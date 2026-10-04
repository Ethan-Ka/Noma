import { create } from 'zustand'
import type {
  HoloTouchCheckSummary,
  HoloTrackpadEvent,
  HoloTrackpadStatus,
  HoloTrackpadZone,
  HoloTrackpadZoneCount,
  InputSource
} from '@shared/types'

/**
 * Holo: the free, no-hardware way to press Noma's controls. Slide a finger
 * from the empty space beside the trackpad onto it, and the control for
 * that side runs. Main recognises the gesture from the precision touchpad's
 * raw reports (main/holo/trackpadGesture.ts); this store turns it on and
 * off, presses the zone's control, and runs the touch check.
 */

const ZONES_KEY = 'noma.holo.trackpadZones'
/** Whether swipe-ins were on when the app last ran (see resumeTrackpad). */
const ON_KEY = 'noma.holo.trackpadOn'

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked: the preference just doesn't persist.
  }
}

/** What the last swipe-in came to (Holo page status line). */
export interface TrackpadOutcome {
  zone: HoloTrackpadZone
  outcome: 'pressed' | 'no-control' | Extract<HoloTrackpadEvent, { type: 'miss' }>['reason']
  at: number
}

/** The touch check's guided steps, in order, and how long each runs. Timed
 *  rather than "click Next", because clicking Next on the trackpad would
 *  itself land in the recording. */
export const TOUCH_CHECK_STEPS: Array<{ kind: 'left' | 'right' | 'normal'; seconds: number }> = [
  { kind: 'left', seconds: 15 },
  { kind: 'right', seconds: 15 },
  { kind: 'normal', seconds: 20 }
]

/** Which control slot each swipe-in zone presses. */
export const TRACKPAD_ZONE_SLOTS: Record<HoloTrackpadZone, number> = {
  topLeft: 1,
  topRight: 2,
  bottomLeft: 3,
  bottomRight: 4
}

const NO_TOUCHPAD_MESSAGE =
  'Glide needs Windows and a precision touchpad, which this computer does not report. Most laptops from the last several years have one; check Settings > Bluetooth & devices > Touchpad.'

interface HoloStoreState {
  inputSource: InputSource
  /** Swipe-ins are on. */
  isListening: boolean
  /** A real problem to show (no touchpad, not Windows), never swallowed. */
  error: string | null
  /** Precision touchpads found when swipe-ins last started. */
  trackpadStatus: HoloTrackpadStatus | null
  trackpadLast: TrackpadOutcome | null
  /** Left/right only, or each side split in halves. */
  trackpadZones: HoloTrackpadZoneCount
  /** The touch check in progress: which step, and when it ends. */
  touchCheck: { step: number; endsAt: number } | null
  touchCheckResult: { summary: HoloTouchCheckSummary; savedTo: string } | null
  /** When the last touch check was saved, or null if it never has been. Once
   *  set, the Holo page shows the check as a small "run again" line. */
  touchCheckDoneAt: number | null

  refresh: () => Promise<void>
  setInputSource: (source: InputSource) => Promise<void>
  startListening: () => Promise<void>
  stopListening: () => void
  setTrackpadZones: (zones: HoloTrackpadZoneCount) => void
  startTouchCheck: () => Promise<void>
  cancelTouchCheck: () => void
  /** At app launch: turns swipe-ins back on if they were on last time and
   *  Holo is the chosen Input Source, so they work in the background
   *  without opening the Holo page first. */
  resumeTrackpad: () => Promise<void>
}

/** Advances the touch check from one step to the next. */
let touchCheckTimer: ReturnType<typeof setTimeout> | null = null

export const useHoloStore = create<HoloStoreState>((set, get) => ({
  inputSource: 'keyboard',
  isListening: false,
  error: null,
  trackpadStatus: null,
  trackpadLast: null,
  trackpadZones: readStored<HoloTrackpadZoneCount>(ZONES_KEY, 4),
  touchCheck: null,
  touchCheckResult: null,
  touchCheckDoneAt: null,

  refresh: async () => {
    const [inputSource, touchCheckDoneAt] = await Promise.all([
      window.flow.getInputSource(),
      window.flow.getHoloTouchCheckLast().catch(() => null)
    ])
    set({ inputSource, touchCheckDoneAt })
  },

  setInputSource: async (source) => {
    const resolved = await window.flow.setInputSource(source)
    set({ inputSource: resolved })
    // Back to Keyboard: Holo has no reason to keep watching the trackpad.
    if (resolved !== 'holo') get().stopListening()
  },

  startListening: async () => {
    set({ error: null })
    const status = await window.flow.setHoloTrackpad(true, get().trackpadZones).catch(() => null)
    if (!status || status.touchpads === 0) {
      if (status) void window.flow.setHoloTrackpad(false)
      set({ trackpadStatus: status, error: NO_TOUCHPAD_MESSAGE })
      return
    }
    writeStored(ON_KEY, true)
    set({ isListening: true, trackpadStatus: status })
  },

  stopListening: () => {
    void window.flow.setHoloTrackpad(false)
    writeStored(ON_KEY, false)
    set({ isListening: false, trackpadLast: null })
  },

  setTrackpadZones: (zones) => {
    writeStored(ZONES_KEY, zones)
    set({ trackpadZones: zones })
    if (get().isListening) void window.flow.setHoloTrackpad(true, zones)
  },

  startTouchCheck: async () => {
    if (get().touchCheck) return
    set({ error: null, touchCheckResult: null })
    const status = await window.flow.startHoloTouchCheck().catch(() => null)
    if (!status || status.touchpads === 0) {
      if (status) void window.flow.stopHoloTouchCheck([])
      set({ error: NO_TOUCHPAD_MESSAGE })
      return
    }
    // Each step runs for a fixed time, then the next starts on its own.
    const phases: Array<{ kind: 'left' | 'right' | 'normal'; startAt: number; endAt: number }> = []
    let at = Date.now()
    for (const step of TOUCH_CHECK_STEPS) {
      phases.push({ kind: step.kind, startAt: at, endAt: at + step.seconds * 1000 })
      at += step.seconds * 1000
    }
    const run = (index: number): void => {
      if (index >= phases.length) {
        touchCheckTimer = null
        set({ touchCheck: null })
        void window.flow
          .stopHoloTouchCheck(phases)
          .then((result) => set(result ? { touchCheckResult: result, touchCheckDoneAt: Date.now() } : {}))
        return
      }
      set({ touchCheck: { step: index, endsAt: phases[index].endAt } })
      touchCheckTimer = setTimeout(() => run(index + 1), phases[index].endAt - Date.now())
    }
    run(0)
  },

  cancelTouchCheck: () => {
    if (touchCheckTimer) clearTimeout(touchCheckTimer)
    touchCheckTimer = null
    set({ touchCheck: null })
    void window.flow.stopHoloTouchCheck([])
  },

  resumeTrackpad: async () => {
    if (get().isListening || !readStored<boolean>(ON_KEY, false)) return
    const inputSource = await window.flow.getInputSource()
    set({ inputSource })
    if (inputSource === 'holo') await get().startListening()
  }
}))

/**
 * Presses whatever control sits in `slot` for the application focused
 * *right now* — the same slots the physical/virtual keyboard uses. Read
 * fresh from main every time: the shared flowStore only receives context
 * pushes while a page that subscribes to it is mounted, so it goes stale
 * exactly when Holo matters most (user in another app). False when the slot
 * has no control.
 */
async function pressSlot(slot: number): Promise<boolean> {
  const context = await window.flow.getActiveContext()
  const control = context.profile?.controls.find((item) => item.slot === slot)
  if (!control) return false
  void window.flow.pressControl(control.id)
  return true
}

const stopTrackpadEvents =
  typeof window !== 'undefined' && window.flow
    ? window.flow.onHoloTrackpadEvent((event) => {
        if (!useHoloStore.getState().isListening) return
        if (event.type === 'miss') {
          useHoloStore.setState({ trackpadLast: { zone: event.zone, outcome: event.reason, at: event.at } })
          return
        }
        void pressSlot(TRACKPAD_ZONE_SLOTS[event.zone]).then((pressed) => {
          useHoloStore.setState({
            trackpadLast: { zone: event.zone, outcome: pressed ? 'pressed' : 'no-control', at: event.at }
          })
        })
      })
    : null

// In development, editing this file hot-reloads it, which creates a fresh
// store but would leave the old event listener pressing controls too.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopTrackpadEvents?.()
    if (touchCheckTimer) clearTimeout(touchCheckTimer)
  })
}
