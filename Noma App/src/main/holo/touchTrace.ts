import type { HoloTouchCheckSummary } from '@shared/types'
import { TrackpadGestureDetector, edgeAt, type TouchContact, type TouchFrame } from './trackpadGesture'

/**
 * The trackpad touch check (Holo page): a short guided recording of the
 * user swiping in from each side, then using the trackpad normally. It
 * exists so the swipe-in rules are set from what this touchpad actually
 * reports (how near the edge a sliding-in finger is first seen, whether the
 * pad calls it a palm at first, how fast people flick) rather than from
 * assumptions, and so a change can be re-scored on the same touches.
 */

export interface TraceFrame extends TouchFrame {
  /** Date.now() ms. */
  t: number
}

export interface TouchTrace {
  frames: TraceFrame[]
  /** Key press times (Date.now() ms), never which key. */
  keys: number[]
}

export interface CheckPhase {
  kind: 'left' | 'right' | 'normal'
  startAt: number
  endAt: number
}

/** The first frame each finger touch was seen in. */
function firstContacts(frames: TraceFrame[]): Array<{ t: number; contact: TouchContact }> {
  const firsts: Array<{ t: number; contact: TouchContact }> = []
  const down = new Map<number, Set<number>>()
  for (const frame of frames) {
    const wasDown = down.get(frame.device) ?? new Set<number>()
    const active = frame.contacts.filter((contact) => contact.tip)
    for (const contact of active) if (!wasDown.has(contact.id)) firsts.push({ t: frame.t, contact })
    down.set(frame.device, new Set(active.map((contact) => contact.id)))
  }
  return firsts
}

function median(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)]
}

export function summarizeTouchCheck(trace: TouchTrace, phases: CheckPhase[]): HoloTouchCheckSummary {
  return {
    phases: phases.map((phase) => {
      const inPhase = (t: number): boolean => t >= phase.startAt && t < phase.endAt
      const firsts = firstContacts(trace.frames.filter((frame) => inPhase(frame.t)))
      const distances =
        phase.kind === 'normal'
          ? []
          : firsts.map(({ contact }) => (phase.kind === 'left' ? contact.x : 1 - contact.x)).sort((a, b) => a - b)

      // What the current rules would have done, replayed on this phase alone.
      const detector = new TrackpadGestureDetector()
      const events = []
      const keys = trace.keys.filter(inPhase)
      let k = 0
      for (const frame of trace.frames.filter((item) => inPhase(item.t))) {
        while (k < keys.length && keys[k] <= frame.t) events.push(...detector.noteKey(keys[k++]))
        events.push(...detector.frame(frame, frame.t))
      }
      const fires = events.filter((event) => event.type === 'fire')
      const misses: Record<string, number> = {}
      for (const event of events) if (event.type === 'miss') misses[event.reason] = (misses[event.reason] ?? 0) + 1
      const onSide = (zone: string): boolean =>
        phase.kind === 'left' ? zone.endsWith('Left') : phase.kind === 'right' && zone.endsWith('Right')

      return {
        kind: phase.kind,
        touches: firsts.length,
        startedAtEdge: firsts.filter(({ contact }) => edgeAt(contact.x) !== null).length,
        firstEdgeDistance: distances.length
          ? [distances[0], median(distances), distances[distances.length - 1]]
          : null,
        firstConfident: firsts.length ? firsts.filter(({ contact }) => contact.confident).length / firsts.length : 0,
        fires: fires.length,
        firesOnSide: fires.filter((event) => onSide(event.zone)).length,
        misses
      }
    })
  }
}

