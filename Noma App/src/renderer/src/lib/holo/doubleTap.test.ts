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
  it('fits a quick knocker a tighter, earlier window', () => {
    const window = fitDoubleTapWindow([280, 300, 310, 320, 330, 350])!
    expect(window.minGapMs).toBe(DOUBLE_TAP_MIN_GAP_MS)
    expect(window.maxGapMs).toBeLessThan(DOUBLE_TAP_MAX_GAP_MS)
  })

  it('gives a slow knocker a longer window than the default', () => {
    const window = fitDoubleTapWindow([600, 650, 700, 720, 750])!
    expect(window.maxGapMs).toBeGreaterThan(DOUBLE_TAP_MAX_GAP_MS)
    expect(window.minGapMs).toBeGreaterThan(DOUBLE_TAP_MIN_GAP_MS)
  })

  it('never goes below the structural floor', () => {
    expect(fitDoubleTapWindow([100, 120, 140, 150])!.minGapMs).toBe(DOUBLE_TAP_MIN_GAP_MS)
  })

  it('needs a few double taps before it says anything', () => {
    expect(fitDoubleTapWindow([300, 320])).toBeNull()
  })

  it('is what the detector then uses', () => {
    const detector = new DoubleTapDetector()
    detector.setWindow({ minGapMs: 500, maxGapMs: 1100 })
    detector.tap('frontLeft', 1000, -20)
    expect(detector.tap('frontLeft', 1400, -20)).toBe('armed')
    expect(detector.tap('frontLeft', 2400, -20)).toBe('fire')
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
