/**
 * Test-only desk simulator for Holo's accuracy benchmarks.
 *
 * Deliberately harder than a pure tone per zone, and shaped by the physics
 * that actually separates two spots on one desk:
 *
 * - Every spot excites the *same* desk resonances (it's one desk), differing
 *   only slightly in how strongly each mode rings.
 * - What really differs is the first millisecond or two: the direct
 *   "click" travels a different path to the mic (a spot further away sounds
 *   duller) and arrives with a different early reflection (a comb filter at
 *   a spot-specific delay).
 * - Tap force varies ~5x, and harder taps are brighter.
 * - The knuckle never lands on exactly the same square centimetre twice, so
 *   the reflection delay and mode balance jitter from tap to tap.
 *
 * This is not real audio, and a score here is not a real-world accuracy.
 * What it can show is whether a change to the pipeline helps or hurts
 * against the kind of difference real zones have, instead of against
 * differences the tests invented to be easy.
 */

export const SIM_SAMPLE_RATE = 48000
export const SIM_WINDOW = 12288

export function makeRng(seed: number): () => number {
  // Hash the seed first: consecutive seeds fed straight into an LCG give
  // nearly identical first draws, which once made every calibration tap in
  // a run the same force.
  let state = seed >>> 0
  state = Math.imul(state ^ (state >>> 16), 0x45d9f3b) >>> 0
  state = Math.imul(state ^ (state >>> 16), 0x45d9f3b) >>> 0
  state = (state ^ (state >>> 16)) >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export interface SimSpot {
  /** Low-pass cutoff of the direct click, Hz (nearer the mic = brighter). */
  clickCutoffHz: number
  /** Delay of the strongest early reflection, ms. */
  reflectionMs: number
  reflectionGain: number
  /** Per-mode gain on the shared desk resonances. */
  modeGains: number[]
  /** How loud the click is relative to the desk ringing. */
  clickGain: number
  /** A different surface's resonances instead of the desk's (e.g. the
   *  laptop's own chassis). */
  modes?: Array<[number, number]>
  /** Overall level at the mic (path loss), 1 = the nearest spot. */
  level?: number
}

/** Shared desk resonances: [frequency Hz, decay time constant s]. */
const DESK_MODES: Array<[number, number]> = [
  [185, 0.09],
  [430, 0.055],
  [960, 0.03],
  [2350, 0.014],
  [5200, 0.006]
]

/** Two spots on the mic's side of a laptop, top and bottom: close enough
 *  that the desk rings almost identically for both. */
export const SIM_SPOTS: Record<'near' | 'far', SimSpot> = {
  near: { clickCutoffHz: 5200, reflectionMs: 0.35, reflectionGain: 0.55, modeGains: [1, 0.85, 0.7, 0.55, 0.35], clickGain: 1 },
  far: { clickCutoffHz: 3600, reflectionMs: 0.8, reflectionGain: 0.5, modeGains: [1, 0.9, 0.62, 0.5, 0.28], clickGain: 0.8 }
}

/** Taps that must never fire: places that were never calibrated. */
export const SIM_OFF_SPOTS: Record<'otherSide' | 'laptopBody', SimSpot> = {
  /** The desk on the far side of the laptop: same desk, longer path, a
   *  different nearest edge. */
  otherSide: { clickCutoffHz: 2900, reflectionMs: 1.45, reflectionGain: 0.45, modeGains: [1, 0.95, 0.55, 0.42, 0.2], clickGain: 0.65 },
  /** A knock on the laptop itself: stiff plastic/metal, bright and short. */
  laptopBody: {
    clickCutoffHz: 8000,
    reflectionMs: 0.18,
    reflectionGain: 0.6,
    modeGains: [1, 0.8, 0.6],
    clickGain: 1.2,
    modes: [
      [1450, 0.018],
      [3300, 0.009],
      [7100, 0.004]
    ]
  }
}

export interface SimTapOptions {
  seed: number
  /** 0..1, default random 0.2..1. */
  force?: number
  /** Range the random force is drawn from, default [0.2, 1]. */
  forceRange?: [number, number]
  noiseDb?: number
}

/** One tap on `spot`, as a mono window with the onset around frame 1000. */
export function simulateTap(spot: SimSpot, options: SimTapOptions): Float32Array {
  const rng = makeRng(options.seed)
  const sr = SIM_SAMPLE_RATE
  const out = new Float32Array(SIM_WINDOW)
  const [minForce, maxForce] = options.forceRange ?? [0.2, 1]
  const force = options.force ?? minForce + (maxForce - minForce) * rng()
  const amp = (0.08 + 0.42 * force) * (spot.level ?? 1)
  const onset = 900 + Math.floor(rng() * 200)

  // Direct click: a ~1.5 ms decaying noise burst, one-pole low-passed. Harder
  // taps are brighter; the knuckle's exact spot nudges the cutoff.
  const cutoff = spot.clickCutoffHz * (0.8 + 0.4 * force) * (1 + (rng() - 0.5) * 0.12)
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sr)
  const clickLength = Math.round(sr * 0.004)
  const click = new Float32Array(clickLength)
  let lp = 0
  for (let i = 0; i < clickLength; i++) {
    const burst = (rng() * 2 - 1) * Math.exp(-i / (sr * 0.0015))
    lp += alpha * (burst - lp)
    click[i] = lp * spot.clickGain
  }
  const reflection = Math.round(((spot.reflectionMs * (1 + (rng() - 0.5) * 0.25)) / 1000) * sr)
  for (let i = 0; i < clickLength; i++) {
    const at = onset + i
    if (at < SIM_WINDOW) out[at] += amp * click[i]
    if (at + reflection < SIM_WINDOW) out[at + reflection] += amp * click[i] * spot.reflectionGain
  }

  // Shared desk ringing, with small per-tap jitter in the mode balance.
  ;(spot.modes ?? DESK_MODES).forEach(([freq, decay], m) => {
    const gain = spot.modeGains[m] * (1 + (rng() - 0.5) * 0.2) * 0.35
    const f = freq * (1 + (rng() - 0.5) * 0.01)
    const phase = rng() * Math.PI * 2
    for (let t = 0; onset + t < SIM_WINDOW; t++) {
      out[onset + t] += amp * gain * Math.sin((2 * Math.PI * f * t) / sr + phase) * Math.exp(-t / (sr * decay))
    }
  })

  const noise = Math.pow(10, (options.noiseDb ?? -62) / 20)
  for (let i = 0; i < SIM_WINDOW; i++) out[i] += (rng() * 2 - 1) * noise
  return out
}

/** A laptop chassis: stiffer and higher than a desk, and shorter-lived. */
const CHASSIS_MODES: Array<[number, number]> = [
  [620, 0.03],
  [1450, 0.018],
  [3300, 0.009],
  [7100, 0.004]
]

/**
 * The 2-zone layout Holo actually uses on one-mic laptops: the palm rest
 * left and right of the trackpad, with the mic on the left (as on the
 * ROG Zephyrus G14). The right-hand tap reaches the mic across the chassis:
 * quieter and duller, with a different early reflection, but ringing the
 * same chassis modes.
 */
export const PALM_SPOTS: Record<'left' | 'right', SimSpot> = {
  left: { clickCutoffHz: 7000, reflectionMs: 0.25, reflectionGain: 0.5, modeGains: [1, 0.9, 0.7, 0.5], clickGain: 1.1, modes: CHASSIS_MODES, level: 1 },
  right: { clickCutoffHz: 4800, reflectionMs: 0.6, reflectionGain: 0.5, modeGains: [1, 0.95, 0.6, 0.4], clickGain: 0.9, modes: CHASSIS_MODES, level: 0.6 }
}

/** Taps near the palm-rest zones that must not fire. */
export const PALM_OFF_SPOTS: Record<'deskBeside' | 'keyboardDeck' | 'belowTrackpad', SimSpot> = {
  /** The desk just beside the laptop: a different surface entirely. */
  deskBeside: { clickCutoffHz: 3000, reflectionMs: 0.9, reflectionGain: 0.45, modeGains: [1, 0.9, 0.6, 0.45, 0.25], clickGain: 0.7, level: 0.4 },
  /** The keyboard deck above the zones (keys not pressed). */
  keyboardDeck: { clickCutoffHz: 5600, reflectionMs: 0.45, reflectionGain: 0.65, modeGains: [0.7, 1, 0.8, 0.6], clickGain: 1, modes: CHASSIS_MODES, level: 0.75 },
  /** The palm-rest lip in front of the trackpad, between the two zones. */
  belowTrackpad: { clickCutoffHz: 5800, reflectionMs: 0.15, reflectionGain: 0.8, modeGains: [1, 0.7, 0.8, 0.6], clickGain: 1, modes: CHASSIS_MODES, level: 0.8 }
}
