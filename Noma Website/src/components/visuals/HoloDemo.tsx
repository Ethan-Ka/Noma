import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import AppIcon from './AppIcon'
import { appProfiles } from '../../data/appProfiles'

/**
 * Holo, demonstrated rather than described: a double tap lands on the palm
 * rest beside the trackpad, and a control in the software fires.
 *
 * The causal gap is the whole point, so it is built in deliberately — both
 * taps ripple, and the button answers ~180ms after the second, the way it
 * does in the real thing, where the pair has to be heard, classified and
 * matched before anything runs. Firing on the first tap would misrepresent
 * the product: a single tap is ignored on purpose, so a resting hand never
 * sets anything off.
 *
 * It runs on its own until the visitor taps a zone themselves, then hands
 * over for good — the same rule the Context section follows.
 */

/** The app whose controls the demo drives. Claude Code, because the rest of
 *  the page has been telling a Claude Code story and the controls are ones
 *  you would genuinely want without looking down. */
const APP_ID = 'claude'

/** The two palm-rest zones, either side of the trackpad, matching the app's
 *  two-zone palm layout. `control` indexes the app's control list; each zone
 *  is labelled with what it fires rather than where it is — where it is, you
 *  can see. */
const ZONES = [
  { where: 'Left of the trackpad', position: 'left-[6%]', control: 1 },
  { where: 'Right of the trackpad', position: 'right-[6%]', control: 3 },
]

/** Keyboard rows, as key counts — enough to read as a laptop at a glance. */
const KEY_ROWS = [13, 13, 12, 11]

const CYCLE_MS = 2600
/** Gap between the two taps of a double tap. */
const SECOND_TAP_DELAY = 0.16
/** How long after the second tap the control answers. */
const TRIGGER_DELAY = SECOND_TAP_DELAY + 0.18
/** The lit control holds well past the ripple: the tap is the gesture, but
 *  the button firing is the thing the visitor is meant to leave with. */
const FIRED_MS = 1400
const TAPPED_MS = 900
/** A beat before the demo starts itself. */
const FIRST_TAP_MS = 500

export default function HoloDemo({ className = '' }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  const app = appProfiles[APP_ID]

  const [tapped, setTapped] = useState<number | null>(null)
  const [fired, setFired] = useState<number | null>(null)
  const [taken, setTaken] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const tap = useCallback((index: number) => {
    clearTimers()
    setTapped(index)
    setFired(null)
    timers.current.push(setTimeout(() => setFired(index), TRIGGER_DELAY * 1000))
    timers.current.push(setTimeout(() => setTapped(null), TAPPED_MS))
    timers.current.push(setTimeout(() => setFired(null), FIRED_MS))
  }, [])

  useEffect(() => clearTimers, [])

  useEffect(() => {
    if (taken || reduceMotion) return
    let index = 0
    // The first tap waits a beat rather than firing on the same tick this
    // effect runs: it keeps the demo out of the very first paint (where it
    // would be missed anyway, mid-scroll) and avoids a cascading render.
    const first = setTimeout(() => tap(index), FIRST_TAP_MS)
    const loop = setInterval(() => {
      index = (index + 1) % ZONES.length
      tap(index)
    }, CYCLE_MS)
    return () => {
      clearTimeout(first)
      clearInterval(loop)
    }
  }, [taken, reduceMotion, tap])

  const handleTap = (index: number) => {
    setTaken(true)
    tap(index)
  }

  return (
    <div className={`grid gap-6 sm:gap-8 ${className}`}>
      {/* The laptop's base, from above. */}
      <div className="relative mx-auto aspect-[16/11] w-full max-w-md">
        <div className="absolute inset-0 rounded-3xl border border-base-700 bg-base-850" />

        {/* The hinge, and the microphone in the lid that is doing the listening. */}
        <div className="absolute inset-x-[6%] top-0 h-[3%] rounded-b-md bg-base-800" />
        <span className="absolute left-1/2 top-[1%] h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />

        {/* Keyboard. */}
        <div className="absolute inset-x-[8%] top-[9%] flex h-[42%] flex-col gap-[5%]">
          {KEY_ROWS.map((count, row) => (
            <div key={row} className="flex flex-1 gap-[1.2%]">
              {Array.from({ length: count }, (_, key) => (
                <span key={key} className="flex-1 rounded-[3px] border border-base-700/80 bg-base-800/60" />
              ))}
            </div>
          ))}
          <div className="flex flex-1 justify-center">
            <span className="w-[46%] rounded-[3px] border border-base-700/80 bg-base-800/60" />
          </div>
        </div>

        {/* Trackpad. */}
        <div className="absolute bottom-[7%] left-1/2 top-[58%] w-[38%] -translate-x-1/2 rounded-xl border border-base-700 bg-base-800/70" />

        {ZONES.map((zone, index) => {
          const isTapped = tapped === index
          const control = app.controls[zone.control]
          return (
            <button
              key={zone.where}
              type="button"
              onClick={() => handleTap(index)}
              aria-label={`Double-tap ${zone.where.toLowerCase()} to run ${control}`}
              className={`absolute bottom-[7%] top-[58%] flex w-[22%] flex-col items-center justify-center rounded-2xl border border-dashed transition-colors duration-200 ${zone.position} ${
                isTapped ? 'border-accent/60 bg-accent/[0.07]' : 'border-white/12 bg-white/[0.02] hover:border-white/25'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <AnimatePresence>
                  {isTapped &&
                    !reduceMotion &&
                    [0, SECOND_TAP_DELAY].map((delay) => (
                      <motion.span
                        key={delay}
                        className="absolute h-1.5 w-1.5 rounded-full border border-accent"
                        initial={{ scale: 1, opacity: 0 }}
                        animate={{ scale: 9, opacity: [0.9, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay }}
                      />
                    ))}
                </AnimatePresence>
              </span>
              <span
                className={`mt-2 px-1 text-center text-[10px] font-medium tracking-tight transition-colors duration-200 ${
                  isTapped ? 'text-accent-bright' : 'text-base-400'
                }`}
              >
                {control}
              </span>
            </button>
          )
        })}

        <p className="absolute inset-x-0 -bottom-7 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-base-500">
          {taken ? 'Double-tap a side' : 'Double-tap a side to try it'}
        </p>
      </div>

      {/* The software, answering. */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-base-900/70 p-4 backdrop-blur-xl sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <AppIcon id={APP_ID} color={app.color} className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight text-base-50">{app.shortName}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-base-500">
              Noma is listening
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {ZONES.map((zone, index) => {
            const control = app.controls[zone.control]
            const isFired = fired === index
            return (
              <motion.div
                key={control}
                animate={reduceMotion ? {} : { scale: isFired ? 0.96 : 1 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className={`flex h-[58px] items-center justify-center rounded-xl border px-2 text-center transition-colors duration-200 sm:h-[64px] ${
                  isFired
                    ? 'border-accent/60 bg-accent/15 text-base-50'
                    : 'border-white/[0.09] bg-gradient-to-b from-white/[0.06] to-white/[0.015] text-base-100'
                }`}
              >
                <span className="block w-full truncate text-[11px] font-medium tracking-tight sm:text-xs">
                  {control}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
