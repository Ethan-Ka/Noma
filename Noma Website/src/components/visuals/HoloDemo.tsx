import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import AppIcon from './AppIcon'
import { appProfiles } from '../../data/appProfiles'

/**
 * Holo, demonstrated rather than described: a tap lands on the desk, and a
 * control in the software fires.
 *
 * The causal gap is the whole point, so it is built in deliberately — the
 * ripple happens, and the button answers ~180ms later, the way it does in
 * the real thing, where the sound has to be heard, classified and matched
 * before anything runs. Firing both at the same instant would read as two
 * decorations on one timer instead of one thing causing another.
 *
 * It runs on its own until the visitor taps a zone themselves, then hands
 * over for good — the same rule the Context section follows.
 */

/** The app whose controls the demo drives. Claude Code, because the rest of
 *  the page has been telling a Claude Code story and the controls are ones
 *  you would genuinely want without looking down. */
const APP_ID = 'claude'

/** Desk zones in slot order, positioned around the laptop in plan view. Each
 *  is labelled with the control it fires rather than with where it is: where
 *  it is, you can see. What it does is the thing worth saying. */
const ZONES = [
  { where: 'Bottom left', position: 'bottom-0 left-0' },
  { where: 'Bottom right', position: 'bottom-0 right-0' },
  { where: 'Top left', position: 'top-0 left-0' },
  { where: 'Top right', position: 'top-0 right-0' },
]

const CYCLE_MS = 2400
/** How long after the tap the control answers. Short enough to read as cause
 *  and effect, long enough that the two are visibly separate events. */
const TRIGGER_DELAY = 0.18
/** The lit control holds well past the ripple: the tap is the gesture, but
 *  the button firing is the thing the visitor is meant to leave with. */
const FIRED_MS = 1250
const TAPPED_MS = 750
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

  const tap = useCallback(
    (index: number) => {
      clearTimers()
      setTapped(index)
      setFired(null)
      timers.current.push(setTimeout(() => setFired(index), TRIGGER_DELAY * 1000))
      timers.current.push(setTimeout(() => setTapped(null), TAPPED_MS))
      timers.current.push(setTimeout(() => setFired(null), FIRED_MS))
    },
    []
  )

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
      {/* The desk, from above. */}
      <div className="relative mx-auto aspect-[4/3] w-full max-w-md">
        <div className="absolute inset-0 rounded-3xl border border-base-800 bg-base-900" />

        <div className="absolute left-1/2 top-1/2 h-[36%] w-[44%] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-base-700 bg-base-850">
          <div className="absolute inset-x-[12%] inset-y-[16%] rounded-sm border border-base-700 bg-base-800" />
          {/* The microphone that is doing the listening. */}
          <span className="absolute left-1/2 top-1.5 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
        </div>

        {ZONES.map((zone, index) => {
          const isTapped = tapped === index
          return (
            <button
              key={zone.where}
              type="button"
              onClick={() => handleTap(index)}
              aria-label={`Tap ${zone.where} to run ${app.controls[index]}`}
              className={`absolute m-5 flex h-[26%] w-[26%] flex-col items-center justify-center rounded-2xl border border-dashed transition-colors duration-200 ${zone.position} ${
                isTapped ? 'border-accent/60 bg-accent/[0.07]' : 'border-white/12 bg-white/[0.02] hover:border-white/25'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <AnimatePresence>
                  {isTapped && !reduceMotion && (
                    <motion.span
                      className="absolute h-1.5 w-1.5 rounded-full border border-accent"
                      initial={{ scale: 1, opacity: 0.9 }}
                      animate={{ scale: 11, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                  )}
                </AnimatePresence>
              </span>
              <span
                className={`mt-2 px-1 text-center text-[10px] font-medium tracking-tight transition-colors duration-200 ${
                  isTapped ? 'text-accent-bright' : 'text-base-400'
                }`}
              >
                {app.controls[index]}
              </span>
            </button>
          )
        })}

        <p className="absolute inset-x-0 -bottom-7 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-base-500">
          {taken ? 'Tap a zone' : 'Tap a zone to try it'}
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

        <div className="mt-4 grid grid-cols-4 gap-2">
          {app.controls.map((control, index) => {
            const isFired = fired === index
            return (
              <motion.div
                key={control}
                animate={
                  reduceMotion
                    ? {}
                    : { scale: isFired ? 0.96 : 1 }
                }
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
