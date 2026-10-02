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

/**
 * Everyday sounds that are NOT taps, for measuring false fires. Each is
 * built from what physically separates it from a knuckle tap, not from
 * whatever Holo happens to check today:
 *
 * - palmLand: a hand or wrist landing on the palm rest next to a zone. A big,
 *   soft mass: several milliseconds to reach full force, so a dull attack.
 *   The most tap-like of all, and exactly where the zones are.
 * - fingerRest: a fingertip coming to rest (pad, not knuckle): soft and dull.
 * - setDown: a cup or phone put on the desk: lands on one edge, then settles.
 * - phoneBounce: something dropped a few centimetres: one hit, then a bounce.
 * - scrape: a sleeve or object sliding: sustained, no single impact.
 * - clap: airborne, broadband, room reverb, no chassis ringing.
 * - knockFar: a door knock in the room: dull, reverberant, quiet.
 * - keyClick: someone typing on another keyboard: short airborne clicks.
 */
export type NonTapKind = 'palmLand' | 'fingerRest' | 'setDown' | 'phoneBounce' | 'scrape' | 'clap' | 'knockFar' | 'keyClick'
export const NON_TAP_KINDS: NonTapKind[] = ['palmLand', 'fingerRest', 'setDown', 'phoneBounce', 'scrape', 'clap', 'knockFar', 'keyClick']

interface ImpactParams {
  cutoffHz: number
  /** Time for the contact force to build up (a knuckle is ~0.3 ms). */
  riseMs: number
  clickGain: number
  modes: Array<[number, number]>
  modeGains: number[]
  level: number
  /** Extra contacts: [delay ms, relative gain]. */
  contacts?: Array<[number, number]>
  /** Airborne room reverb instead of structural ringing. */
  reverbMs?: number
}

function synthImpact(params: ImpactParams, rng: () => number, out: Float32Array, onset: number, amp: number): void {
  const sr = SIM_SAMPLE_RATE
  const alpha = 1 - Math.exp((-2 * Math.PI * params.cutoffHz) / sr)
  const riseFrames = Math.max(1, Math.round((params.riseMs / 1000) * sr))
  const hits: Array<[number, number]> = [[0, 1], ...(params.contacts ?? [])]
  for (const [delayMs, gain] of hits) {
    const start = onset + Math.round((delayMs / 1000) * sr)
    const length = Math.round(sr * 0.004) + riseFrames
    let lp = 0
    for (let i = 0; i < length && start + i < SIM_WINDOW; i++) {
      const envelope = i < riseFrames ? i / riseFrames : Math.exp(-(i - riseFrames) / (sr * 0.0015))
      lp += alpha * ((rng() * 2 - 1) * envelope - lp)
      out[start + i] += amp * gain * params.clickGain * lp
    }
    if (params.reverbMs) {
      const tau = (params.reverbMs / 1000 / 6.9) * sr
      let lpr = 0
      for (let t = 0; start + t < SIM_WINDOW; t++) {
        lpr += alpha * ((rng() * 2 - 1) - lpr)
        out[start + t] += amp * gain * 0.25 * lpr * Math.exp(-t / tau) * Math.min(1, t / 48)
      }
    } else {
      params.modes.forEach(([freq, decay], m) => {
        const modeGain = (params.modeGains[m] ?? 0.3) * 0.35 * (1 + (rng() - 0.5) * 0.2)
        const phase = rng() * Math.PI * 2
        for (let t = 0; start + t < SIM_WINDOW; t++) {
          const attack = t < riseFrames ? t / riseFrames : 1
          out[start + t] += amp * gain * modeGain * attack * Math.sin((2 * Math.PI * freq * t) / sr + phase) * Math.exp(-t / (sr * decay))
        }
      })
    }
  }
}

/** One non-tap sound, as a mono window with its onset around frame 1000. */
export function simulateNonTap(kind: NonTapKind, options: { seed: number; noiseDb?: number }): Float32Array {
  const rng = makeRng(options.seed)
  const sr = SIM_SAMPLE_RATE
  const out = new Float32Array(SIM_WINDOW)
  const onset = 900 + Math.floor(rng() * 200)
  const r = (lo: number, hi: number): number => lo + (hi - lo) * rng()
  const loudness = r(0.15, 1)

  switch (kind) {
    case 'palmLand':
      synthImpact(
        { cutoffHz: r(500, 1600), riseMs: r(3, 12), clickGain: 1, modes: CHASSIS_MODES, modeGains: [1, 0.6, 0.25, 0.1], level: 1 },
        rng, out, onset, (0.1 + 0.45 * loudness) * r(0.6, 1)
      )
      break
    case 'fingerRest':
      synthImpact(
        { cutoffHz: r(1200, 2800), riseMs: r(1.5, 5), clickGain: 1, modes: CHASSIS_MODES, modeGains: [1, 0.8, 0.45, 0.2], level: 1 },
        rng, out, onset, 0.06 + 0.2 * loudness
      )
      break
    case 'setDown':
      synthImpact(
        {
          cutoffHz: r(2000, 4500), riseMs: r(0.5, 2), clickGain: 1, modes: DESK_MODES, modeGains: [1, 0.9, 0.6, 0.4, 0.2], level: 1,
          contacts: [[r(4, 30), r(0.4, 1.1)]]
        },
        rng, out, onset, 0.08 + 0.35 * loudness
      )
      break
    case 'phoneBounce':
      synthImpact(
        {
          cutoffHz: r(3000, 7000), riseMs: r(0.2, 0.8), clickGain: 1.1, modes: DESK_MODES, modeGains: [0.8, 1, 0.7, 0.5, 0.3], level: 1,
          contacts: [[r(25, 70), r(0.2, 0.5)]]
        },
        rng, out, onset, 0.1 + 0.35 * loudness
      )
      break
    case 'scrape': {
      const length = Math.round(r(0.08, 0.3) * sr)
      const alpha = 1 - Math.exp((-2 * Math.PI * r(1500, 5000)) / sr)
      let lp = 0
      const amp = 0.03 + 0.12 * loudness
      for (let i = 0; i < length && onset + i < SIM_WINDOW; i++) {
        const envelope = Math.sin((Math.PI * i) / length) * (0.6 + 0.4 * Math.sin(i / r(200, 600)))
        lp += alpha * ((rng() * 2 - 1) - lp)
        out[onset + i] += amp * envelope * lp
      }
      break
    }
    case 'clap':
      synthImpact(
        { cutoffHz: r(3000, 9000), riseMs: r(0.2, 0.6), clickGain: 1.3, modes: [], modeGains: [], level: 1, reverbMs: r(250, 600) },
        rng, out, onset, 0.08 + 0.3 * loudness
      )
      break
    case 'knockFar':
      synthImpact(
        {
          cutoffHz: r(400, 900), riseMs: r(0.5, 2), clickGain: 1, modes: [], modeGains: [], level: 1, reverbMs: r(300, 700),
          contacts: [[r(140, 220), r(0.7, 1)]]
        },
        rng, out, onset, 0.02 + 0.08 * loudness
      )
      break
    case 'keyClick':
      synthImpact(
        { cutoffHz: r(4000, 9000), riseMs: r(0.1, 0.4), clickGain: 1, modes: [], modeGains: [], level: 1, reverbMs: r(150, 350) },
        rng, out, onset, 0.02 + 0.08 * loudness
      )
      break
  }

  const noise = Math.pow(10, (options.noiseDb ?? -62) / 20)
  for (let i = 0; i < SIM_WINDOW; i++) out[i] += (rng() * 2 - 1) * noise
  return out
}
