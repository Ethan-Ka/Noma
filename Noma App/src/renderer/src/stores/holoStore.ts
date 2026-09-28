import { create } from 'zustand'
import {
  HOLO_CALIBRATION_VERSION,
  type HoloCalibration,
  type HoloInputGateStatus,
  type HoloZone,
  type InputSource,
  type LaptopInfo
} from '@shared/types'
import { getHoloZones, recommendHoloZoneCount, type HoloZoneCount } from '@shared/constants'
import { HoloCaptureEngine, type MicInfo } from '../lib/holo/holoCapture'
import type { MicCandidate } from '../lib/holo/micKind'
import {
  buildModel,
  deriveGates,
  evaluateDiscriminant,
  MAX_IGNORED_SOUNDS,
  type HoloSensitivity,
  type ImpactCheck
} from '../lib/holo/classifier'

/**
 * One capture engine for the whole app's lifetime (not per-page) — Holo is
 * meant to work "in the background" while the user is in some other real
 * application, so it can't be torn down just because the Holo page isn't
 * the one currently showing. Same singleton-module pattern main/index.ts
 * uses for captureService.
 */
const engine = new HoloCaptureEngine()

/** Turns on main's key/mouse/touch gate and records what this machine's
 *  touch hardware lets it see (shown on the Holo page). */
async function enableInputGate(): Promise<void> {
  const touchCoverage = await window.flow.setHoloInputGate(true)
  useHoloStore.setState({ touchCoverage })
}

const SENSITIVITY_KEY = 'noma.holo.sensitivity'
const COOLDOWN_KEY = 'noma.holo.cooldown'
const ALLOW_EXTERNAL_KEY = 'noma.holo.allowExternalMic'
const ZONE_OVERRIDE_KEY = 'noma.holo.zoneOverride'
export type ZoneOverride = 'auto' | HoloZoneCount

interface SetupInputs {
  laptop: LaptopInfo | null
  zoneOverride: ZoneOverride
}

/** Everything derived from "what computer is this": zone count and the
 *  resulting ordered zone list. Zone *position* no longer depends on
 *  anything measured or looked up — see getHoloZones' own doc comment. */
function resolveSetup(inputs: SetupInputs): {
  zoneCount: HoloZoneCount
  zoneReason: string
  activeZones: HoloZone[]
} {
  let zoneCount: HoloZoneCount
  let zoneReason: string
  if (inputs.zoneOverride !== 'auto') {
    zoneCount = inputs.zoneOverride
    zoneReason = 'Set manually'
  } else {
    const recommended = recommendHoloZoneCount(inputs.laptop)
    zoneCount = recommended.count
    zoneReason = recommended.reason
  }

  return { zoneCount, zoneReason, activeZones: getHoloZones(zoneCount) }
}

function currentSetup(state: SetupInputs): ReturnType<typeof resolveSetup> {
  return resolveSetup(state)
}

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

/** What happened to the most recent sound Holo heard — shown live on the
 *  Holo page so "nothing happens" is never a mystery. */
export type TapOutcome =
  | 'pressed'
  | 'no-control'
  | 'ignored-input'
  | 'unrecognized'
  | 'ambiguous'
  | 'wrong-level'
  | 'voice'
  | 'not-a-tap'
  | 'set-down'
  | 'learned-ignore'
  | 'layout-changed'

interface LastTap {
  zone: HoloZone | null
  confidence: number
  outcome: TapOutcome
  at: number
  /** The raw measurements behind the outcome (Holo page > Details). */
  peakDb: number
  impact: ImpactCheck | null
  /** Kept so "that wasn't a tap" can teach Noma this exact sound without
   *  asking the user to reproduce it — it has already been heard once. */
  features: number[]
}

/**
 * How long Holo stays deaf after a control fires.
 *
 * The default assumes what a macro actually is: the end of a decision, not a
 * key held down. Someone who has just fired one is reading the result of it,
 * not queueing another — so a second tap a beat later is far more likely to
 * be the same one made again by a person who wasn't sure it landed than a
 * genuine second action. "Rapid" is for the case that assumption is wrong,
 * a zone mapped to something like volume that really is pressed in a burst.
 */
export type HoloPace = 'rapid' | 'normal' | 'deliberate'
export const HOLO_COOLDOWN_MS: Record<HoloPace, number> = { rapid: 300, normal: 900, deliberate: 2000 }

/**
 * Adds examples to the learned-ignore list and persists them.
 *
 * Oldest-first eviction at MAX_IGNORED_SOUNDS: a desk, a room and a mouse all
 * change over time, and a list that only ever grew would slowly veto more and
 * more of what the user actually does.
 */
async function appendIgnoredSounds(
  get: () => HoloStoreState,
  set: (partial: Partial<HoloStoreState>) => void,
  examples: number[][]
): Promise<void> {
  const calibration = get().calibration
  if (!calibration) return
  const ignoredSounds = [...(calibration.ignoredSounds ?? []), ...examples].slice(-MAX_IGNORED_SOUNDS)
  const saved = await window.flow.saveHoloCalibration({ ...calibration, ignoredSounds })
  engine.setCalibration(saved)
  set({ calibration: saved })
}

export type CalibrationProgress = { phase: 'zone'; zone: HoloZone; zoneIndex: number; totalZones: number; tapIndex: number }

interface HoloStoreState {
  inputSource: InputSource
  calibration: HoloCalibration | null
  isLoading: boolean
  isListening: boolean
  isCalibrating: boolean
  /** Set on a failed start()/calibrate() — a real error to show, not
   *  silently pretending Holo is listening when it isn't. */
  micError: string | null
  lastTap: LastTap | null
  /** Microphones in use while listening (auto-detected — none configured). */
  mics: MicInfo[]
  /** Every usable microphone on this computer, for the on/off list. */
  availableMics: MicCandidate[]
  /** Off by default: an external mic is used only if the user allows it AND no built-in mic exists. */
  allowExternalMic: boolean
  sensitivity: HoloSensitivity
  /** How long taps are ignored after a control fires (see HOLO_COOLDOWN_MS). */
  pace: HoloPace
  /** Live input level as a multiple of the trigger threshold (1 = triggers). */
  level: number
  /** True while the mic is switched off because the user is typing/clicking. */
  pausedForTyping: boolean
  /** What this computer's trackpad/touchscreen lets Holo detect (null
   *  until listening starts, or when touch reports aren't available). */
  touchCoverage: HoloInputGateStatus | null
  /** True while taps are being ignored because a control just fired. */
  coolingDown: boolean
  /** True when the mic setup differs from what was calibrated. */
  layoutMismatch: boolean
  laptop: LaptopInfo | null
  zoneOverride: ZoneOverride
  /** How many zones this computer uses (auto-detected unless overridden). */
  zoneCount: HoloZoneCount
  zoneReason: string
  setZoneOverride: (override: ZoneOverride) => void
  /** Zones in slot order for the current setup. */
  activeZones: HoloZone[]

  refresh: () => Promise<void>
  setInputSource: (source: InputSource) => Promise<void>
  startListening: () => Promise<void>
  stopListening: () => void
  setSensitivity: (sensitivity: HoloSensitivity) => void
  setPace: (pace: HoloPace) => void
  /** Teaches Noma that a sound is not a tap. Either the one it just
   *  reacted to, or `count` fresh ones the user makes on purpose. */
  ignoreLastSound: () => Promise<void>
  learnIgnoredSounds: (count: number, onProgress: (index: number, total: number) => void) => Promise<void>
  clearIgnoredSounds: () => Promise<void>
  /** True while `learnIgnoredSounds` is listening. */
  isLearningIgnored: boolean
  setAllowExternalMic: (allow: boolean) => Promise<void>
  refreshAvailableMics: () => Promise<void>
  /**
   * Walks through all 4 zones, `tapsPerZone` taps each; reports progress
   * via `onProgress`. Computes the model + a leave-one-out accuracy and
   * saves it. Stray sounds (typing, clicks) are ignored automatically by
   * the input gate — there's no separate "teach it to ignore typing" step.
   */
  calibrate: (tapsPerZone: number, onProgress: (update: CalibrationProgress) => void) => Promise<void>
  clearCalibration: () => Promise<void>
}

engine.setSensitivity(readStored<HoloSensitivity>(SENSITIVITY_KEY, 'medium'))
engine.setAllowExternalMic(readStored<boolean>(ALLOW_EXTERNAL_KEY, false))

export const useHoloStore = create<HoloStoreState>((set, get) => ({
  inputSource: 'keyboard',
  calibration: null,
  isLoading: true,
  isListening: false,
  isCalibrating: false,
  micError: null,
  lastTap: null,
  mics: [],
  availableMics: [],
  allowExternalMic: readStored<boolean>(ALLOW_EXTERNAL_KEY, false),
  sensitivity: readStored<HoloSensitivity>(SENSITIVITY_KEY, 'medium'),
  pace: readStored<HoloPace>(COOLDOWN_KEY, 'normal'),
  coolingDown: false,
  isLearningIgnored: false,
  level: 0,
  pausedForTyping: false,
  touchCoverage: null,
  layoutMismatch: false,
  laptop: null,
  zoneOverride: readStored<ZoneOverride>(ZONE_OVERRIDE_KEY, 'auto'),
  ...resolveSetup({
    laptop: null,
    zoneOverride: readStored<ZoneOverride>(ZONE_OVERRIDE_KEY, 'auto')
  }),

  setZoneOverride: (override) => {
    writeStored(ZONE_OVERRIDE_KEY, override)
    set({ zoneOverride: override })
    set(currentSetup(get()))
  },

  refresh: async () => {
    set({ isLoading: true })
    const [inputSource, calibration, laptop] = await Promise.all([
      window.flow.getInputSource(),
      window.flow.getHoloCalibration(),
      window.flow.getLaptopInfo().catch(() => null)
    ])
    engine.setCalibration(calibration)
    set({
      inputSource,
      calibration,
      isLoading: false,
      laptop
    })
    set(currentSetup(get()))
  },

  setInputSource: async (source) => {
    const resolved = await window.flow.setInputSource(source)
    set({ inputSource: resolved })
    // Switching back to Keyboard should stop listening — the mic has no
    // reason to stay engaged once Holo is no longer the chosen input.
    if (resolved !== 'holo') get().stopListening()
  },

  startListening: async () => {
    if (engine.isRunning) {
      set({ isListening: true })
      return
    }
    set({ micError: null })
    try {
      await engine.start()
      await enableInputGate()
      const { calibration } = get()
      set({
        isListening: true,
        mics: engine.mics,
        layoutMismatch: calibration !== null && calibration.layout !== engine.layout
      })
      void get().refreshAvailableMics()
    } catch (error) {
      set({ micError: error instanceof Error ? error.message : 'Microphone access failed' })
    }
  },

  stopListening: () => {
    engine.stop()
    void window.flow.setHoloInputGate(false)
    set({ isListening: false, lastTap: null, mics: [], level: 0, pausedForTyping: false })
  },

  setPace: (pace) => {
    writeStored(COOLDOWN_KEY, pace)
    set({ pace })
  },

  setSensitivity: (sensitivity) => {
    engine.setSensitivity(sensitivity)
    writeStored(SENSITIVITY_KEY, sensitivity)
    set({ sensitivity })
  },

  refreshAvailableMics: async () => {
    try {
      set({ availableMics: await HoloCaptureEngine.listInputDevices() })
    } catch {
      set({ availableMics: [] })
    }
  },

  setAllowExternalMic: async (allow) => {
    writeStored(ALLOW_EXTERNAL_KEY, allow)
    engine.setAllowExternalMic(allow)
    set({ allowExternalMic: allow, micError: null })
    // Reopen so the change takes effect immediately.
    if (engine.isRunning) {
      get().stopListening()
      await get().startListening()
    }
  },

  calibrate: async (tapsPerZone, onProgress) => {
    set({ isCalibrating: true, micError: null })

    try {
      if (!engine.isRunning) {
        await engine.start()
        await enableInputGate()
      }
      set({ isListening: true, mics: engine.mics })

      // Zones are fixed for the rest of this run.
      const zones = get().activeZones

      // Each tap is recorded three ways: the feature vector the classifier
      // compares, how loud it was, and how it decayed. The last two are what
      // turn every accept/reject bound into a measurement of this desk
      // instead of a constant guessed in advance (classifier.ts's
      // `deriveGates`) — which is the whole reason they're collected here
      // rather than only during listening.
      const tapsByZone: Array<{ zone: HoloZone; taps: number[][] }> = []
      const peakLevels: number[] = []
      const impacts: ImpactCheck[] = []
      for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex++) {
        const zone = zones[zoneIndex]
        const taps: number[][] = []
        for (let tapIndex = 0; tapIndex < tapsPerZone; tapIndex++) {
          onProgress({ phase: 'zone', zone, zoneIndex, totalZones: zones.length, tapIndex })
          taps.push(await engine.captureNextTap())
          peakLevels.push(engine.lastTapPeakDb)
          if (engine.lastTapImpact) impacts.push(engine.lastTapImpact)
        }
        tapsByZone.push({ zone, taps })
      }

      const { zones: profiles, scale, weights } = buildModel(tapsByZone)
      // Refits the model for every held-out tap, so the accuracy shown is
      // what fresh taps will get, not a flattering in-sample score.
      const { accuracy, distances } = evaluateDiscriminant(tapsByZone, scale)
      const saved = await window.flow.saveHoloCalibration({
        version: HOLO_CALIBRATION_VERSION,
        zones: profiles,
        scale,
        weights,
        layout: engine.layout,
        levelRange: { minDb: Math.min(...peakLevels), maxDb: Math.max(...peakLevels) },
        gates: deriveGates(distances, peakLevels, impacts),
        accuracy,
        calibratedAt: Date.now()
      })
      engine.setCalibration(saved)
      set({ calibration: saved, layoutMismatch: false })
    } catch (error) {
      set({ micError: error instanceof Error ? error.message : 'Calibration failed' })
    } finally {
      set({ isCalibrating: false })
    }
  },

  ignoreLastSound: async () => {
    const features = get().lastTap?.features
    if (!features?.length) return
    // If Holo had learned from it, un-learn it first, so the zone stops
    // treating it as a typical tap.
    const unlearned = engine.forgetTap(features)
    if (unlearned) set({ calibration: unlearned })
    await appendIgnoredSounds(get, set, [features])
  },

  learnIgnoredSounds: async (count, onProgress) => {
    set({ isLearningIgnored: true, micError: null })
    try {
      if (!engine.isRunning) {
        await engine.start()
        await enableInputGate()
        set({ isListening: true, mics: engine.mics })
      }
      const learned: number[][] = []
      for (let index = 0; index < count; index++) {
        onProgress(index, count)
        // requireImpact: false — the whole point is to record sounds that
        // are *not* taps, so the tap gate must not filter them out.
        learned.push(await engine.captureNextTap(20000, { requireImpact: false }))
      }
      await appendIgnoredSounds(get, set, learned)
    } catch (error) {
      set({ micError: error instanceof Error ? error.message : 'Could not learn that sound' })
    } finally {
      set({ isLearningIgnored: false })
    }
  },

  clearIgnoredSounds: async () => {
    const calibration = get().calibration
    if (!calibration) return
    const saved = await window.flow.saveHoloCalibration({ ...calibration, ignoredSounds: [] })
    engine.setCalibration(saved)
    set({ calibration: saved })
  },

  clearCalibration: async () => {
    await window.flow.clearHoloCalibration()
    engine.setCalibration(null)
    set({ calibration: null, layoutMismatch: false })
  }
}))

// Wired once for the engine's whole lifetime, so toggling listening on and
// off can never accumulate duplicate listeners (and duplicate presses).
if (typeof window !== 'undefined' && window.flow) {
  window.flow.onHoloInputActivity((timestamp) => engine.noteInputActivity(timestamp))
}

engine.onStatus(({ level, muted, coolingDown }) => {
  // Cheap guard: this fires ~16x/s; only re-render on a visible change.
  const current = useHoloStore.getState()
  if (current.pausedForTyping !== muted) useHoloStore.setState({ pausedForTyping: muted })
  if (current.coolingDown !== coolingDown) useHoloStore.setState({ coolingDown })
  if (Math.abs(current.level - level) > 0.05) useHoloStore.setState({ level })
})

/** Learned taps are saved at most this often: they arrive one per tap, and
 *  nothing is lost by writing a burst of them together. */
const LEARN_SAVE_DELAY_MS = 4000
let learnSaveTimer: ReturnType<typeof setTimeout> | null = null

engine.onCalibrationLearned((calibration) => {
  // The store's copy is updated straight away, not on save: anything else
  // that edits the calibration (the ignore list, say) starts from the store's
  // copy, and must not quietly drop what was just learned.
  useHoloStore.setState({ calibration })
  if (learnSaveTimer) clearTimeout(learnSaveTimer)
  learnSaveTimer = setTimeout(() => {
    learnSaveTimer = null
    const latest = useHoloStore.getState().calibration
    if (latest) void window.flow.saveHoloCalibration(latest)
  }, LEARN_SAVE_DELAY_MS)
})

engine.onTap((event) => {
  const { zone, confidence, reason, ignoredByInput, peakDb, impact, features } = event
  const publish = (outcome: TapOutcome): void =>
    useHoloStore.setState({ lastTap: { zone, confidence, outcome, at: Date.now(), peakDb, impact, features } })

  if (ignoredByInput) return publish('ignored-input')
  if (reason === 'no-calibration') {
    useHoloStore.setState({ layoutMismatch: true })
    return publish('layout-changed')
  }
  if (!zone) {
    // Reasons the user gets told apart by name, because each one has its own
    // fix; anything else just reads as "that didn't match a zone".
    const named: TapOutcome[] = ['ambiguous', 'wrong-level', 'voice', 'not-a-tap', 'set-down', 'learned-ignore']
    return publish(named.find((outcome) => outcome === reason) ?? 'unrecognized')
  }

  // Which control this zone maps to depends on whichever application is
  // focused *right now* — the same 4 slots the physical/virtual keyboard
  // uses. Read fresh from main on every tap: the shared flowStore only
  // receives context pushes while a page that subscribes to it is mounted,
  // so it goes stale exactly when Holo matters most (user in another app).
  const slot = useHoloStore.getState().activeZones.indexOf(zone) + 1
  void window.flow.getActiveContext().then((context) => {
    const control = context.profile?.controls.find((item) => item.slot === slot)
    if (!control) return publish('no-control')
    void window.flow.pressControl(control.id)
    // Only now — a recognized tap on an unassigned zone fired nothing, so it
    // shouldn't cost the user a second of deafness.
    engine.beginCooldown(HOLO_COOLDOWN_MS[useHoloStore.getState().pace])
    publish('pressed')
  })
})
