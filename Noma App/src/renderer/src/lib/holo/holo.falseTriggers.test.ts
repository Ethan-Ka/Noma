import { describe, expect, it } from 'vitest'
import type { HoloZone } from '@shared/types'
import {
  buildDiscriminant,
  buildModel,
  classifyZone,
  deriveGates,
  detectImpact,
  evaluateDiscriminant,
  extractTapFeatures,
  tapPeakDb,
  type ClassificationResult,
  type ImpactCheck
} from './classifier'
import { DoubleTapDetector } from './doubleTap'
import { NON_TAP_KINDS, PALM_SPOTS, SIM_SAMPLE_RATE, makeRng, simulateNonTap, simulateTap } from './testing/tapSimulator'


describe('Holo false triggers (simulated)', () => {
  it('almost never fires on everyday sounds, and still fires on deliberate double taps', () => {
    const zones: Array<[HoloZone, typeof PALM_SPOTS.left]> = [['frontLeft', PALM_SPOTS.left], ['frontRight', PALM_SPOTS.right]]
    let doubleOk = 0
    let doubleWrong = 0
    let doubleN = 0
    let singleOk = 0
    let singleN = 0
    let nonTapEvents = 0
    let singleModeFires = 0
    let doubleModeFires = 0
    for (let seed = 1; seed <= 4; seed++) {
      const tapsByZone: Array<{ zone: HoloZone; taps: number[][] }> = []
      const peaks: number[] = []
      const impacts: ImpactCheck[] = []
      zones.forEach(([zone, spot], s) => {
        const taps: number[][] = []
        for (let i = 0; i < 12; i++) {
          const a = simulateTap(spot, { seed: seed * 7919 + s * 1000 + i })
          taps.push(extractTapFeatures([a], [0], SIM_SAMPLE_RATE)!)
          peaks.push(tapPeakDb([a]))
          impacts.push(detectImpact([a], SIM_SAMPLE_RATE)!)
        }
        tapsByZone.push({ zone, taps })
      })
      const model = buildModel(tapsByZone)
      const ev = evaluateDiscriminant(tapsByZone, model.scale)
      const gates = deriveGates(ev.distances, peaks, impacts)
      const disc = buildDiscriminant(tapsByZone, model.scale)
      const classify = (a: Float32Array): (ClassificationResult & { peakDb: number }) | null => {
        const f = extractTapFeatures([a], [0], SIM_SAMPLE_RATE)
        if (!f) return null
        const peakDb = tapPeakDb([a])
        return {
          ...classifyZone(f, model.zones, model.scale, {
            weights: model.weights,
            gates,
            peakDb,
            impact: detectImpact([a], SIM_SAMPLE_RATE) ?? undefined,
            discriminant: disc
          }),
          peakDb
        }
      }
      // Same logic as holoStore's onTap.
      const feed = (detector: DoubleTapDetector, r: ReturnType<typeof classify>, at: number): HoloZone | null => {
        if (!r) return null
        const zone = r.zone ?? (r.reason === 'ambiguous' && r.candidate && detector.armedZone(at) === r.candidate ? r.candidate : null)
        if (!zone) return null
        return detector.tap(zone, at, r.peakDb) === 'fire' ? zone : null
      }
      const rng = makeRng(seed * 99991)

      // Deliberate double taps, one attempt each, no retries.
      for (let i = 0; i < 80; i++) {
        const [zone, spot] = zones[rng() < 0.5 ? 0 : 1]
        const detector = new DoubleTapDetector()
        const t0 = 100000 * i
        // Real double taps: 150-220 ms apart in a recording of a real laptop.
      const gap = 150 + rng() * 100
        const first = classify(simulateTap(spot, { seed: seed * 1_000_003 + i * 2 }))
        const second = classify(simulateTap(spot, { seed: seed * 1_000_003 + i * 2 + 1, force: undefined }))
        feed(detector, first, t0)
        const fired = feed(detector, second, t0 + gap)
        doubleN++
        if (fired === zone) doubleOk++
        else if (fired) doubleWrong++
        singleN++
        if (first?.zone === zone) singleOk++
      }

      // Everyday non-tap activity: random kinds, often in quick bursts.
      const detector = new DoubleTapDetector()
      let t = 0
      for (let i = 0; i < 400; i++) {
        t += rng() < 0.4 ? 250 + rng() * 500 : 800 + rng() * 4000
        const kind = NON_TAP_KINDS[Math.floor(rng() * NON_TAP_KINDS.length)]
        const r = classify(simulateNonTap(kind, { seed: seed * 424243 + i }))
        nonTapEvents++
        if (r?.zone) singleModeFires++
        if (feed(detector, r, t)) doubleModeFires++
      }
    }
    // Double tap has to be far safer than single tap, and nearly silent.
    expect(doubleModeFires).toBeLessThanOrEqual(Math.max(3, singleModeFires / 8))
    expect(doubleModeFires / nonTapEvents).toBeLessThan(0.003)
    // ...without making deliberate use unreliable.
    expect(doubleOk / doubleN).toBeGreaterThan(0.78)
    expect(doubleWrong / doubleN).toBeLessThan(0.01)
    expect(singleOk / singleN).toBeGreaterThan(0.85)
  }, 300000)
})
