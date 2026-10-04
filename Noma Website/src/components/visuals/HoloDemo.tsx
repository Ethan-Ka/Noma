import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import AppIcon from './AppIcon'
import { appProfiles } from '../../data/appProfiles'

/**
 * Holo, demonstrated rather than described: a finger starts on the palm rest
 * beside the trackpad, slides onto it, and a control in the software fires.
 *
 * The order is the point, so it is built in deliberately: the finger has to
 * travel in from the edge before anything happens, and the button answers
 * the moment the swipe lands, the way it does in the real thing, where the
 * swipe is recognised once the finger has come far enough in. A finger
 * simply put down on the trackpad does nothing, which is why ordinary
 * trackpad use never sets it off.
 *
 * It runs on its own until the visitor picks a zone themselves, then hands
 * over for good — the same rule the Context section follows.
 */

/** The app whose controls the demo drives. Claude Code, because the rest of
 *  the page has been telling a Claude Code story and the controls are ones
 *  you would genuinely want without looking down. */
const APP_ID = 'claude'

/** The four swipe-in zones, matching the app's: each side of the trackpad
 *  split into an upper and a lower half, in slot order (upper left 1, upper
 *  right 2, lower left 3, lower right 4), so `control` is simply the slot's
 *  index in the app's control list. `from` and `to` are where the finger
 *  starts (on the palm rest) and ends (just inside the trackpad), as a share
 *  of the laptop's width; `y` is the height it travels at. Each zone is
 *  labelled with what it fires rather than where it is; where it is, you
 *  can see. */
const ZONES = [
  { where: 'upper left', position: 'left-[6%] top-[58%] h-[16.5%]', from: 18, to: 40, y: 66, arrow: '→', control: 0 },
  { where: 'upper right', position: 'right-[6%] top-[58%] h-[16.5%]', from: 82, to: 60, y: 66, arrow: '←', control: 1 },
  { where: 'lower left', position: 'left-[6%] top-[76.5%] h-[16.5%]', from: 18, to: 40, y: 85, arrow: '→', control: 2 },
  { where: 'lower right', position: 'right-[6%] top-[76.5%] h-[16.5%]', from: 82, to: 60, y: 85, arrow: '←', control: 3 },
]

/** Keyboard rows, as key counts — enough to read as a laptop at a glance. */
const KEY_ROWS = [13, 13, 12, 11]

const CYCLE_MS = 2200
/** How long the finger takes to slide in. A real swipe-in is a quick flick. */
const SWIPE_S = 0.32
/** The control answers as the swipe lands. */
const TRIGGER_DELAY = SWIPE_S + 0.04
/** The lit control holds well past the swipe: the swipe is the gesture, but
 *  the button firing is the thing the visitor is meant to leave with. */
const FIRED_MS = 1400
const SWIPING_MS = 900
/** A beat before the demo starts itself. */
const FIRST_SWIPE_MS = 500

export default function HoloDemo({ className = '' }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  const app = appProfiles[APP_ID]

  const [swiping, setSwiping] = useState<number | null>(null)
  const [fired, setFired] = useState<number | null>(null)
  const [taken, setTaken] = useState(false)
  /** Bumped per swipe so the same side swiped twice replays the animation. */
  const [swipeKey, setSwipeKey] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const swipe = useCallback((index: number) => {
    clearTimers()
    setSwiping(index)
    setSwipeKey((key) => key + 1)
    setFired(null)
    timers.current.push(setTimeout(() => setFired(index), TRIGGER_DELAY * 1000))
    timers.current.push(setTimeout(() => setSwiping(null), SWIPING_MS))
    timers.current.push(setTimeout(() => setFired(null), FIRED_MS))
  }, [])

  useEffect(() => clearTimers, [])

  useEffect(() => {
    if (taken || reduceMotion) return
    let index = 0
    // The first swipe waits a beat rather than firing on the same tick this
    // effect runs: it keeps the demo out of the very first paint (where it
    // would be missed anyway, mid-scroll) and avoids a cascading render.
    const first = setTimeout(() => swipe(index), FIRST_SWIPE_MS)
    const loop = setInterval(() => {
      index = (index + 1) % ZONES.length
      swipe(index)
    }, CYCLE_MS)
    return () => {
      clearTimeout(first)
      clearInterval(loop)
    }
  }, [taken, reduceMotion, swipe])

  const handleSwipe = (index: number) => {
    setTaken(true)
    swipe(index)
  }

  const active = swiping === null ? null : ZONES[swiping]

  return (
    <div className={`grid gap-6 sm:gap-8 ${className}`}>
      {/* The laptop's base, from above. */}
      <div className="relative mx-auto aspect-[16/11] w-full max-w-md">
        <div className="absolute inset-0 rounded-3xl border border-base-700 bg-base-850" />

        {/* The hinge. */}
        <div className="absolute inset-x-[6%] top-0 h-[3%] rounded-b-md bg-base-800" />

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
        <div
          className={`absolute bottom-[7%] left-1/2 top-[58%] w-[38%] -translate-x-1/2 rounded-xl border transition-colors duration-200 ${
            fired !== null ? 'border-accent/50 bg-accent/[0.05]' : 'border-base-700 bg-base-800/70'
          }`}
        />

        {/* The palm rest either side: where a swipe starts. */}
        {ZONES.map((zone, index) => {
          const isSwiping = swiping === index
          const control = app.controls[zone.control]
          return (
            <button
              key={zone.where}
              type="button"
              onClick={() => handleSwipe(index)}
              aria-label={`Swipe in from the ${zone.where} of the trackpad to run ${control}`}
              className={`absolute flex w-[22%] flex-col items-center justify-center rounded-xl border border-dashed transition-colors duration-200 ${zone.position} ${
                isSwiping ? 'border-accent/60 bg-accent/[0.07]' : 'border-white/12 bg-white/[0.02] hover:border-white/25'
              }`}
            >
              <span
                aria-hidden
                className={`text-xs leading-none transition-colors duration-200 ${isSwiping ? 'text-accent-bright' : 'text-base-500'}`}
              >
                {zone.arrow}
              </span>
              <span
                className={`mt-1 px-1 text-center text-[10px] font-medium leading-tight tracking-tight transition-colors duration-200 ${
                  isSwiping ? 'text-accent-bright' : 'text-base-400'
                }`}
              >
                {control}
              </span>
            </button>
          )
        })}

        {/* The finger: lands on the palm rest, slides onto the trackpad. */}
        <AnimatePresence>
          {active && !reduceMotion && (
            <motion.span
              key={swipeKey}
              aria-hidden
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent bg-accent/30"
              style={{ top: `${active.y}%` }}
              initial={{ left: `${active.from}%`, opacity: 0, scale: 0.8 }}
              animate={{ left: [`${active.from}%`, `${active.from}%`, `${active.to}%`], opacity: [0, 1, 1], scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: SWIPE_S + 0.12, times: [0, 0.27, 1], ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        <p className="absolute inset-x-0 -bottom-7 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-base-500">
          {taken ? 'Swipe in from a zone' : 'Tap a zone to swipe in'}
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
              Noma is ready
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
