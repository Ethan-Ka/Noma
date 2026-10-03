import type { HoloCalibration, HoloZone } from '@shared/types'
import { evaluateDiscriminant, scaledDistance, type ClassificationResult } from './classifier'

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
 * - At least MIN_GAP_MS apart: past the bounces of a single knock (20-40 ms
 *   in real recordings). People double-tap fast: 150-220 ms apart in a
 *   recording of the user's own laptop. An earlier 250 ms floor here (plus
 *   the engine ignoring anything within 220 ms of a knock) meant every
 *   second knock was thrown away and a double tap was heard as one tap; the
 *   engine now analyses each knock separately with the next one cut out of
 *   its audio, so a fast second knock can't spoil the first.
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
 * - The pair is judged as one piece of evidence, not two separate verdicts.
 *   On a real laptop's mic about one knock in five fails a "soft" check
 *   (slow rise, several contacts) or isn't sure of its side, and needing
 *   BOTH knocks to pass everything squared that into a miss on almost every
 *   other double tap. So one knock of the pair may be unsure (`sure: false`,
 *   see `doubleTapKnock`) as long as the other is sure and both point at the
 *   same zone. Two unsure knocks never fire.
 * - What that costs is made back on the pair as a whole: on average the two
 *   knocks must sit as close to the user's calibration taps as calibration
 *   double taps did (`pairDistanceBound`), and the quiet moment between them
 *   must be as deep as the user's own (`fitDoubleTapDip`). In the first real
 *   recording, everyday handling that paired up failed both.
 */
export const DOUBLE_TAP_MIN_GAP_MS = 120
export const DOUBLE_TAP_MAX_GAP_MS = 500
export const DOUBLE_TAP_MAX_LEVEL_DIFF_DB = 15
/** How far (dB) the level must fall between the two taps. */
export const DOUBLE_TAP_MIN_DIP_DB = -15

export type DoubleTapVerdict = 'fire' | 'armed'

/**
 * Which zone a classified sound counts towards as half of a double tap, and
 * whether it's sure. A recognized tap is sure. A sound that passed every hard
 * "is this a tap" check but was unsure of its side, or failed only a soft
 * check (see classifyZone), counts for its best-matching zone but unsure.
 * Anything else can't be half of a double tap.
 */
export function doubleTapKnock(result: ClassificationResult): { zone: HoloZone; sure: boolean } | null {
  if (result.zone) return { zone: result.zone, sure: true }
  if (
    result.candidate &&
    (result.reason === 'ambiguous' || result.reason === 'soft-touch' || result.reason === 'set-down')
  ) {
    return { zone: result.candidate, sure: false }
  }
  return null
}

export interface DoubleTapWindow {
  minGapMs: number
  maxGapMs: number
}

/**
 * Fits the double-tap window to the gaps between the two taps of each
 * double tap made during calibration. Only ever narrows the default: a
 * quick knocker (150-220 ms in a real recording) gets a tight window, so
 * two unrelated sounds a few hundred ms apart can't pair up. Generous either side of what was
 * demonstrated (people are less careful in use than in a wizard), but never
 * below DOUBLE_TAP_MIN_GAP_MS, which keeps a single knock's bounces from
 * counting as a second tap. Null with too
 * few gaps to say anything.
 */
export function fitDoubleTapWindow(gapsMs: number[]): DoubleTapWindow | null {
  if (gapsMs.length < 3) return null
  const sorted = [...gapsMs].sort((a, b) => a - b)
  const low = sorted[Math.floor(0.1 * (sorted.length - 1))]
  const high = sorted[Math.ceil(0.9 * (sorted.length - 1))]
  const minGapMs = Math.max(DOUBLE_TAP_MIN_GAP_MS, Math.round(low * 0.6))
  const maxGapMs = Math.min(DOUBLE_TAP_MAX_GAP_MS, Math.max(minGapMs + 250, Math.round(high * 1.8)))
  return { minGapMs, maxGapMs }
}

/** Margin (dB) over the shallowest typical dip the user showed. */
const DIP_MARGIN_DB = 8

/**
 * How deep the quiet moment between two knocks must be, fitted to the dips
 * measured before the second tap of each calibration double tap: the
 * shallowest typical one (90th percentile) plus a margin, and never looser
 * than DOUBLE_TAP_MIN_DIP_DB. How deep a dip can get depends on the room's
 * noise and the laptop's mic, which is why this is measured rather than
 * fixed. Null with too few dips to say.
 */
export function fitDoubleTapDip(dipsDb: number[]): number | null {
  const usable = dipsDb.filter((dip) => Number.isFinite(dip) && dip < 0)
  if (usable.length < 3) return null
  const sorted = [...usable].sort((a, b) => a - b)
  const shallow = sorted[Math.ceil(0.9 * (sorted.length - 1))]
  return Math.min(DOUBLE_TAP_MIN_DIP_DB, Math.round(shallow + DIP_MARGIN_DB))
}

/** Headroom over the calibration pairs' spread, and the floor under it. */
const PAIR_DISTANCE_HEADROOM = 1.2
const MIN_PAIR_DISTANCE = 1.3

/**
 * Furthest the two knocks of a double tap may sit, on average, from the
 * zone they're on (in classifyZone's distance units). Taken from the
 * calibration double taps: each tap's distance with itself held out (what a
 * fresh tap scores), averaged per double tap, 90th percentile, with
 * headroom. Two genuine knocks rarely both land at the edge of what was
 * calibrated, while something that only roughly resembles a tap tends to sit
 * far out twice. Never above the single-knock bound, which still applies to
 * each knock. Null when the calibration doesn't have the taps to say.
 */
export function pairDistanceBound(calibration: HoloCalibration): number | null {
  const tapsByZone = calibration.zones.map((zone) => ({ zone: zone.zone, taps: zone.taps ?? [] }))
  if (tapsByZone.length < 2 || tapsByZone.some((entry) => entry.taps.length < 4 || entry.taps.length % 2 !== 0)) {
    return null
  }
  const { distances } = evaluateDiscriminant(tapsByZone, calibration.scale)
  // Calibration records both halves of each double tap in order, so taps
  // 0+1, 2+3, ... of every zone are one double tap.
  const pairs: number[] = []
  let offset = 0
  for (const { taps } of tapsByZone) {
    for (let i = 0; i + 1 < taps.length; i += 2) pairs.push((distances[offset + i] + distances[offset + i + 1]) / 2)
    offset += taps.length
  }
  if (distances.length !== offset || pairs.length < 4) return null
  pairs.sort((a, b) => a - b)
  const bound = Math.max(MIN_PAIR_DISTANCE, pairs[Math.ceil(0.9 * (pairs.length - 1))] * PAIR_DISTANCE_HEADROOM)
  const single = calibration.gates?.maxDistance
  return single !== undefined ? Math.min(bound, single) : bound
}

interface FirstTap {
  zone: HoloZone
  at: number
  peakDb: number
  features?: number[]
  sure: boolean
  distance?: number
}

/** What the detector knows about a tap beyond where and when. */
export interface TapDetail {
  features?: number[]
  /** See HoloTapEvent.dipDb (holoCapture.ts). */
  dipDb?: number
  /** False for a knock that's only a candidate (see `doubleTapKnock`).
   *  Defaults to true. */
  sure?: boolean
  /** classifyZone's distance to the zone, for the pair bound. */
  distance?: number
}

/** Pair-level bounds fitted to the user's calibration. Missing ones fall
 *  back to the fixed defaults. */
export interface PairGates {
  /** See `fitDoubleTapDip`. */
  maxDipDb?: number | null
  /** See `pairDistanceBound`. */
  maxMeanDistance?: number | null
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
  private pairGates: PairGates = {}

  /** See `PairGates`. */
  setPairGates(gates: PairGates): void {
    this.pairGates = gates
  }

  /** See `pairMatcher`. Null skips the sound-alike check. */
  setPairMatcher(matches: ((a: number[], b: number[]) => boolean) | null): void {
    this.pairMatches = matches
  }

  /** Uses the user's own rhythm (see `fitDoubleTapWindow`), or the default.
   *  Never wider than the default: an earlier fit allowed up to 1.2 s, which
   *  let two everyday sounds 405 ms apart fire on a real recording. */
  setWindow(window: DoubleTapWindow | null | undefined): void {
    this.window = {
      minGapMs: Math.max(DOUBLE_TAP_MIN_GAP_MS, window?.minGapMs ?? DOUBLE_TAP_MIN_GAP_MS),
      maxGapMs: Math.min(DOUBLE_TAP_MAX_GAP_MS, window?.maxGapMs ?? DOUBLE_TAP_MAX_GAP_MS)
    }
  }

  /** A recognized tap on `zone`. Returns 'fire' when it completes a double
   *  tap, else 'armed' (it's now the first half of one). */
  tap(zone: HoloZone, at: number, peakDb: number, detail: TapDetail = {}): DoubleTapVerdict {
    const first = this.first
    const sure = detail.sure ?? true
    if (first && first.zone === zone && (first.sure || sure)) {
      const gap = at - first.at
      const alike =
        !this.pairMatches || !first.features || !detail.features || this.pairMatches(first.features, detail.features)
      const maxDip = Math.min(DOUBLE_TAP_MIN_DIP_DB, this.pairGates.maxDipDb ?? DOUBLE_TAP_MIN_DIP_DB)
      const maxMean = this.pairGates.maxMeanDistance
      const close =
        maxMean == null ||
        first.distance === undefined ||
        detail.distance === undefined ||
        (first.distance + detail.distance) / 2 <= maxMean
      if (
        gap >= this.window.minGapMs &&
        gap <= this.window.maxGapMs &&
        Math.abs(peakDb - first.peakDb) <= DOUBLE_TAP_MAX_LEVEL_DIFF_DB &&
        (detail.dipDb === undefined || detail.dipDb <= maxDip) &&
        alike &&
        close
      ) {
        this.first = null
        return 'fire'
      }
    }
    this.first = { zone, at, peakDb, features: detail.features, sure, distance: detail.distance }
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
