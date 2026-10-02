import { describe, expect, it } from 'vitest'
import { detectSounds, parseWav, type RecordingMeta } from './replay'
import { PALM_SPOTS, SIM_SAMPLE_RATE, simulateNonTap, simulateTap } from './tapSimulator'

/** A fake recording: taps pasted into silence-plus-noise at known times. */
function session(): { pcm: Int16Array; meta: RecordingMeta; tapTimesMs: number[] } {
  const seconds = 12
  const frames = seconds * SIM_SAMPLE_RATE
  const samples = new Float32Array(frames)
  let seed = 1
  for (let i = 0; i < frames; i++) samples[i] = ((((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1) * 0.0008)
  const tapTimesMs: number[] = []
  const paste = (audio: Float32Array, atMs: number): void => {
    // The simulated sound's onset sits around frame 1000 of its window.
    const offset = Math.round((atMs / 1000) * SIM_SAMPLE_RATE) - 1000
    for (let i = 0; i < audio.length; i++) if (offset + i >= 0 && offset + i < frames) samples[offset + i] += audio[i]
  }
  for (let k = 0; k < 4; k++) {
    const at = 1000 + k * 1000
    paste(simulateTap(PALM_SPOTS.left, { seed: 10 + k, force: 0.7 }), at)
    tapTimesMs.push(at)
  }
  paste(simulateNonTap('clap', { seed: 3 }), 8000)
  const pcm = new Int16Array(frames)
  for (let i = 0; i < frames; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767)
  const meta: RecordingMeta = {
    sampleRate: SIM_SAMPLE_RATE,
    channels: 1,
    phases: [
      { kind: 'zone', zone: 'frontLeft', startMs: 0, endMs: 6000 },
      { kind: 'everyday', startMs: 6000, endMs: 12000 }
    ],
    // A keystroke right at the clap: the replay must gate it like the app does.
    inputActivityMs: [8010]
  }
  return { pcm, meta, tapTimesMs }
}

describe('replaying a diagnostic recording', () => {
  it('finds each tap near when it happened, labelled with the phase it was in', () => {
    const { pcm, meta, tapTimesMs } = session()
    const sounds = detectSounds(pcm, meta)
    const taps = sounds.filter((sound) => sound.label === 'frontLeft')
    expect(taps).toHaveLength(tapTimesMs.length)
    taps.forEach((tap, i) => expect(Math.abs(tap.onsetMs - tapTimesMs[i])).toBeLessThan(40))
    expect(taps.every((tap) => tap.features !== null && tap.impact !== null)).toBe(true)
  })

  it('applies the typing gate to a sound that coincides with a keystroke', () => {
    const { pcm, meta } = session()
    const clap = detectSounds(pcm, meta).find((sound) => sound.phase === 'everyday')
    expect(clap?.ignoredByInput).toBe(true)
  })

  it('reads back a WAV in the format the app writes', () => {
    const pcm = new Int16Array([0, 1000, -1000, 32767])
    const header = new Uint8Array(44)
    const view = new DataView(header.buffer)
    view.setUint16(22, 1, true)
    view.setUint32(24, 48000, true)
    view.setUint32(40, pcm.length * 2, true)
    const bytes = new Uint8Array(44 + pcm.length * 2)
    bytes.set(header)
    bytes.set(new Uint8Array(pcm.buffer), 44)
    const parsed = parseWav(bytes)
    expect(parsed.sampleRate).toBe(48000)
    expect(Array.from(parsed.pcm)).toEqual([0, 1000, -1000, 32767])
  })
})
