import {
  GA_ROOT,
  GetAncestor,
  GetForegroundWindow,
  GetWindowRect,
  IsWindow,
  SendInput,
  SetCursorPos,
  WindowFromPoint,
  INPUT_MOUSE,
  INPUT_SIZE,
  MOUSEEVENTF_LEFTDOWN,
  MOUSEEVENTF_LEFTUP
} from './win32'
import { ZONE_COLUMNS, ZONE_ROWS, MIN_WINDOW_SIZE, type ScreenRect } from '../workflow/clickTarget'
import { markSelfInjectedClick } from '../workflow/selfInjectedClicks'
import { getApplicationById } from '../database/repositories/applicationsRepository'
import { processForWindow, sameProcess } from './windowProcess'
import { uiaControlFinder } from './uiaControlFinder'
import type { ExecutionResult } from './actionExecutor'

/** A window minimized (or otherwise off-screen) reports coordinates around
 *  -32000 on Windows — nowhere close to a real, clickable position. */
const OFFSCREEN_COORD_THRESHOLD = -30000

/** How long a named control may take to appear. A replayed step often
 *  follows one that opens something (a menu, a panel, a dialog), and the
 *  app needs a moment to draw it; the search is repeated until then. */
const FIND_WAIT_MS = 2000
const FIND_RETRY_MS = 200

/**
 * Real click replay for a learned workflow's `click` MacroStep.
 *
 * Every click is checked before it happens, and refuses (the macro stops
 * there, with the reason shown) rather than click somewhere it can't vouch
 * for. A click can trigger something irreversible, so a missed step is
 * always the better failure than a misdirected one.
 *
 * 1. **The right app is in front.** When the step knows which application
 *    it was recorded in (`applicationId`), the foreground window must
 *    belong to that app's process. Otherwise, e.g. if a focus step before
 *    it lost a race with a notification, the click would land in whatever
 *    happened to be on top.
 * 2. **`label:<name>` — the same control, found again.** The named button
 *    or menu item is looked up afresh by UI Automation in that app's
 *    windows (uiaControlFinder.ts), so it's found wherever it is *now*:
 *    after a window resize, a moved toolbar or a different screen. It must
 *    be exactly one enabled, visible control with that name; none (after
 *    waiting FIND_WAIT_MS for it to appear) or several both refuse. The
 *    found point must also belong to the app's own window, so a popup
 *    covering the button can't receive the click instead.
 * 3. **`zone:<col>x<row>` — a position.** Only recorded where the app
 *    exposes no named controls (custom-drawn UIs). Mapped onto the
 *    foreground window's *current* bounds, so a moved or resized window
 *    still gets the same relative spot. This one is approximate by design:
 *    Noma never records exact pixels (see clickTarget.ts).
 */
export async function executeClick(target: string, applicationId?: string): Promise<ExecutionResult> {
  const hwnd = GetForegroundWindow()
  const owner = processForWindow(hwnd)

  if (applicationId) {
    const application = getApplicationById(applicationId)
    if (!application) return { ok: false, reason: 'The app this click was recorded in is no longer known to Noma' }
    if (!owner || !sameProcess(owner.processName, application.processName)) {
      return {
        ok: false,
        reason: `Expected ${application.name} to be in front, but ${owner?.processName || 'another window'} was. Nothing was clicked`
      }
    }
  }

  if (target.startsWith('label:')) return clickNamedControl(target.slice('label:'.length), owner?.pid ?? null)

  const match = /^zone:(\d+)x(\d+)$/.exec(target)
  if (!match) return { ok: false, reason: 'Unrecognized click target' }
  const col = Number(match[1])
  const row = Number(match[2])
  if (col < 0 || col >= ZONE_COLUMNS || row < 0 || row >= ZONE_ROWS) {
    return { ok: false, reason: 'Click target is outside the recorded grid' }
  }

  const rect = windowRect(hwnd)
  if (!rect) {
    return { ok: false, reason: 'Could not find the focused window on screen right now (it may be minimized)' }
  }
  const width = rect.right - rect.left
  const height = rect.bottom - rect.top
  const x = rect.left + Math.round(((col + 0.5) / ZONE_COLUMNS) * width)
  const y = rect.top + Math.round(((row + 0.5) / ZONE_ROWS) * height)
  return sendClick(x, y)
}

async function clickNamedControl(label: string, processId: number | null): Promise<ExecutionResult> {
  if (processId === null) return { ok: false, reason: `Could not tell which app is in front to look for “${label}”` }

  const deadline = Date.now() + FIND_WAIT_MS
  for (;;) {
    const found = await uiaControlFinder.find(processId, label)
    if (found.status === 'found') {
      const atPoint = GetAncestor(WindowFromPoint({ x: found.x, y: found.y }), GA_ROOT)
      if (processForWindow(atPoint)?.pid !== processId) {
        return { ok: false, reason: `Something is covering “${label}”. Nothing was clicked` }
      }
      return sendClick(found.x, found.y)
    }
    if (found.status === 'several') {
      return { ok: false, reason: `Found ${found.count} buttons named “${label}” and couldn't tell which one. Nothing was clicked` }
    }
    if (found.status === 'unavailable') {
      return { ok: false, reason: `Couldn't search the app for “${label}” (Windows UI Automation didn't answer)` }
    }
    if (Date.now() >= deadline) {
      return { ok: false, reason: `Couldn't find “${label}” in the app. It may be hidden, disabled or renamed` }
    }
    await new Promise((resolve) => setTimeout(resolve, FIND_RETRY_MS))
  }
}

function sendClick(x: number, y: number): ExecutionResult {
  markSelfInjectedClick()
  SetCursorPos(x, y)
  const events = [mouseEvent(MOUSEEVENTF_LEFTDOWN), mouseEvent(MOUSEEVENTF_LEFTUP)]
  const sent: number = SendInput(events.length, events, INPUT_SIZE)
  return sent === events.length ? { ok: true } : { ok: false, reason: 'The OS refused the synthetic click' }
}

function windowRect(hwnd: number): ScreenRect | null {
  if (!IsWindow(hwnd)) return null
  const rect: ScreenRect = { left: 0, top: 0, right: 0, bottom: 0 }
  if (!GetWindowRect(hwnd, rect)) return null
  if (rect.left <= OFFSCREEN_COORD_THRESHOLD || rect.top <= OFFSCREEN_COORD_THRESHOLD) return null

  const width = rect.right - rect.left
  const height = rect.bottom - rect.top
  if (width < MIN_WINDOW_SIZE || height < MIN_WINDOW_SIZE) return null
  return rect
}

function mouseEvent(flags: number): {
  type: number
  u: { mi: { dx: number; dy: number; mouseData: number; dwFlags: number; time: number; dwExtraInfo: number } }
} {
  return { type: INPUT_MOUSE, u: { mi: { dx: 0, dy: 0, mouseData: 0, dwFlags: flags, time: 0, dwExtraInfo: 0 } } }
}
