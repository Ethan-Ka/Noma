import { useEffect, useState } from 'react'
import type { Control, HoloTouchCheckSummary, HoloTrackpadZone, HoloTrackpadZoneCount } from '@shared/types'
import { TOUCH_CHECK_STEPS, TRACKPAD_ZONE_SLOTS, useHoloStore, type TrackpadOutcome } from '../stores/holoStore'

const ZONE_LABELS: Record<HoloTrackpadZoneCount, Record<HoloTrackpadZone, string>> = {
  2: { topLeft: 'Left', topRight: 'Right', bottomLeft: 'Left', bottomRight: 'Right' },
  4: { topLeft: 'Upper left', topRight: 'Upper right', bottomLeft: 'Lower left', bottomRight: 'Lower right' }
}

const ZONE_COUNT_OPTIONS: Array<{ value: HoloTrackpadZoneCount; label: string }> = [
  { value: 4, label: 'Upper and lower half of each side' },
  { value: 2, label: 'Left and right only' }
]

const OUTCOME_MESSAGES: Record<TrackpadOutcome['outcome'], string> = {
  pressed: 'Swiped in. Control pressed.',
  'no-control': 'Swiped in, but this zone has no control assigned in the current app.',
  'too-slow': 'Not counted: that was slow, like moving the pointer. Flick in quickly.',
  'not-sideways': 'Not counted: that went up or down more than across. Swipe straight in.',
  'second-finger': 'Not counted: a second finger touched the trackpad.',
  palm: 'Not counted: the trackpad flagged that touch as a palm.',
  typing: "Not counted: you were typing. Swipe-ins wait until you've stopped typing for a moment.",
  click: 'Not counted: the trackpad was pressed down (a click).'
}

const STEP_INSTRUCTIONS: Record<'left' | 'right' | 'normal', string> = {
  left: 'Swipe in from the LEFT side: start your finger on the empty space left of the trackpad and flick it onto the trackpad. Do it about 8 times, at different heights.',
  right:
    'Now from the RIGHT side: start on the empty space right of the trackpad and flick onto it. About 8 times, at different heights.',
  normal:
    'Now use the trackpad normally, without swiping in: move the pointer around, click, scroll. Use the edges too, the way you usually would.'
}

/**
 * Holo's trackpad swipe-ins: slide a finger from the empty space beside the
 * trackpad onto it to press that side's control (main/holo/trackpadGesture.ts).
 * A picture of the trackpad with its zones and what each presses, a flash
 * when one fires, a line saying why a swipe didn't count, and the touch
 * check that measures this trackpad before anything is tuned around it.
 */
export function HoloTrackpadPanel({ controls }: { controls: Control[] }) {
  const { isListening, trackpadLast, trackpadStatus, trackpadZones, setTrackpadZones, startListening, stopListening } =
    useHoloStore()
  const [flashing, setFlashing] = useState<HoloTrackpadZone | null>(null)

  useEffect(() => {
    if (!trackpadLast || (trackpadLast.outcome !== 'pressed' && trackpadLast.outcome !== 'no-control')) return
    setFlashing(trackpadLast.zone)
    const timeout = window.setTimeout(() => setFlashing(null), 600)
    return () => window.clearTimeout(timeout)
  }, [trackpadLast])

  const zones: HoloTrackpadZone[] =
    trackpadZones === 4 ? ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] : ['topLeft', 'topRight']
  const controlFor = (zone: HoloTrackpadZone): Control | undefined =>
    controls.find((control) => control.slot === TRACKPAD_ZONE_SLOTS[zone])

  return (
    <div className="rounded-2xl bg-holo-bg p-6">
      <TouchCheckCard />

      <div className="mb-5 flex items-start justify-between gap-4">
        <p className="max-w-md text-xs text-holo-muted">
          Start a finger on the empty space beside your trackpad and flick it onto the trackpad. The control for that
          side runs in whatever app you&apos;re using, and the pointer is put back where it was. It never clicks.
          Moving the pointer, scrolling, a palm, a second finger, or typing just before don&apos;t count.
        </p>
        <button
          type="button"
          onClick={() => void (isListening ? stopListening() : startListening())}
          className={`shrink-0 rounded-full border px-3 py-1 text-[11px] ${
            isListening
              ? 'border-accent/50 bg-accent/10 text-accent'
              : 'border-holo-border text-holo-text/80 hover:border-holo-text/30 hover:text-holo-text'
          }`}
        >
          {isListening ? 'On, click to stop' : 'Turn on'}
        </button>
      </div>

      {/* The trackpad, with a zone strip down each side. */}
      <div className="relative mx-auto mb-5 aspect-[3/2] w-full max-w-md rounded-2xl border border-holo-border bg-holo-surface">
        {zones.map((zone) => (
          <ZoneStrip
            key={zone}
            zone={zone}
            label={ZONE_LABELS[trackpadZones][zone]}
            half={trackpadZones === 4}
            control={controlFor(zone)}
            flashing={flashing === zone}
          />
        ))}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] text-holo-muted">
          {isListening ? 'Swipe in from either side' : 'Turn on to try it'}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-holo-muted">
        <span className="mr-1">Zones</span>
        {ZONE_COUNT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTrackpadZones(option.value)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
              trackpadZones === option.value
                ? 'border-accent/50 bg-accent/10 text-accent'
                : 'border-holo-border hover:border-holo-text/30 hover:text-holo-text'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="min-h-[1.25rem] text-xs text-holo-muted">
        {isListening && trackpadLast && (
          <span className={trackpadLast.outcome === 'pressed' ? 'text-accent' : ''}>
            {ZONE_LABELS[trackpadZones][trackpadLast.zone]}: {OUTCOME_MESSAGES[trackpadLast.outcome]}
          </span>
        )}
        {isListening && !trackpadLast && trackpadStatus && (
          <span>
            Watching {trackpadStatus.touchpads === 1 ? 'your trackpad' : `${trackpadStatus.touchpads} touchpads`}.
          </span>
        )}
      </div>

      <p className="mt-4 text-xs text-holo-muted">
        Prototype. Holo reads where your fingers are on the trackpad, in memory only, to recognise a swipe-in;
        nothing is recorded or saved (except during a touch check you start). It also notices <em>when</em> you press
        a key (never which one) so a hand coming off the keyboard isn&apos;t mistaken for a swipe. Needs a Windows
        precision touchpad.
      </p>
    </div>
  )
}

/** Position and rounding of each zone strip on the drawn trackpad. Whole
 *  class names only: Tailwind can't see names assembled at runtime. */
const STRIP_PLACEMENT: Record<'full' | 'half', Record<HoloTrackpadZone, string>> = {
  full: {
    topLeft: 'left-0 inset-y-0 border-r rounded-l-2xl',
    topRight: 'right-0 inset-y-0 border-l rounded-r-2xl',
    bottomLeft: 'left-0 inset-y-0 border-r rounded-l-2xl',
    bottomRight: 'right-0 inset-y-0 border-l rounded-r-2xl'
  },
  half: {
    topLeft: 'left-0 top-0 h-1/2 border-r rounded-tl-2xl',
    topRight: 'right-0 top-0 h-1/2 border-l rounded-tr-2xl',
    bottomLeft: 'left-0 bottom-0 h-1/2 border-r border-t rounded-bl-2xl',
    bottomRight: 'right-0 bottom-0 h-1/2 border-l border-t rounded-br-2xl'
  }
}

function ZoneStrip({
  zone,
  label,
  half,
  control,
  flashing
}: {
  zone: HoloTrackpadZone
  label: string
  half: boolean
  control: Control | undefined
  flashing: boolean
}) {
  const left = zone.endsWith('Left')
  return (
    <div
      className={`absolute flex w-[24%] flex-col justify-between overflow-hidden border-holo-border p-2 transition-colors duration-150 ${STRIP_PLACEMENT[half ? 'half' : 'full'][zone]} ${
        flashing ? 'bg-accent/20' : 'bg-holo-bg/40'
      }`}
    >
      <span className="text-[10px] text-holo-muted">
        {left ? '→ ' : ''}
        {label} · Slot {TRACKPAD_ZONE_SLOTS[zone]}
        {left ? '' : ' ←'}
      </span>
      <span className="truncate text-xs font-medium text-holo-text">
        {control?.label ?? <span className="text-holo-muted">–</span>}
      </span>
    </div>
  )
}

/**
 * The touch check: under a minute of guided swiping and ordinary use,
 * recorded so the swipe-in rules can be set from what this trackpad actually
 * reports. Nothing fires meanwhile.
 *
 * Asked for once. After that it shrinks to one line, kept for running again
 * (a new laptop, or swipe-ins that stop feeling right) rather than nagging.
 */
function TouchCheckCard() {
  const { touchCheck, touchCheckResult, touchCheckDoneAt, startTouchCheck, cancelTouchCheck } = useHoloStore()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!touchCheck) return
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [touchCheck])

  if (touchCheck) {
    const step = TOUCH_CHECK_STEPS[touchCheck.step]
    const secondsLeft = Math.max(0, Math.ceil((touchCheck.endsAt - now) / 1000))
    return (
      <div className="mb-5 rounded-lg border border-accent/40 px-4 py-3 text-xs text-holo-muted">
        <div className="mb-1 flex items-center gap-2 text-holo-text">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden />
          Touch check, step {touchCheck.step + 1} of {TOUCH_CHECK_STEPS.length} · {secondsLeft}s left (nothing fires
          meanwhile)
        </div>
        <p className="mb-3 max-w-xl text-sm text-holo-text">{STEP_INSTRUCTIONS[step.kind]}</p>
        <button
          type="button"
          onClick={cancelTouchCheck}
          className="text-[11px] underline decoration-dotted underline-offset-2 hover:text-holo-text"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (touchCheckDoneAt) {
    return (
      <div className="mb-5 text-xs text-holo-muted">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Touch check done{' '}
            {new Date(touchCheckDoneAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
          </span>
          <button
            type="button"
            onClick={() => void startTouchCheck()}
            className="text-[11px] underline decoration-dotted underline-offset-2 hover:text-holo-text"
          >
            Run again
          </button>
          <button
            type="button"
            onClick={() => void window.flow.openHoloRecordings()}
            className="text-[11px] underline decoration-dotted underline-offset-2 hover:text-holo-text"
          >
            Open folder
          </button>
          <span className="text-[11px]">Run it again on a new laptop, or if swipe-ins stop feeling right.</span>
        </div>
        {touchCheckResult && <TouchCheckResult summary={touchCheckResult.summary} />}
      </div>
    )
  }

  return (
    <div className="mb-5 rounded-lg border border-holo-border px-4 py-3 text-xs text-holo-muted">
      <div className="mb-2 text-holo-text">Touch check</div>
      <p className="mb-3 max-w-xl">
        Under a minute: swipe in from each side a few times, then use the trackpad normally. Holo measures how your
        trackpad sees those touches, so swipe-ins can be tuned to it. Steps move on by themselves, so you never need to
        click. Finger positions are saved only on this computer, in Noma&apos;s folder.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void startTouchCheck()}
          className="rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-[11px] text-accent hover:bg-accent/20"
        >
          Start touch check
        </button>
        <button
          type="button"
          onClick={() => void window.flow.openHoloRecordings()}
          className="text-[11px] underline decoration-dotted underline-offset-2 hover:text-holo-text"
        >
          Open folder
        </button>
      </div>
    </div>
  )
}

function TouchCheckResult({ summary }: { summary: HoloTouchCheckSummary }) {
  const pct = (value: number): string => `${Math.round(value * 100)}%`
  return (
    <div className="mt-3 space-y-1 font-mono text-[11px] text-holo-text/80">
      {summary.phases.map((phase) => {
        const missText = Object.entries(phase.misses)
          .map(([reason, count]) => `${reason} ${count}`)
          .join(', ')
        return (
          <div key={phase.kind}>
            {phase.kind === 'normal' ? 'Normal use' : `Swipe from ${phase.kind}`}: {phase.touches} touches,{' '}
            {phase.startedAtEdge} began at the edge
            {phase.firstEdgeDistance &&
              ` (first seen ${phase.firstEdgeDistance.map(pct).join(' / ')} in: min / median / max)`}
            , {pct(phase.firstConfident)} read as a finger at first. Would fire {phase.fires}
            {phase.kind !== 'normal' && ` (${phase.firesOnSide} on this side)`}
            {missText && `; not counted: ${missText}`}.
          </div>
        )
      })}
    </div>
  )
}
