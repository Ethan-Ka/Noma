import { app, shell } from 'electron'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Where Holo's touch checks are saved (trackpadGestureService.ts): Noma's
 * own folder on this computer, %APPDATA%/noma/holo-recordings. Only ever
 * written by a touch check the user starts. Nothing uploads it. See
 * docs/privacy-and-legal.md.
 */
export function recordingsFolder(): string {
  return join(app.getPath('userData'), 'holo-recordings')
}

/** When the most recent touch check was saved (ms), or null if none has
 *  been. Read from the folder itself, so it stays true if the user clears
 *  it, and counts checks made before this was tracked. */
export function latestTouchCheckAt(): number | null {
  const folder = recordingsFolder()
  if (!existsSync(folder)) return null
  const times = readdirSync(folder)
    .filter((name) => name.startsWith('touch-check-') && name.endsWith('.json'))
    .map((name) => statSync(join(folder, name)).mtimeMs)
  return times.length ? Math.max(...times) : null
}

export function openRecordingsFolder(): void {
  mkdirSync(recordingsFolder(), { recursive: true })
  void shell.openPath(recordingsFolder())
}

