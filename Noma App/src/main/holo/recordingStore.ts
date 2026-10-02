import { app, shell } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Saves a Holo diagnostic recording (see renderer holoCapture.ts's
 * `HoloRecording`) as a WAV file plus a JSON file of what happened when:
 * which phase the user was in, what Holo decided about each sound, and when
 * they typed or used the trackpad.
 *
 * Only ever called from the Holo page's explicit "Record a test session",
 * and written only to Noma's own folder on this computer
 * (%APPDATA%/noma/holo-recordings). Nothing uploads it. See
 * docs/privacy-and-legal.md.
 */
export function recordingsFolder(): string {
  return join(app.getPath('userData'), 'holo-recordings')
}

export function saveHoloRecording(pcm: Int16Array, sampleRate: number, channels: number, meta: unknown): string {
  const folder = join(recordingsFolder(), new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, 'session.wav'), wavFile(pcm, sampleRate, channels))
  writeFileSync(join(folder, 'session.json'), JSON.stringify(meta, null, 2))
  return folder
}

export function openRecordingsFolder(): void {
  mkdirSync(recordingsFolder(), { recursive: true })
  void shell.openPath(recordingsFolder())
}

/** A standard 16-bit PCM WAV. */
function wavFile(pcm: Int16Array, sampleRate: number, channels: number): Buffer {
  const dataBytes = pcm.length * 2
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataBytes, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * channels * 2, 28)
  header.writeUInt16LE(channels * 2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataBytes, 40)
  return Buffer.concat([header, Buffer.from(pcm.buffer, pcm.byteOffset, dataBytes)])
}
