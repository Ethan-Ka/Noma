import type { HoloGates, HoloZone } from '@shared/types'
import {
  buildDiscriminant,
  buildModel,
  classifyZone,
  deriveGates,
  detectImpact,
  evaluateCalibration,
  evaluateDiscriminant,
  extractTapFeatures,
  tapPeakDb,
  type ImpactCheck
} from '../classifier'
import { PALM_OFF_SPOTS, PALM_SPOTS, SIM_OFF_SPOTS, SIM_SAMPLE_RATE, SIM_SPOTS, simulateTap, type SimSpot } from './tapSimulator'

export interface SimLayout {
  zones: [SimSpot, SimSpot]
  offSpots: Record<string, SimSpot>
}

/** Two spots on the desk, both on the mic's side (harder: same surface). */
export const DESK_LAYOUT: SimLayout = { zones: [SIM_SPOTS.near, SIM_SPOTS.far], offSpots: SIM_OFF_SPOTS }
/** The palm rest either side of the trackpad (what 2-zone Holo uses). */
export const PALM_LAYOUT: SimLayout = { zones: [PALM_SPOTS.left, PALM_SPOTS.right], offSpots: PALM_OFF_SPOTS }

export interface BenchmarkResult {
  /** Test taps that fired on the right zone. */
  correct: number
  /** Test taps that fired on the wrong zone: the costly error. */
  wrong: number
  /** Test taps that fired nothing (unrecognized, ambiguous, gated). */
  missed: number
  total: number
  /** Taps on never-calibrated spots that fired anything. */
  offSpotFired: number
  offSpotTotal: number
  offSpotByName: Record<string, [number, number]>
  /** What the user is shown after calibrating. */
  calibrationAccuracy: number
  missReasons: Record<string, number>
}

export interface BenchmarkOptions {
  seed: number
  calibrationTaps: number
  testTaps: number
  /** The shipping pipeline (discriminant) vs the older distance-only one. */
  useDiscriminant?: boolean
  layout?: SimLayout
  /** Force range of the calibration taps (default: the full range). A user
   *  who calibrates gently and then taps harder in use is a real case. */
  calibrationForce?: [number, number]
  /** Adjusts the derived gates before testing (for sweeps). */
  tweakGates?: (gates: HoloGates, distances: number[]) => HoloGates
}

function analyse(audio: Float32Array): { features: number[] | null; peakDb: number; impact: ImpactCheck | null } {
  return {
    features: extractTapFeatures([audio], [0], SIM_SAMPLE_RATE),
    peakDb: tapPeakDb([audio]),
    impact: detectImpact([audio], SIM_SAMPLE_RATE)
  }
}

/**
 * Calibrates the way holoStore does, then classifies fresh taps from the two
 * calibrated spots and from spots that were never calibrated.
 */
export function runBenchmark(options: BenchmarkOptions): BenchmarkResult {
  const layout = options.layout ?? DESK_LAYOUT
  const spots: Array<[HoloZone, SimSpot]> = [
    ['frontLeft', layout.zones[0]],
    ['frontRight', layout.zones[1]]
  ]
  const tapsByZone: Array<{ zone: HoloZone; taps: number[][] }> = []
  const peaks: number[] = []
  const impacts: ImpactCheck[] = []
  spots.forEach(([zone, spot], s) => {
    const taps: number[][] = []
    for (let i = 0; i < options.calibrationTaps; i++) {
      const tap = analyse(
        simulateTap(spot, { seed: options.seed * 7919 + s * 1000 + i, forceRange: options.calibrationForce })
      )
      if (!tap.features) continue
      taps.push(tap.features)
      peaks.push(tap.peakDb)
      if (tap.impact) impacts.push(tap.impact)
    }
    tapsByZone.push({ zone, taps })
  })

  const model = buildModel(tapsByZone)
  const evaluation = options.useDiscriminant
    ? evaluateDiscriminant(tapsByZone, model.scale)
    : evaluateCalibration(tapsByZone, model.scale, model.weights)
  let gates = deriveGates(evaluation.distances, peaks, impacts)
  if (options.tweakGates) gates = options.tweakGates(gates, evaluation.distances)
  const discriminant = options.useDiscriminant ? buildDiscriminant(tapsByZone, model.scale) : null
  const classify = (tap: ReturnType<typeof analyse>): ReturnType<typeof classifyZone> | null =>
    tap.features
      ? classifyZone(tap.features, model.zones, model.scale, {
          weights: model.weights,
          gates,
          peakDb: tap.peakDb,
          impact: tap.impact ?? undefined,
          discriminant
        })
      : null

  const result: BenchmarkResult = {
    correct: 0,
    wrong: 0,
    missed: 0,
    total: 0,
    offSpotFired: 0,
    offSpotTotal: 0,
    offSpotByName: {},
    calibrationAccuracy: evaluation.accuracy,
    missReasons: {}
  }
  spots.forEach(([zone, spot], s) => {
    for (let i = 0; i < options.testTaps; i++) {
      const verdict = classify(analyse(simulateTap(spot, { seed: options.seed * 104729 + 50000 + s * 10000 + i })))
      result.total++
      if (verdict?.zone === zone) result.correct++
      else if (verdict?.zone) result.wrong++
      else {
        result.missed++
        const reason = verdict?.reason ?? 'no-features'
        result.missReasons[reason] = (result.missReasons[reason] ?? 0) + 1
      }
    }
  })
  Object.entries(layout.offSpots).forEach(([name, spot], s) => {
    result.offSpotByName[name] ??= [0, 0]
    for (let i = 0; i < options.testTaps / 2; i++) {
      const verdict = classify(analyse(simulateTap(spot, { seed: options.seed * 15485863 + 90000 + s * 10000 + i })))
      result.offSpotTotal++
      result.offSpotByName[name][1]++
      if (verdict?.zone) {
        result.offSpotFired++
        result.offSpotByName[name][0]++
      }
    }
  })
  return result
}

/** Totals over several seeds (independent calibrations). */
export function runBenchmarks(seeds: number[], options: Omit<BenchmarkOptions, 'seed'>): BenchmarkResult {
  const total: BenchmarkResult = {
    correct: 0,
    wrong: 0,
    missed: 0,
    total: 0,
    offSpotFired: 0,
    offSpotTotal: 0,
    offSpotByName: {},
    calibrationAccuracy: 0,
    missReasons: {}
  }
  for (const seed of seeds) {
    const row = runBenchmark({ ...options, seed })
    total.correct += row.correct
    total.wrong += row.wrong
    total.missed += row.missed
    total.total += row.total
    total.offSpotFired += row.offSpotFired
    total.offSpotTotal += row.offSpotTotal
    total.calibrationAccuracy += row.calibrationAccuracy / seeds.length
    for (const [name, [fired, count]] of Object.entries(row.offSpotByName)) {
      const entry = (total.offSpotByName[name] ??= [0, 0])
      entry[0] += fired
      entry[1] += count
    }
    for (const [reason, count] of Object.entries(row.missReasons)) {
      total.missReasons[reason] = (total.missReasons[reason] ?? 0) + count
    }
  }
  return total
}
