import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import AdaptiveSurface from '../visuals/AdaptiveSurface'

/**
 * The obvious objection: why not just buy more buttons?
 *
 * This used to be preceded by a separate problem section — "your work changes,
 * your computer doesn't", over a row of unchanging function keys. It was the
 * same argument twice, and the function-key version was a strawman: nobody
 * thinks F5 is what is wrong with their computer. The honest version of the
 * problem is the thing people actually buy to solve it, so the comparison is
 * against that, and the heading asks the question that sells rather than
 * restating the one the section before it already answered.
 *
 * Extra buttons already exist, and they are fine. What they are not is
 * *aware* — you assign them once and they stay assigned, which means the work
 * of deciding what they should be never goes away, it just moves to you. The
 * two panels run side by side on the same clock so the difference is
 * watchable rather than claimed: one changes, one doesn't.
 */

const CYCLE = ['vscode', 'claude', 'figma']
const DWELL_MS = 2800

/** Whatever someone assigned, months ago, for whatever they were doing then. */
const FIXED = ['Mute', 'Copy', 'Paste', 'Volume']

export default function NotStatic() {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduceMotion) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % CYCLE.length), DWELL_MS)
    return () => clearInterval(timer)
  }, [reduceMotion])

  return (
    <Section id="adaptive">
      <div className="max-w-2xl">
        <Reveal>
          <h2 className="text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-5xl">
            You shouldn’t have to
            <br />
            <span className="text-base-400">assign them yourself.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-6 text-base leading-relaxed text-base-300">
            Your computer already knows what you&apos;re doing. Let it decide.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2 md:gap-8">
        <Reveal>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-base-500">Assigned once</p>
          <div className="rounded-3xl border border-base-800 bg-base-900 p-6 sm:p-8">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="h-16 w-16 shrink-0 rounded-2xl border border-base-700 bg-base-850 sm:h-20 sm:w-20" />
              <div>
                <p className="font-display text-xl font-semibold tracking-tight text-base-300 sm:text-2xl">
                  Any application
                </p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-base-500 sm:text-xs">
                  Doesn’t look
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2.5 sm:gap-3">
              {FIXED.map((label) => (
                <div
                  key={label}
                  className="flex h-[64px] items-center justify-center rounded-xl border border-base-700 bg-base-850 px-2 sm:h-[76px]"
                >
                  <span className="block w-full truncate text-center text-[11px] font-medium tracking-tight text-base-400 sm:text-[13px]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Decided for you</p>
          <AdaptiveSurface appId={CYCLE[index]} size="lg" />
        </Reveal>
      </div>
    </Section>
  )
}
