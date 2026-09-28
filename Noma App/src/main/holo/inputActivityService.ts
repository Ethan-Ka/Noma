import type { BrowserWindow } from 'electron'
import type { HoloInputGateStatus } from '@shared/types'
import { uIOhook, type UiohookMouseEvent } from 'uiohook-napi'
import { acquireHook, releaseHook } from '../workflow/sharedHook'
import { TouchActivityWatcher } from './touchActivity'

/** Key auto-repeat, cursor movement and touchpad reports (~125/s) all fire
 *  far faster than the gate needs. The renderer's gate windows are
 *  hundreds of ms wide, so one timestamp per this window is enough. */
const MIN_EMIT_GAP_MS = 40
/** Cursor movement smaller than this (px) is ignored. A desk tap can shake
 *  a high-DPI mouse by a pixel, and treating that as "the user is using the
 *  mouse" would make a real tap veto itself. A finger dragging on the
 *  trackpad moves the cursor much further than this. */
const MIN_MOVE_PX = 4

/**
 * Tells Holo *when* the user physically pressed a key, clicked, scrolled,
 * moved the pointer, or touched the trackpad or touchscreen. It sends timestamps only,
 * never which key, where, or what the finger did. Holo uses them to discard
 * the sound of typing and trackpad use instead of guessing from audio
 * alone. The OS hooks exist only between start() and stop(), i.e. only
 * while Holo is listening or calibrating (see docs/privacy-and-legal.md).
 */
export class InputActivityService {
  private isRunning = false
  private lastEmit = 0
  private lastMoveX = NaN
  private lastMoveY = NaN
  private readonly touch = new TouchActivityWatcher(() => this.handle())
  private status: HoloInputGateStatus | null = null

  constructor(
    private readonly onActivity: (timestamp: number) => void,
    private readonly getWindow: () => BrowserWindow | null
  ) {}

  /** Returns what this machine's touch hardware lets the gate see (null
   *  when touch reports aren't available, e.g. not Windows). */
  start(): HoloInputGateStatus | null {
    if (this.isRunning) return this.status
    uIOhook.on('keydown', this.handle)
    uIOhook.on('keyup', this.handle)
    uIOhook.on('mousedown', this.handle)
    uIOhook.on('mouseup', this.handle)
    uIOhook.on('wheel', this.handle)
    uIOhook.on('mousemove', this.handleMove)
    acquireHook()
    const window = this.getWindow()
    this.status = window ? this.touch.start(window) : null
    this.isRunning = true
    return this.status
  }

  stop(): void {
    if (!this.isRunning) return
    uIOhook.off('keydown', this.handle)
    uIOhook.off('keyup', this.handle)
    uIOhook.off('mousedown', this.handle)
    uIOhook.off('mouseup', this.handle)
    uIOhook.off('wheel', this.handle)
    uIOhook.off('mousemove', this.handleMove)
    releaseHook()
    this.touch.stop()
    this.status = null
    this.lastMoveX = NaN
    this.lastMoveY = NaN
    this.isRunning = false
  }

  private readonly handleMove = (event: UiohookMouseEvent): void => {
    if (Number.isNaN(this.lastMoveX)) {
      this.lastMoveX = event.x
      this.lastMoveY = event.y
      return
    }
    if (Math.hypot(event.x - this.lastMoveX, event.y - this.lastMoveY) < MIN_MOVE_PX) return
    this.lastMoveX = event.x
    this.lastMoveY = event.y
    this.handle()
  }

  private readonly handle = (): void => {
    const now = Date.now()
    if (now - this.lastEmit < MIN_EMIT_GAP_MS) return
    this.lastEmit = now
    this.onActivity(now)
  }
}
