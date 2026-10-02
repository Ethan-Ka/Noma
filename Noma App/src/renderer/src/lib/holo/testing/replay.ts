import type { HoloCalibration, HoloZone } from '@shared/types'
import {
  blockEnergy,
  buildDiscriminant,
  classifyZone,
  createOnsetDetectorState,
  DEFAULT_GATES,
  detectImpact,
  detectOnset,
  extractTapFeatures,
  relaxGates,
  tapPeakDb,
  trainingTaps,
  type ClassificationResult,
  type HoloSensitivity,
  type ImpactCheck
} from '../classifier'

/**
 * Replays a diagnostic recording (the Holo page's "Record a test session")
 * through the same detection and classification code the app runs live, so
 * a change can be scored on real taps and real non-taps from a real laptop.
 *
 * Mirrors holoCapture.ts's timing: 512-frame blocks, the onset detector, the
 * refractory window, features read from the window ending FINALIZE_DELAY
 * after the onset, and the typing/trackpad gate. Kept in step with it by
 * hand; if holoCapture's constants change, change them here too.
 */
const BLOCK_FRAMES = 512
const TAP_WINDOW_FRAMES = 12288
const FINALIZE_DELAY_MS = 190
const TAP_REFRACTORY_MS = 220
const INPUT_GATE_MS = 220
const UNMUTE_SETTLE_MS = 120

export interface RecordingMeta {
  sampleRate: number
  channels: number
  phases: Array<{ kind: 'zone' | 'singles' | 'everyday' | 'typing'; zone?: HoloZone; startMs: number; endMs: number }>
  inputActivityMs: number[]
  events?: Array<{ onsetMs: number; outcome: string; zone: HoloZone | null; reason: string }>
}

export interface ReplayedSound {
  onsetMs: number
  /** The zone the user was asked to tap in this phase, or null in a no-tap phase. */
  label: HoloZone | null
  phase: string
  ignoredByInput: boolean
  features: number[] | null
  peakDb: number
  impact: ImpactCheck | null
}

/** Finds every sound Holo's detector would have picked up, with what the
 *  classifier needs about each. */
export function detectSounds(
  pcm: Int16Array,
  meta: RecordingMeta,
  sensitivity: HoloSensitivity = 'medium'
): ReplayedSound[] {
  const { sampleRate: sr, channels } = meta
  const frames = Math.floor(pcm.length / channels)
  const channel = (c: number, from: number, to: number): Float32Array => {
    const out = new Float32Array(Math.max(0, to - from))
    for (let i = from; i < to; i++) out[i - from] = i >= 0 ? pcm[i * channels + c] / 32767 : 0
    return out
  }
  const detector = createOnsetDetectorState()
  const sounds: ReplayedSound[] = []
  let lastOnsetMs = -Infinity
  let pendingUntil = -Infinity
  let settleUntilMs = 0
  let wasMuted = false

  for (let start = 0; start + BLOCK_FRAMES <= frames; start += BLOCK_FRAMES) {
    const endMs = ((start + BLOCK_FRAMES) / sr) * 1000
    let energy = 0
    let silent = true
    for (let c = 0; c < channels; c++) {
      const block = channel(c, start, start + BLOCK_FRAMES)
      if (silent && block.some((v) => v !== 0)) silent = false
      energy = Math.max(energy, blockEnergy(block))
    }
    // The live engine mutes the mic while the user types, which records as
    // exact zeros, and skips the detector then and for a moment after.
    if (silent) {
      wasMuted = true
      continue
    }
    if (wasMuted) {
      wasMuted = false
      settleUntilMs = endMs + UNMUTE_SETTLE_MS
    }
    if (endMs < settleUntilMs) continue

    const isOnset = detectOnset(energy, detector, sensitivity)
    if (!isOnset || endMs < pendingUntil || endMs - lastOnsetMs < TAP_REFRACTORY_MS) continue
    lastOnsetMs = endMs
    pendingUntil = endMs + FINALIZE_DELAY_MS

    const finalizeFrame = Math.min(frames, Math.round(((endMs + FINALIZE_DELAY_MS) / 1000) * sr))
    const windows = Array.from({ length: channels }, (_, c) => channel(c, finalizeFrame - TAP_WINDOW_FRAMES, finalizeFrame))
    const phase = meta.phases.find((p) => endMs >= p.startMs && endMs < p.endMs)
    sounds.push({
      onsetMs: endMs,
      label: phase?.kind === 'zone' ? (phase.zone ?? null) : null,
      phase: phase ? (phase.kind === 'zone' ? `zone:${phase.zone}` : phase.kind) : 'none',
      ignoredByInput: meta.inputActivityMs.some((t) => Math.abs(t - endMs) <= INPUT_GATE_MS),
      features: extractTapFeatures(windows, new Array(channels).fill(0), sr),
      peakDb: tapPeakDb(windows),
      impact: detectImpact(windows, sr)
    })
  }
  return sounds
}

/** Classifies replayed sounds against a calibration, as the live engine would. */
export function classifySounds(
  sounds: ReplayedSound[],
  calibration: HoloCalibration,
  sensitivity: HoloSensitivity = 'medium'
): Array<ReplayedSound & { result: ClassificationResult | null }> {
  const discriminant = buildDiscriminant(trainingTaps(calibration.zones), calibration.scale)
  const gates = relaxGates(calibration.gates ?? DEFAULT_GATES, sensitivity)
  return sounds.map((sound) => ({
    ...sound,
    result:
      sound.ignoredByInput || !sound.features
        ? null
        : classifyZone(sound.features, calibration.zones, calibration.scale, {
            weights: calibration.weights,
            gates,
            peakDb: sound.peakDb,
            impact: sound.impact ?? undefined,
            negatives: calibration.ignoredSounds,
            discriminant
          })
  }))
}

/** Reads a 16-bit PCM WAV (as written by main/holo/recordingStore.ts). */
export function parseWav(buffer: Uint8Array): { pcm: Int16Array; sampleRate: number; channels: number } {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const channels = view.getUint16(22, true)
  const sampleRate = view.getUint32(24, true)
  const dataBytes = view.getUint32(40, true)
  const pcm = new Int16Array(dataBytes / 2)
  for (let i = 0; i < pcm.length; i++) pcm[i] = view.getInt16(44 + i * 2, true)
  return { pcm, sampleRate, channels }
}
