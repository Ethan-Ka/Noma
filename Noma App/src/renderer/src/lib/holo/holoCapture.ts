import type { HoloCalibration, HoloZone } from '@shared/types'
import { classifyMic, pickMicrophone, type MicCandidate, type MicKind } from './micKind'
import {
  blockEnergy,
  buildDiscriminant,
  classifyZone,
  createOnsetDetectorState,
  DEFAULT_GATES,
  detectImpact,
  detectOnset,
  extractTapFeatures,
  relaxGates,
  anchorAgrees,
  anchorDiscriminant,
  withoutMislabelledTaps,
  forgetLearnedTap,
  learnFromTap,
  shouldLearnFrom,
  trainingTaps,
  tapPeakDb,
  onsetThreshold,
  type ClassificationResult,
  type Discriminant,
  type HoloSensitivity,
  type ImpactCheck,
  type OnsetDetectorState
} from './classifier'

/**
 * Owns the Web Audio plumbing — the browser-API-dependent counterpart to
 * classifier.ts's pure math. Not unit tested: jsdom has no Web Audio at all
 * (same reason windowsAdapter.ts's real PowerShell process isn't).
 *
 * Works on any computer with a built-in microphone, and uses *only* that
 * one. Taps are located relative to the laptop's own mic, so a headset, USB
 * or webcam mic elsewhere on the desk would ruin calibration — see
 * micKind.ts. Extra external mics are ignored unless the user explicitly
 * allows one as a last resort (no built-in mic at all, e.g. a desktop PC).
 *
 * Deliberately *raw* audio: echo cancellation, noise suppression and auto
 * gain control are all switched off. They exist to make speech clean and
 * treat a desk tap as noise to remove — leaving them on is exactly how a
 * tap can vanish before it ever reaches the detector.
 */

const MAX_CHANNELS = 2
const BLOCK_FRAMES = 512
const RING_FRAMES = 16384
/** Audio kept for feature extraction (~256 ms at 48 kHz): wide enough that
 *  timer jitter in the finalize delay can't push the tap's start out of it. */
const TAP_WINDOW_FRAMES = 12288
/**
 * After an onset, wait this long before extracting features.
 *
 * This is the whole cost of the impact gate: telling a knock from a cough
 * means watching what the sound does at 110-180 ms, which means being 190 ms
 * behind it. That is a real delay and it was weighed rather than assumed —
 * against needing two or three taps before one registers, which is what the
 * shorter window was costing in practice. One tap at 190 ms beats three at
 * 110 ms, and 190 ms is still under the ~200 ms where a press stops feeling
 * like a direct response.
 */
const FINALIZE_DELAY_MS = 190
/** After an onset, ignore new onsets for this long. Short on purpose: it
 *  only has to swallow the bounces of one knock (a knuckle that lands and
 *  rebounds: 20-40 ms apart in real recordings), not the second knock of a
 *  double tap. People double-tap fast, 150-220 ms apart in a real recording
 *  of the user's own laptop; the old 220 ms here threw every second knock
 *  away, so a double tap was heard as a single tap. Each knock is analysed
 *  separately, with any later knock cut out of its audio (see
 *  `finalizeTap`), so they can't spoil each other's measurements.
 *
 *  Deliberately separate from the cooldown that follows a control actually
 *  firing (`beginCooldown`), which is skipped while a calibration capture is
 *  pending. This one isn't: without it a knock's own bounce (20-40 ms later)
 *  could be recorded as the second tap of a calibration double tap. */
const TAP_REFRACTORY_MS = 100
/** A key/mouse/trackpad event within this long *before* or *after* an
 *  acoustic onset means the sound was the user's typing, clicking or
 *  trackpad use, never a desk tap.
 *
 *  The "after" side is wide for the trackpad. A tap-to-click only produces
 *  its click after the finger has lifted, and cursor movement starts a
 *  beat after the finger lands, so the evidence that a sound was the
 *  trackpad can arrive ~100-200 ms after the sound itself. Holo therefore
 *  waits until this window has closed before acting on any tap (see
 *  `decide`). That costs ~30 ms on top of FINALIZE_DELAY_MS, because
 *  firing a macro because someone touched the trackpad is far worse. */
const INPUT_GATE_BEFORE_MS = 220
const INPUT_GATE_AFTER_MS = 220
/** How long input timestamps are remembered for the gate above. */
const INPUT_HISTORY_MS = 1000
/** The mic is switched off the instant a key/mouse event arrives and back on
 *  this long after the last one, so typing sounds are never even captured
 *  (not merely filtered afterwards). */
const INPUT_MUTE_HOLD_MS = 300
/** After switching back on, ignore onsets briefly: the mic coming back up
 *  can itself look like a sudden rise against the silence just before it. */
const UNMUTE_SETTLE_MS = 120
const VIRTUAL_MIC_PATTERN = /stereo mix|loopback|virtual|voicemeeter|cable|steam streaming|obs|nvidia broadcast|what u hear/i

export interface MicInfo {
  id: string
  label: string
  kind: MicKind
  channels: number
}

export interface HoloTapEvent extends ClassificationResult {
  features: number[]
  /** When the sound started (Date.now() ms), not when Holo finished judging
   *  it: double-tap timing is about the taps themselves. */
  onsetAt: number
  /**
   * How far the sound level fell (dB, negative) between the loudest moment
   * of the previous sound and this one starting. A real second knock comes
   * after the first has died away; the tail of one tap still ringing, or a
   * finger lifting off, doesn't. Used by the double-tap check
   * (doubleTap.ts). 0 when it couldn't be measured.
   */
  dipDb: number
  /** True when the sound was discarded because a key/mouse event coincided. */
  ignoredByInput: boolean
  /** What was actually measured, so a misfire can be reported as numbers
   *  rather than "it's flaky" — shown under Details on the Holo page. */
  peakDb: number
  impact: ImpactCheck | null
}

export type HoloTapListener = (event: HoloTapEvent) => void

/**
 * A diagnostic recording: every sample the engine received, exactly as the
 * detector saw it (silence included where the mic was muted for typing), plus
 * the typing/trackpad timestamps. Only ever made during the Holo page's
 * explicit "Record a test session", and only saved on this computer (see
 * docs/privacy-and-legal.md). It's how Holo gets tuned on real taps from a
 * real laptop instead of on simulated ones.
 */
export interface HoloRecording {
  sampleRate: number
  channels: number
  /** Interleaved 16-bit PCM. */
  pcm: Int16Array
  /** Date.now() when the first recorded sample arrived. */
  startedAt: number
  /** Typing/clicking/trackpad timestamps, ms from `startedAt`. */
  inputActivityMs: number[]
}

export interface HoloStatus {
  /** Loudest recent block energy as a multiple of the current trigger
   *  threshold — >= 1 means "would trigger." Drives the live meter. */
  level: number
  /** True while the mic is switched off because the user is typing/clicking. */
  muted: boolean
  /** True while taps are being ignored because a control just fired. */
  coolingDown: boolean
}

interface DeviceInput {
  info: MicInfo
  stream: MediaStream
  source: MediaStreamAudioSourceNode
  processor: ScriptProcessorNode
  ring: Float32Array[]
  writeIndex: number
  /** Total frames ever written, so onsets can be located in the ring. */
  frameCount: number
  detector: OnsetDetectorState
}

export class HoloCaptureEngine {
  private audioContext: AudioContext | null = null
  private devices: DeviceInput[] = []
  private silentSink: GainNode | null = null
  /** Knocks detected but not analysed yet, plus recent ones, so each can be
   *  cut short where the next one starts. */
  private onsets: Array<{ frame: number; at: number; dipDb: number }> = []
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()
  private lastOnsetAt = -Infinity
  private calibration: HoloCalibration | null = null
  private discriminant: Discriminant | null = null
  private anchor: Discriminant | null = null
  private readonly learnListeners = new Set<(calibration: HoloCalibration) => void>()
  private sensitivity: HoloSensitivity = 'medium'
  private allowExternalMic = false
  private muted = false
  private unmuteTimer: ReturnType<typeof setTimeout> | null = null
  private settleUntil = 0
  private cooldownUntil = 0
  /** Recent key/mouse/trackpad timestamps (Date.now() ms), oldest first. */
  private inputActivity: number[] = []
  private recording: { chunks: Int16Array[]; frames: number; channels: number; startedAt: number; inputActivity: number[] } | null =
    null
  /** Onset of the sound `decide` is currently reporting on. */
  private decidingOnsetAt = 0
  /** Loudest block since the last onset, and the quietest block after it:
   *  how far the previous sound had died away when the next one started. */
  private envelopePeak = 0
  private envelopeTrough = Infinity
  private decidingDipDb = 0
  private readonly tapListeners = new Set<HoloTapListener>()
  private readonly statusListeners = new Set<(status: HoloStatus) => void>()
  private pendingCapture: {
    resolve: (features: number[]) => void
    reject: (error: Error) => void
  } | null = null
  private peakRatio = 0
  /** When the most recent sound started (Date.now() ms) — the calibration
   *  wizard uses it to measure the gap inside each double tap. */
  lastTapOnsetAt = 0
  /** Peak level (dB) of the most recent accepted tap — used to find which side the mic is on. */
  lastTapPeakDb = -Infinity
  /** How the most recent sound decayed. Read by the calibration wizard so the
   *  gates are derived from the user's own taps (see classifier.ts). */
  lastTapImpact: ImpactCheck | null = null
  /** The most recent sound's dip (see HoloTapEvent.dipDb). Read by the
   *  calibration wizard to fit how deep the user's double-tap gap is. */
  lastTapDipDb = 0
  private lastStatusAt = 0
  private starting: Promise<void> | null = null

  get isRunning(): boolean {
    return this.audioContext !== null
  }

  /** The microphones in use right now (empty when not listening). */
  get mics(): MicInfo[] {
    return this.devices.map((device) => device.info)
  }

  /** Which mic (and channel count) a calibration was made on — a calibration
   *  is only valid for the mic it was recorded with. */
  get layout(): string {
    return this.devices.map((device) => `${device.info.label}:${device.info.channels}`).join('+')
  }

  setSensitivity(sensitivity: HoloSensitivity): void {
    this.sensitivity = sensitivity
  }

  /** Whether an external mic may be used when no built-in one exists. Off by default. */
  setAllowExternalMic(allow: boolean): void {
    this.allowExternalMic = allow
  }

  /** Lists input devices with their built-in/external classification
   *  (labels need a prior mic permission grant). */
  static async listInputDevices(): Promise<MicCandidate[]> {
    const all = await navigator.mediaDevices.enumerateDevices()
    const inputs = all.filter((device) => device.kind === 'audioinput')
    const hasReal = inputs.some((device) => device.deviceId !== 'default' && device.deviceId !== 'communications')
    return inputs
      .filter((device) => !hasReal || (device.deviceId !== 'default' && device.deviceId !== 'communications'))
      .filter((device) => !VIRTUAL_MIC_PATTERN.test(device.label))
      .map((device, index) => {
        const label = device.label || `Microphone ${index + 1}`
        return { id: device.deviceId, label, kind: classifyMic(label) }
      })
  }

  /** Requests permission and starts listening on every usable microphone.
   *  Throws (as a readable Error) if none can be opened. */
  start(): Promise<void> {
    if (this.isRunning) return Promise.resolve()
    this.starting ??= this.doStart().finally(() => {
      this.starting = null
    })
    return this.starting
  }

  private async doStart(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This computer has no microphone access available.')
    }

    // Raw capture: see the class doc comment for why these are all off.
    const rawAudio = (deviceId?: string): MediaTrackConstraints => ({
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 }
    })

    // Permission (and therefore device labels) needs a first open. That
    // stream is on the system *default* input, which may well be a headset —
    // it's only used to read labels, then replaced if it isn't the built-in mic.
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: rawAudio() })
    } catch (error) {
      throw new Error(describeMicError(error))
    }

    const probeTrack = stream.getAudioTracks()[0]
    const listed = await HoloCaptureEngine.listInputDevices().catch(() => [] as MicCandidate[])
    const candidates: MicCandidate[] = listed.length
      ? listed
      : [{ id: probeTrack.getSettings().deviceId ?? '', label: probeTrack.label, kind: classifyMic(probeTrack.label) }]
    const chosen = pickMicrophone(candidates, this.allowExternalMic)
    if (!chosen) {
      stream.getTracks().forEach((track) => track.stop())
      throw new Error(NO_BUILT_IN_MIC_MESSAGE)
    }
    if (chosen.id && chosen.id !== probeTrack.getSettings().deviceId) {
      stream.getTracks().forEach((track) => track.stop())
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: rawAudio(chosen.id) })
      } catch (error) {
        throw new Error(describeMicError(error))
      }
    }

    const context = new AudioContext({ latencyHint: 'interactive' })
    await context.resume()
    const sink = context.createGain()
    sink.gain.value = 0 // ScriptProcessor only runs while connected; we never want to hear it.
    sink.connect(context.destination)

    const track = stream.getAudioTracks()[0]
    const settings = track.getSettings()
    const channels = Math.max(1, Math.min(MAX_CHANNELS, settings.channelCount ?? 1))
    const source = context.createMediaStreamSource(stream)
    const processor = context.createScriptProcessor(BLOCK_FRAMES, channels, 1)
    const device: DeviceInput = {
      info: { id: chosen.id || track.id, label: chosen.label, kind: chosen.kind, channels },
      stream,
      source,
      processor,
      ring: Array.from({ length: channels }, () => new Float32Array(RING_FRAMES)),
      writeIndex: 0,
      frameCount: 0,
      detector: createOnsetDetectorState()
    }
    processor.onaudioprocess = (event) => this.handleBlock(device, event)
    source.connect(processor)
    processor.connect(sink)

    this.audioContext = context
    this.silentSink = sink
    this.devices = [device]
  }

  /** Releases the mic. Idempotent. */
  stop(): void {
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
    this.onsets = []
    this.inputActivity = []
    if (this.unmuteTimer) clearTimeout(this.unmuteTimer)
    this.unmuteTimer = null
    this.muted = false
    this.cooldownUntil = 0
    this.recording = null
    for (const device of this.devices) {
      device.processor.onaudioprocess = null
      device.processor.disconnect()
      device.source.disconnect()
      device.stream.getTracks().forEach((track) => track.stop())
    }
    this.devices = []
    this.silentSink?.disconnect()
    this.silentSink = null
    void this.audioContext?.close()
    this.audioContext = null
    this.pendingCapture?.reject(new Error('Holo capture stopped'))
    this.pendingCapture = null
  }

  setCalibration(calibration: HoloCalibration | null): void {
    this.anchor = calibration ? anchorDiscriminant(calibration.zones, calibration.scale) : null
    // A tap learned under the wrong zone in the past is dropped, and the
    // cleaned calibration saved (see `anchorDiscriminant`).
    if (calibration && this.anchor) {
      const zones = withoutMislabelledTaps(calibration.zones, this.anchor, calibration.scale)
      if (zones !== calibration.zones) {
        calibration = { ...calibration, zones }
        this.calibration = calibration
        this.discriminant = buildDiscriminant(trainingTaps(zones), calibration.scale)
        for (const listener of this.learnListeners) listener(calibration)
        return
      }
    }
    this.calibration = calibration
    // Rebuilt from the stored taps rather than persisted: it's a few
    // milliseconds of arithmetic, and it can never go stale against them.
    this.discriminant = calibration ? buildDiscriminant(trainingTaps(calibration.zones), calibration.scale) : null
  }

  /**
   * Learns from the two knocks of a double tap that actually fired, the
   * strongest evidence of where the user meant to tap there is: two knocks,
   * both recognized, both on the same side. Each knock must also clear the
   * usual near-certainty bar and be agreed by the anchor. Single knocks are
   * never learned from any more; that's how mislabelled taps used to creep in.
   */
  learnFromDoubleTap(knocks: Array<{ zone: HoloZone; features: number[]; result: ClassificationResult }>): void {
    const calibration = this.calibration
    const anchor = this.anchor
    if (!calibration || !anchor) return
    const gates = calibration.gates ?? DEFAULT_GATES
    let zones = calibration.zones
    for (const knock of knocks) {
      if (!shouldLearnFrom({ ...knock.result, zone: knock.zone }, gates)) continue
      if (!anchorAgrees(knock.features, knock.zone, anchor, calibration.scale)) continue
      zones = learnFromTap(zones, knock.zone, knock.features)
    }
    if (zones === calibration.zones) return
    const learned = { ...calibration, zones }
    this.setCalibration(learned)
    for (const listener of this.learnListeners) listener(learned)
  }

  /** Called with the updated calibration whenever Holo learns from a tap in
   *  use (see classifier.ts's `learnFromTap`), so the store can persist it. */
  onCalibrationLearned(listener: (calibration: HoloCalibration) => void): () => void {
    this.learnListeners.add(listener)
    return () => {
      this.learnListeners.delete(listener)
    }
  }

  /** Un-learns a tap the user has since said wasn't one. Returns the updated
   *  calibration, or null when that tap had never been learned. */
  forgetTap(features: number[]): HoloCalibration | null {
    const calibration = this.calibration
    if (!calibration) return null
    const zones = forgetLearnedTap(calibration.zones, features)
    if (zones === calibration.zones) return null
    const updated = { ...calibration, zones }
    this.setCalibration(updated)
    return updated
  }

  /**
   * Ignore taps for `ms` after a control has actually fired.
   *
   * A macro is the end of a thought, not something pressed in a burst — so
   * the second tap arriving a beat later is almost never a second action.
   * It's the same one made again by someone who wasn't sure the first
   * landed, and firing twice off that is worse than missing a genuine quick
   * repeat. This deliberately does *not* apply to sounds Holo rejected:
   * those are the ones the user is about to retry, and they only ever wait
   * out TAP_REFRACTORY_MS.
   *
   * Called by the store once a press really happens — not when a zone is
   * merely recognized — so a tap on a zone with nothing assigned to it
   * doesn't quietly cost the user a second of deafness.
   */
  beginCooldown(ms: number): void {
    this.cooldownUntil = performance.now() + ms
  }

  /** Milliseconds left of the post-press cooldown (0 when not in one). */
  get cooldownRemaining(): number {
    return Math.max(0, this.cooldownUntil - performance.now())
  }

  onTap(listener: HoloTapListener): () => void {
    this.tapListeners.add(listener)
    return () => {
      this.tapListeners.delete(listener)
    }
  }

  onStatus(listener: (status: HoloStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  /** Called for every physical key/mouse/trackpad event (timestamp only —
   *  see inputActivityService.ts). Sounds coinciding with one are the user's
   *  typing, clicking or trackpad use. */
  noteInputActivity(timestamp: number): void {
    this.recording?.inputActivity.push(timestamp)
    this.inputActivity.push(timestamp)
    const cutoff = timestamp - INPUT_HISTORY_MS
    while (this.inputActivity.length && this.inputActivity[0] < cutoff) this.inputActivity.shift()
    this.muteForInput()
  }

  /** True when any input event landed within the gate around `onsetAt`. */
  private inputCoincided(onsetAt: number): boolean {
    return this.inputActivity.some(
      (t) => t >= onsetAt - INPUT_GATE_BEFORE_MS && t <= onsetAt + INPUT_GATE_AFTER_MS
    )
  }

  /** Switches the mic track off (it delivers pure silence) while the user
   *  types or clicks, and back on shortly after they stop. */
  private muteForInput(): void {
    if (!this.isRunning) return
    this.setTracksEnabled(false)
    this.muted = true
    if (this.unmuteTimer) clearTimeout(this.unmuteTimer)
    this.unmuteTimer = setTimeout(() => {
      this.unmuteTimer = null
      this.setTracksEnabled(true)
      this.muted = false
      this.settleUntil = performance.now() + UNMUTE_SETTLE_MS
    }, INPUT_MUTE_HOLD_MS)
  }

  private setTracksEnabled(enabled: boolean): void {
    for (const device of this.devices) {
      device.stream.getAudioTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }

  /**
   * Calibration wizard support: resolves with the next detected tap's raw
   * feature vector. Rejects on timeout or if `stop()` is called first.
   *
   * Unfiltered by design — see the pendingCapture branch of finalizeTap.
   * `requireImpact` only changes the timeout's wording (tap vs. sound), for
   * "teach Noma a sound to ignore" where what's being captured deliberately
   * isn't a tap.
   */
  captureNextTap(timeoutMs = 15000, options: { requireImpact?: boolean } = {}): Promise<number[]> {
    if (this.pendingCapture) return Promise.reject(new Error('A tap capture is already pending'))
    const requireImpact = options.requireImpact ?? true
    return new Promise<number[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCapture = null
        reject(
          new Error(
            requireImpact
              ? 'No tap heard. Check that the right microphone is selected and tap a little harder.'
              : 'No sound heard. Make the sound you want Noma to ignore, a little louder.'
          )
        )
      }, timeoutMs)
      this.pendingCapture = {
        resolve: (features) => {
          clearTimeout(timeout)
          resolve(features)
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        }
      }
    })
  }

  // -------------------------------------------------------------- internals

  /** Starts a diagnostic recording (see `HoloRecording`). Needs the mic
   *  to be open already. */
  startRecording(): void {
    const device = this.devices[0]
    if (!device) throw new Error('Start listening before recording')
    this.recording = { chunks: [], frames: 0, channels: device.ring.length, startedAt: 0, inputActivity: [] }
  }

  get isRecording(): boolean {
    return this.recording !== null
  }

  /** Seconds recorded so far. */
  get recordedSeconds(): number {
    return this.recording && this.audioContext ? this.recording.frames / this.audioContext.sampleRate : 0
  }

  /** Ends the recording and hands it over (null if none was running). */
  stopRecording(): HoloRecording | null {
    const recording = this.recording
    this.recording = null
    if (!recording || !this.audioContext) return null
    const pcm = new Int16Array(recording.frames * recording.channels)
    let offset = 0
    for (const chunk of recording.chunks) {
      pcm.set(chunk, offset)
      offset += chunk.length
    }
    return {
      sampleRate: this.audioContext.sampleRate,
      channels: recording.channels,
      pcm,
      startedAt: recording.startedAt,
      inputActivityMs: recording.inputActivity.filter((t) => t >= recording.startedAt).map((t) => t - recording.startedAt)
    }
  }

  private handleBlock(device: DeviceInput, event: AudioProcessingEvent): void {
    const input = event.inputBuffer
    const frames = input.length
    const recording = this.recording
    if (recording) {
      if (recording.frames === 0) recording.startedAt = Date.now()
      const chunk = new Int16Array(frames * recording.channels)
      for (let c = 0; c < recording.channels; c++) {
        const data = input.getChannelData(Math.min(c, input.numberOfChannels - 1))
        for (let i = 0; i < frames; i++) {
          chunk[i * recording.channels + c] = Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767)))
        }
      }
      recording.chunks.push(chunk)
      recording.frames += frames
    }
    let energy = 0
    for (let c = 0; c < device.ring.length; c++) {
      const channelData = input.getChannelData(Math.min(c, input.numberOfChannels - 1))
      const ring = device.ring[c]
      for (let i = 0; i < frames; i++) ring[(device.writeIndex + i) % RING_FRAMES] = channelData[i]
      energy = Math.max(energy, blockEnergy(channelData))
    }
    device.writeIndex = (device.writeIndex + frames) % RING_FRAMES
    device.frameCount += frames

    const now = performance.now()
    // While muted (or just resuming) the detector is skipped entirely, so
    // its noise-floor estimate isn't dragged down by the silence. The ring
    // buffer above still records that silence, so a tap right after typing
    // never sees stale pre-mute audio in its window.
    if (!this.muted && now >= this.settleUntil) {
      const threshold = onsetThreshold(device.detector, this.sensitivity)
      this.peakRatio = Math.max(this.peakRatio, energy / threshold)

      // The detector still runs through a cooldown so its noise floor and the
      // level meter stay live — only the decision to analyse is skipped.
      const isOnset = detectOnset(energy, device.detector, this.sensitivity)
      const dipDb =
        this.envelopePeak > 0 && Number.isFinite(this.envelopeTrough)
          ? 10 * Math.log10(Math.max(this.envelopeTrough, 1e-14) / this.envelopePeak)
          : 0
      if (energy > this.envelopePeak) {
        this.envelopePeak = energy
        this.envelopeTrough = Infinity
      } else {
        this.envelopeTrough = Math.min(this.envelopeTrough, energy)
      }
      const gated =
        now - this.lastOnsetAt < TAP_REFRACTORY_MS || (this.pendingCapture === null && now < this.cooldownUntil)
      if (isOnset && !gated) {
        // This sound is the new reference for the next one's dip.
        this.envelopePeak = energy
        this.envelopeTrough = Infinity
        this.lastOnsetAt = now
        const onset = { frame: device.frameCount, at: Date.now(), dipDb }
        this.onsets.push(onset)
        this.schedule(() => this.finalizeTap(onset), FINALIZE_DELAY_MS)
      }
    }

    if (now - this.lastStatusAt > 60) {
      this.lastStatusAt = now
      const status = { level: this.peakRatio, muted: this.muted, coolingDown: now < this.cooldownUntil }
      this.peakRatio = 0
      for (const listener of this.statusListeners) listener(status)
    }
  }

  private schedule(run: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      run()
    }, ms)
    this.timers.add(timer)
  }

  private finalizeTap(onset: { frame: number; at: number; dipDb: number }): void {
    const context = this.audioContext
    if (!context) return
    // Keep only knocks that could still overlap a window still to be analysed.
    this.onsets = this.onsets.filter((other) => other.frame >= onset.frame - TAP_WINDOW_FRAMES)
    // The next knock after this one, if it has started already: cut it out of
    // this knock's audio, so a fast double tap's second knock can't spoil the
    // first one's measurements. Cut a block early: an onset is detected at the
    // end of the block it starts in.
    const next = this.onsets.find((other) => other.frame > onset.frame)
    const device0 = this.devices[0]
    const cutFrom = next && device0 ? next.frame - BLOCK_FRAMES - (device0.frameCount - TAP_WINDOW_FRAMES) : Infinity

    const span = TAP_WINDOW_FRAMES
    const channels: Float32Array[] = []
    const deviceOf: number[] = []
    this.devices.forEach((device, deviceIndex) => {
      for (const ring of device.ring) {
        const out = new Float32Array(span)
        for (let i = 0; i < span && i < cutFrom; i++) {
          out[i] = ring[(device.writeIndex - span + i + RING_FRAMES * 2) % RING_FRAMES]
        }
        channels.push(out)
        deviceOf.push(deviceIndex)
      }
    })

    const features = extractTapFeatures(channels, deviceOf, context.sampleRate)
    if (!features) return
    const peakDb = tapPeakDb(channels)
    const impact = detectImpact(channels, context.sampleRate)

    // The audio is captured now, while the tap is still inside the ring
    // buffer, but the verdict waits until every input event that could
    // belong to this sound has had time to arrive (see INPUT_GATE_AFTER_MS).
    const { at: onsetAt, dipDb } = onset
    const wait = onsetAt + INPUT_GATE_AFTER_MS - Date.now()
    if (wait <= 0) {
      this.decide(features, peakDb, impact, onsetAt, dipDb)
      return
    }
    this.schedule(() => {
      if (this.isRunning) this.decide(features, peakDb, impact, onsetAt, dipDb)
    }, wait)
  }

  private decide(features: number[], peakDb: number, impact: ImpactCheck | null, onsetAt: number, dipDb: number): void {
    this.decidingOnsetAt = onsetAt
    this.decidingDipDb = dipDb
    this.lastTapDipDb = dipDb
    this.lastTapPeakDb = peakDb
    this.lastTapImpact = impact
    this.lastTapOnsetAt = onsetAt

    const ignoredByInput = this.inputCoincided(onsetAt)
    if (ignoredByInput) {
      const result: HoloTapEvent = {
        zone: null,
        confidence: 0,
        reason: 'unrecognized',
        features,
        ignoredByInput,
        peakDb: this.lastTapPeakDb,
        impact: this.lastTapImpact,
        onsetAt,
        dipDb
      }
      for (const listener of this.tapListeners) listener(result)
      return
    }

    if (this.pendingCapture) {
      // Unfiltered: the wizard already told the user exactly which tap it
      // wants and when, so the first onset that survives the input-activity
      // gate above *is* that tap. An impact-shape gate here doesn't protect
      // the model from a stray cough so much as it silently eats real taps
      // that ring a little differently than expected — which reads as
      // "nothing happens when I tap," not as a filter working correctly.
      const { resolve } = this.pendingCapture
      this.pendingCapture = null
      resolve(features)
      return
    }

    const calibration = this.calibration
    if (!calibration) return
    if (calibration.layout !== this.layout || calibration.scale.length !== features.length) {
      const mismatch: HoloTapEvent = {
        zone: null,
        confidence: 0,
        reason: 'no-calibration',
        features,
        ignoredByInput: false,
        peakDb: this.lastTapPeakDb,
        impact: this.lastTapImpact,
        onsetAt,
        dipDb
      }
      for (const listener of this.tapListeners) listener(mismatch)
      return
    }
    const result = classifyZone(features, calibration.zones, calibration.scale, {
      weights: calibration.weights,
      // `gates` is always present in practice: holoRepository refuses any
      // calibration whose version isn't current, and the current one writes
      // them. DEFAULT_GATES keeps that an assumption the types enforce.
      gates: relaxGates(calibration.gates ?? DEFAULT_GATES, this.sensitivity),
      peakDb: this.lastTapPeakDb,
      impact: this.lastTapImpact ?? undefined,
      negatives: calibration.ignoredSounds,
      discriminant: this.discriminant
    })
    for (const listener of this.tapListeners) {
      listener({
        ...result,
        features,
        ignoredByInput: false,
        peakDb: this.lastTapPeakDb,
        impact: this.lastTapImpact,
        onsetAt: this.decidingOnsetAt,
        dipDb: this.decidingDipDb
      })
    }
  }
}

const NO_BUILT_IN_MIC_MESSAGE =
  "No built-in laptop microphone was found. Holo locates taps relative to your laptop's own mic, so it doesn't use headsets, USB or webcam mics. If this computer has no built-in mic, enable \"Allow an external microphone\" below."

/** Turns a getUserMedia failure into something a person can act on. */
function describeMicError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was blocked. Allow microphone access for Noma in Windows Settings > Privacy & security > Microphone, then try again.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone was found. Plug one in (or enable your built-in mic) and try again.'
  }
  if (name === 'NotReadableError') {
    return 'The microphone is busy or unavailable. Close other apps using it and try again.'
  }
  return error instanceof Error ? error.message : 'Microphone access failed.'
}
