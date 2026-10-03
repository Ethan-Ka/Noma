import { describe, expect, it } from 'vitest'
import {
  COOLDOWN_MS,
  EDGE_START,
  MAX_SWIPE_MS,
  MIN_TRAVEL,
  TrackpadGestureDetector,
  TYPING_QUIET_MS,
  edgeAt,
  zoneFor,
  type TouchContact,
  type TouchFrame
} from './trackpadGesture'
import { summarizeTouchCheck, type TraceFrame } from './touchTrace'

const finger = (x: number, y: number, extra: Partial<TouchContact> = {}): TouchContact => ({
  id: 1,
  tip: true,
  confident: true,
  x,
  y,
  ...extra
})

const frameOf = (contacts: TouchContact[], extra: Partial<TouchFrame> = {}): TouchFrame => ({
  device: 1,
  contacts,
  contactCount: contacts.filter((contact) => contact.tip).length,
  ...extra
})

/**
 * A finger path sampled every 8 ms (a precision touchpad reports at ~125 Hz):
 * from (x0, y0) to (x1, y1) over `ms`, then lifted.
 */
function path(x0: number, y0: number, x1: number, y1: number, ms: number, from = 10_000, extra: Partial<TouchContact> = {}) {
  const frames: Array<{ t: number; frame: TouchFrame }> = []
  const steps = Math.max(1, Math.round(ms / 8))
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    frames.push({ t: from + i * 8, frame: frameOf([finger(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, extra)]) })
  }
  frames.push({ t: from + steps * 8 + 8, frame: frameOf([{ ...finger(x1, y1), tip: false }]) })
  return frames
}

function play(detector: TrackpadGestureDetector, frames: Array<{ t: number; frame: TouchFrame }>) {
  return frames.flatMap(({ t, frame }) => detector.frame(frame, t))
}

const types = (events: Array<{ type: string }>) => events.map((event) => event.type)

describe('edges and zones', () => {
  it('only the outermost strip of each side counts as an edge', () => {
    expect(edgeAt(0.01)).toBe('left')
    expect(edgeAt(0.99)).toBe('right')
    expect(edgeAt(EDGE_START + 0.05)).toBeNull()
    expect(edgeAt(0.5)).toBeNull()
  })

  it('splits each side into halves with four zones, and not with two', () => {
    expect(zoneFor('left', 0.2, 4)).toBe('topLeft')
    expect(zoneFor('right', 0.8, 4)).toBe('bottomRight')
    expect(zoneFor('right', 0.8, 2)).toBe('topRight')
  })
})

describe('TrackpadGestureDetector', () => {
  it('fires once on a quick flick in from the left side', () => {
    const detector = new TrackpadGestureDetector()
    const events = play(detector, path(0.01, 0.3, 0.35, 0.33, 150))
    expect(types(events)).toEqual(['fire'])
    expect(events[0]).toMatchObject({ zone: 'topLeft' })
  })

  it('fires the lower half of the right side', () => {
    const detector = new TrackpadGestureDetector()
    const events = play(detector, path(0.99, 0.75, 0.7, 0.72, 150))
    expect(events).toEqual([expect.objectContaining({ type: 'fire', zone: 'bottomRight' })])
  })

  it('ignores a finger that lands inside the pad and moves the pointer, even through the edge band', () => {
    const detector = new TrackpadGestureDetector()
    expect(play(detector, path(0.3, 0.5, 0.0, 0.5, 150))).toEqual([])
    expect(play(detector, path(0.2, 0.5, 0.8, 0.5, 150, 20_000))).toEqual([])
  })

  it('ignores a tap on the edge (it never travels in)', () => {
    const detector = new TrackpadGestureDetector()
    expect(play(detector, path(0.02, 0.5, 0.025, 0.5, 80))).toEqual([])
  })

  it('a slow drag in from the edge is pointer use, not a swipe', () => {
    const detector = new TrackpadGestureDetector()
    const events = play(detector, path(0.01, 0.5, 0.4, 0.5, MAX_SWIPE_MS * 3))
    expect(events).toEqual([expect.objectContaining({ type: 'miss', reason: 'too-slow' })])
  })

  it('a mostly vertical stroke from the edge is not a swipe-in', () => {
    const detector = new TrackpadGestureDetector()
    const events = play(detector, path(0.01, 0.1, 0.01 + MIN_TRAVEL + 0.01, 0.9, 150))
    expect(events).toEqual([expect.objectContaining({ type: 'miss', reason: 'not-sideways' })])
  })

  it('ignores a palm, a second finger and a click', () => {
    expect(play(new TrackpadGestureDetector(), path(0.01, 0.5, 0.4, 0.5, 150, 10_000, { confident: false }))).toEqual([
      expect.objectContaining({ type: 'miss', reason: 'palm' })
    ])

    const twoFingers = new TrackpadGestureDetector()
    twoFingers.frame(frameOf([finger(0.01, 0.5)]), 10_000)
    expect(twoFingers.frame(frameOf([finger(0.05, 0.5), finger(0.5, 0.5, { id: 2 })]), 10_008)).toEqual([
      expect.objectContaining({ type: 'miss', reason: 'second-finger' })
    ])

    const click = new TrackpadGestureDetector()
    click.frame(frameOf([finger(0.01, 0.9)]), 10_000)
    expect(click.frame(frameOf([finger(0.05, 0.9)], { clicked: true }), 10_008)).toEqual([
      expect.objectContaining({ type: 'miss', reason: 'click' })
    ])
  })

  it('ignores a swipe right after typing, and cancels one when a key is pressed', () => {
    const detector = new TrackpadGestureDetector()
    detector.noteKey(10_000)
    const early = play(detector, path(0.01, 0.5, 0.4, 0.5, 150, 10_000 + TYPING_QUIET_MS - 200))
    expect(early).toEqual([expect.objectContaining({ type: 'miss', reason: 'typing' })])

    const during = new TrackpadGestureDetector()
    during.frame(frameOf([finger(0.01, 0.5)]), 20_000)
    expect(during.noteKey(20_050)).toEqual([expect.objectContaining({ type: 'miss', reason: 'typing' })])
  })

  it('fires once per touch, then waits out a short cooldown', () => {
    const detector = new TrackpadGestureDetector()
    // Keeps sliding well past the threshold: still one fire.
    expect(types(play(detector, path(0.01, 0.5, 0.9, 0.5, 300)))).toEqual(['fire'])
    expect(play(detector, path(0.99, 0.5, 0.6, 0.5, 150, 10_320))).toEqual([])
    expect(types(play(detector, path(0.99, 0.5, 0.6, 0.5, 150, 10_320 + COOLDOWN_MS)))).toEqual(['fire'])
  })

  it('remembers which touch fired, for the pointer to be put back', () => {
    const detector = new TrackpadGestureDetector()
    play(detector, path(0.01, 0.5, 0.4, 0.5, 150))
    expect(detector.lastFired).toEqual({ device: 1, id: 1 })
  })
})

describe('summarizeTouchCheck', () => {
  it('measures where swipes start and replays the rules per phase', () => {
    const frames: TraceFrame[] = [
      ...path(0.01, 0.5, 0.4, 0.5, 150, 1_000).map(({ t, frame }) => ({ ...frame, t })),
      ...path(0.98, 0.5, 0.6, 0.5, 150, 5_000).map(({ t, frame }) => ({ ...frame, t })),
      ...path(0.4, 0.4, 0.6, 0.6, 400, 9_000).map(({ t, frame }) => ({ ...frame, t }))
    ]
    const { phases } = summarizeTouchCheck({ frames, keys: [] }, [
      { kind: 'left', startAt: 0, endAt: 4_000 },
      { kind: 'right', startAt: 4_000, endAt: 8_000 },
      { kind: 'normal', startAt: 8_000, endAt: 12_000 }
    ])
    expect(phases[0]).toMatchObject({ touches: 1, startedAtEdge: 1, fires: 1, firesOnSide: 1 })
    expect(phases[0].firstEdgeDistance?.[0]).toBeCloseTo(0.01)
    expect(phases[1]).toMatchObject({ touches: 1, fires: 1, firesOnSide: 1 })
    expect(phases[1].firstEdgeDistance?.[0]).toBeCloseTo(0.02)
    expect(phases[2]).toMatchObject({ touches: 1, startedAtEdge: 0, fires: 0, firstEdgeDistance: null })
  })
})
