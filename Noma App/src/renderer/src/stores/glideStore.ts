import { create } from 'zustand'
import type { GlideActivity, GlideState, HoloTouchCheckSummary, HoloTrackpadZoneCount } from '@shared/types'

/**
 * Glide in the renderer: a mirror of the state main owns (on/off and zone
 * count live in settings; main reads the touchpad and presses controls,
 * see main/holo/glideController.ts), the last swipe-in for feedback, and
 * the touch check. Nothing here has to be mounted for Glide to work.
 */

/** The touch check's guided steps, in order, and how long each runs. Timed
 *  rather than "click Next", because clicking Next on the trackpad would
 *  itself land in the recording. */
export const TOUCH_CHECK_STEPS: Array<{ kind: 'left' | 'right' | 'normal'; seconds: number }> = [
  { kind: 'left', seconds: 15 },
  { kind: 'right', seconds: 15 },
  { kind: 'normal', seconds: 20 }
]

/** An older build kept the zone count in this browser-storage key. */
const LEGACY_ZONES_KEY = 'noma.holo.trackpadZones'
/** Set once a swipe-in has run an action for real (Home's getting-started). */
const FIRST_RUN_KEY = 'noma.glide.firstActionAt'

function readFirstRun(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_KEY) !== null
  } catch {
    return false
  }
}

interface GlideStoreState {
  state: GlideState | null
  /** The most recent swipe-in (fired or not), for the status line. */
  lastActivity: GlideActivity | null
  isChanging: boolean
  /** A swipe-in has run an action at least once on this computer. */
  hasRunAction: boolean
  touchCheck: { step: number; endsAt: number } | null
  touchCheckResult: { summary: HoloTouchCheckSummary; savedTo: string } | null
  touchCheckDoneAt: number | null
  touchCheckError: string | null

  refresh: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
  setZoneCount: (zoneCount: HoloTrackpadZoneCount) => Promise<void>
  startTouchCheck: () => Promise<void>
  cancelTouchCheck: () => void
}

let touchCheckTimer: ReturnType<typeof setTimeout> | null = null
/** Bumped by every change, so a refresh that started before it can't
 *  overwrite the newer state when it lands. */
let stateVersion = 0

export const useGlideStore = create<GlideStoreState>((set, get) => ({
  state: null,
  lastActivity: null,
  isChanging: false,
  hasRunAction: readFirstRun(),
  touchCheck: null,
  touchCheckResult: null,
  touchCheckDoneAt: null,
  touchCheckError: null,

  refresh: async () => {
    const version = stateVersion
    const [state, touchCheckDoneAt] = await Promise.all([
      window.flow.getGlideState(),
      window.flow.getHoloTouchCheckLast().catch(() => null)
    ])
    set(version === stateVersion ? { state, touchCheckDoneAt } : { touchCheckDoneAt })
    migrateLegacyZoneCount(state)
  },

  setEnabled: async (enabled) => {
    stateVersion++
    set({ isChanging: true })
    try {
      set({ state: await window.flow.setGlideEnabled(enabled), lastActivity: null })
    } finally {
      set({ isChanging: false })
    }
  },

  setZoneCount: async (zoneCount) => {
    stateVersion++
    set({ state: await window.flow.setGlideZoneCount(zoneCount) })
  },

  startTouchCheck: async () => {
    if (get().touchCheck) return
    set({ touchCheckError: null, touchCheckResult: null })
    const status = await window.flow.startHoloTouchCheck().catch(() => null)
    if (!status || status.touchpads === 0) {
      if (status) void window.flow.stopHoloTouchCheck([])
      set({ touchCheckError: 'No precision touchpad to check.' })
      return
    }
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
  }
}))

/** One-time move of a two-zone choice made in an older build into the
 *  setting main now owns. */
function migrateLegacyZoneCount(state: GlideState): void {
  try {
    const legacy = localStorage.getItem(LEGACY_ZONES_KEY)
    if (legacy === null) return
    localStorage.removeItem(LEGACY_ZONES_KEY)
    if (legacy === '2' && state.zoneCount !== 2) void useGlideStore.getState().setZoneCount(2)
  } catch {
    // Storage blocked: nothing to migrate.
  }
}

const unsubscribers =
  typeof window !== 'undefined' && window.flow
    ? [
        window.flow.onGlideState((state) => {
          stateVersion++
          useGlideStore.setState({ state })
        }),
        window.flow.onGlideActivity((activity) => {
          const ran = activity.type === 'fire' && activity.outcome === 'pressed'
          if (ran && !useGlideStore.getState().hasRunAction) {
            try {
              localStorage.setItem(FIRST_RUN_KEY, String(activity.at))
            } catch {
              // Storage blocked: Home just asks again next launch.
            }
          }
          useGlideStore.setState((state) => ({ lastActivity: activity, hasRunAction: state.hasRunAction || ran }))
        })
      ]
    : []

// Load once at startup, so any screen (including onboarding resumed part-way)
// knows whether Glide is on without having to ask first.
if (typeof window !== 'undefined' && window.flow) void useGlideStore.getState().refresh()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const unsubscribe of unsubscribers) unsubscribe()
    if (touchCheckTimer) clearTimeout(touchCheckTimer)
  })
}
