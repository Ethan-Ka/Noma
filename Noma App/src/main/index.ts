import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

/**
 * Isolated test profile — set NOMA_TEST_USER_DATA_DIR to point Electron's
 * userData (and therefore db.ts's noma.db) at a throwaway directory instead
 * of the real, actively-used profile.
 *
 * This exists because of a real incident: automated testing launched the
 * raw built binary directly, which defaulted to the same userData path the
 * developer's actual daily-use Noma installation uses, and ended up
 * overwriting two real control slots with demo data before anyone noticed.
 * That should be structurally impossible, not something a future session
 * has to remember not to do — hence a hard switch, checked before anything
 * else in this file touches `app`, rather than a convention documented
 * somewhere and hoped for.
 *
 * Must run before `initDatabase()` (db.ts reads `app.getPath('userData')`
 * the moment it's called) and before anything else that could touch real
 * user state — so this sits at the very top of the file, ahead of every
 * other import's side effects that might run first.
 */
const TEST_USER_DATA_DIR = process.env.NOMA_TEST_USER_DATA_DIR
if (TEST_USER_DATA_DIR) {
  app.setPath('userData', TEST_USER_DATA_DIR)
  // eslint-disable-next-line no-console
  console.log(`[TEST MODE] userData redirected to: ${TEST_USER_DATA_DIR}`)
}
import icon from '../../resources/icon.png?asset'
import { IPC_CHANNELS } from '@shared/constants'
import { initDatabase } from './database/db'
import { registerIpcHandlers } from './ipc/handlers'
import { WindowsOSAdapter } from './os/windowsAdapter'
import { ApplicationContextService } from './applications/contextService'
import { getDefaultHardwareDevice } from './hardware/virtualDevice'
import { DeviceTransportServer } from './hardware/deviceTransportServer'
import { CaptureService } from './workflow/captureService'
import { ClickCaptureService } from './workflow/clickCaptureService'
import { UiaClickInspector } from './workflow/uiaInspector'
import { InputActivityService } from './holo/inputActivityService'
import { getLaptopInfo } from './holo/laptopInfo'
import { insertWorkflowEvent } from './database/repositories/workflowEventsRepository'
import { getClickCaptureEnabled, getWorkflowMonitoringEnabled } from './database/repositories/settingsRepository'
import { getSuggestionHistoryForKind, getPendingSuggestions } from './database/repositories/suggestionsRepository'
import { simulateDemoMultiStepWorkflow } from './demo/demoService'
import { getApplicationById } from './database/repositories/applicationsRepository'
import { LocalRuleBasedProvider } from './ai/localProvider'
import { SuggestionEngine } from './ai/suggestionEngine'
import { executeControlAction } from './actions/actionExecutor'
import { WorkflowNotifier } from './notifications/workflowNotifier'
import {
  closeWorkflowNoticeWindow,
  getPendingWorkflowNotice,
  setWorkflowNoticeInteractive
} from './notifications/notificationWindow'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
/** False until a real quit is underway (tray "Quit Noma", OS shutdown, or
 *  Cmd+Q) — while false, the window's own close button hides it instead of
 *  exiting the app. See `createTray` and `createMainWindow`'s `close`
 *  handler. */
let isQuitting = false
/** The last application a genuine appSwitch WorkflowEvent was recorded for
 *  (see contextService.onContextChanged below) — distinct from
 *  contextService's own `current`, which also updates for reasons that
 *  aren't a real switch (a control reassignment's same-app context
 *  refresh, Demo Mode handing control back to the real OS adapter). Lets
 *  that listener record one row per genuine switch, not one per emission. */
let lastRecordedApplicationId: string | null = null

/** Feeds Holo the timestamps (only) of real key/mouse activity so it can
 *  ignore the sound of typing, clicking and trackpad use. Engaged only while
 *  Holo asks. */
const inputActivityService = new InputActivityService(
  (timestamp) => {
    mainWindow?.webContents.send(IPC_CHANNELS.HOLO_INPUT_ACTIVITY, timestamp)
  },
  () => mainWindow
)

const osAdapter = new WindowsOSAdapter()
const contextService = new ApplicationContextService(osAdapter)
const hardwareDevice = getDefaultHardwareDevice()
const deviceTransportServer = new DeviceTransportServer(hardwareDevice)
const aiProvider = new LocalRuleBasedProvider(
  getSuggestionHistoryForKind,
  (applicationId) => getApplicationById(applicationId)?.name ?? null
)
const suggestionEngine = new SuggestionEngine(aiProvider)

/**
 * Noma Notice. Nothing about detection changed to add this — the notifier
 * only reads the suggestions the engine already produced and decides whether
 * one of them has been seen often enough to be worth saying out loud while
 * the user is working somewhere else.
 */
const workflowNotifier = new WorkflowNotifier(() => {
  mainWindow?.webContents.send(IPC_CHANNELS.SUGGESTIONS_CHANGED, getPendingSuggestions())
})

/** Re-runs pattern detection -> suggestion generation, then pushes the
 *  (possibly updated) pending list to the renderer. Called after every
 *  captured workflow event — see docs/architecture.md's learning loop. */
async function refreshSuggestions(): Promise<void> {
  const patterns = await suggestionEngine.refresh()
  mainWindow?.webContents.send(IPC_CHANNELS.SUGGESTIONS_CHANGED, getPendingSuggestions())
  // Reuses the patterns that pass already detected rather than running
  // detection again — and runs after the push, so the app is never showing
  // a stale list behind a notice that's already on screen.
  workflowNotifier.review(patterns)
}

const captureService = new CaptureService((event) => {
  insertWorkflowEvent({
    applicationId: event.applicationId,
    eventType: 'shortcut',
    comboKeys: event.comboKeys,
    timestamp: event.timestamp
  })
  void refreshSuggestions()
  // Improved Virtual Keyboard: let the decorative layout flash the real
  // keys of this real captured combo. Nothing new is exposed here — this
  // is exactly the already-sanitized combo insertWorkflowEvent just
  // persisted, not a raw keystroke.
  mainWindow?.webContents.send(IPC_CHANNELS.WORKFLOW_COMBO_CAPTURED, event.comboKeys)
})

/** Opt-in (settingsRepository's clickCaptureEnabled, off by default) and only
 *  ever engaged alongside workflow monitoring: records which on-screen
 *  control was clicked, sanitized to a label or a coarse window zone — see
 *  workflow/clickTarget.ts and docs/privacy-and-legal.md. */
const clickCaptureService = new ClickCaptureService((event) => {
  insertWorkflowEvent({
    applicationId: event.applicationId,
    eventType: 'click',
    clickTarget: event.clickTarget,
    timestamp: event.timestamp
  })
  void refreshSuggestions()
}, new UiaClickInspector())

/**
 * A control usually fires while the user is in some other app (that's the
 * point of a physical key or a Holo tap), where the in-app "✗ failed" line
 * on the Virtual Keyboard page is invisible. A workflow that stops partway
 * without saying so leaves the user not knowing what did and didn't
 * happen, so a failure there gets a Windows notification instead. Only when
 * Noma's own window isn't the one being looked at, and only for failures:
 * a success is already visible in whatever the action did.
 */
function notifyActionFailed(controlLabel: string, reason: string | undefined): void {
  if (mainWindow?.isVisible() && mainWindow.isFocused()) return
  if (!Notification.isSupported()) return
  new Notification({
    title: `Noma couldn't finish “${controlLabel}”`,
    body: reason ?? 'The action failed.',
    silent: true
  }).show()
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#08080a',
    title: TEST_USER_DATA_DIR ? 'Noma — TEST PROFILE' : 'Noma',
    // Windows/Linux taskbar + window icon. macOS instead uses the app
    // bundle's icon (set at packaging time), which doesn't exist yet — see
    // "Prepare for STM32"/packaging notes; this only affects the
    // dev/unpackaged window on this machine.
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Explicit, not relied-on-as-default: no Node access in the
      // renderer, isolated from the preload's JS context, and Chromium's
      // OS-level sandbox enabled. See docs/security-review.md.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Holo listens for taps while the user works in *other* apps, with
      // this window minimized or hidden. Chromium otherwise throttles
      // timers in a hidden window to ~1/s, which would drop or delay taps.
      backgroundThrottling: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // The renderer's own <title>Noma</title> would otherwise overwrite the
  // constructor's `title` option the instant the page loads — this is the
  // one place that's allowed to win, so "TEST PROFILE" actually stays
  // visible for the whole session rather than flashing briefly on launch.
  if (TEST_USER_DATA_DIR) {
    mainWindow.on('page-title-updated', (event) => {
      event.preventDefault()
    })
  }

  // Noma is meant to run in the background (see PRODUCT.md's "infrastructure
  // that is always present," and Flow/Holo both keep working with no window
  // open at all). The minimize button and the close button both hide the
  // window instead of minimizing/quitting — reopening happens from the tray
  // icon's "Open Noma" (or a click on the icon itself), same as any other
  // background-utility app. A real quit only happens via the tray's "Quit
  // Noma" or the OS shutting the app down, both of which set `isQuitting`
  // first.
  // 'minimize' itself isn't cancelable (no `event` to preventDefault — see
  // Electron's typings), so this rides along right after: the taskbar entry
  // blinks for an instant, then `hide()` removes it entirely and the window
  // is reachable only from the tray from here on.
  mainWindow.on('minimize', () => {
    mainWindow?.hide()
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    // The notice window is hidden rather than closed between notices, so it
    // would otherwise still be in getAllWindows() here — 'window-all-closed'
    // would never fire and Noma would linger invisibly after a real quit.
    // Only reached now once `isQuitting` is true (see the `close` handler
    // above) — an ordinary close hides the window instead of destroying it.
    closeWorkflowNoticeWindow()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Un-hides the main window, creating it first if it was never opened this
 *  run — the one path both the tray icon and Noma Notice's "Review" use. */
function showMainWindow(): void {
  if (!mainWindow) createMainWindow()
  mainWindow?.show()
  mainWindow?.focus()
}

/**
 * The reopen path for a minimized/closed Noma — see the `minimize`/`close`
 * handlers above. A left-click toggles (matches most Windows tray icons:
 * Discord, Slack); the context menu (right-click, or Electron's own
 * left-click fallback on Linux) spells the same action out in words, plus
 * the only real way left to quit the app.
 */
function createTray(): void {
  const trayIcon = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  tray.setToolTip(TEST_USER_DATA_DIR ? 'Noma — TEST PROFILE, running in the background' : 'Noma — running in the background')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Noma', click: () => showMainWindow() },
      { type: 'separator' },
      // Flips `isQuitting` via the app-wide `before-quit` listener, not
      // here directly — the same flag has to be true for an OS shutdown or
      // Cmd+Q to actually exit too, not just this menu item.
      { label: 'Quit Noma', click: () => app.quit() }
    ])
  )
  tray.on('click', () => {
    if (mainWindow?.isVisible()) mainWindow.hide()
    else showMainWindow()
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.noma.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDatabase()
  ipcMain.handle(IPC_CHANNELS.GET_LAPTOP_INFO, () => getLaptopInfo())
  ipcMain.handle(IPC_CHANNELS.HOLO_SET_INPUT_GATE, (_event, enabled: boolean) => {
    if (enabled) return inputActivityService.start()
    inputActivityService.stop()
    return null
  })

  // Noma Notice. Registered here rather than in registerIpcHandlers because,
  // like the two above, these belong to a window this file owns.
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_NOTICE_DISMISS,
    (_event, suggestionId: string, reason: 'timeout' | 'closed' | 'dismissed' | 'reviewed') => {
      workflowNotifier.dismiss(suggestionId, reason)
    }
  )
  ipcMain.handle(IPC_CHANNELS.WORKFLOW_NOTICE_PENDING, () => getPendingWorkflowNotice())
  ipcMain.handle(IPC_CHANNELS.WORKFLOW_NOTICE_SET_INTERACTIVE, (_event, interactive: boolean) => {
    setWorkflowNoticeInteractive(interactive)
  })
  ipcMain.handle(IPC_CHANNELS.WORKFLOW_NOTICE_REVIEW, (_event, suggestionId: string) => {
    // Accepting ends in choosing which control slot the workflow lives on,
    // and a 400px card floating over someone's work is the wrong place to
    // ask that. This is the one interaction that deliberately brings the
    // main window forward — because the user just asked for it.
    workflowNotifier.dismiss(suggestionId, 'reviewed')
    showMainWindow()
    mainWindow?.webContents.send(IPC_CHANNELS.OPEN_SUGGESTION_IN_APP, suggestionId)
  })
  ipcMain.handle(IPC_CHANNELS.SIMULATE_WORKFLOW_NOTICE, async () => {
    // Demo Mode: replay the real demo workflow through the real pipeline,
    // then put its real suggestion on screen — the threshold and cooldown
    // are the only things bypassed, so what appears is the production
    // surface with production data, not a mock.
    simulateDemoMultiStepWorkflow()
    await refreshSuggestions()
    // The most-repeated multi-application workflow, which after that replay
    // is the demo one — picked by the same "which workflow matters most"
    // rule the real policy uses, rather than by hardcoding the demo's id.
    const workflow = getPendingSuggestions()
      .filter((suggestion) => suggestion.chainApplicationNames)
      .sort((a, b) => (b.occurrenceCount ?? 0) - (a.occurrenceCount ?? 0) || b.confidence - a.confidence)[0]
    if (workflow) workflowNotifier.simulate(workflow, workflow.occurrenceCount ?? 0)
  })
  registerIpcHandlers(
    contextService,
    captureService,
    clickCaptureService,
    suggestionEngine,
    (applicationId) => {
      // A control was just reassigned (e.g. accepting a suggestion, or
      // saving an edit in the Control Mapping Editor). If it belongs to
      // whichever application is currently focused, the onContextChanged
      // listener below (hardware controls + IPC push) fires the same way
      // it would for a normal app switch — the user doesn't have to
      // Alt-Tab away and back to see their own change.
      contextService.refreshIfCurrentApplication(applicationId)
    },
    () => osAdapter.getLastKnownWindowHandle(),
    refreshSuggestions
  )

  // Application context -> hardware simulator + capture service: whenever
  // the foreground application (and its resolved profile) changes,
  // reflect it on the virtual device exactly as a real STM32 device would
  // need to be told, and tag any subsequently-captured shortcuts with it.
  contextService.onContextChanged((context) => {
    void hardwareDevice.setControls(context.profile?.controls ?? [])
    void hardwareDevice.updateDisplay('status', context.application?.name ?? 'Idle')
    captureService.setCurrentApplicationId(context.application?.id ?? null)
    clickCaptureService.setCurrentApplicationId(context.application?.id ?? null)

    // Which app the user just moved into is workflow metadata like any
    // other captured event — Flow needs it to recognize workflows that
    // span multiple applications (e.g. a screenshot tool -> an editor -> a
    // git client), not only the shortcuts pressed within one. Only
    // recorded on a genuine change (this listener also re-fires for a
    // same-app profile refresh and Demo Mode's hand-back-to-real-OS
    // resync — neither is a real switch) so one real switch is one row,
    // the same way a control activation is logged once per press. Still
    // exactly `{ applicationId, timestamp }` — see docs/privacy-and-legal.md.
    const newApplicationId = context.application?.id ?? null
    if (getWorkflowMonitoringEnabled() && newApplicationId !== lastRecordedApplicationId) {
      insertWorkflowEvent({ applicationId: newApplicationId, eventType: 'appSwitch', timestamp: Date.now() })
      void refreshSuggestions()
    }
    lastRecordedApplicationId = newApplicationId

    mainWindow?.webContents.send(IPC_CHANNELS.ACTIVE_CONTEXT_CHANGED, context)
  })
  contextService.start()

  hardwareDevice.onStatusChanged((status) => {
    mainWindow?.webContents.send(IPC_CHANNELS.HARDWARE_STATUS_CHANGED, status)
  })
  hardwareDevice.onLogEntry((entry) => {
    mainWindow?.webContents.send(IPC_CHANNELS.DEVICE_LOG_ENTRY, entry)
  })
  hardwareDevice.onDeviceEvent((event) => {
    mainWindow?.webContents.send(IPC_CHANNELS.DEVICE_EVENT, event)

    if (event.type === 'buttonPress') {
      // A control activation is workflow metadata like any other — log it
      // under the same enabled/disabled toggle as shortcut capture, tagged
      // with whichever application was active when it happened.
      if (getWorkflowMonitoringEnabled()) {
        insertWorkflowEvent({
          applicationId: contextService.getContext().application?.id ?? null,
          eventType: 'controlActivation',
          controlId: event.controlId,
          timestamp: Date.now()
        })
        void refreshSuggestions()
      }

      // This is the "not just a pretty animation" step: actually run
      // whatever this control is configured to do, against whichever real
      // application was last focused (Flow's own window is excluded from
      // detection specifically so this handle always points at that real
      // target — see windowsAdapter.ts).
      const control = contextService
        .getContext()
        .profile?.controls.find((item) => item.id === event.controlId)
      if (control) {
        void executeControlAction(control.action, osAdapter.getLastKnownWindowHandle()).then(
          (result) => {
            if (!result.ok) notifyActionFailed(control.label, result.reason)
            mainWindow?.webContents.send(IPC_CHANNELS.ACTION_EXECUTED, {
              controlId: event.controlId,
              ok: result.ok,
              reason: result.reason
            })
            deviceTransportServer.notifyActionExecuted({
              controlId: event.controlId,
              ok: result.ok,
              reason: result.reason
            })

            // Flash the decorative keyboard layout's keys — the same
            // "digital twin reacts to real input" feedback a genuinely
            // captured shortcut gets, driven directly from the control's
            // own configured keys. This used to happen "for free" because
            // captureService's global hook picked up the control's own
            // synthetic keystroke and echoed it back as a captured combo —
            // exactly the double-counting selfInjectedKeys.ts was written
            // to stop (see docs/architecture.md's "Real execution"
            // section), which correctly silenced that echo and, as a side
            // effect, silently took this cosmetic flash down with it. Only
            // fires on a real successful send (`result.ok`), matching what
            // the old accidental path actually did — a failed send never
            // reaches uIOhook.keyTap, so it never flashed either.
            if (result.ok && control.action.type === 'shortcut' && control.action.keys.length > 0) {
              mainWindow?.webContents.send(IPC_CHANNELS.WORKFLOW_COMBO_CAPTURED, control.action.keys)
            }
          }
        )
      }
    }
  })
  // The device no longer auto-connects here — it starts disconnected
  // ("no keyboard attached") and DeviceTransportServer connects/
  // disconnects it as the standalone Noma Virtual Device app actually
  // attaches/detaches, the same way a real USB keyboard would.
  void deviceTransportServer.start()

  // Workflow monitoring is off by default (see docs/privacy-and-legal.md).
  // Only re-engage the global hook here if the user previously opted in.
  if (getWorkflowMonitoringEnabled()) {
    captureService.start()
    if (getClickCaptureEnabled()) clickCaptureService.start()
  }

  createMainWindow()
  createTray()

  app.on('activate', function () {
    // Minimizing/closing now hides the window rather than destroying it
    // (see createMainWindow's `minimize`/`close` handlers), so on macOS a
    // dock click most often finds one already open, just hidden — show it
    // instead of leaving `getAllWindows().length === 0` as the only check,
    // which would never fire again once the first window exists.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    else showMainWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  captureService.stop()
  clickCaptureService.stop()
  contextService.stop()
  deviceTransportServer.stop()
  osAdapter.dispose()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
