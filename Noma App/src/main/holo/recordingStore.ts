import { app, shell } from 'electron'
import { mkdirSync } from 'fs'
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

export function openRecordingsFolder(): void {
  mkdirSync(recordingsFolder(), { recursive: true })
  void shell.openPath(recordingsFolder())
}

