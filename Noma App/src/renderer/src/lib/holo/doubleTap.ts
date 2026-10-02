import type { HoloCalibration, HoloZone } from '@shared/types'
import { scaledDistance } from './classifier'

/**
 * Holo fires a zone only on a double tap: two deliberate taps on the same
 * zone, a relaxed "knock-knock" apart.
 *
 * Why: the per-sound checks (classifier.ts) can only get a single contact so
 * far. A fingertip coming to rest on a zone *is* a small, soft tap, and even
 * the tightest per-sound filter that doesn't also throw away real taps still
 * let it through ~10% of the time on the benchmark. For a zone mapped to
 * something like "close tab", that's not acceptable. Accidental contacts are
 * single events (a finger settling, a palm landing, a stray knock), so
 * requiring a matching second tap inside a short window makes an accidental
 * fire need two unlucky events in a row, on the same side, at the right
 * spacing and loudness.
 *
 * The rules, each there for a reason:
 * - Same zone. A tap on each side is two single taps, not a double.
 * - At least MIN_GAP_MS apart. The classifier judges a sound by the 180 ms
 *   after it (how it decays), so a second tap inside that window spoils the
 *   first. It also means a tap's own ringing can never be its second half.
 * - At most MAX_GAP_MS apart. Slower than that is two separate taps.
 * - Similar loudness (MAX_LEVEL_DIFF_DB). Two deliberate taps land with
 *   similar force; a big mismatch is one tap plus some other sound.
 * - A fired pair is consumed: a triple tap fires once, not twice.
 * - Two separate knocks, not one sound arriving twice. On real laptops a
 *   single tap can register a second time: the chassis still ringing, or the
 *   finger lifting off. That second "tap" comes inside the time window and
 *   at a similar level, so the rules above alone fired on one tap. Two more
 *   checks close that:
 *   - the level must fall at least MIN_DIP_DB between the two (a real
 *     double tap has a quiet moment between knocks; a ringing tail doesn't),
 *   - the two must sound alike (`pairMatches`): two knocks of one finger on
 *     one spot are close in every feature, while a ringing tail or a lift-off
 *     sounds nothing like the knock that caused it.
 */
export const DOUBLE_TAP_MIN_GAP_MS = 250
export const DOUBLE_TAP_MAX_GAP_MS = 800
export const DOUBLE_TAP_MAX_LEVEL_DIFF_DB = 15
/** How far (dB) the level must fall between the two taps. */
export const DOUBLE_TAP_MIN_DIP_DB = -15

export type DoubleTapVerdict = 'fire' | 'armed'

export interface DoubleTapWindow {
  minGapMs: number
  maxGapMs: number
}

/**
 * Fits the double-tap window to the gaps between the two taps of each
 * double tap made during calibration, so someone who knocks quickly isn't
 * held to a slow window and vice versa. Generous either side of what was
 * demonstrated (people are less careful in use than in a wizard), but never
 * below DOUBLE_TAP_MIN_GAP_MS: that floor is structural (a second tap any
 * sooner spoils how the first is judged), not a preference. Null with too
 * few gaps to say anything.
 */
export function fitDoubleTapWindow(gapsMs: number[]): DoubleTapWindow | null {
  if (gapsMs.length < 3) return null
  const sorted = [...gapsMs].sort((a, b) => a - b)
  const low = sorted[Math.floor(0.1 * (sorted.length - 1))]
  const high = sorted[Math.ceil(0.9 * (sorted.length - 1))]
  const minGapMs = Math.max(DOUBLE_TAP_MIN_GAP_MS, Math.round(low * 0.6))
  const maxGapMs = Math.min(1200, Math.max(minGapMs + 250, Math.round(high * 1.6)))
  return { minGapMs, maxGapMs }
}

interface FirstTap {
  zone: HoloZone
  at: number
  peakDb: number
  features?: number[]
}

/** What the detector knows about a tap beyond where and when. */
export interface TapDetail {
  features?: number[]
  /** See HoloTapEvent.dipDb (holoCapture.ts). */
  dipDb?: number
}

/**
 * "Do these two sound like the same knock twice?", with the bar taken from
 * the user's own calibration: the distance between two calibration taps on
 * the same zone (all taps on one spot, so exactly the spread two genuine
 * knocks have), 95th percentile with headroom. Null when the calibration
 * has too few taps to say.
 */
export function pairMatcher(calibration: HoloCalibration): ((a: number[], b: number[]) => boolean) | null {
  const distances: number[] = []
  for (const zone of calibration.zones) {
    const taps = zone.taps ?? []
    for (let i = 0; i < taps.length; i++) {
      for (let j = i + 1; j < taps.length; j++) {
        distances.push(scaledDistance(taps[i], taps[j], calibration.scale, calibration.weights))
      }
    }
  }
  if (distances.length < 10) return null
  distances.sort((a, b) => a - b)
  const bound = distances[Math.floor(0.95 * (distances.length - 1))] * PAIR_HEADROOM
  return (a, b) => scaledDistance(a, b, calibration.scale, calibration.weights) <= bound
}

/** Headroom over the calibration spread: knocks in use are a little less
 *  consistent than in the wizard. */
const PAIR_HEADROOM = 1.3

export class DoubleTapDetector {
  private first: FirstTap | null = null
  private window: DoubleTapWindow = { minGapMs: DOUBLE_TAP_MIN_GAP_MS, maxGapMs: DOUBLE_TAP_MAX_GAP_MS }
  private pairMatches: ((a: number[], b: number[]) => boolean) | null = null

  /** See `pairMatcher`. Null skips the sound-alike check. */
  setPairMatcher(matches: ((a: number[], b: number[]) => boolean) | null): void {
    this.pairMatches = matches
  }

  /** Uses the user's own rhythm (see `fitDoubleTapWindow`), or the default. */
  setWindow(window: DoubleTapWindow | null | undefined): void {
    this.window = window ?? { minGapMs: DOUBLE_TAP_MIN_GAP_MS, maxGapMs: DOUBLE_TAP_MAX_GAP_MS }
  }

  /** A recognized tap on `zone`. Returns 'fire' when it completes a double
   *  tap, else 'armed' (it's now the first half of one). */
  tap(zone: HoloZone, at: number, peakDb: number, detail: TapDetail = {}): DoubleTapVerdict {
    const first = this.first
    if (first && first.zone === zone) {
      const gap = at - first.at
      const alike =
        !this.pairMatches || !first.features || !detail.features || this.pairMatches(first.features, detail.features)
      if (
        gap >= this.window.minGapMs &&
        gap <= this.window.maxGapMs &&
        Math.abs(peakDb - first.peakDb) <= DOUBLE_TAP_MAX_LEVEL_DIFF_DB &&
        (detail.dipDb === undefined || detail.dipDb <= DOUBLE_TAP_MIN_DIP_DB) &&
        alike
      ) {
        this.first = null
        return 'fire'
      }
    }
    this.first = { zone, at, peakDb, features: detail.features }
    return 'armed'
  }

  /** Forgets a half-finished double tap (the user typed, clicked or used the
   *  trackpad in between, so the next tap starts over). */
  reset(): void {
    this.first = null
  }

  /** The zone waiting for its second tap, if one is and it hasn't expired. */
  armedZone(now: number): HoloZone | null {
    return this.first && now - this.first.at <= this.window.maxGapMs ? this.first.zone : null
  }
}
