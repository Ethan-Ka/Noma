import { getHoloZoneLabel } from '@shared/constants'
import { useHoloStore, type DiagnosticPhase } from '../stores/holoStore'

/**
 * "Record a test session": a few minutes of guided, labelled real audio from
 * this laptop (taps on each zone, then everyday handling and typing with no
 * taps), saved only on this computer. It exists because tuning Holo on
 * simulated taps stopped carrying over to real laptops: the real taps it
 * measured looked nothing like the simulated ones. With a recording, every
 * change can be scored against real taps and real non-taps.
 *
 * Holo runs as a dry run meanwhile: it decides as usual and logs what it
 * would have done, but presses nothing.
 */
export function HoloDiagnosticCard() {
  const { calibration, diagnostic, diagnosticSavedTo, zoneCount, startDiagnostic, nextDiagnosticPhase, cancelDiagnostic } =
    useHoloStore()
  if (!calibration) return null

  if (!diagnostic) {
    return (
      <div className="mb-4 rounded-lg border border-holo-border px-4 py-3 text-xs text-holo-muted">
        <div className="mb-2 text-holo-text">Record a test session</div>
        <p className="mb-3 max-w-xl">
          About four minutes: double-tap each zone, single-tap a few times, then use your laptop normally without tapping. Holo records the
          audio so it can be tuned on real taps from this laptop, and does a dry run meanwhile, so nothing is pressed.
          The recording (which includes anything said nearby) is saved only on this computer, in Noma&apos;s
          folder, and you can delete it any time.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void startDiagnostic()}
            className="rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-[11px] text-accent hover:bg-accent/20"
          >
            Start recording
          </button>
          <button
            type="button"
            onClick={() => void window.flow.openHoloRecordings()}
            className="text-[11px] underline decoration-dotted underline-offset-2 hover:text-holo-text"
          >
            Open recordings folder
          </button>
          {diagnosticSavedTo && <span className="text-accent">Saved. Thanks, that&apos;s everything needed.</span>}
        </div>
      </div>
    )
  }

  const phase = diagnostic.phases[diagnostic.index]
  const isLast = diagnostic.index === diagnostic.phases.length - 1
  return (
    <div className="mb-4 rounded-lg border border-accent/40 px-4 py-3 text-xs text-holo-muted">
      <div className="mb-1 flex items-center gap-2 text-holo-text">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden />
        Recording, step {diagnostic.index + 1} of {diagnostic.phases.length} (dry run, nothing is pressed)
      </div>
      <p className="mb-3 max-w-xl text-sm text-holo-text">{instructionFor(phase, zoneCount)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void nextDiagnosticPhase()}
          className="rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-[11px] text-accent hover:bg-accent/20"
        >
          {isLast ? 'Finish and save' : 'Done, next step'}
        </button>
        <button
          type="button"
          onClick={cancelDiagnostic}
          className="text-[11px] underline decoration-dotted underline-offset-2 hover:text-holo-text"
        >
          Cancel (discard)
        </button>
      </div>
    </div>
  )
}

function instructionFor(phase: DiagnosticPhase, zoneCount: 2 | 4): string {
  switch (phase.kind) {
    case 'zone':
      return `Double-tap the ${getHoloZoneLabel(phase.zone, zoneCount).toUpperCase()} zone 10 times, the way you normally would, pausing a couple of seconds between each double tap. Include a few softer and a few firmer ones.`
    case 'singles':
      return 'Now single taps only: tap one zone ONCE, wait about three seconds, and repeat, 10 times (either zone). None of these should fire. This is the step that shows why a single tap sometimes counts as two.'
    case 'everyday':
      return "Now don't tap any zone. For about a minute, do the things that have set Holo off by accident: rest your fingers and palms on the palm rest, shift your hands, pick up and put down your phone or a cup, bump the desk, talk. Anything except deliberate taps."
    case 'typing':
      return "Still no taps. For about a minute, type and use the trackpad normally, like you're working."
  }
}
