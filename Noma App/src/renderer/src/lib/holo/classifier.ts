import type { HoloGates, HoloZone, HoloZoneProfile } from '@shared/types'

/**
 * Holo's DSP — pure, framework/DOM-free math so it's unit-testable without
 * any real audio hardware (holoCapture.ts owns the Web Audio glue and is
 * not unit tested; jsdom has no Web Audio implementation).
 *
 * This is a from-scratch reimplementation of the *concept* behind
 * github.com/JustinGamer191/Holo (tap-the-desk zones -> actions), built to
 * run on any computer with at least one microphone — not a port of its
 * macOS/Swift code. Pipeline:
 *
 *   raw samples (every mic channel, no browser DSP)
 *     -> block-energy onset detection (onset detector below)
 *     -> a short window per channel, aligned to where the tap actually starts
 *     -> Hann + FFT -> log-spaced band levels in dB ("spectral shape"),
 *        plus spectral centroid and decay shape
 *     -> with >1 channel: relative level between channels, and (for
 *        channels of the same physical device) inter-channel arrival delay
 *     -> an impact gate on the raw samples (did it decay like something
 *        struck, or keep going like a voice or a cough), applied before
 *        calibration as well as before classification
 *     -> separability-weighted centroid + nearest-neighbour classification,
 *        against bounds measured from the user's own calibration taps
 *
 * With one mic the zones are told apart purely by how the desk rings
 * (tone + decay); every additional mic channel adds real spatial
 * information (which mic heard it louder / earlier), so accuracy improves
 * automatically with hardware — nothing here assumes a particular count.
 */

// ---------------------------------------------------------------- FFT

/** In-place iterative radix-2 FFT. `re.length` must be a power of two. */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let start = 0; start < n; start += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const a = start + k
        const b = a + len / 2
        const tRe = re[b] * curRe - im[b] * curIm
        const tIm = re[b] * curIm + im[b] * curRe
        re[b] = re[a] - tRe
        im[b] = im[a] - tIm
        re[a] += tRe
        im[a] += tIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}

const hannWindow = (i: number, n: number): number => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))

/**
 * Window for a segment that *starts* at a transient: a short raised-cosine
 * fade-in over `rise` samples, flat, then a raised-cosine fade-out over the
 * last quarter.
 *
 * A symmetric Hann window is the wrong shape here. A tap's segment begins
 * `rise` samples before the attack, and Hann's weight there is ~0.01, so it
 * all but erases the first milliseconds. Those are the part that differs
 * most between two spots on the same desk (the direct click and its early
 * reflections). What Hann keeps is the middle of the segment, i.e. the
 * desk's own ringing, which sounds nearly the same wherever it was struck.
 */
export function onsetWindow(i: number, n: number, rise: number): number {
  if (i < rise) return 0.5 - 0.5 * Math.cos((Math.PI * (i + 0.5)) / rise)
  const fall = Math.floor(n / 4)
  const fromEnd = n - 1 - i
  if (fromEnd < fall) return 0.5 - 0.5 * Math.cos((Math.PI * (fromEnd + 0.5)) / fall)
  return 1
}

/** Power spectrum (bins 0..n/2) of a windowed, mean-removed segment. Hann
 *  by default; `window` overrides it (see `onsetWindow`). */
export function powerSpectrum(
  segment: ArrayLike<number>,
  window: (i: number, n: number) => number = hannWindow
): Float64Array {
  const n = segment.length
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  let mean = 0
  for (let i = 0; i < n; i++) mean += segment[i]
  mean /= n || 1
  for (let i = 0; i < n; i++) re[i] = (segment[i] - mean) * window(i, n)
  fftInPlace(re, im)
  const out = new Float64Array(n / 2 + 1)
  for (let i = 0; i < out.length; i++) out[i] = re[i] * re[i] + im[i] * im[i]
  return out
}

// ------------------------------------------------------- feature extraction

/** Log-spaced frequency bands per channel. */
export const TAP_BAND_COUNT = 20
/** Log-spaced bands of the attack-only spectrum (see ATTACK_FFT_SIZE). */
export const ATTACK_BAND_COUNT = 10
/** Early-echo lag bins (see `echoFeatures`). */
export const ECHO_LAG_BINS = 10
/** Per channel: the body bands, spectral centroid, two decay ratios, three
 *  "is this a knock at all" shape features (tail energy 50-100 ms later,
 *  re-excitation / a bounce, rise time to the peak), then the attack bands
 *  and the attack's share of the tap's energy. Being ordinary features,
 *  they're standardized by the user's own calibration taps, so what counts
 *  as "knock-like" is learned per person and desk. */
export const FEATURES_PER_CHANNEL = TAP_BAND_COUNT + 6 + ATTACK_BAND_COUNT + 1 + ECHO_LAG_BINS
/** FFT length for a tap (~21 ms at 48 kHz — the impact's resonance). */
export const TAP_FFT_SIZE = 1024
/**
 * FFT length for the attack alone (~5 ms at 48 kHz): the direct click from
 * the knuckle and its first reflections, before the desk's own modes take
 * over. This is where location lives. The desk rings with the same modes
 * wherever it's struck, but the path from each spot to the mic (distance,
 * what the sound crosses, where it reflects first) is different, and that
 * path shapes the first few milliseconds. Kept separate from the body
 * spectrum so the loud ringing can't drown it out.
 */
export const ATTACK_FFT_SIZE = 256
const ATTACK_MIN_HZ = 400
const ATTACK_MAX_HZ = 12000

/**
 * Early-echo features: the attack's autocorrelation at short lags, in
 * ECHO_LAG_BINS log-spaced bins from ECHO_MIN_MS to ECHO_MAX_MS.
 *
 * Within a millisecond or two of the direct click, the mic also hears the
 * same click bounced off whatever is nearest the spot: the desk edge, the
 * laptop's own body, a monitor stand. The delay of those echoes is set by
 * geometry, so it changes with where the tap landed and not with how hard
 * it was. An echo at delay T is a peak in the autocorrelation at lag T.
 * The spectrum sees the same thing only as fine comb ripples that coarse
 * bands smear away. (The zero-lag term normalizes, so loudness cancels.)
 */
const ECHO_MIN_MS = 0.08
const ECHO_MAX_MS = 2.5
/** How much audio past the onset the echo search looks at. */
const ECHO_SPAN_MS = 6
/** How much audio to keep before the localized onset so the attack is inside the window. */
const PRE_ONSET_FRAMES = 32
const MIN_BAND_HZ = 150
const MAX_BAND_HZ = 10000
const EPS = 1e-14

const toDb = (power: number): number => 10 * Math.log10(power + EPS)
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** Index where a tap's transient starts: first sample above a quarter of
 *  the window's peak. -1 when the window is effectively silent. */
export function localizeOnset(samples: ArrayLike<number>): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]))
  if (peak < 1e-5) return -1
  const threshold = peak * 0.25
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= threshold) return i
  }
  return -1
}

/** Loudest sample across all channels, in dB (full scale = 0). Absolute
 *  loudness is discarded from the features on purpose (it varies with tap
 *  force), but comparing it across *repeated taps at fixed spots* is how the
 *  microphone's side is found — the near side is consistently louder. */
export function tapPeakDb(channels: ArrayLike<number>[]): number {
  let peak = 0
  for (const samples of channels) {
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]))
  }
  return toDb(peak * peak)
}


interface ChannelAnalysis {
  features: number[]
  levelDb: number
  onset: number
}

/** Mean energy of `samples[from..to)`, clamped to the array. */
function meanSquare(samples: ArrayLike<number>, from: number, to: number): number {
  let sum = 0
  let n = 0
  for (let i = Math.max(0, from); i < to && i < samples.length; i++) {
    sum += samples[i] * samples[i]
    n++
  }
  return n > 0 ? sum / n : 0
}

/**
 * How a sound evolves over ~100 ms: what separates a knuckle tap (instant
 * peak, fast clean decay, one hit) from an object set down (slower rise,
 * long tail, bounces or scrapes). Values are scaled to roughly unit range.
 */
function envelopeFeatures(samples: ArrayLike<number>, onset: number, sampleRate: number): number[] {
  const frames = (ms: number): number => Math.round((sampleRate * ms) / 1000)
  const measure = (from: number, to: number): number => meanSquare(samples, from, to)

  const head = measure(onset, onset + frames(5))
  const tail = measure(onset + frames(50), onset + frames(100))
  const tailDb = clamp(toDb(tail) - toDb(head), -60, 0) / 20

  // Largest jump in energy between consecutive 8 ms blocks after the initial
  // hit: a clean tap only ever falls; a bounce or second impact rises again.
  const block = frames(8)
  let previous = measure(onset + frames(5), onset + frames(5) + block)
  let bounceDb = 0
  for (let from = onset + frames(5) + block; from < onset + frames(100); from += block) {
    const energy = measure(from, from + block)
    if (energy > head * 1e-3 && previous > 0) bounceDb = Math.max(bounceDb, toDb(energy) - toDb(previous))
    previous = energy
  }

  let peakIndex = onset
  let peak = 0
  for (let i = onset; i < onset + frames(10) && i < samples.length; i++) {
    if (Math.abs(samples[i]) > peak) {
      peak = Math.abs(samples[i])
      peakIndex = i
    }
  }
  const riseMs = ((peakIndex - onset) / sampleRate) * 1000

  return [tailDb, clamp(bounceDb, 0, 30) / 10, Math.log2(1 + riseMs) / 3]
}

/** Level (dB) in each of `bands` log-spaced bands from `minHz` to the mic's
 *  usable top (at most `maxBandHz`). */
function logBandLevelsDb(
  power: Float64Array,
  sampleRate: number,
  fftSize: number,
  bands = TAP_BAND_COUNT,
  minHz = MIN_BAND_HZ,
  maxBandHz = MAX_BAND_HZ
): number[] {
  const binHz = sampleRate / fftSize
  const maxHz = Math.min(maxBandHz, (sampleRate / 2) * 0.95)
  const ratio = maxHz / minHz

  const bandDb: number[] = []
  for (let band = 0; band < bands; band++) {
    const lo = minHz * Math.pow(ratio, band / bands)
    const hi = minHz * Math.pow(ratio, (band + 1) / bands)
    const loBin = Math.max(1, Math.floor(lo / binHz))
    const hiBin = Math.max(loBin + 1, Math.ceil(hi / binHz))
    let sum = 0
    for (let bin = loBin; bin < hiBin && bin < power.length; bin++) sum += power[bin]
    bandDb.push(toDb(sum / (hiBin - loBin)))
  }
  return bandDb
}

/** See ECHO_LAG_BINS. Mean-removed and first-differenced so the desk's own
 *  low resonances (which correlate at every short lag) don't dominate. */
export function echoFeatures(samples: ArrayLike<number>, onset: number, sampleRate: number): number[] {
  const span = Math.round((sampleRate * ECHO_SPAN_MS) / 1000)
  const minLag = Math.max(1, Math.round((sampleRate * ECHO_MIN_MS) / 1000))
  const maxLag = Math.round((sampleRate * ECHO_MAX_MS) / 1000)
  const from = Math.max(1, onset - 8)
  const to = Math.min(samples.length, from + span + maxLag)
  const x = new Float64Array(Math.max(0, to - from))
  for (let i = 0; i < x.length; i++) x[i] = samples[from + i] - samples[from + i - 1]

  let zero = 0
  for (let i = 0; i < Math.min(span, x.length); i++) zero += x[i] * x[i]
  const out = new Array<number>(ECHO_LAG_BINS).fill(0)
  if (zero < EPS) return out

  const ratio = maxLag / minLag
  for (let bin = 0; bin < ECHO_LAG_BINS; bin++) {
    const lo = Math.round(minLag * Math.pow(ratio, bin / ECHO_LAG_BINS))
    const hi = Math.max(lo + 1, Math.round(minLag * Math.pow(ratio, (bin + 1) / ECHO_LAG_BINS)))
    let best = -1
    for (let lag = lo; lag < hi; lag++) {
      let dot = 0
      for (let i = 0; i < span && i + lag < x.length; i++) dot += x[i] * x[i + lag]
      best = Math.max(best, dot / zero)
    }
    out[bin] = clamp(best, -1, 1)
  }
  return out
}

// ----------------------------------------------------------- the impact gate

/**
 * "Was that an impact at all?", asked before any zone is considered.
 *
 * Everything that has falsely triggered Holo in real use — a voice, a cough,
 * a sleeve dragging, a hand shifting on the desk — is a sound a person
 * *makes over time*. A knuckle on a desk is not: all of its energy arrives
 * in one collision and nothing replaces it, so from that instant it only
 * ever gets quieter. That is the difference this measures, and it is a
 * difference of physics rather than of timbre, which is why it holds for
 * sounds nobody thought to calibrate against.
 *
 * Two numbers, both ratios (so neither depends on how hard the tap was):
 * how much is left at 45-105 ms, and whether what is left is still falling
 * at 110-180 ms. A cough is loud in both. A tap in a live room can be loud
 * in the first — that is the room ringing, not the person — but never in the
 * second, because a room's tail decays too. Both thresholds come from the
 * user's own calibration taps (see `deriveGates`), so a lively desk in a
 * tiled kitchen sets its own bar rather than being held to a constant that
 * was picked on someone else's furniture.
 */
export interface ImpactCheck {
  /** Energy at 45-105 ms relative to the attack, in dB. */
  sustainDb: number
  /** Energy at 110-180 ms relative to 45-105 ms, in dB. A decaying impact
   *  keeps falling; a driven sound holds roughly level. */
  drivenDb: number
  /** Strongest normalized autocorrelation at a speech pitch in the late
   *  window (0..1). Not part of the accept/reject decision — it only picks
   *  the wording, so "a voice" is never claimed about a cough or a scrape. */
  periodicity: number
  /**
   * How many separate impacts are inside the first 80 ms.
   *
   * A knuckle strikes a desk once: one body, one contact, one transient. An
   * object *put down* almost never does — a mouse lands on one edge and
   * settles onto the other, feet touch microseconds apart, something rocks
   * once before it stops. That difference survives when nothing else does:
   * a mouse on a desk is a genuine impact on the same desk, so it decays
   * like one, it is as loud as one, and it rings the same wood. What it
   * isn't is a single event.
   */
  contacts: number
  /** Time from 10% to 90% of the sound's peak, ms. See `measureAttack`. */
  riseMs: number
  /** How bright the first 2 ms are, in dB (0 ≈ white noise, very negative =
   *  dull thud). See `measureAttack`. */
  attackBrightnessDb: number
}

/** Windows measured from the onset. The first is late enough that a knock is
 *  over; the second is far enough past it to tell a decay from a hold. */
const IMPACT_LATE_FROM_MS = 45
const IMPACT_LATE_TO_MS = 105
const IMPACT_TAIL_FROM_MS = 110
const IMPACT_TAIL_TO_MS = 180
/** Speech's fundamental. Only used for the wording of a rejection. */
const VOICE_MIN_F0_HZ = 70
const VOICE_MAX_F0_HZ = 330
/** f0 is far below 1 kHz, so averaging groups of 4 samples before the lag
 *  search costs nothing and makes it ~16x cheaper. */
const VOICE_DECIMATION = 4
/** Above this, a rejected sound is described to the user as a voice. */
export const VOICE_PERIODICITY = 0.45

/**
 * Rejected only when a sound is loud in *both* windows. Either one alone
 * would throw away real taps: a live room keeps the first one up, and a dead
 * room with a short window can flatter the second. Requiring both is what
 * lets the gate be strict about coughs without being strict about desks.
 */
export function isImpactLike(check: ImpactCheck, gates: HoloGates): boolean {
  return check.sustainDb <= gates.maxSustainDb || check.drivenDb <= gates.maxDrivenDb
}

/** Mean-removed, `factor`x-decimated copy of `samples[from..to)`. */
function decimate(samples: ArrayLike<number>, from: number, to: number, factor: number): Float64Array {
  const length = Math.max(0, Math.floor((to - from) / factor))
  const out = new Float64Array(length)
  let mean = 0
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let j = 0; j < factor; j++) sum += samples[from + i * factor + j]
    out[i] = sum / factor
    mean += out[i]
  }
  mean /= length || 1
  for (let i = 0; i < length; i++) out[i] -= mean
  return out
}

/** Best normalized self-similarity at a speech pitch. Every lag is scored
 *  over the same number of samples, so a long lag cannot win simply by
 *  comparing a shorter, more self-similar stretch. */
function latePeriodicity(samples: ArrayLike<number>, from: number, to: number, sampleRate: number): number {
  const decimated = decimate(samples, from, to, VOICE_DECIMATION)
  const rate = sampleRate / VOICE_DECIMATION
  const minLag = Math.max(2, Math.floor(rate / VOICE_MAX_F0_HZ))
  const maxLag = Math.ceil(rate / VOICE_MIN_F0_HZ)
  const span = decimated.length - maxLag
  if (span < minLag * 2) return 0

  let best = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let dot = 0
    let energyA = 0
    let energyB = 0
    for (let i = 0; i < span; i++) {
      const a = decimated[i]
      const b = decimated[i + lag]
      dot += a * b
      energyA += a * a
      energyB += b * b
    }
    const denominator = Math.sqrt(energyA * energyB)
    if (denominator > EPS) best = Math.max(best, dot / denominator)
  }
  return best
}

/** Envelope resolution. Long enough that a low desk resonance's own
 *  oscillation doesn't show up as structure, short enough to separate two
 *  contacts a few milliseconds apart. */
const CONTACT_BLOCK_MS = 4
/** How far past the onset a second contact still counts as part of the same
 *  landing rather than a new sound. */
const CONTACT_WINDOW_MS = 80
/** A contact must rise this far above the quietest point since the last one.
 *  Only a *rise* counts — an impact's own decay must never be read as a
 *  series of little impacts, which is exactly what a dip-based rule does. */
const CONTACT_RISE_DB = 6
/** ...and must still be within this of the loudest, so the noise floor after
 *  the sound has died away can't manufacture contacts. */
const CONTACT_PEAK_FLOOR_DB = 20

/**
 * Counts distinct impacts in the first 80 ms: the first attack, plus every
 * later point where the envelope climbs back up after falling.
 *
 * Deliberately measured on a peak envelope rather than block energy. A desk
 * resonance is a decaying oscillation, so its energy in any window shorter
 * than a few cycles rises and falls with the waveform itself — an
 * energy-based rule counts a single clean tap as several.
 */
export function countContacts(samples: ArrayLike<number>, onset: number, sampleRate: number): number {
  const block = Math.max(1, Math.round((sampleRate * CONTACT_BLOCK_MS) / 1000))
  const end = Math.min(samples.length, onset + Math.round((sampleRate * CONTACT_WINDOW_MS) / 1000))

  const envelope: number[] = []
  for (let from = Math.max(0, onset); from < end; from += block) {
    let peak = 0
    for (let i = from; i < from + block && i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]))
    envelope.push(toDb(peak * peak))
  }
  if (envelope.length < 3) return 1

  const floor = Math.max(...envelope) - CONTACT_PEAK_FLOOR_DB
  let contacts = 1
  let trough = envelope[0]
  for (const level of envelope.slice(1)) {
    if (level < trough) {
      trough = level
      continue
    }
    if (level - trough >= CONTACT_RISE_DB && level >= floor) {
      contacts++
      trough = level
    }
  }
  return contacts
}

/**
 * How the contact *started*: the difference between striking the surface and
 * coming to rest on it.
 *
 * A knuckle, fingernail or firm fingertip is a hard, light body: it delivers
 * its whole force in well under a millisecond, which makes a sharp, bright
 * click. A finger pad settling onto the palm rest, a wrist landing, a hand
 * shifting its weight: soft and heavy, so the force builds over several
 * milliseconds and the start of the sound is dull. It's physics, like the
 * decay test above, so it holds for contacts nobody demonstrated.
 *
 * On the benchmark this was the gap: a fingertip coming to rest on a zone
 * fired Holo 87% of the time, because nothing else about it differs from a
 * soft tap. Both limits come from the user's own calibration taps
 * (`deriveGates`), so someone who deliberately taps with the pad of a finger
 * sets their own bar and isn't rejected for it.
 */
export function measureAttack(
  samples: ArrayLike<number>,
  onset: number,
  sampleRate: number
): { riseMs: number; attackBrightnessDb: number } {
  const from = Math.max(1, onset - Math.round(sampleRate * 0.002))
  const to = Math.min(samples.length, onset + Math.round(sampleRate * 0.03))
  let peak = 0
  for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(samples[i]))
  if (peak <= 0) return { riseMs: 0, attackBrightnessDb: 0 }

  let start = -1
  let top = -1
  for (let i = from; i < to; i++) {
    const level = Math.abs(samples[i])
    if (start < 0 && level >= 0.1 * peak) start = i
    if (level >= 0.9 * peak) {
      top = i
      break
    }
  }
  if (start < 0 || top < 0) return { riseMs: 0, attackBrightnessDb: 0 }

  // First-difference energy over plain energy: a first difference weights
  // each frequency by how high it is, so the ratio rises with brightness and
  // doesn't depend on loudness.
  const end = Math.min(samples.length, start + Math.round(sampleRate * 0.002))
  let energy = 0
  let diffEnergy = 0
  for (let i = start; i < end; i++) {
    energy += samples[i] * samples[i]
    const d = samples[i] - samples[i - 1]
    diffEnergy += d * d
  }
  return {
    riseMs: ((top - start) / sampleRate) * 1000,
    attackBrightnessDb: energy > EPS ? clamp(toDb(diffEnergy) - toDb(energy), -60, 10) : 0
  }
}

/** The impact measures for one channel's window. */
export function measureImpact(samples: ArrayLike<number>, onset: number, sampleRate: number): ImpactCheck {
  const frames = (ms: number): number => Math.round((sampleRate * ms) / 1000)
  const lateFrom = onset + frames(IMPACT_LATE_FROM_MS)
  const lateTo = Math.min(samples.length, onset + frames(IMPACT_LATE_TO_MS))
  const tailFrom = onset + frames(IMPACT_TAIL_FROM_MS)
  const tailTo = Math.min(samples.length, onset + frames(IMPACT_TAIL_TO_MS))

  const head = meanSquare(samples, onset, onset + frames(5))
  const late = meanSquare(samples, lateFrom, lateTo)
  const sustainDb = clamp(toDb(late) - toDb(head), -80, 40)

  // Too little audio past the onset to judge the decay. Reported as "already
  // decayed", which is the safe direction: the gate then never rejects on a
  // measurement it could not actually make.
  const tailShort = tailTo - tailFrom < frames(25)
  const drivenDb = tailShort ? -80 : clamp(toDb(meanSquare(samples, tailFrom, tailTo)) - toDb(late), -80, 40)
  const periodicity = lateTo - lateFrom < frames(20) ? 0 : latePeriodicity(samples, lateFrom, lateTo, sampleRate)

  return {
    sustainDb,
    drivenDb,
    periodicity,
    contacts: countContacts(samples, onset, sampleRate),
    ...measureAttack(samples, onset, sampleRate)
  }
}

/**
 * The most conservative reading across every channel: a sound only counts as
 * sustained/driven when *all* channels say so. Channels of one mic hear
 * nearly the same thing, so this costs almost nothing in rejection power —
 * and it means one odd channel can never suppress a real tap. Null when no
 * channel contains a usable onset.
 */
export function detectImpact(channels: ArrayLike<number>[], sampleRate: number): ImpactCheck | null {
  const checks: ImpactCheck[] = []
  for (const samples of channels) {
    const onset = localizeOnset(samples)
    if (onset >= 0) checks.push(measureImpact(samples, onset, sampleRate))
  }
  if (checks.length === 0) return null
  return {
    sustainDb: Math.min(...checks.map((check) => check.sustainDb)),
    drivenDb: Math.min(...checks.map((check) => check.drivenDb)),
    periodicity: Math.min(...checks.map((check) => check.periodicity)),
    // The fewest any channel saw: every channel must agree it was a series
    // of impacts before one is rejected for being one.
    contacts: Math.min(...checks.map((check) => check.contacts)),
    // Same idea: a soft contact is only called one when every channel agrees.
    riseMs: Math.min(...checks.map((check) => check.riseMs)),
    attackBrightnessDb: Math.max(...checks.map((check) => check.attackBrightnessDb))
  }
}

function analyzeChannel(samples: ArrayLike<number>, sampleRate: number): ChannelAnalysis | null {
  const onset = localizeOnset(samples)
  if (onset < 0) return null
  const start = Math.max(0, onset - PRE_ONSET_FRAMES)
  const segment = new Float64Array(TAP_FFT_SIZE)
  for (let i = 0; i < TAP_FFT_SIZE && start + i < samples.length; i++) segment[i] = samples[start + i]

  const power = powerSpectrum(segment, (i, n) => onsetWindow(i, n, PRE_ONSET_FRAMES))
  const binHz = sampleRate / TAP_FFT_SIZE

  const bandDb = logBandLevelsDb(power, sampleRate, TAP_FFT_SIZE)
  const meanDb = bandDb.reduce((a, b) => a + b, 0) / bandDb.length
  // Shape only (loudness varies with tap force); /10 keeps values near unit scale.
  const shape = bandDb.map((db) => (db - meanDb) / 10)

  let weighted = 0
  let total = 0
  for (let bin = 1; bin < power.length; bin++) {
    weighted += bin * binHz * power[bin]
    total += power[bin]
  }
  const centroid = Math.log2(Math.max(weighted / (total + EPS), 50) / 1000)

  const blockEnergy = (from: number): number => {
    let sum = 0
    for (let i = 0; i < 256; i++) sum += segment[from + i] * segment[from + i]
    return sum / 256
  }
  const e0 = blockEnergy(0)
  const decay1 = clamp(toDb(blockEnergy(256)) - toDb(e0), -40, 10) / 10
  const decay2 = clamp(toDb(blockEnergy(512)) - toDb(e0), -40, 10) / 10

  let rmsSum = 0
  for (let i = 0; i < segment.length; i++) rmsSum += segment[i] * segment[i]

  const envelope = envelopeFeatures(samples, onset, sampleRate)

  // The attack on its own: ATTACK_FFT_SIZE samples from just before the
  // onset, windowed so they reach full weight almost immediately.
  const attackRise = 16
  const attackStart = Math.max(0, onset - attackRise)
  const attack = new Float64Array(ATTACK_FFT_SIZE)
  for (let i = 0; i < ATTACK_FFT_SIZE && attackStart + i < samples.length; i++) attack[i] = samples[attackStart + i]
  const attackPower = powerSpectrum(attack, (i, n) => onsetWindow(i, n, attackRise))
  const attackDb = logBandLevelsDb(attackPower, sampleRate, ATTACK_FFT_SIZE, ATTACK_BAND_COUNT, ATTACK_MIN_HZ, ATTACK_MAX_HZ)
  const attackMean = attackDb.reduce((a, b) => a + b, 0) / attackDb.length
  const attackShape = attackDb.map((db) => (db - attackMean) / 10)
  // How much of the first ~21 ms is in the first ~5 ms: a nearer spot's
  // direct click is a bigger share of what the mic hears. A ratio, so tap
  // force cancels out.
  let attackEnergy = 0
  for (let i = 0; i < ATTACK_FFT_SIZE; i++) attackEnergy += attack[i] * attack[i]
  const attackShare = clamp(toDb(attackEnergy) - toDb(rmsSum), -30, 0) / 10

  return {
    features: [
      ...shape,
      centroid,
      decay1,
      decay2,
      ...envelope,
      ...attackShape,
      attackShare,
      ...echoFeatures(samples, onset, sampleRate)
    ],
    levelDb: toDb(rmsSum / segment.length),
    onset
  }
}

/** Lag (in frames) at which `b` best matches `a` — positive means `b`
 *  heard the tap later. First-difference signals emphasize the sharp
 *  attack over low-frequency rumble. */
export function estimateDelay(a: ArrayLike<number>, b: ArrayLike<number>, around: number, maxLag: number): number {
  const length = 384
  const start = Math.max(maxLag + 1, around - PRE_ONSET_FRAMES)
  const end = Math.min(a.length, b.length) - maxLag - 1
  if (end - start < 64) return 0
  const span = Math.min(length, end - start)
  let bestLag = 0
  let bestScore = -Infinity
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let score = 0
    for (let i = start; i < start + span; i++) {
      score += (a[i] - a[i - 1]) * (b[i + lag] - b[i + lag - 1])
    }
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  return bestLag
}

/** Same-device delay search range: ~1 ms, plenty for laptop mic arrays. */
const MAX_DELAY_SECONDS = 0.001

/**
 * One tap's feature vector from raw windows of every mic channel.
 * `deviceOf[c]` is which physical device channel `c` belongs to — arrival
 * delays are only meaningful between channels of one device (separate
 * devices have independent clocks and buffering). Returns null when no
 * channel contains a usable transient.
 */
export function extractTapFeatures(
  channels: ArrayLike<number>[],
  deviceOf: number[],
  sampleRate: number
): number[] | null {
  const analyses = channels.map((samples) => analyzeChannel(samples, sampleRate))
  if (analyses.every((analysis) => analysis === null)) return null

  const silent = new Array(FEATURES_PER_CHANNEL).fill(0)
  const features: number[] = []
  for (const analysis of analyses) features.push(...(analysis?.features ?? silent))


  if (channels.length > 1) {
    const levels = analyses.map((analysis) => analysis?.levelDb ?? -140)
    const meanLevel = levels.reduce((a, b) => a + b, 0) / levels.length
    for (const level of levels) features.push(clamp(level - meanLevel, -40, 40) / 10)

    const maxLag = Math.max(1, Math.round(sampleRate * MAX_DELAY_SECONDS))
    for (let c = 0; c < channels.length; c++) {
      const first = deviceOf.indexOf(deviceOf[c])
      if (first === c) continue
      const reference = analyses[first]
      features.push(reference ? estimateDelay(channels[first], channels[c], reference.onset, maxLag) / 16 : 0)
    }
  }
  return features
}

// ----------------------------------------------------- model + classification

/** Averages several feature vectors into one profile. */
export function averageFeatureVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return []
  const length = vectors[0].length
  const sums = new Array(length).fill(0)
  for (const vector of vectors) {
    for (let i = 0; i < length; i++) sums[i] += vector[i] ?? 0
  }
  return sums.map((sum) => sum / vectors.length)
}

/** Smallest per-dimension spread trusted — stops a dimension that happened
 *  to be identical across a few calibration taps from becoming infinitely
 *  strict about tiny natural variation. */
const MIN_SCALE = 0.18
/** How far a dimension's weight may be pushed either way. A dimension that
 *  separates zones well is worth more than one that doesn't, but never so
 *  much that the decision rests on a single number. */
const MIN_WEIGHT = 0.3
const MAX_WEIGHT = 3

export interface HoloModel {
  zones: HoloZoneProfile[]
  scale: number[]
  weights: number[]
}

/**
 * Builds zone profiles plus two per-dimension vectors.
 *
 * `scale` (pooled within-zone standard deviation, blended with its own
 * average so a dimension that looked artificially steady across a handful of
 * taps isn't trusted beyond reason) makes distances comparable across
 * feature types — dB shape, delay, level — so one threshold means the same
 * thing on any mic setup.
 *
 * `weights` then asks a second, different question: of those standardized
 * dimensions, which ones actually tell the zones *apart*? A band that varies
 * just as much between two taps on the same spot as it does between spots
 * carries no location information, and averaging it into the distance only
 * adds noise — which is exactly how a tap lands on the wrong zone. Each
 * weight is the spread of the zone means in that dimension divided by the
 * within-zone spread (a Fisher ratio, in already-standardized units),
 * normalized so the average weight is 1 and the overall distance scale is
 * unchanged.
 */
export function buildModel(tapsByZone: Array<{ zone: HoloZone; taps: number[][] }>): HoloModel {
  const zones: HoloZoneProfile[] = tapsByZone.map(({ zone, taps }) => ({
    zone,
    features: averageFeatureVectors(taps),
    taps,
    sampleCount: taps.length
  }))
  const dimension = zones[0]?.features.length ?? 0
  const pooled = new Array(dimension).fill(0)
  let degrees = 0
  tapsByZone.forEach(({ taps }, zoneIndex) => {
    for (const tap of taps) {
      for (let d = 0; d < dimension; d++) {
        const diff = (tap[d] ?? 0) - zones[zoneIndex].features[d]
        pooled[d] += diff * diff
      }
    }
    degrees += Math.max(0, taps.length - 1)
  })
  const std = pooled.map((sum) => Math.sqrt(sum / Math.max(1, degrees)))
  const avgStd = std.reduce((a, b) => a + b, 0) / (std.length || 1)
  const scale = std.map((value) => Math.max(MIN_SCALE, Math.sqrt(0.5 * value * value + 0.5 * avgStd * avgStd)))

  // Spread of the zone means, in units of `scale` — how much of this
  // dimension's variation is between zones rather than within one.
  const separability = new Array(dimension).fill(0)
  for (let d = 0; d < dimension; d++) {
    const means = zones.map((profile) => profile.features[d] ?? 0)
    const mean = means.reduce((a, b) => a + b, 0) / (means.length || 1)
    const variance = means.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / (means.length || 1)
    separability[d] = Math.sqrt(variance) / scale[d]
  }
  const avgSeparability = separability.reduce((a, b) => a + b, 0) / (separability.length || 1)
  const weights =
    avgSeparability > EPS
      ? separability.map((value) => clamp(value / avgSeparability, MIN_WEIGHT, MAX_WEIGHT))
      : new Array(dimension).fill(1)

  return { zones, scale, weights }
}

/** Root-mean-square z-distance: ~1 for a typical repeat of the same tap.
 *  `weights` is optional so the raw standardized distance stays available
 *  (the model builder needs it before any weights exist). */
export function scaledDistance(a: number[], b: number[], scale: number[], weights?: number[]): number {
  const length = Math.min(a.length, b.length, scale.length)
  if (length === 0) return Infinity
  let sum = 0
  for (let i = 0; i < length; i++) {
    const z = ((a[i] - b[i]) / scale[i]) * (weights?.[i] ?? 1)
    sum += z * z
  }
  return Math.sqrt(sum / length)
}

function maxAbsZ(a: number[], b: number[], scale: number[], weights?: number[]): number {
  let max = 0
  const length = Math.min(a.length, b.length, scale.length)
  for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(((a[i] - b[i]) / scale[i]) * (weights?.[i] ?? 1)))
  return max
}

/** How many of a zone's own calibration taps the nearest-neighbour half of
 *  the distance averages over. */
const KNN_NEIGHBOURS = 2
/** How much of the distance comes from the zone's average tap rather than
 *  its nearest individual ones. */
const CENTROID_SHARE = 0.5

/**
 * Distance from a sound to one zone, as half "how far from this zone's
 * average tap" and half "how far from the nearest taps actually recorded
 * there".
 *
 * The average alone assumes every tap on a spot sounds like every other one,
 * which real taps don't: force, knuckle angle and the exact square inch all
 * move the sound, so a zone is a small cloud rather than a point, and a tap
 * at the edge of its own cloud can sit closer to a neighbour's average than
 * to its own. The nearest-neighbour half sees that cloud. Keeping both is
 * deliberate shrinkage — with only a handful of taps per zone, individual
 * neighbours are noisy, and the average is the steadier estimate.
 */
function zoneDistance(features: number[], profile: HoloZoneProfile, scale: number[], weights: number[]): number {
  const centroid = scaledDistance(features, profile.features, scale, weights)
  const taps = profile.taps ?? []
  if (taps.length === 0) return centroid

  const nearest = taps.map((tap) => scaledDistance(features, tap, scale, weights)).sort((a, b) => a - b)
  const k = Math.min(KNN_NEIGHBOURS, nearest.length)
  const knn = nearest.slice(0, k).reduce((a, b) => a + b, 0) / k
  return CENTROID_SHARE * centroid + (1 - CENTROID_SHARE) * knn
}

// ----------------------------------------------------- linear discriminant

/**
 * A regularized linear discriminant over the zones: the part of the model
 * that decides *which* zone, as opposed to *whether* a sound is a tap at all
 * (the gates and `zoneDistance` below still own that).
 *
 * Why not the weighted distance alone: it treats every feature as separate
 * evidence, but they aren't. Neighbouring frequency bands rise and fall
 * together, so a distance counts the same fact several times, and a broad,
 * correlated wobble (a harder tap brightens every band at once) can outvote
 * the one narrow difference that actually tells two spots apart. A
 * discriminant uses the covariance of the user's own taps to cancel shared
 * wobble and keep only the directions along which the zones differ. With
 * two zones it reduces to a single, well-chosen direction.
 *
 * Calibration has far fewer taps than dimensions, so the raw covariance is
 * singular. It's shrunk towards a scaled identity by the Ledoit-Wolf amount,
 * which is computed from the data: a lot of shrinkage when the taps can't
 * support a full covariance, less when they can. No tuning constant.
 *
 * Built from the stored calibration taps whenever a calibration is loaded,
 * so it needs no extra persistence.
 */
export interface Discriminant {
  zones: HoloZone[]
  /** Per zone: linear weights over the standardized features. */
  weights: number[][]
  biases: number[]
  /** Per zone: mean of its standardized calibration taps. */
  means: number[][]
  /** Cholesky factor (row-major, lower) of the shrunk pooled covariance. */
  cholesky: Float64Array
  dimension: number
}

/** Lower Cholesky factor of symmetric positive-definite A (d×d, row-major). */
function choleskyFactor(a: Float64Array, d: number): Float64Array {
  const l = new Float64Array(d * d)
  for (let i = 0; i < d; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = a[i * d + j]
      for (let k = 0; k < j; k++) sum -= l[i * d + k] * l[j * d + k]
      if (i === j) l[i * d + i] = Math.sqrt(Math.max(sum, 1e-12))
      else l[i * d + j] = sum / l[j * d + j]
    }
  }
  return l
}

/** Forward substitution: y with L y = b. */
function forwardSolve(l: Float64Array, d: number, b: ArrayLike<number>): Float64Array {
  const y = new Float64Array(d)
  for (let i = 0; i < d; i++) {
    let sum = b[i]
    for (let k = 0; k < i; k++) sum -= l[i * d + k] * y[k]
    y[i] = sum / l[i * d + i]
  }
  return y
}

/** Solves (L L') x = b. */
function choleskySolve(l: Float64Array, d: number, b: ArrayLike<number>): number[] {
  const y = forwardSolve(l, d, b)
  const x = new Array<number>(d).fill(0)
  for (let i = d - 1; i >= 0; i--) {
    let sum = y[i]
    for (let k = i + 1; k < d; k++) sum -= l[k * d + i] * x[k]
    x[i] = sum / l[i * d + i]
  }
  return x
}

export function buildDiscriminant(
  tapsByZone: Array<{ zone: HoloZone; taps: number[][] }>,
  scale: number[]
): Discriminant | null {
  const usable = tapsByZone.filter((entry) => entry.taps.length > 0)
  if (usable.length < 2) return null
  const d = scale.length
  const standardize = (tap: number[]): number[] => scale.map((s, i) => (tap[i] ?? 0) / s)

  const means: number[][] = []
  const centered: number[][] = []
  for (const { taps } of usable) {
    const z = taps.map(standardize)
    const mean = averageFeatureVectors(z)
    means.push(mean)
    for (const row of z) centered.push(row.map((value, i) => value - mean[i]))
  }
  const n = centered.length
  if (n < 2) return null

  // Pooled within-zone covariance.
  const cov = new Float64Array(d * d)
  for (const row of centered) {
    for (let i = 0; i < d; i++) {
      const ri = row[i]
      if (ri === 0) continue
      for (let j = 0; j <= i; j++) cov[i * d + j] += ri * row[j]
    }
  }
  for (let i = 0; i < d; i++) {
    for (let j = 0; j <= i; j++) {
      cov[i * d + j] /= n
      cov[j * d + i] = cov[i * d + j]
    }
  }

  // Ledoit-Wolf shrinkage intensity towards mu*I.
  let trace = 0
  for (let i = 0; i < d; i++) trace += cov[i * d + i]
  const mu = trace / d
  let distance2 = 0
  let covNorm2 = 0
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      const value = cov[i * d + j]
      covNorm2 += value * value
      const off = value - (i === j ? mu : 0)
      distance2 += off * off
    }
  }
  let spread = 0
  for (const row of centered) {
    let norm2 = 0
    for (const value of row) norm2 += value * value
    let quad = 0
    for (let i = 0; i < d; i++) {
      let si = 0
      for (let j = 0; j < d; j++) si += cov[i * d + j] * row[j]
      quad += row[i] * si
    }
    // ||x x' - S||_F^2 = ||x||^4 - 2 x'Sx + ||S||_F^2
    spread += norm2 * norm2 - 2 * quad + covNorm2
  }
  spread /= n * n
  const shrinkage = distance2 > EPS ? clamp(spread / distance2, 0, 1) : 1
  const floor = Math.max(mu, 1e-6)
  const shrunk = new Float64Array(d * d)
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      shrunk[i * d + j] = (1 - shrinkage) * cov[i * d + j] + (i === j ? shrinkage * floor : 0)
    }
  }

  const cholesky = choleskyFactor(shrunk, d)
  const weights = means.map((mean) => choleskySolve(cholesky, d, mean))
  const biases = weights.map((w, k) => -0.5 * w.reduce((sum, value, i) => sum + value * means[k][i], 0))
  return { zones: usable.map((entry) => entry.zone), weights, biases, means, cholesky, dimension: d }
}

/**
 * How far a sound is from one zone's taps, measured with the same shrunk
 * covariance the discriminant uses (a Mahalanobis distance), as an RMS per
 * dimension so it reads ~1 for a typical tap. This is the "was it a tap
 * *here* at all" question, and it's better at it than the per-feature
 * distance for the same reason the discriminant is better at "which zone":
 * a harder tap moves many correlated features together, which this
 * recognizes as ordinary, while a tap on a spot that was never calibrated
 * changes their *relationship* (a different echo, a different attack),
 * which this sees as far away.
 */
export function discriminantDistance(
  features: number[],
  discriminant: Discriminant,
  scale: number[],
  zoneIndex: number
): number {
  const d = discriminant.dimension
  const mean = discriminant.means[zoneIndex]
  const diff = scale.map((s, i) => (features[i] ?? 0) / s - mean[i])
  const y = forwardSolve(discriminant.cholesky, d, diff)
  let sum = 0
  for (let i = 0; i < d; i++) sum += y[i] * y[i]
  return Math.sqrt(sum / d)
}

/**
 * Leave-one-out over the calibration taps with the discriminant *refitted*
 * for every held-out tap. This is the honest version of the calibration
 * accuracy shown to the user: scoring taps against a model that already
 * contains them flatters it (the old score read 95-100% on setups that got
 * ~80% of fresh taps right). It also supplies the spread of genuine taps'
 * distances that `deriveGates` turns into the "is it a tap here" bound.
 */
export function evaluateDiscriminant(
  tapsByZone: Array<{ zone: HoloZone; taps: number[][] }>,
  scale: number[]
): CalibrationEvaluation {
  let correct = 0
  let total = 0
  const distances: number[] = []
  tapsByZone.forEach(({ zone, taps }, zoneIndex) => {
    taps.forEach((tap, tapIndex) => {
      const folds = tapsByZone.map((entry, index) =>
        index === zoneIndex ? { zone: entry.zone, taps: entry.taps.filter((_, i) => i !== tapIndex) } : entry
      )
      const fitted = buildDiscriminant(folds, scale)
      if (!fitted) return
      const own = fitted.zones.indexOf(zone)
      if (own < 0) return
      const posteriors = discriminantPosteriors(tap, fitted, scale)
      total++
      if (posteriors.indexOf(Math.max(...posteriors)) === own) correct++
      distances.push(discriminantDistance(tap, fitted, scale, own))
    })
  })
  return { accuracy: total === 0 ? 0 : correct / total, distances }
}

/** Posterior probability of each zone (same order as `discriminant.zones`),
 *  assuming equal priors. */
export function discriminantPosteriors(features: number[], discriminant: Discriminant, scale: number[]): number[] {
  const z = scale.map((s, i) => (features[i] ?? 0) / s)
  const scores = discriminant.weights.map(
    (w, k) => w.reduce((sum, value, i) => sum + value * z[i], 0) + discriminant.biases[k]
  )
  const top = Math.max(...scores)
  const exps = scores.map((score) => Math.exp(score - top))
  const total = exps.reduce((a, b) => a + b, 0)
  return exps.map((value) => value / total)
}

/** Below this posterior the winning zone isn't trusted enough to act on: a
 *  missed tap costs a retry, a wrong one runs the wrong macro. Chosen on the
 *  simulated benchmark: 0.95 trades ~1 point of misses for fewer wrong-zone
 *  fires than 0.85, and stays above 95% right-zone at 12 calibration taps. */
export const MIN_ZONE_POSTERIOR = 0.95

export type ClassificationReason =
  | 'ok'
  | 'unrecognized'
  | 'ambiguous'
  | 'wrong-level'
  | 'not-a-tap'
  | 'voice'
  | 'set-down'
  | 'soft-touch'
  | 'learned-ignore'
  | 'no-calibration'

export interface ClassificationResult {
  zone: HoloZone | null
  /** With the discriminant: the winning zone's posterior probability.
   *  Without it: the winner's margin over the runner-up (0..1). */
  confidence: number
  reason: ClassificationReason
  /** How far the sound was from the winning zone, in the units of
   *  `HoloGates.maxDistance`. Absent when it was rejected before ranking. */
  distance?: number
  /** For 'ambiguous' only: the zone it was closest to. It passed every "is
   *  this a tap" check and only failed "which zone, for sure", so the
   *  second half of a double tap may still use it (see holoStore). */
  candidate?: HoloZone
}

/** Used when a calibration predates the contact count being measured —
 *  permissive rather than strict, so an older calibration is never made
 *  worse by a gate whose bar was never measured for it. */
export const DEFAULT_MAX_CONTACTS = 2

/** Fallbacks for a calibration saved before gates were measured, and for the
 *  degenerate case of a calibration with nothing to measure from. */
export const DEFAULT_GATES: HoloGates = {
  maxContacts: DEFAULT_MAX_CONTACTS,
  minPosterior: MIN_ZONE_POSTERIOR,
  maxDistance: 2.8,
  maxSingleFeatureZ: 8,
  minMargin: 0.06,
  minPeakDb: -70,
  maxPeakDb: 0,
  maxSustainDb: -20,
  maxDrivenDb: -15
}

/** Headroom over the worst calibration tap. Generous on purpose: a missed
 *  tap is felt immediately and a false one only occasionally, so every bound
 *  sits a clear margin outside what the user actually demonstrated. 1.5 on
 *  the discriminant distance: at 1.3 about 3% of genuine taps fell outside
 *  it on the benchmark, at 1.5 almost none, and a tap on a different
 *  surface (the desk beside the laptop, the laptop body) is still several
 *  times further away than either. */
const DISTANCE_HEADROOM = 1.5
const PEAK_ABOVE_MARGIN_DB = 9
const PEAK_BELOW_MARGIN_DB = 10
const IMPACT_MARGIN_DB = 6

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))))]
}

/**
 * Turns the calibration taps into the bounds above. The 90th percentile
 * rather than the maximum, so one bad tap (a slip, a knock on the laptop
 * itself) can't widen every gate; then a margin on top of that.
 */
export function deriveGates(looDistances: number[], peakDbs: number[], impacts: ImpactCheck[]): HoloGates {
  const sustains = impacts.map((impact) => impact.sustainDb)
  const drivens = impacts.map((impact) => impact.drivenDb)
  return {
    maxDistance: looDistances.length
      ? clamp(percentile(looDistances, 0.9) * DISTANCE_HEADROOM, 1.2, 4.5)
      : DEFAULT_GATES.maxDistance,
    minPosterior: MIN_ZONE_POSTERIOR,
    maxSingleFeatureZ: DEFAULT_GATES.maxSingleFeatureZ,
    minMargin: DEFAULT_GATES.minMargin,
    minPeakDb: peakDbs.length ? Math.min(...peakDbs) - PEAK_BELOW_MARGIN_DB : DEFAULT_GATES.minPeakDb,
    maxPeakDb: peakDbs.length ? Math.max(...peakDbs) + PEAK_ABOVE_MARGIN_DB : DEFAULT_GATES.maxPeakDb,
    maxSustainDb: sustains.length ? clamp(percentile(sustains, 0.9) + IMPACT_MARGIN_DB, -45, -6) : DEFAULT_GATES.maxSustainDb,
    maxDrivenDb: drivens.length ? clamp(percentile(drivens, 0.9) + IMPACT_MARGIN_DB, -32, -4) : DEFAULT_GATES.maxDrivenDb,
    // Whatever the user's own taps actually do. Almost always 1 — which
    // makes this a tight gate for free — but a knuckle that habitually
    // bounces sets its own bar rather than being called a mouse.
    maxContacts: impacts.length
      ? Math.min(3, Math.max(1, percentile(impacts.map((impact) => impact.contacts), 0.9)))
      : DEFAULT_MAX_CONTACTS,
    // Slowest / dullest of the user's own taps (90th / 10th percentile) plus
    // a margin, so only contacts clearly softer than anything they tapped
    // with are refused.
    ...(impacts.length
      ? {
          maxRiseMs: percentile(impacts.map((impact) => impact.riseMs), 0.9) * RISE_HEADROOM + RISE_MARGIN_MS,
          minAttackBrightnessDb:
            percentile(impacts.map((impact) => impact.attackBrightnessDb), 0.1) - BRIGHTNESS_MARGIN_DB
        }
      : {})
  }
}

/** 1.2x the slowest ordinary tap: on the benchmark this let ~10% of
 *  fingertips-coming-to-rest through (vs 21% at 1.5x) for about one point of
 *  real taps; the double tap (doubleTap.ts) takes care of the rest. Tighter
 *  than this started costing real taps faster than it caught soft contacts. */
const RISE_HEADROOM = 1.2
const RISE_MARGIN_MS = 0.5
const BRIGHTNESS_MARGIN_DB = 6

/**
 * The sensitivity control, applied to the gates as well as to the onset
 * threshold. One knob the user can actually reason about: "Light taps" leans
 * towards firing on anything plausible, "Firm taps" towards only firing on
 * something unmistakable. Which way to lean is a matter of where they are
 * sitting and what else is in the room, so it belongs to them rather than to
 * a constant in here.
 */
export function relaxGates(gates: HoloGates, sensitivity: HoloSensitivity): HoloGates {
  const lean = { low: -1, medium: 0, high: 1 }[sensitivity]
  if (lean === 0) return gates
  return {
    ...gates,
    maxDistance: gates.maxDistance * (1 + 0.15 * lean),
    minMargin: Math.max(0, gates.minMargin - 0.02 * lean),
    // "Light taps" accepts a less certain zone, "Firm taps" wants near
    // certainty: 0.9 / 0.95 / 0.98.
    minPosterior: clamp((gates.minPosterior ?? MIN_ZONE_POSTERIOR) + (lean > 0 ? -0.05 : 0.03), 0.5, 0.99),
    minPeakDb: gates.minPeakDb - 4 * lean,
    maxPeakDb: gates.maxPeakDb + 4 * lean,
    maxSustainDb: gates.maxSustainDb + 3 * lean,
    maxDrivenDb: gates.maxDrivenDb + 3 * lean,
    ...(gates.maxRiseMs !== undefined ? { maxRiseMs: gates.maxRiseMs * (1 + 0.25 * lean) } : {}),
    ...(gates.minAttackBrightnessDb !== undefined ? { minAttackBrightnessDb: gates.minAttackBrightnessDb - 2 * lean } : {})
  }
}

/**
 * How much closer a sound has to be to something the user has taught Noma to
 * ignore than to its best zone before it is thrown away.
 *
 * Under 1, so a known unwanted sound has to be *clearly* the better match,
 * not merely a tie. This is the whole reason the learned-ignore list is safe
 * where its ancestor wasn't: an earlier version of Holo averaged every
 * unwanted sound into a single vector and let it compete as a fifth zone,
 * which put it in the middle of everything and let it beat real taps. These
 * are kept as individual examples, they are never averaged, they can never
 * win a zone — they can only veto one, and only by a margin.
 */
export const IGNORE_MATCH_MARGIN = 0.9

/** Most Noma keeps. Old examples are dropped first: a room changes, and a
 *  list that only ever grows would eventually veto everything. */
export const MAX_IGNORED_SOUNDS = 40

export interface ClassifyOptions {
  weights?: number[]
  gates?: HoloGates
  /** Peak loudness of the sound, for the level bounds. */
  peakDb?: number
  /** Decay measures, for the impact gate. */
  impact?: ImpactCheck
  /** Feature vectors of sounds the user has pointed at and said "not a tap"
   *  — a mouse being set down, a drawer, whatever this desk actually does. */
  negatives?: number[][]
  /** When present, decides the zone (see `Discriminant`); the distance
   *  ranking is then only used for the "is it a tap at all" bound. */
  discriminant?: Discriminant | null
}

export function classifyZone(
  features: number[],
  profiles: HoloZoneProfile[],
  scale: number[],
  options: ClassifyOptions = {}
): ClassificationResult {
  if (profiles.length === 0) return { zone: null, confidence: 0, reason: 'no-calibration' }

  const gates = options.gates ?? DEFAULT_GATES
  const weights = options.weights ?? new Array(scale.length).fill(1)

  if (options.peakDb !== undefined && (options.peakDb > gates.maxPeakDb || options.peakDb < gates.minPeakDb)) {
    return { zone: null, confidence: 0, reason: 'wrong-level' }
  }
  if (options.impact && !isImpactLike(options.impact, gates)) {
    // Named apart only so the user is told something true about what they
    // heard themselves do; both are the same rejection.
    return { zone: null, confidence: 0, reason: options.impact.periodicity > VOICE_PERIODICITY ? 'voice' : 'not-a-tap' }
  }
  if (options.impact && options.impact.contacts > (gates.maxContacts ?? DEFAULT_MAX_CONTACTS)) {
    return { zone: null, confidence: 0, reason: 'set-down' }
  }
  if (
    options.impact &&
    ((gates.maxRiseMs !== undefined && options.impact.riseMs > gates.maxRiseMs) ||
      (gates.minAttackBrightnessDb !== undefined && options.impact.attackBrightnessDb < gates.minAttackBrightnessDb))
  ) {
    return { zone: null, confidence: 0, reason: 'soft-touch' }
  }

  const ranked = profiles
    .map((profile) => ({
      zone: profile.zone,
      distance: zoneDistance(features, profile, scale, weights),
      worst: maxAbsZ(features, profile.features, scale, weights)
    }))
    .sort((a, b) => a.distance - b.distance)

  const discriminant = options.discriminant
  let posterior: number | null = null
  let noveltyDistance: number | null = null
  if (discriminant && profiles.length > 1) {
    const posteriors = discriminantPosteriors(features, discriminant, scale)
    const top = posteriors.indexOf(Math.max(...posteriors))
    const chosen = ranked.findIndex((entry) => entry.zone === discriminant.zones[top])
    if (chosen > 0) ranked.unshift(...ranked.splice(chosen, 1))
    posterior = posteriors[top]
    noveltyDistance = discriminantDistance(features, discriminant, scale, top)
  }
  const [best, runnerUp] = ranked

  // The single-feature bound only applies to the older distance-only model.
  // With the discriminant it did more harm than good: separability weights
  // of up to 3x pushed ordinary taps past it (it was rejecting ~15% of real
  // taps on the benchmark), and the Mahalanobis bound already catches a
  // sound whose features are wrong *together*, which is what matters.
  const singleFeatureOff = noveltyDistance === null && best.worst > gates.maxSingleFeatureZ
  if (!((noveltyDistance ?? best.distance) <= gates.maxDistance) || singleFeatureOff) {
    return { zone: null, confidence: 0, reason: 'unrecognized' }
  }
  // Checked after the zones, not before: a sound only has to survive this if
  // it was going to be accepted anyway, and the comparison is against the
  // zone it would have won — so the list can never reject something it isn't
  // actually a better explanation for.
  if (options.negatives?.length) {
    const nearestIgnored = Math.min(
      ...options.negatives.map((example) => scaledDistance(features, example, scale, weights))
    )
    if (nearestIgnored <= best.distance * IGNORE_MATCH_MARGIN) {
      return { zone: null, confidence: 0, reason: 'learned-ignore' }
    }
  }
  const distance = noveltyDistance ?? best.distance
  if (!runnerUp) return { zone: best.zone, confidence: 1, reason: 'ok', distance }
  if (posterior !== null) {
    if (posterior < (gates.minPosterior ?? MIN_ZONE_POSTERIOR)) {
      return { zone: null, confidence: posterior, reason: 'ambiguous', distance, candidate: best.zone }
    }
    return { zone: best.zone, confidence: posterior, reason: 'ok', distance }
  }

  const margin = runnerUp.distance === 0 ? 0 : 1 - best.distance / runnerUp.distance
  if (margin < gates.minMargin) return { zone: null, confidence: margin, reason: 'ambiguous' }
  return { zone: best.zone, confidence: Math.min(1, margin), reason: 'ok' }
}

// ------------------------------------------------------------ learning in use

/**
 * Only taps this certain are learned from. A wrongly learned tap teaches the
 * model its own mistake, so the bar is far above what's needed to *act* on a
 * tap (MIN_ZONE_POSTERIOR): on the benchmark, 0.99 and 0.999 learned equally
 * well, and neither ever drifted.
 */
export const LEARN_MIN_POSTERIOR = 0.99
/** ...and only taps well inside the "is it a tap here" bound, so an
 *  unusual sound that barely passed is never made more typical. */
const LEARN_MAX_DISTANCE_SHARE = 0.8
/** Learned taps kept per zone, on top of the calibration taps. With 12
 *  calibration taps this lets a zone grow to 48, where the benchmark
 *  plateaus (~97% right-zone vs ~92% from calibration alone). */
export const MAX_LEARNED_TAPS = 36

/** Whether a classified tap is certain enough to learn from. */
export function shouldLearnFrom(result: ClassificationResult, gates: HoloGates): boolean {
  return (
    result.zone !== null &&
    result.reason === 'ok' &&
    result.confidence >= LEARN_MIN_POSTERIOR &&
    result.distance !== undefined &&
    result.distance <= gates.maxDistance * LEARN_MAX_DISTANCE_SHARE
  )
}

/**
 * Adds a tap to its zone's learned taps (oldest dropped past
 * MAX_LEARNED_TAPS). Returns new profiles, never mutates.
 *
 * Why this exists: accuracy here is limited by how many examples each zone
 * has, not by the method. On the simulated benchmark the discriminant gets
 * ~92% from 12 calibration taps per zone, ~97% from 24 and ~99% from 48,
 * but a 48-tap wizard would be unbearable. Learning from near-certain taps
 * in everyday use gets the same effect without asking for it: ~97% after
 * a hundred taps, with wrong-zone fires down from ~3% to ~0.4%. It also
 * adapts to what calibration can't capture, such as a user who calibrated
 * gently and taps harder in use, or a laptop moved to a different desk.
 */
export function learnFromTap(profiles: HoloZoneProfile[], zone: HoloZone, features: number[]): HoloZoneProfile[] {
  return profiles.map((profile) =>
    profile.zone === zone
      ? { ...profile, learnedTaps: [...(profile.learnedTaps ?? []), features].slice(-MAX_LEARNED_TAPS) }
      : profile
  )
}

/** Removes a tap from whichever zone learned it (the user said it wasn't a
 *  tap after all). Compared by value, since a saved calibration has been
 *  through JSON. Returns the same array when nothing matched. */
export function forgetLearnedTap(profiles: HoloZoneProfile[], features: number[]): HoloZoneProfile[] {
  const same = (tap: number[]): boolean => tap.length === features.length && tap.every((v, i) => v === features[i])
  if (!profiles.some((profile) => profile.learnedTaps?.some(same))) return profiles
  return profiles.map((profile) =>
    profile.learnedTaps?.some(same) ? { ...profile, learnedTaps: profile.learnedTaps.filter((tap) => !same(tap)) } : profile
  )
}

/** Calibration taps plus learned ones: what the discriminant is built from. */
export function trainingTaps(profiles: HoloZoneProfile[]): Array<{ zone: HoloZone; taps: number[][] }> {
  return profiles.map((profile) => ({ zone: profile.zone, taps: [...(profile.taps ?? []), ...(profile.learnedTaps ?? [])] }))
}

export interface CalibrationEvaluation {
  /** Share of the calibration taps that land on their own zone. */
  accuracy: number
  /** Each tap's distance to its own zone with itself held out — the spread
   *  of genuine taps, which is what `deriveGates` turns into `maxDistance`. */
  distances: number[]
}

/**
 * Leave-one-out over the calibration taps themselves: each tap is scored
 * against a model rebuilt without it. Tells the user, right after
 * calibrating, whether their zones are actually separable on this setup —
 * instead of finding out by tapping and nothing happening — and supplies the
 * distance distribution the gates are derived from.
 *
 * `scale` and `weights` are not rebuilt per fold: they are second-order
 * statistics over every tap, so holding one out barely moves them, and
 * recomputing them 30-odd times would buy nothing.
 */
export function evaluateCalibration(
  tapsByZone: Array<{ zone: HoloZone; taps: number[][] }>,
  scale: number[],
  weights?: number[]
): CalibrationEvaluation {
  let correct = 0
  let total = 0
  const distances: number[] = []
  for (const { zone, taps } of tapsByZone) {
    if (taps.length < 2) continue
    taps.forEach((tap, index) => {
      const profiles: HoloZoneProfile[] = tapsByZone.map((entry) => {
        const used = entry.zone === zone ? entry.taps.filter((_, i) => i !== index) : entry.taps
        return { zone: entry.zone, features: averageFeatureVectors(used), taps: used, sampleCount: used.length }
      })
      const ranked = profiles
        .map((profile) => ({ zone: profile.zone, distance: zoneDistance(tap, profile, scale, weights ?? []) }))
        .sort((a, b) => a.distance - b.distance)
      total++
      if (ranked[0].zone === zone) correct++
      const own = ranked.find((entry) => entry.zone === zone)
      if (own) distances.push(own.distance)
    })
  }
  return { accuracy: total === 0 ? 0 : correct / total, distances }
}

// ------------------------------------------------------------ onset detection

export interface OnsetDetectorState {
  noiseFloor: number
  /** Whether the previous block was already over the threshold — a tap
   *  fires once on the rising edge, not on every block of its ringing. */
  previousAbove: boolean
  /** Consecutive blocks over the threshold (see SUSTAINED_ABOVE_BLOCKS). */
  aboveBlocks: number
}

export function createOnsetDetectorState(initialNoiseFloor = 0): OnsetDetectorState {
  return { noiseFloor: initialNoiseFloor, previousAbove: false, aboveBlocks: 0 }
}

/** ~0.5 s of blocks at 48 kHz. Past this, a sound that stays over the
 *  threshold is the room getting louder (a fan, music), not a tap ringing,
 *  and the floor is allowed to follow it again. */
const SUSTAINED_ABOVE_BLOCKS = 48

/**
 * Block loudness with the block's own mean (DC offset / slower-than-block
 * drift) removed. Deliberately not a first difference: that weights energy
 * by frequency squared and made soft desk taps — mostly low-frequency
 * thump — barely register against room noise.
 */
export function blockEnergy(samples: ArrayLike<number>): number {
  const n = samples.length
  if (n < 2) return 0
  let mean = 0
  for (let i = 0; i < n; i++) mean += samples[i]
  mean /= n
  let sum = 0
  for (let i = 0; i < n; i++) {
    const d = samples[i] - mean
    sum += d * d
  }
  return sum / n
}

export type HoloSensitivity = 'low' | 'medium' | 'high'

/** How many times louder than the rolling noise floor a block must be. */
export const SENSITIVITY_MULTIPLIER: Record<HoloSensitivity, number> = { low: 30, medium: 12, high: 5 }
/** Floor of the floor, so a dead-silent mic can't fire on a single bit flip
 *  (diff-RMS ≈ 0.001 of full scale). */
const MIN_NOISE_ENERGY = 1e-6
const NOISE_FLOOR_EMA_ALPHA = 0.04
/** Threshold energy a block must exceed right now — also drives the UI meter. */
export function onsetThreshold(state: OnsetDetectorState, sensitivity: HoloSensitivity): number {
  return Math.max(state.noiseFloor, MIN_NOISE_ENERGY) * SENSITIVITY_MULTIPLIER[sensitivity]
}

export function detectOnset(energy: number, state: OnsetDetectorState, sensitivity: HoloSensitivity = 'medium'): boolean {
  // Rising edge across the threshold. (Comparing against the previous
  // block's energy instead missed taps that straddle a block boundary: a
  // slow-rising thump can be 0.9x threshold in one block and 2x in the
  // next, which is under any fixed jump ratio yet plainly a tap.)
  const above = energy > onsetThreshold(state, sensitivity)
  const isOnset = above && !state.previousAbove
  state.aboveBlocks = above ? state.aboveBlocks + 1 : 0
  // Only quiet blocks feed the noise floor. A tap rings for 100 ms or more
  // after its onset, and letting those blocks in raised the floor (and so the
  // threshold) right when the next tap was most likely: a quick second tap
  // was being judged against the first one's echo, which is part of why a
  // tap sometimes needed repeating. A long, steady rise still gets through,
  // after SUSTAINED_ABOVE_BLOCKS, so a room that gets louder isn't mistaken
  // for a tap forever.
  if (!above || state.aboveBlocks > SUSTAINED_ABOVE_BLOCKS) {
    state.noiseFloor = state.noiseFloor * (1 - NOISE_FLOOR_EMA_ALPHA) + energy * NOISE_FLOOR_EMA_ALPHA
  }
  state.previousAbove = above
  return isOnset
}
