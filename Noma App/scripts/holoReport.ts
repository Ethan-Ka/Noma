/**
 * Replays the newest Holo diagnostic recording (%APPDATA%/noma/holo-recordings)
 * against the calibration saved in %APPDATA%/noma/noma.db and prints what
 * Holo would have done with every sound, and how real taps and non-taps
 * measured on each check.
 *
 * Run: npx esbuild scripts/holoReport.ts --bundle --platform=node
 *        --external:better-sqlite3 --alias:@shared=./src/shared --outfile=<tmp>.cjs
 *      node <tmp>.cjs [recording folder]
 */
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import type { HoloCalibration } from '@shared/types'
import { classifySounds, detectSounds, parseWav, type RecordingMeta } from '../src/renderer/src/lib/holo/testing/replay'
import { DoubleTapDetector, doubleTapKnock, pairDistanceBound, pairMatcher } from '../src/renderer/src/lib/holo/doubleTap'
import { anchorDiscriminant, withoutMislabelledTaps } from '../src/renderer/src/lib/holo/classifier'

const root = join(process.env.APPDATA ?? '', 'noma')
const recordings = join(root, 'holo-recordings')
const folder = process.argv[2] ?? join(recordings, readdirSync(recordings).sort().pop() ?? '')
const meta = JSON.parse(readFileSync(join(folder, 'session.json'), 'utf8')) as RecordingMeta & {
  settings?: { sensitivity?: 'low' | 'medium' | 'high' }
}
const { pcm } = parseWav(readFileSync(join(folder, 'session.wav')))
const db = new Database(join(root, 'noma.db'), { readonly: true })
const row = db.prepare("SELECT value FROM settings WHERE key='holoCalibration'").get() as { value: string } | undefined
if (!row) throw new Error('No calibration saved')
const saved = JSON.parse(row.value) as HoloCalibration
// As the app does on load: drop learned taps the calibration-only anchor
// puts on the other side.
const anchor = anchorDiscriminant(saved.zones, saved.scale)
const calibration: HoloCalibration = anchor ? { ...saved, zones: withoutMislabelledTaps(saved.zones, anchor, saved.scale) } : saved
const sensitivity = meta.settings?.sensitivity ?? 'medium'

console.log(`recording ${folder}`)
console.log(`${(pcm.length / meta.channels / meta.sampleRate).toFixed(1)} s, ${meta.channels} ch @ ${meta.sampleRate} Hz, sensitivity ${sensitivity}`)
console.log('gates', JSON.stringify(calibration.gates))

const sounds = classifySounds(detectSounds(pcm, meta, sensitivity), calibration, sensitivity)
// Same double-tap rules as holoStore's onTap (see doubleTap.ts).
const detector = new DoubleTapDetector()
detector.setWindow(calibration.doubleTapWindow)
detector.setPairMatcher(pairMatcher(calibration))
const pairGates = { maxDipDb: calibration.doubleTapWindow?.maxDipDb ?? null, maxMeanDistance: pairDistanceBound(calibration) }
detector.setPairGates(pairGates)
console.log('pair gates', JSON.stringify(pairGates))
const dipsAtSecondHalf: number[] = []
for (const phase of meta.phases) {
  const inPhase = sounds.filter((s) => s.onsetMs >= phase.startMs && s.onsetMs < phase.endMs)
  const outcomes: Record<string, number> = {}
  let fires = 0
  let right = 0
  detector.reset()
  for (const s of inPhase) {
    const key = s.ignoredByInput ? 'typing-gate' : (s.result?.zone ?? s.result?.reason ?? 'no-features')
    outcomes[key] = (outcomes[key] ?? 0) + 1
    if (s.ignoredByInput) {
      detector.reset()
      continue
    }
    const knock = s.result ? doubleTapKnock(s.result) : null
    if (!knock) continue
    if (detector.armedZone(s.onsetMs) === knock.zone) dipsAtSecondHalf.push(s.dipDb)
    const detail = { features: s.features ?? undefined, dipDb: s.dipDb, sure: knock.sure, distance: s.result?.distance }
    if (detector.tap(knock.zone, s.onsetMs, s.peakDb, detail) === 'fire') {
      fires++
      if (knock.zone === s.label) right++
      if (process.env.HOLO_FIRES) console.log(`   fire ${knock.zone} at ${(s.onsetMs / 1000).toFixed(2)} s`)
    }
  }
  const name = phase.kind === 'zone' ? `tap ${phase.zone}` : phase.kind
  console.log(`\n== ${name} (${((phase.endMs - phase.startMs) / 1000).toFixed(0)} s): ${inPhase.length} sounds detected`)
  console.log(`   verdicts ${JSON.stringify(outcomes)}`)
  console.log(`   double-tap fires ${fires}${phase.kind === 'zone' ? ` (right side ${right}; asked for 10)` : ' (should be 0)'}`)
}

const q = (values: number[], f: number): string =>
  values.length ? [...values].sort((a, b) => a - b)[Math.round(f * (values.length - 1))].toFixed(1) : '-'
const row5 = (values: number[]): string => [0.1, 0.25, 0.5, 0.75, 0.9].map((f) => q(values, f)).join(' / ')
const taps = sounds.filter((s) => s.label && !s.ignoredByInput)
const others = sounds.filter((s) => !s.label && !s.ignoredByInput)
console.log(`\nmeasures, p10/p25/p50/p75/p90 — taps (${taps.length}) vs non-taps (${others.length})`)
for (const [name, get] of [
  ['peakDb', (s: (typeof sounds)[number]) => s.peakDb],
  ['sustainDb', (s: (typeof sounds)[number]) => s.impact?.sustainDb ?? NaN],
  ['drivenDb', (s: (typeof sounds)[number]) => s.impact?.drivenDb ?? NaN],
  ['contacts', (s: (typeof sounds)[number]) => s.impact?.contacts ?? NaN],
  ['riseMs', (s: (typeof sounds)[number]) => s.impact?.riseMs ?? NaN],
  ['attackBrightDb', (s: (typeof sounds)[number]) => s.impact?.attackBrightnessDb ?? NaN],
  ['distance', (s: (typeof sounds)[number]) => s.result?.distance ?? NaN],
  ['confidence', (s: (typeof sounds)[number]) => (s.result?.confidence ?? NaN) * 100]
] as const) {
  const a = taps.map(get).filter((v) => !Number.isNaN(v))
  const b = others.map(get).filter((v) => !Number.isNaN(v))
  console.log(`   ${name.padEnd(15)} taps ${row5(a).padEnd(40)} non-taps ${row5(b)}`)
}

console.log(`
dip before a would-be second half (dB): ${[...dipsAtSecondHalf].sort((a, b) => a - b).map((d) => d.toFixed(0)).join(' ')}`)
