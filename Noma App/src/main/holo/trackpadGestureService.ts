import type { BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { HoloTouchCheckSummary, HoloTrackpadEvent, HoloTrackpadStatus, HoloTrackpadZoneCount } from '@shared/types'
import { uIOhook } from 'uiohook-napi'
import { GetCursorPos, HID_USAGE_DIGITIZER_TOUCH_PAD, HID_USAGE_PAGE_DIGITIZER, SetCursorPos } from '../actions/win32'
import { acquireHook, releaseHook } from '../workflow/sharedHook'
import { subscribeDigitizerInput } from './rawDigitizerInput'
import { recordingsFolder } from './recordingStore'
import { listRawDevices } from './rawDevices'
import { clearTouchpadLayouts, readTouchpadFrames } from './touchpadReports'
import { TrackpadGestureDetector, edgeAt, type TouchFrame } from './trackpadGesture'
import { summarizeTouchCheck, type CheckPhase, type TouchTrace } from './touchTrace'

/** A swipe-in's finger usually lifts within this long of firing; past it,
 *  the pointer is left wherever the user has since moved it. */
const RESTORE_WINDOW_MS = 800

/**
 * Runs Holo's trackpad swipe-ins (see trackpadGesture.ts for the gesture and
 * why): reads finger positions from the precision touchpad, watches the
 * keyboard for "the user is typing" (timestamps only), reports swipe-ins to
 * the renderer (which presses the zone's control exactly as a key on the
 * physical keyboard would), and puts the pointer back where it was before
 * the swipe moved it.
 *
 * Also records the trackpad touch check (`startTrace` / `stopTrace`), during
 * which nothing fires.
 *
 * Runs only while the user has chosen trackpad swipe-ins and turned Holo on,
 * or during a touch check. Finger positions are used in memory and never
 * stored or sent, except in a touch check the user starts, which is saved
 * only on this computer (docs/privacy-and-legal.md).
 */
export class TrackpadGestureService {
  private readonly detector = new TrackpadGestureDetector()
  private unsubscribe: (() => void) | null = null
  /** True while the user has Holo's swipe-ins on (as opposed to the
   *  service only running for a touch check). */
  private live = false
  private trace: TouchTrace | null = null
  /** Pointer position when each edge contact arrived, by "device:id". */
  private readonly pointerAt = new Map<string, { x: number; y: number }>()
  private restore: { key: string; x: number; y: number; until: number } | null = null

  constructor(
    private readonly emit: (event: HoloTrackpadEvent) => void,
    private readonly getWindow: () => BrowserWindow | null
  ) {}

  /** Turns swipe-ins on. Null when raw touchpad input isn't available. */
  start(zones: HoloTrackpadZoneCount = 4): HoloTrackpadStatus | null {
    this.detector.setZoneCount(zones)
    const status = this.ensureRunning()
    if (status) this.live = true
    return status
  }

  stop(): void {
    this.live = false
    if (!this.trace) this.shutDown()
  }

  /** Starts recording a touch check (nothing fires meanwhile). */
  startTrace(): HoloTrackpadStatus | null {
    const status = this.ensureRunning()
    if (status) this.trace = { frames: [], keys: [] }
    return status
  }

  /** Ends the touch check, saves it, and returns what it showed. */
  stopTrace(phases: CheckPhase[]): { summary: HoloTouchCheckSummary; savedTo: string } | null {
    const trace = this.trace
    this.trace = null
    if (!this.live) this.shutDown()
    if (!trace) return null
    const summary = summarizeTouchCheck(trace, phases)
    mkdirSync(recordingsFolder(), { recursive: true })
    const savedTo = join(recordingsFolder(), `touch-check-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(savedTo, JSON.stringify({ version: 1, phases, summary, ...trace }))
    return { summary, savedTo }
  }

  private ensureRunning(): HoloTrackpadStatus | null {
    if (process.platform !== 'win32') return null
    const touchpads = listRawDevices().filter(
      (device) => device.usagePage === HID_USAGE_PAGE_DIGITIZER && device.usage === HID_USAGE_DIGITIZER_TOUCH_PAD
    ).length
    if (this.unsubscribe) return { touchpads }
    const window = this.getWindow()
    if (!window) return null
    clearTouchpadLayouts()
    this.unsubscribe = subscribeDigitizerInput(window, this.handleInput)
    if (!this.unsubscribe) return null
    uIOhook.on('keydown', this.handleKey)
    acquireHook()
    return { touchpads }
  }

  private shutDown(): void {
    if (!this.unsubscribe) return
    this.unsubscribe()
    this.unsubscribe = null
    uIOhook.off('keydown', this.handleKey)
    releaseHook()
    this.detector.reset()
    this.pointerAt.clear()
    this.restore = null
  }

  private readonly handleInput = (hRawInput: number): void => {
    try {
      const now = Date.now()
      for (const frame of readTouchpadFrames(hRawInput)) {
        if (this.trace) {
          this.trace.frames.push({ ...frame, t: now })
          continue
        }
        this.notePointer(frame, now)
        this.send(this.detector.frame(frame, now), now)
      }
    } catch (error) {
      console.warn('[holo] could not read a touchpad report:', error)
    }
  }

  private readonly handleKey = (): void => {
    const now = Date.now()
    if (this.trace) {
      this.trace.keys.push(now)
      return
    }
    this.send(this.detector.noteKey(now), now)
  }

  private send(events: HoloTrackpadEvent[], now: number): void {
    for (const event of events) {
      if (event.type === 'fire') this.beginRestore(now)
      if (this.live) this.emit(event)
    }
  }

  /**
   * Remembers where the pointer was when a finger arrived at an edge, and
   * once a swipe has fired, puts it back: right away, and again when that
   * finger lifts (it keeps moving the pointer until then).
   */
  private notePointer(frame: TouchFrame, now: number): void {
    const down = new Set<string>()
    for (const contact of frame.contacts) {
      const key = `${frame.device}:${contact.id}`
      if (!contact.tip) continue
      down.add(key)
      if (!this.pointerAt.has(key) && edgeAt(contact.x)) {
        const point: { x?: number; y?: number } = {}
        if (GetCursorPos(point)) this.pointerAt.set(key, { x: point.x ?? 0, y: point.y ?? 0 })
      }
    }
    const restore = this.restore
    if (restore && (!down.has(restore.key) || now > restore.until)) {
      if (now <= restore.until) SetCursorPos(restore.x, restore.y)
      this.restore = null
    }
    for (const key of [...this.pointerAt.keys()]) {
      if (key.startsWith(`${frame.device}:`) && !down.has(key) && key !== this.restore?.key) this.pointerAt.delete(key)
    }
  }

  private beginRestore(now: number): void {
    const fired = this.detector.lastFired
    if (!fired) return
    const key = `${fired.device}:${fired.id}`
    const point = this.pointerAt.get(key)
    if (!point) return
    SetCursorPos(point.x, point.y)
    this.restore = { key, ...point, until: now + RESTORE_WINDOW_MS }
  }
}
