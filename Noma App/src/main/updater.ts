import { app, Notification, shell } from 'electron'
import { execFile } from 'child_process'
import { dirname } from 'path'
import { autoUpdater } from 'electron-updater'
import { isMac } from './platform'

/** Where pilot builds are published (electron-builder.yml's `publish`). */
const RELEASES_URL = 'https://github.com/awnsh/Noma/releases/latest'
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/**
 * Keeps installed pilot/beta copies up to date from GitHub Releases, which
 * CI fills for Windows and macOS from the same tag (see RELEASING.md).
 *
 * Windows: downloads in the background and installs when Noma quits (or
 * right away from the tray's "Restart to update").
 *
 * macOS: only an app signed with an Apple Developer ID can replace itself —
 * macOS refuses a self-update of an ad-hoc signed build. So an unsigned
 * build doesn't download anything; it shows a notification that opens the
 * download page instead. Once the Mac build is signed (see RELEASING.md),
 * it updates itself exactly like Windows, with no code change.
 *
 * Never runs in development or against the isolated test profile.
 */
export function startAutoUpdates(onReadyToInstall: (version: string) => void): void {
  if (!app.isPackaged || process.env.NOMA_TEST_USER_DATA_DIR) return

  void canSelfUpdate().then((selfUpdate) => {
    autoUpdater.autoDownload = selfUpdate
    autoUpdater.autoInstallOnAppQuit = selfUpdate
    // Failures (offline, GitHub rate limit) are retried at the next check;
    // never worth interrupting the user for.
    autoUpdater.on('error', () => {})

    if (selfUpdate) {
      autoUpdater.on('update-downloaded', (info) => {
        onReadyToInstall(info.version)
        notify(`Noma ${info.version} is ready`, 'It installs the next time Noma quits, or now from the tray menu.')
      })
    } else {
      let announced: string | null = null
      autoUpdater.on('update-available', (info) => {
        if (announced === info.version) return
        announced = info.version
        notify(`Noma ${info.version} is available`, 'Click to download the new version.', () => {
          void shell.openExternal(RELEASES_URL)
        })
      })
    }

    const check = (): void => {
      autoUpdater.checkForUpdates().catch(() => {})
    }
    check()
    setInterval(check, CHECK_INTERVAL_MS)
  })
}

/** Quits and installs a downloaded update. */
export function installUpdateNow(): void {
  autoUpdater.quitAndInstall()
}

/** Windows always can; macOS only when the app carries a Developer ID
 *  signature (an ad-hoc signed app can't replace itself there). */
function canSelfUpdate(): Promise<boolean> {
  if (!isMac) return Promise.resolve(true)
  // .../Noma.app/Contents/MacOS/Noma -> .../Noma.app
  const bundle = dirname(dirname(dirname(process.execPath)))
  return new Promise((resolve) => {
    execFile('codesign', ['-dv', '--verbose=2', bundle], { timeout: 5000 }, (_error, stdout, stderr) => {
      resolve(`${stdout}${stderr}`.includes('Authority=Developer ID Application'))
    })
  })
}

function notify(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({ title, body, silent: true })
  if (onClick) notification.on('click', onClick)
  notification.show()
}
