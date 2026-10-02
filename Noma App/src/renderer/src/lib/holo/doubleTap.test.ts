import { describe, expect, it } from 'vitest'
import { DOUBLE_TAP_MAX_GAP_MS, DOUBLE_TAP_MIN_GAP_MS, DoubleTapDetector, fitDoubleTapWindow } from './doubleTap'

describe('DoubleTapDetector', () => {
  it('fires on two taps on the same zone a relaxed beat apart', () => {
    const detector = new DoubleTapDetector()
    expect(detector.tap('frontLeft', 1000, -20)).toBe('armed')
    expect(detector.tap('frontLeft', 1400, -22)).toBe('fire')
  })

  it('never fires on a single tap', () => {
    const detector = new DoubleTapDetector()
    expect(detector.tap('frontLeft', 1000, -20)).toBe('armed')
  })

  it('does not pair taps on different zones', () => {
    const detector = new DoubleTapDetector()
    detector.tap('frontLeft', 1000, -20)
    expect(detector.tap('frontRight', 1400, -20)).toBe('armed')
    // ...but the second one can start its own double tap.
    expect(detector.tap('frontRight', 1800, -20)).toBe('fire')
  })

  it("refuses a second half that comes too soon (a tap's own ringing)", () => {
    const detector = new DoubleTapDetector()
    detector.tap('frontLeft', 1000, -20)
    expect(detector.tap('frontLeft', 1000 + DOUBLE_TAP_MIN_GAP_MS - 1, -24)).toBe('armed')
  })

  it('treats taps further apart than the window as two separate taps', () => {
    const detector = new DoubleTapDetector()
    detector.tap('frontLeft', 1000, -20)
    expect(detector.tap('frontLeft', 1000 + DOUBLE_TAP_MAX_GAP_MS + 1, -20)).toBe('armed')
  })

  it('refuses a pair with very different loudness (one tap plus some other sound)', () => {
    const detector = new DoubleTapDetector()
    detector.tap('frontLeft', 1000, -10)
    expect(detector.tap('frontLeft', 1400, -40)).toBe('armed')
  })

  it('fires once for a triple tap, not twice', () => {
    const detector = new DoubleTapDetector()
    detector.tap('frontLeft', 1000, -20)
    expect(detector.tap('frontLeft', 1400, -20)).toBe('fire')
    expect(detector.tap('frontLeft', 1800, -20)).toBe('armed')
  })

  it('starts over after a reset (typing or trackpad use in between)', () => {
    const detector = new DoubleTapDetector()
    detector.tap('frontLeft', 1000, -20)
    detector.reset()
    expect(detector.tap('frontLeft', 1400, -20)).toBe('armed')
  })

  it('reports which zone is waiting for its second tap, until it expires', () => {
    const detector = new DoubleTapDetector()
    detector.tap('frontRight', 1000, -20)
    expect(detector.armedZone(1300)).toBe('frontRight')
    expect(detector.armedZone(1000 + DOUBLE_TAP_MAX_GAP_MS + 1)).toBeNull()
  })
})

describe('fitDoubleTapWindow (the user\'s own rhythm)', () => {
  it('fits a quick knocker (the real recording: 150-220 ms) a tight window', () => {
    const window = fitDoubleTapWindow([150, 165, 185, 190, 205, 210, 215, 220])!
    expect(window.minGapMs).toBe(DOUBLE_TAP_MIN_GAP_MS)
    expect(window.maxGapMs).toBeLessThan(DOUBLE_TAP_MAX_GAP_MS)
    // ...which still takes in every gap that was demonstrated.
    expect(window.maxGapMs).toBeGreaterThan(220)
  })

  it('never widens past the default, however slowly someone knocked in the wizard', () => {
    const window = fitDoubleTapWindow([600, 650, 700, 720, 750])!
    expect(window.maxGapMs).toBe(DOUBLE_TAP_MAX_GAP_MS)
  })

  it('caps an already-saved wide window when it is applied', () => {
    const detector = new DoubleTapDetector()
    detector.setWindow({ minGapMs: 120, maxGapMs: 1200 })
    detector.tap('frontLeft', 1000, -20)
    // 700 ms apart: two separate sounds, not a double tap.
    expect(detector.tap('frontLeft', 1700, -20)).toBe('armed')
  })

  it('never goes below the structural floor', () => {
    expect(fitDoubleTapWindow([100, 120, 140, 150])!.minGapMs).toBe(DOUBLE_TAP_MIN_GAP_MS)
  })

  it('needs a few double taps before it says anything', () => {
    expect(fitDoubleTapWindow([300, 320])).toBeNull()
  })

  it('is what the detector then uses', () => {
    const detector = new DoubleTapDetector()
    detector.setWindow({ minGapMs: 150, maxGapMs: 400 })
    detector.tap('frontLeft', 1000, -20)
    expect(detector.tap('frontLeft', 1450, -20)).toBe('armed')
    expect(detector.tap('frontLeft', 1650, -20)).toBe('fire')
  })
})

describe('one tap arriving twice is not a double tap', () => {
  it("refuses a second 'tap' when the level never fell in between (a ringing tail)", () => {
    const detector = new DoubleTapDetector()
    detector.tap('frontLeft', 1000, -20, { dipDb: -40 })
    expect(detector.tap('frontLeft', 1400, -24, { dipDb: -6 })).toBe('armed')
  })

  it('fires when there was a real quiet moment between the knocks', () => {
    const detector = new DoubleTapDetector()
    detector.tap('frontLeft', 1000, -20, { dipDb: -40 })
    expect(detector.tap('frontLeft', 1400, -21, { dipDb: -35 })).toBe('fire')
  })

  it("refuses a pair that doesn't sound alike", () => {
    const detector = new DoubleTapDetector()
    detector.setPairMatcher((a, b) => Math.abs(a[0] - b[0]) < 1)
    detector.tap('frontLeft', 1000, -20, { features: [0] })
    expect(detector.tap('frontLeft', 1400, -20, { features: [5], dipDb: -30 })).toBe('armed')
    expect(detector.tap('frontLeft', 1800, -20, { features: [5.2], dipDb: -30 })).toBe('fire')
  })
})
