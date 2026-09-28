import { describe, expect, it } from 'vitest'
import type { HoloZone, HoloZoneProfile } from '@shared/types'
import {
  buildDiscriminant,
  buildModel,
  classifyZone,
  deriveGates,
  detectImpact,
  evaluateDiscriminant,
  extractTapFeatures,
  learnFromTap,
  shouldLearnFrom,
  tapPeakDb,
  trainingTaps,
  type ImpactCheck
} from './classifier'
import { DESK_LAYOUT, PALM_LAYOUT, runBenchmarks, type SimLayout } from './testing/benchmark'
import { SIM_SAMPLE_RATE, makeRng, simulateTap, type SimSpot } from './testing/tapSimulator'

/**
 * Accuracy regression tests on the simulated desk/palm rest
 * (testing/tapSimulator.ts). Simulated, not real audio: these numbers are
 * not a real-world accuracy, and passing them doesn't prove one. What they
 * do catch is a change that makes Holo worse at the kind of difference real
 * zones have, which is how the pipeline was tuned (see the doc comments on
 * `onsetWindow`, `echoFeatures`, `Discriminant` and `learnFromTap`).
 *
 * Numbers when this was written (20 calibrations each):
 *   palm rest, calibration only:  ~91% right, ~3.4% wrong
 *   palm rest, after 100 taps:    ~97% right, ~0.4% wrong
 *   before these changes:         ~79% right, ~7% wrong
 */

const CALIBRATION_TAPS = 12

interface Session {
  profiles: HoloZoneProfile[]
  scale: number[]
  weights: number[]
  gates: ReturnType<typeof deriveGates>
}

function calibrate(zones: Array<[HoloZone, SimSpot]>, seed: number): Session {
  const tapsByZone: Array<{ zone: HoloZone; taps: number[][] }> = []
  const peaks: number[] = []
  const impacts: ImpactCheck[] = []
  zones.forEach(([zone, spot], s) => {
    const taps: number[][] = []
    for (let i = 0; i < CALIBRATION_TAPS; i++) {
      const audio = simulateTap(spot, { seed: seed * 7919 + s * 1000 + i })
      taps.push(extractTapFeatures([audio], [0], SIM_SAMPLE_RATE)!)
      peaks.push(tapPeakDb([audio]))
      impacts.push(detectImpact([audio], SIM_SAMPLE_RATE)!)
    }
    tapsByZone.push({ zone, taps })
  })
  const model = buildModel(tapsByZone)
  const { distances } = evaluateDiscriminant(tapsByZone, model.scale)
  return { profiles: model.zones, scale: model.scale, weights: model.weights, gates: deriveGates(distances, peaks, impacts) }
}

/** Streams `count` taps at random zones through the shipping classify +
 *  learn loop (what holoCapture does), scoring those after `warmup`. */
function useFor(session: Session, zones: Array<[HoloZone, SimSpot]>, seed: number, count: number, warmup: number, learn: boolean) {
  let profiles = session.profiles
  let discriminant = buildDiscriminant(trainingTaps(profiles), session.scale)
  const rng = makeRng(seed * 31337)
  let right = 0
  let wrong = 0
  let scored = 0
  for (let t = 0; t < count; t++) {
    const which = rng() < 0.5 ? 0 : 1
    const audio = simulateTap(zones[which][1], { seed: seed * 104729 + 50000 + t })
    const features = extractTapFeatures([audio], [0], SIM_SAMPLE_RATE)!
    const result = classifyZone(features, profiles, session.scale, {
      weights: session.weights,
      gates: session.gates,
      peakDb: tapPeakDb([audio]),
      impact: detectImpact([audio], SIM_SAMPLE_RATE) ?? undefined,
      discriminant
    })
    if (t >= warmup) {
      scored++
      if (result.zone === zones[which][0]) right++
      else if (result.zone) wrong++
    }
    if (learn && result.zone && shouldLearnFrom(result, session.gates)) {
      profiles = learnFromTap(profiles, result.zone, features)
      discriminant = buildDiscriminant(trainingTaps(profiles), session.scale)
    }
  }
  return { right: right / scored, wrong: wrong / scored }
}

const zonesOf = (layout: SimLayout): Array<[HoloZone, SimSpot]> => [
  ['frontLeft', layout.zones[0]],
  ['frontRight', layout.zones[1]]
]

describe('Holo accuracy on the simulated palm rest (2-zone layout)', () => {
  const zones = zonesOf(PALM_LAYOUT)
  const seeds = [1, 2, 3, 4, 5, 6]

  it('gets the right side on well over 90% of taps from calibration alone', () => {
    const results = seeds.map((seed) => useFor(calibrate(zones, seed), zones, seed, 120, 0, false))
    const right = results.reduce((a, r) => a + r.right, 0) / results.length
    const wrong = results.reduce((a, r) => a + r.wrong, 0) / results.length
    expect(right).toBeGreaterThan(0.88)
    expect(wrong).toBeLessThan(0.05)
  }, 120000)

  it('reaches 95%+ once it has learned from everyday taps, and fires on the wrong side under 1.5% of the time', () => {
    const results = seeds.map((seed) => useFor(calibrate(zones, seed), zones, seed, 220, 100, true))
    const right = results.reduce((a, r) => a + r.right, 0) / results.length
    const wrong = results.reduce((a, r) => a + r.wrong, 0) / results.length
    expect(right).toBeGreaterThanOrEqual(0.95)
    expect(wrong).toBeLessThan(0.015)
    // No single calibration may drift into learning its own mistakes.
    for (const result of results) expect(result.right).toBeGreaterThan(0.9)
  }, 180000)

  it('never fires on a tap on the desk beside the laptop', () => {
    const result = runBenchmarks([1, 2, 3], { calibrationTaps: CALIBRATION_TAPS, testTaps: 60, layout: PALM_LAYOUT, useDiscriminant: true })
    const [fired, total] = result.offSpotByName.deskBeside
    expect(fired / total).toBeLessThan(0.01)
  }, 120000)
})

describe('Holo accuracy on the simulated desk (same surface, harder)', () => {
  it('keeps wrong-zone fires rare and rejects knocks on the laptop body', () => {
    const result = runBenchmarks([1, 2, 3], { calibrationTaps: CALIBRATION_TAPS, testTaps: 80, layout: DESK_LAYOUT, useDiscriminant: true })
    expect(result.correct / result.total).toBeGreaterThan(0.88)
    expect(result.wrong / result.total).toBeLessThan(0.05)
    const [fired, total] = result.offSpotByName.laptopBody
    expect(fired / total).toBeLessThan(0.01)
  }, 120000)
})
