import type { BrowserWindow } from 'electron'
import type {
  ApplicationContext,
  Control,
  GlideActivity,
  GlideState,
  HoloTouchCheckSummary,
  HoloTrackpadEvent,
  HoloTrackpadStatus,
  HoloTrackpadZoneCount
} from '@shared/types'
import {
  getGlideEnabled,
  getGlideZoneCount,
  setGlideEnabled,
  setGlideZoneCount
} from '../database/repositories/settingsRepository'
import { TrackpadGestureService } from './trackpadGestureService'
import { resolveGlidePress } from './glidePress'
import type { CheckPhase } from './touchTrace'

const NOT_WINDOWS_MESSAGE = 'Glide needs Windows and a precision touchpad. It isn’t available on this computer yet.'
const NO_TOUCHPAD_MESSAGE =
  'No precision touchpad found. Glide reads raw finger positions, which only Windows precision touchpads report. Check Settings > Bluetooth & devices > Touchpad: if it doesn’t say “Your PC has a precision touchpad”, Glide can’t work on this laptop.'
const NO_WINDOW_MESSAGE = 'Glide couldn’t start because Noma’s window isn’t ready. Try again in a moment.'

/** What the controller needs from the rest of main. */
export interface GlideHost {
  getWindow: () => BrowserWindow | null
  getContext: () => ApplicationContext
  /** Noma's own window is the one in front. */
  isNomaFocused: () => boolean
  isActionRunning: () => boolean
  /** Presses a control exactly as a key on the keyboard would. */
  press: (control: Control) => void
  emitState: (state: GlideState) => void
  emitActivity: (activity: GlideActivity) => void
}

/**
 * Glide, owned by main: the on/off switch and zone count live in settings,
 * so Glide comes back on by itself at launch, keeps working with Noma's
 * window closed to the tray, and can be switched off from the tray at once.
 * Each recognised swipe-in is turned into a press here (resolveGlidePress
 * decides whether it may), rather than in the renderer, so nothing depends
 * on a page being open.
 */
export class GlideController {
  private readonly gestures: TrackpadGestureService
  private touchpads: number | null = null
  private error: string | null = null
  private touchCheckRunning = false

  constructor(private readonly host: GlideHost) {
    this.gestures = new TrackpadGestureService(
      (event) => this.handleGesture(event),
      () => host.getWindow()
    )
  }

  getState(): GlideState {
    return {
      enabled: getGlideEnabled(),
      zoneCount: getGlideZoneCount(),
      platformSupported: process.platform === 'win32',
      touchpads: this.touchpads,
      error: this.error
    }
  }

  /** At launch, once the main window exists: back on if it was on. */
  resume(): void {
    if (getGlideEnabled()) this.setEnabled(true)
  }

  /** Turns Glide on or off and remembers it. Turning on fails (and stays
   *  off) when there's nothing to read, with the reason in `error`. */
  setEnabled(enabled: boolean): GlideState {
    if (!enabled) {
      setGlideEnabled(false)
      this.gestures.stop()
      this.error = null
      return this.publish()
    }
    const status = this.start()
    setGlideEnabled(status !== null && status.touchpads > 0)
    return this.publish()
  }

  setZoneCount(zoneCount: HoloTrackpadZoneCount): GlideState {
    setGlideZoneCount(zoneCount)
    if (getGlideEnabled()) this.start()
    return this.publish()
  }

  /** Stops reading the touchpad without changing the saved setting: for
   *  shutdown, so no hook outlives the window it was registered on. */
  shutDown(): void {
    this.gestures.stop()
    if (this.touchCheckRunning) this.gestures.stopTrace([])
    this.touchCheckRunning = false
  }

  startTouchCheck(): HoloTrackpadStatus | null {
    const status = this.gestures.startTrace()
    this.touchpads = status?.touchpads ?? this.touchpads
    this.touchCheckRunning = status !== null
    return status
  }

  stopTouchCheck(phases: CheckPhase[]): { summary: HoloTouchCheckSummary; savedTo: string } | null {
    this.touchCheckRunning = false
    return this.gestures.stopTrace(phases)
  }

  private start(): HoloTrackpadStatus | null {
    if (process.platform !== 'win32') {
      this.error = NOT_WINDOWS_MESSAGE
      return null
    }
    if (!this.host.getWindow()) {
      this.error = NO_WINDOW_MESSAGE
      return null
    }
    const status = this.gestures.start(getGlideZoneCount())
    this.touchpads = status?.touchpads ?? 0
    if (!status || status.touchpads === 0) {
      this.gestures.stop()
      this.error = NO_TOUCHPAD_MESSAGE
      return status
    }
    this.error = null
    return status
  }

  private publish(): GlideState {
    const state = this.getState()
    this.host.emitState(state)
    return state
  }

  private handleGesture(event: HoloTrackpadEvent): void {
    if (event.type === 'miss') {
      this.host.emitActivity(event)
      return
    }
    const context = this.host.getContext()
    const decision = resolveGlidePress({
      zone: event.zone,
      context,
      nomaFocused: this.host.isNomaFocused(),
      touchCheckRunning: this.touchCheckRunning,
      actionRunning: this.host.isActionRunning()
    })
    if (decision.control) this.host.press(decision.control)
    const control = decision.control ?? context.profile?.controls.find((item) => item.slot === decision.slot)
    this.host.emitActivity({
      type: 'fire',
      zone: event.zone,
      slot: decision.slot,
      at: event.at,
      outcome: decision.outcome,
      controlLabel: control?.label,
      applicationName: context.application?.name
    })
  }
}
