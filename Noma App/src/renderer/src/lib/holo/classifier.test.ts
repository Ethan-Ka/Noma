import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GATES,
  FEATURES_PER_CHANNEL,
  IGNORE_MATCH_MARGIN,
  blockEnergy,
  buildModel,
  classifyZone,
  createOnsetDetectorState,
  deriveGates,
  detectImpact,
  detectOnset,
  estimateDelay,
  evaluateCalibration,
  countContacts,
  extractTapFeatures,
  isImpactLike,
  localizeOnset,
  measureImpact,
  powerSpectrum,
  relaxGates,
  scaledDistance,
  buildDiscriminant,
  discriminantPosteriors,
  forgetLearnedTap,
  learnFromTap,
  onsetWindow,
  shouldLearnFrom,
  trainingTaps,
  MAX_LEARNED_TAPS,
  anchorAgrees,
  anchorDiscriminant,
  withoutMislabelledTaps,
  type ImpactCheck
} from './classifier'
import type { HoloGates, HoloZone, HoloZoneProfile } from '@shared/types'

const SAMPLE_RATE = 48000
const WINDOW = 12288

/** Deterministic pseudo-random noise so tests never flake. */
function makeRng(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296 - 0.5
  }
}

/** A synthetic desk tap: a decaying resonance starting at `onset`. */
function synthTap(opts: { freq: number; decay: number; amp?: number; onset?: number; delay?: number; seed: number }): Float32Array {
  const rng = makeRng(opts.seed)
  const out = new Float32Array(WINDOW)
  const onset = (opts.onset ?? 1000) + (opts.delay ?? 0)
  const freq = opts.freq * (1 + rng() * 0.04)
  for (let i = 0; i < WINDOW; i++) {
    const t = i - onset
    const ring = t >= 0 ? Math.sin((2 * Math.PI * freq * t) / SAMPLE_RATE) * Math.exp(-t / opts.decay) : 0
    out[i] = (opts.amp ?? 0.4) * ring + rng() * 0.002
  }
  return out
}

const ZONE_SOUNDS: Record<HoloZone, { freq: number; decay: number }> = {
  frontLeft: { freq: 400, decay: 500 },
  frontRight: { freq: 1200, decay: 250 },
  rearLeft: { freq: 3000, decay: 120 },
  rearRight: { freq: 700, decay: 900 }
}

function zoneTaps(zone: HoloZone, count: number, seedBase: number): number[][] {
  return Array.from({ length: count }, (_, i) => {
    const sound = ZONE_SOUNDS[zone]
    const features = extractTapFeatures([synthTap({ ...sound, seed: seedBase + i })], [0], SAMPLE_RATE)
    if (!features) throw new Error('synthetic tap had no features')
    return features
  })
}

describe('powerSpectrum', () => {
  it('puts a pure tone in the right bin', () => {
    const n = 1024
    const tone = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 64 * i) / n))
    const spectrum = powerSpectrum(tone)
    const peak = spectrum.indexOf(Math.max(...spectrum))
    expect(peak).toBe(64)
  })
})

describe('localizeOnset', () => {
  it('finds where the transient starts', () => {
    const tap = synthTap({ freq: 800, decay: 300, onset: 1200, seed: 1 })
    expect(Math.abs(localizeOnset(tap) - 1200)).toBeLessThan(80)
  })

  it('reports -1 for silence', () => {
    expect(localizeOnset(new Float32Array(1000))).toBe(-1)
  })
})

describe('extractTapFeatures', () => {
  it('returns null when every channel is silent', () => {
    expect(extractTapFeatures([new Float32Array(WINDOW)], [0], SAMPLE_RATE)).toBeNull()
  })

  it('has a fixed per-channel size, plus level features for extra channels', () => {
    const tap = synthTap({ freq: 800, decay: 300, seed: 2 })
    expect(extractTapFeatures([tap], [0], SAMPLE_RATE)).toHaveLength(FEATURES_PER_CHANNEL)
    // 2 channels of one device: 2x channel features + 2 levels + 1 delay
    expect(extractTapFeatures([tap, tap], [0, 0], SAMPLE_RATE)).toHaveLength(FEATURES_PER_CHANNEL * 2 + 3)
    // 2 devices: no cross-device delay
    expect(extractTapFeatures([tap, tap], [0, 1], SAMPLE_RATE)).toHaveLength(FEATURES_PER_CHANNEL * 2 + 2)
  })

  it('is stable across repeats of one sound but differs between sounds', () => {
    const a1 = extractTapFeatures([synthTap({ ...ZONE_SOUNDS.frontLeft, seed: 3 })], [0], SAMPLE_RATE)!
    const a2 = extractTapFeatures([synthTap({ ...ZONE_SOUNDS.frontLeft, seed: 4 })], [0], SAMPLE_RATE)!
    const b = extractTapFeatures([synthTap({ ...ZONE_SOUNDS.rearLeft, seed: 5 })], [0], SAMPLE_RATE)!
    const flat = new Array(a1.length).fill(0.3)
    expect(scaledDistance(a1, a2, flat)).toBeLessThan(scaledDistance(a1, b, flat))
  })

  it('is independent of tap loudness', () => {
    const loud = extractTapFeatures([synthTap({ ...ZONE_SOUNDS.frontRight, amp: 0.6, seed: 6 })], [0], SAMPLE_RATE)!
    const soft = extractTapFeatures([synthTap({ ...ZONE_SOUNDS.frontRight, amp: 0.2, seed: 6 })], [0], SAMPLE_RATE)!
    const flat = new Array(loud.length).fill(0.3)
    expect(scaledDistance(loud, soft, flat)).toBeLessThan(1.5)
  })
})

describe('estimateDelay', () => {
  it('reports how much later the second channel heard the tap', () => {
    const early = synthTap({ freq: 900, decay: 200, seed: 7 })
    const late = synthTap({ freq: 900, decay: 200, seed: 7, delay: 12 })
    expect(estimateDelay(early, late, 1000, 48)).toBe(12)
    expect(estimateDelay(late, early, 1012, 48)).toBe(-12)
  })
})

describe('classification', () => {
  const zones = Object.keys(ZONE_SOUNDS) as HoloZone[]
  const training = zones.map((zone, index) => ({ zone, taps: zoneTaps(zone, 8, 100 + index * 50) }))
  const { zones: profiles, scale } = buildModel(training)

  it('builds one profile per zone and a scale per dimension', () => {
    expect(profiles).toHaveLength(4)
    expect(scale).toHaveLength(FEATURES_PER_CHANNEL)
    expect(scale.every((value) => value > 0)).toBe(true)
  })

  it('classifies fresh taps into the right zone', () => {
    for (const zone of zones) {
      const [tap] = zoneTaps(zone, 1, 9000 + zones.indexOf(zone))
      const result = classifyZone(tap, profiles, scale)
      expect(result.zone).toBe(zone)
      expect(result.reason).toBe('ok')
    }
  })

  it('rejects a sound unlike any calibrated tap', () => {
    // A sustained, broadband hiss — nothing like a decaying knock.
    const rng = makeRng(77)
    const hiss = new Float32Array(WINDOW)
    for (let i = 1000; i < WINDOW; i++) hiss[i] = rng() * 0.6
    const features = extractTapFeatures([hiss], [0], SAMPLE_RATE)!
    expect(classifyZone(features, profiles, scale).zone).toBeNull()
  })

  it('reports no-calibration with no profiles', () => {
    expect(classifyZone([0], [], []).reason).toBe('no-calibration')
  })

  it('scores well-separated calibration taps as highly accurate', () => {
    expect(evaluateCalibration(training, scale).accuracy).toBeGreaterThan(0.9)
  })

  it('scores identical zones as poorly separable', () => {
    const same = zones.map((zone, index) => ({ zone, taps: zoneTaps('frontLeft', 8, 500 + index * 50) }))
    const model = buildModel(same)
    expect(evaluateCalibration(same, model.scale).accuracy).toBeLessThan(0.6)
  })
})

describe('onset detector', () => {
  it('ignores DC offset and keeps low-frequency thumps', () => {
    expect(blockEnergy(new Array(512).fill(0.5))).toBeLessThan(1e-3)
    const thump = Array.from({ length: 512 }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 200 * i) / 48000))
    expect(blockEnergy(thump)).toBeGreaterThan(1e-4)
  })

  it('catches a tap that rises across two blocks (under a fixed jump ratio)', () => {
    const state = createOnsetDetectorState()
    for (let i = 0; i < 100; i++) detectOnset(2e-6, state)
    expect(detectOnset(2e-5, state)).toBe(false) // just under threshold
    expect(detectOnset(4.4e-5, state)).toBe(true) // only 2.2x the block before
  })

  it('fires on a sudden loud block over a quiet room and not on steady noise', () => {
    const state = createOnsetDetectorState()
    for (let i = 0; i < 100; i++) expect(detectOnset(2e-6, state)).toBe(false)
    expect(detectOnset(2e-3, state)).toBe(true)
  })

  it('does not retrigger on a sustained loud sound (needs a fresh rise)', () => {
    const state = createOnsetDetectorState()
    for (let i = 0; i < 50; i++) detectOnset(2e-6, state)
    expect(detectOnset(2e-3, state)).toBe(true)
    expect(detectOnset(1.5e-3, state)).toBe(false)
  })

  it('is more sensitive at "high" than "low"', () => {
    const low = createOnsetDetectorState()
    const high = createOnsetDetectorState()
    for (let i = 0; i < 100; i++) {
      detectOnset(1e-6, low)
      detectOnset(1e-6, high)
    }
    expect(detectOnset(1e-5, low, 'low')).toBe(false)
    expect(detectOnset(1e-5, high, 'high')).toBe(true)
  })
})

describe('separability weighting', () => {
  const zones = Object.keys(ZONE_SOUNDS) as HoloZone[]
  const training = zones.map((zone, index) => ({ zone, taps: zoneTaps(zone, 8, 100 + index * 50) }))

  it('weights a dimension by how much it separates zones, not by how much it varies', () => {
    // Dimension 0 differs between zones and is steady within one; dimension 1
    // is pure noise of the same size. Standardizing alone can't tell them
    // apart — both have the same spread — but only the first says anything
    // about where the tap was.
    const rng = makeRng(31)
    const noisy = zones.map((zone, index) => ({
      zone,
      taps: Array.from({ length: 8 }, () => [index * 0.6 + rng() * 0.2, rng() * 0.6])
    }))
    const { weights } = buildModel(noisy)
    expect(weights[0]).toBeGreaterThan(weights[1] * 2)
  })

  it('gives every dimension the same weight when none of them separates the zones', () => {
    const flat = zones.map((zone) => ({ zone, taps: [[0.2, 0.4], [-0.2, -0.4]] }))
    expect(buildModel(flat).weights).toEqual([1, 1])
  })

  it('pulls a tap onto the right zone when an uninformative dimension would have swamped it', () => {
    // One dimension carries the zone (0 vs 1, steady within a zone). Four
    // carry nothing: they swing +/-0.5 tap to tap, and their zone averages
    // differ only by the luck of a handful of samples. The tap's tone is
    // plainly zone B's, but its four meaningless dimensions all landed on
    // zone A's side — which is exactly the shape of a real-world mix-up,
    // because four weak wrong votes outvote one strong right one.
    const rng = makeRng(41)
    const cluster = (tone: number, drift: number): number[][] =>
      Array.from({ length: 8 }, () => [tone + rng() * 0.04, ...Array.from({ length: 4 }, () => drift + rng())])
    const training2 = [
      { zone: 'frontLeft' as HoloZone, taps: cluster(0, 0.25) },
      { zone: 'frontRight' as HoloZone, taps: cluster(1, -0.25) }
    ]
    const model = buildModel(training2)
    const tap = [0.8, 0.8, 0.8, 0.8, 0.8]

    expect(classifyZone(tap, model.zones, model.scale).zone).toBe('frontLeft') // wrong
    expect(classifyZone(tap, model.zones, model.scale, { weights: model.weights }).zone).toBe('frontRight')
  })

  it('reports leave-one-out accuracy and the spread of genuine taps', () => {
    const { scale, weights } = buildModel(training)
    const { accuracy, distances } = evaluateCalibration(training, scale, weights)
    expect(accuracy).toBeGreaterThan(0.9)
    expect(distances).toHaveLength(32)
    expect(distances.every((distance) => distance > 0 && Number.isFinite(distance))).toBe(true)
  })
})

describe('gates derived from the calibration taps', () => {
  const impacts = (sustain: number, driven: number, count = 8): ImpactCheck[] =>
    Array.from({ length: count }, () => ({ sustainDb: sustain, drivenDb: driven, periodicity: 0.1, contacts: 1, riseMs: 0.3, attackBrightnessDb: -3 }))

  it('sets every bound from the taps the user actually made', () => {
    const gates = deriveGates([1.0, 1.1, 1.2, 1.3], [-24, -20, -16], impacts(-38, -26))
    expect(gates.maxDistance).toBeGreaterThan(1.3)
    expect(gates.minPeakDb).toBeLessThan(-24)
    expect(gates.maxPeakDb).toBeGreaterThan(-16)
    expect(gates.maxSustainDb).toBeCloseTo(-32, 5)
    expect(gates.maxDrivenDb).toBeCloseTo(-20, 5)
  })

  it('lets a live room set a looser bar than a dead one', () => {
    const dead = deriveGates([1], [-20], impacts(-40, -30))
    const live = deriveGates([1], [-20], impacts(-16, -12))
    expect(live.maxSustainDb).toBeGreaterThan(dead.maxSustainDb)
    expect(live.maxDrivenDb).toBeGreaterThan(dead.maxDrivenDb)
  })

  it('ignores one stray tap rather than widening every bound around it', () => {
    const clean = deriveGates([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [-20], impacts(-40, -30))
    const withStray = deriveGates([1, 1, 1, 1, 1, 1, 1, 1, 1, 9], [-20], impacts(-40, -30))
    expect(withStray.maxDistance).toBeCloseTo(clean.maxDistance, 5)
  })

  it('falls back to the defaults when there is nothing to measure', () => {
    expect(deriveGates([], [], [])).toEqual(DEFAULT_GATES)
  })

  it('leans permissive on "light taps" and strict on "firm taps"', () => {
    const base = deriveGates([1.2], [-20], impacts(-38, -26))
    const light = relaxGates(base, 'high')
    const firm = relaxGates(base, 'low')
    expect(light.maxDistance).toBeGreaterThan(base.maxDistance)
    expect(light.minPeakDb).toBeLessThan(base.minPeakDb)
    expect(light.maxSustainDb).toBeGreaterThan(base.maxSustainDb)
    expect(firm.maxDistance).toBeLessThan(base.maxDistance)
    expect(firm.minPeakDb).toBeGreaterThan(base.minPeakDb)
    expect(relaxGates(base, 'medium')).toEqual(base)
  })
})

describe('the impact gate (coughs, voices, things that keep going)', () => {
  const zones = Object.keys(ZONE_SOUNDS) as HoloZone[]
  const training = zones.map((zone, index) => ({ zone, taps: zoneTaps(zone, 8, 100 + index * 50) }))
  const { zones: profiles, scale } = buildModel(training)
  const ONSET = 1000

  /** A cough: an explosive burst, then a couple of hundred milliseconds of
   *  turbulent airflow that decays far too slowly for a struck object. */
  function cough(seed: number): Float32Array {
    const rng = makeRng(seed)
    const out = new Float32Array(WINDOW)
    for (let i = 0; i < WINDOW; i++) {
      const t = i - ONSET
      if (t < 0) {
        out[i] = rng() * 0.002
        continue
      }
      const burst = Math.exp(-t / 600)
      const airflow = 0.45 * Math.exp(-t / 9000)
      out[i] = 0.5 * (burst + airflow) * rng() * 2
    }
    return out
  }

  /** A spoken syllable: harmonics of f0 shaped by formants, held throughout. */
  function vowel(f0: number, seed: number): Float32Array {
    const rng = makeRng(seed)
    const out = new Float32Array(WINDOW)
    const formantGain = (hz: number): number =>
      [500, 1500, 2600].reduce((gain, f) => gain + 1 / (1 + Math.pow((hz - f) / 200, 2)), 0.05)
    for (let i = 0; i < WINDOW; i++) {
      const t = i - ONSET
      if (t < 0) {
        out[i] = rng() * 0.002
        continue
      }
      let sample = 0
      for (let h = 1; h * f0 < 4500; h++) {
        sample += (formantGain(h * f0) / Math.sqrt(h)) * Math.sin((2 * Math.PI * h * f0 * t) / SAMPLE_RATE + h * 1.7)
      }
      out[i] = 0.12 * Math.min(1, t / 400) * sample + rng() * 0.003
    }
    return out
  }

  /** A real tap in a room with an audible tail — still an impact: everything
   *  after the strike, room included, only ever gets quieter. */
  function reverbTap(seed: number): Float32Array {
    const rng = makeRng(seed)
    const out = new Float32Array(WINDOW)
    for (let i = 0; i < WINDOW; i++) {
      const t = i - ONSET
      if (t < 0) {
        out[i] = rng() * 0.002
        continue
      }
      const direct = Math.sin((2 * Math.PI * 900 * t) / SAMPLE_RATE) * Math.exp(-t / 300)
      out[i] = 0.4 * (direct + 0.3 * rng() * 2 * Math.exp(-t / 2600))
    }
    return out
  }

  const impactOf = (signal: Float32Array): ImpactCheck => detectImpact([signal], SAMPLE_RATE)!

  it('rejects a cough, which is loud long after any tap has died away', () => {
    const impact = impactOf(cough(21))
    expect(isImpactLike(impact, DEFAULT_GATES)).toBe(false)
    const result = classifyZone([], profiles, scale, { impact })
    expect(result.zone).toBeNull()
    expect(result.reason).toBe('not-a-tap') // a cough isn't pitched, so it isn't called a voice
  })

  it('rejects speech and says so in those words', () => {
    for (const f0 of [110, 200, 300]) {
      const impact = impactOf(vowel(f0, f0))
      expect(isImpactLike(impact, DEFAULT_GATES)).toBe(false)
      expect(classifyZone([], profiles, scale, { impact }).reason).toBe('voice')
    }
  })

  it('accepts every calibrated zone tap', () => {
    for (const [zone, sound] of Object.entries(ZONE_SOUNDS)) {
      const impact = impactOf(synthTap({ ...sound, seed: 4200 }))
      expect(isImpactLike(impact, DEFAULT_GATES), zone).toBe(true)
    }
  })

  it('accepts a tap whose room tail is still audible, because the tail decays too', () => {
    const impact = impactOf(reverbTap(22))
    expect(impact.drivenDb).toBeLessThan(0) // still falling…
    expect(isImpactLike(impact, DEFAULT_GATES)).toBe(true)
  })

  it('keeps accepting taps in a room lively enough to need its own bounds', () => {
    const live = Array.from({ length: 6 }, (_, i) => impactOf(reverbTap(30 + i)))
    const gates = deriveGates([1.2], [-20], live)
    for (const impact of live) expect(isImpactLike(impact, gates)).toBe(true)
    // …and a cough is still a cough there.
    expect(isImpactLike(impactOf(cough(23)), gates)).toBe(false)
  })

  it('never rejects on a measurement it could not make', () => {
    // A window that ends before the tail could be looked at: the decay is
    // reported as "already gone", so the gate stays out of the way.
    const short = synthTap({ freq: 800, decay: 200, seed: 24 }).slice(0, ONSET + 3000)
    expect(measureImpact(short, ONSET, SAMPLE_RATE).drivenDb).toBeLessThan(DEFAULT_GATES.maxDrivenDb)
  })

  it('returns null when no channel has a usable onset', () => {
    expect(detectImpact([new Float32Array(WINDOW)], SAMPLE_RATE)).toBeNull()
  })

  it('only treats a sound as sustained when every channel agrees', () => {
    const speech = vowel(150, 25)
    const tap = synthTap({ ...ZONE_SOUNDS.frontRight, seed: 26 })
    expect(isImpactLike(detectImpact([speech, speech], SAMPLE_RATE)!, DEFAULT_GATES)).toBe(false)
    expect(isImpactLike(detectImpact([speech, tap], SAMPLE_RATE)!, DEFAULT_GATES)).toBe(true)
  })
})

describe('rejecting non-taps (objects set down, and the level bounds)', () => {
  const zones = Object.keys(ZONE_SOUNDS) as HoloZone[]
  const training = zones.map((zone, index) => ({ zone, taps: zoneTaps(zone, 8, 100 + index * 50) }))
  const { zones: profiles, scale, weights } = buildModel(training)

  /** Same tone as a real zone, but with a slow rise, a long ring, and a bounce. */
  function setDown(seed: number): Float32Array {
    const rng = makeRng(seed)
    const out = new Float32Array(WINDOW)
    const onset = 1000
    for (let i = 0; i < WINDOW; i++) {
      const t = i - onset
      const rise = t < 0 ? 0 : Math.min(1, t / 700)
      const main = t >= 0 ? rise * Math.exp(-t / 3500) : 0
      const bounce = t > 2200 ? 0.7 * Math.exp(-(t - 2200) / 1500) : 0
      out[i] = 0.4 * (main + bounce) * Math.sin((2 * Math.PI * 400 * i) / SAMPLE_RATE) + rng() * 0.002
    }
    return out
  }

  it('rejects a slow, ringing, bouncing sound even when its tone matches a zone', () => {
    const features = extractTapFeatures([setDown(1)], [0], SAMPLE_RATE)!
    expect(classifyZone(features, profiles, scale, { weights }).zone).toBeNull()
  })

  it('still accepts a real tap with the same gates active', () => {
    const [tap] = zoneTaps('frontLeft', 1, 7777)
    expect(classifyZone(tap, profiles, scale, { weights }).zone).toBe('frontLeft')
  })

  it('rejects a sound far louder or softer than the calibration taps', () => {
    const [tap] = zoneTaps('frontLeft', 1, 7778)
    const gates: HoloGates = { ...DEFAULT_GATES, minPeakDb: -30, maxPeakDb: -1 }
    expect(classifyZone(tap, profiles, scale, { weights, gates, peakDb: -15 }).zone).toBe('frontLeft')
    expect(classifyZone(tap, profiles, scale, { weights, gates, peakDb: 2 }).reason).toBe('wrong-level')
    expect(classifyZone(tap, profiles, scale, { weights, gates, peakDb: -45 }).reason).toBe('wrong-level')
  })
})

describe('objects being set down (counting contacts)', () => {
  const zones = Object.keys(ZONE_SOUNDS) as HoloZone[]
  const training = zones.map((zone, index) => ({ zone, taps: zoneTaps(zone, 8, 100 + index * 50) }))
  const { zones: profiles, scale, weights } = buildModel(training)
  const ONSET = 1000

  /** A mouse put down: it lands on one edge, then settles onto the other a
   *  few milliseconds later. Both contacts are real impacts on the desk. */
  function setDownObject(gapMs: number, seed: number): Float32Array {
    const rng = makeRng(seed)
    const out = new Float32Array(WINDOW)
    const second = ONSET + Math.round((SAMPLE_RATE * gapMs) / 1000)
    for (let i = 0; i < WINDOW; i++) {
      const strike = (at: number, amp: number): number => {
        const t = i - at
        return t >= 0 ? amp * Math.sin((2 * Math.PI * 520 * t) / SAMPLE_RATE) * Math.exp(-t / 260) : 0
      }
      out[i] = 0.4 * (strike(ONSET, 1) + strike(second, 0.85)) + rng() * 0.002
    }
    return out
  }

  it('counts one contact for a knuckle and more for something landing', () => {
    for (const sound of Object.values(ZONE_SOUNDS)) {
      expect(countContacts(synthTap({ ...sound, seed: 91 }), ONSET, SAMPLE_RATE)).toBe(1)
    }
    expect(countContacts(setDownObject(18, 92), ONSET, SAMPLE_RATE)).toBeGreaterThan(1)
  })

  /** What a real calibration of single-contact taps derives. */
  const measured: HoloGates = { ...DEFAULT_GATES, maxContacts: 1 }

  it('rejects a two-contact landing even though it decays like a real impact', () => {
    const impact = detectImpact([setDownObject(18, 93)], SAMPLE_RATE)!
    // It passes the decay gate — that is the whole difficulty: a mouse on a
    // desk really is an impact on that desk, and behaves like one.
    expect(isImpactLike(impact, DEFAULT_GATES)).toBe(true)
    const features = extractTapFeatures([setDownObject(18, 93)], [0], SAMPLE_RATE)!
    expect(classifyZone(features, profiles, scale, { weights, gates: measured, impact }).reason).toBe('set-down')
  })

  it('keeps the side of a real tap that fails only a soft check, but never accepts it on its own', () => {
    // Real palm-rest knocks often register several contacts; such a knock is
    // still placed on a side, for doubleTap.ts to pair with a sure one.
    const tap = synthTap({ ...ZONE_SOUNDS.frontLeft, seed: 94 })
    const impact = { ...detectImpact([tap], SAMPLE_RATE)!, contacts: 3 }
    const result = classifyZone(extractTapFeatures([tap], [0], SAMPLE_RATE)!, profiles, scale, {
      weights,
      gates: measured,
      impact
    })
    expect(result.zone).toBeNull()
    expect(result.reason).toBe('set-down')
    expect(result.candidate).toBe('frontLeft')
  })

  it('is permissive by default, so an old calibration is never made worse', () => {
    // Nothing measured this user's own taps, so the bar can't be assumed —
    // it takes a recalibration to tighten to 1, and DEFAULT_GATES says so.
    expect(DEFAULT_GATES.maxContacts).toBe(2)
    const impact = detectImpact([setDownObject(18, 93)], SAMPLE_RATE)!
    const features = extractTapFeatures([setDownObject(18, 93)], [0], SAMPLE_RATE)!
    expect(classifyZone(features, profiles, scale, { weights, impact }).reason).not.toBe('set-down')
  })

  it('still accepts a real tap at the strictest measured bar', () => {
    const tap = synthTap({ ...ZONE_SOUNDS.frontLeft, seed: 94 })
    const impact = detectImpact([tap], SAMPLE_RATE)!
    const features = extractTapFeatures([tap], [0], SAMPLE_RATE)!
    expect(classifyZone(features, profiles, scale, { weights, gates: measured, impact }).zone).toBe('frontLeft')
  })

  it('lets a user whose own taps bounce set their own bar', () => {
    const bouncy = Array.from({ length: 8 }, () => ({
      sustainDb: -40,
      drivenDb: -30,
      periodicity: 0.1,
      contacts: 2,
      riseMs: 0.3,
      attackBrightnessDb: -3
    }))
    expect(deriveGates([1.2], [-20], bouncy).maxContacts).toBe(2)
    expect(deriveGates([1.2], [-20], impactsWithContacts(1)).maxContacts).toBe(1)
  })

  const impactsWithContacts = (contacts: number): ImpactCheck[] =>
    Array.from({ length: 8 }, () => ({ sustainDb: -40, drivenDb: -30, periodicity: 0.1, contacts, riseMs: 0.3, attackBrightnessDb: -3 }))
})

describe('sounds the user has taught Noma to ignore', () => {
  const zones = Object.keys(ZONE_SOUNDS) as HoloZone[]
  const training = zones.map((zone, index) => ({ zone, taps: zoneTaps(zone, 8, 100 + index * 50) }))
  const { zones: profiles, scale, weights } = buildModel(training)

  /** Close enough to a calibrated zone to have been squeaking through as
   *  one — which is the only kind of sound this list has any work to do on. */
  const unwanted = extractTapFeatures([synthTap({ freq: 415, decay: 490, seed: 95 })], [0], SAMPLE_RATE)!

  it('rejects a sound matching one it was told to ignore', () => {
    const before = classifyZone(unwanted, profiles, scale, { weights })
    const after = classifyZone(unwanted, profiles, scale, { weights, negatives: [unwanted] })
    expect(after.reason).toBe('learned-ignore')
    expect(after.zone).toBeNull()
    // Worth stating plainly: without the example it was being accepted.
    expect(before.zone).not.toBeNull()
  })

  it('never lets a list of unwanted sounds swallow real taps', () => {
    // The exact failure that killed this mechanism's ancestor: unwanted
    // sounds were averaged into one vector, which landed in the middle of
    // feature space and beat real zones. These stay separate examples.
    const negatives = [
      [{ freq: 520, decay: 430 }, { freq: 900, decay: 180 }, { freq: 250, decay: 700 }, { freq: 1600, decay: 90 }]
    ][0].map((sound, index) => extractTapFeatures([synthTap({ ...sound, seed: 700 + index })], [0], SAMPLE_RATE)!)

    for (const zone of zones) {
      const [tap] = zoneTaps(zone, 1, 800 + zones.indexOf(zone))
      expect(classifyZone(tap, profiles, scale, { weights, negatives }).zone, zone).toBe(zone)
    }
  })

  it('requires the ignored sound to be a clearly better match, not a tie', () => {
    const [tap] = zoneTaps('frontLeft', 1, 96)
    // An example sitting at exactly the same distance as the winning zone
    // must not veto it — only one inside the margin may.
    const best = classifyZone(tap, profiles, scale, { weights })
    expect(best.zone).toBe('frontLeft')
    expect(IGNORE_MATCH_MARGIN).toBeLessThan(1)
  })

  it('does nothing at all when nothing has been taught', () => {
    const [tap] = zoneTaps('rearLeft', 1, 97)
    expect(classifyZone(tap, profiles, scale, { weights, negatives: [] }).zone).toBe('rearLeft')
    expect(classifyZone(tap, profiles, scale, { weights }).zone).toBe('rearLeft')
  })
})

describe('onsetWindow (keeping the attack)', () => {
  it('is near full weight a few samples into the segment, where Hann is near zero', () => {
    const n = 1024
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * 40) / (n - 1))
    expect(onsetWindow(40, n, 32)).toBe(1)
    expect(hann).toBeLessThan(0.02)
  })

  it('fades in over `rise` and out over the last quarter', () => {
    expect(onsetWindow(0, 1024, 32)).toBeLessThan(0.01)
    expect(onsetWindow(1023, 1024, 32)).toBeLessThan(0.01)
    expect(onsetWindow(512, 1024, 32)).toBe(1)
  })
})

describe('the discriminant', () => {
  /** Two zones that differ only in dimension 0, buried under a large
   *  wobble shared by every dimension (like tap force brightening every
   *  band at once). */
  function correlatedZones(seed: number): Array<{ zone: HoloZone; taps: number[][] }> {
    const rng = (() => {
      let state = seed
      return () => {
        state = (state * 1664525 + 1013904223) % 4294967296
        return state / 4294967296 - 0.5
      }
    })()
    const tap = (offset: number): number[] => {
      const shared = rng() * 6
      return Array.from({ length: 8 }, (_, d) => shared + (d === 0 ? offset : 0) + rng() * 0.2)
    }
    return [
      { zone: 'frontLeft', taps: Array.from({ length: 12 }, () => tap(0)) },
      { zone: 'frontRight', taps: Array.from({ length: 12 }, () => tap(1)) }
    ]
  }

  it("cancels a shared wobble that swamps the per-feature distance", () => {
    const training = correlatedZones(11)
    const test = correlatedZones(99)
    const scale = new Array(8).fill(1)
    const discriminant = buildDiscriminant(training, scale)!
    let right = 0
    let total = 0
    for (const { zone, taps } of test) {
      for (const tap of taps) {
        const posteriors = discriminantPosteriors(tap, discriminant, scale)
        if (discriminant.zones[posteriors.indexOf(Math.max(...posteriors))] === zone) right++
        total++
      }
    }
    expect(right / total).toBeGreaterThan(0.9)
  })

  it('returns posteriors that sum to 1', () => {
    const training = correlatedZones(5)
    const discriminant = buildDiscriminant(training, new Array(8).fill(1))!
    const posteriors = discriminantPosteriors(training[0].taps[0], discriminant, new Array(8).fill(1))
    expect(posteriors.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it('needs at least two zones with taps', () => {
    expect(buildDiscriminant([{ zone: 'frontLeft', taps: [[1, 2]] }], [1, 1])).toBeNull()
  })
})

describe('learning from taps in use', () => {
  const profile = (zone: HoloZone): HoloZoneProfile => ({ zone, features: [0, 0], taps: [[0, 0]], sampleCount: 1 })
  const gates = { ...DEFAULT_GATES, maxDistance: 2 }

  it('only learns from near-certain taps well inside the bound', () => {
    expect(shouldLearnFrom({ zone: 'frontLeft', confidence: 0.995, reason: 'ok', distance: 1 }, gates)).toBe(true)
    expect(shouldLearnFrom({ zone: 'frontLeft', confidence: 0.96, reason: 'ok', distance: 1 }, gates)).toBe(false)
    expect(shouldLearnFrom({ zone: 'frontLeft', confidence: 0.995, reason: 'ok', distance: 1.9 }, gates)).toBe(false)
    expect(shouldLearnFrom({ zone: null, confidence: 0.995, reason: 'ambiguous', distance: 1 }, gates)).toBe(false)
  })

  it('keeps calibration taps untouched and caps the learned ones, oldest first', () => {
    let profiles = [profile('frontLeft'), profile('frontRight')]
    for (let i = 0; i < MAX_LEARNED_TAPS + 5; i++) profiles = learnFromTap(profiles, 'frontLeft', [i, i])
    expect(profiles[0].taps).toEqual([[0, 0]])
    expect(profiles[0].learnedTaps).toHaveLength(MAX_LEARNED_TAPS)
    expect(profiles[0].learnedTaps?.[0]).toEqual([5, 5])
    expect(profiles[1].learnedTaps).toBeUndefined()
    expect(trainingTaps(profiles)[0].taps).toHaveLength(1 + MAX_LEARNED_TAPS)
  })

  it('forgets a learned tap by value, and leaves the profiles alone when it was never learned', () => {
    const profiles = learnFromTap([profile('frontLeft')], 'frontLeft', [3, 4])
    expect(forgetLearnedTap(profiles, [3, 4])[0].learnedTaps).toEqual([])
    expect(forgetLearnedTap(profiles, [9, 9])).toBe(profiles)
  })
})

describe('onset detector noise floor', () => {
  it("doesn't let a tap's own ringing raise the threshold for the next tap", () => {
    const state = createOnsetDetectorState(1e-5)
    for (let i = 0; i < 20; i++) detectOnset(1e-5, state)
    const before = state.noiseFloor
    expect(detectOnset(1e-2, state)).toBe(true)
    // ~100 ms of ringing, well above the threshold.
    for (let i = 0; i < 10; i++) detectOnset(5e-3, state)
    expect(state.noiseFloor).toBeLessThan(before * 1.5)
  })

  it('still follows a room that gets lastingly louder', () => {
    const state = createOnsetDetectorState(1e-5)
    for (let i = 0; i < 200; i++) detectOnset(1e-2, state)
    expect(state.noiseFloor).toBeGreaterThan(1e-3)
  })
})

describe('the anchor (learning can never drift a zone onto the other side)', () => {
  const tap = (x: number, jitter: number): number[] => [x + jitter, 1 - x - jitter * 0.5, jitter]
  const profiles: HoloZoneProfile[] = [
    { zone: 'frontLeft', features: [0, 1, 0], taps: [-0.1, -0.05, 0, 0.05, 0.1].map((j) => tap(0, j)), sampleCount: 5 },
    { zone: 'frontRight', features: [1, 0, 0], taps: [-0.1, -0.05, 0, 0.05, 0.1].map((j) => tap(1, j)), sampleCount: 5 }
  ]
  const scale = [0.2, 0.2, 0.2]
  const anchor = anchorDiscriminant(profiles, scale)!

  it('agrees with a tap on its own side and not with one from the other', () => {
    expect(anchorAgrees(tap(0, 0.02), 'frontLeft', anchor, scale)).toBe(true)
    expect(anchorAgrees(tap(1, 0.02), 'frontLeft', anchor, scale)).toBe(false)
  })

  it('drops a learned tap that belongs to the other side, keeps the rest', () => {
    const withMistake = profiles.map((p) => (p.zone === 'frontLeft' ? { ...p, learnedTaps: [tap(0, 0.03), tap(1, 0)] } : p))
    const cleaned = withoutMislabelledTaps(withMistake, anchor, scale)
    expect(cleaned[0].learnedTaps).toEqual([tap(0, 0.03)])
    expect(cleaned[0].taps).toEqual(profiles[0].taps)
  })

  it('returns the same profiles when there is nothing to drop', () => {
    expect(withoutMislabelledTaps(profiles, anchor, scale)).toBe(profiles)
  })
})
