import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { summarizeTouchCheck, type CheckPhase, type TouchTrace } from './touchTrace'
import { TrackpadGestureDetector } from './trackpadGesture'

/**
 * Regression tests on a real recording: the touch check run on the dev
 * laptop (ASUS ROG Zephyrus G14, ASUS Precision Touchpad) on 2026-10-03,
 * the data the current thresholds were tuned on. 46 deliberate swipe-ins
 * (19 from the left, 27 from the right) and 43 ordinary touches. If a
 * change to the recognizer makes these numbers worse, it's a regression on
 * the only real hardware data we have. This proves nothing about other
 * touchpads.
 */

interface Fixture {
  phases: CheckPhase[]
  keys: number[]
  frames: Array<[number, number, number, ...Array<[number, number, number, number, number]>]>
}

function loadTrace(): { trace: TouchTrace; phases: CheckPhase[] } {
  const fixture = JSON.parse(
    readFileSync(join(__dirname, 'fixtures', 'touch-check-g14-2026-10-03.json'), 'utf8')
  ) as Fixture
  return {
    phases: fixture.phases,
    trace: {
      keys: fixture.keys,
      frames: fixture.frames.map(([t, contactCount, clicked, ...contacts]) => ({
        t,
        device: 1,
        contactCount,
        clicked: clicked === 1,
        contacts: contacts.map(([id, tip, confident, x, y]) => ({ id, tip: tip === 1, confident: confident === 1, x, y }))
      }))
    }
  }
}

describe('Glide recognizer on a recorded touch check (G14)', () => {
  const { trace, phases } = loadTrace()
  const summary = summarizeTouchCheck(trace, phases)
  const phase = (kind: CheckPhase['kind']) => summary.phases.find((item) => item.kind === kind)!

  it('contains what the recording is documented to contain', () => {
    expect(phase('left').touches).toBe(19)
    expect(phase('right').touches).toBe(27)
    expect(phase('normal').touches).toBe(43)
  })

  it('catches nearly every deliberate swipe-in, on the right side', () => {
    expect(phase('left').firesOnSide).toBeGreaterThanOrEqual(18)
    expect(phase('right').firesOnSide).toBeGreaterThanOrEqual(25)
  })

  it('rarely fires on the wrong side', () => {
    expect(phase('left').fires - phase('left').firesOnSide).toBeLessThanOrEqual(1)
    expect(phase('right').fires - phase('right').firesOnSide).toBeLessThanOrEqual(2)
  })

  it('stays quiet during ordinary trackpad use (at most the one known edge flick)', () => {
    expect(phase('normal').fires).toBeLessThanOrEqual(1)
  })

  it('treats any key press as typing: the same swipes right after typing all count as misses', () => {
    // Synthetic keys 100 ms before every left-phase touch, on real frames.
    const left = phases.find((item) => item.kind === 'left')!
    const starts = trace.frames
      .filter((frame) => frame.t >= left.startAt && frame.t < left.endAt && frame.contacts.some((c) => c.tip))
      .map((frame) => frame.t)
    const keys = [...new Set(starts.map((t) => t - 100))]
    const detector = new TrackpadGestureDetector()
    let fires = 0
    let k = 0
    for (const frame of trace.frames.filter((item) => item.t >= left.startAt && item.t < left.endAt)) {
      while (k < keys.length && keys[k] <= frame.t) detector.noteKey(keys[k++])
      fires += detector.frame(frame, frame.t).filter((event) => event.type === 'fire').length
    }
    expect(fires).toBe(0)
  })
})
