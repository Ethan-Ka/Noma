import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import AdaptiveSurface from '../visuals/AdaptiveSurface'
import SiteLink from '../layout/SiteLink'
import { GLASS_ACCENT } from '../../lib/glass'
import DotField from '../visuals/DotField'
import AppIcon from '../visuals/AppIcon'
import { appProfiles } from '../../data/appProfiles'

/**
 * The claim, and the proof of it, in one screen.
 *
 * The headline is deliberately short enough to read in the time the surface
 * below takes to change once — because the surface is the argument and the
 * words are only the caption. Someone who never reads a line should still
 * understand the product from watching four controls rewrite themselves when
 * the application above them changes.
 */

/** The cycle leads with the two applications most people have open at once,
 *  then the one that makes the point hardest: the same four keys, in a tool
 *  that has nothing in common with the other two. */
const CYCLE = ['vscode', 'chrome', 'claude', 'premiere']
const DWELL_MS = 2600

export default function Hero() {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    // Reduced motion gets a single, static state rather than a slower loop:
    // the request is for less movement, not for the same movement delayed.
    if (reduceMotion) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % CYCLE.length), DWELL_MS)
    return () => clearInterval(timer)
  }, [reduceMotion])

  return (
    <section id="top" className="relative overflow-hidden">
      <DotField className="absolute inset-0 h-full w-full" />
      <div aria-hidden className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[70vh]" />

      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-36 sm:px-8 sm:pt-44 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-balance font-display text-[2.3rem] font-semibold leading-[1.04] tracking-[-0.04em] text-base-50 sm:text-6xl md:text-7xl"
          >
            Your computer,
            <br />
            {/* Two-tone: the second line steps back a shade, so the eye
                reads the subject first and the promise second. */}
            <span className="text-base-400">adapting to you.</span>
          </motion.h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-base-300 sm:text-lg"
          >
            Noma learns the way you work and gives you the right controls, shortcuts and actions, right when you need them.
          </motion.p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <SiteLink
              href="#beta"
              className={`inline-flex items-center rounded-full px-6 py-3 text-sm font-medium tracking-tight ${GLASS_ACCENT}`}
            >
              Join the Noma beta
            </SiteLink>
            <SiteLink
              href="#demo"
              className="inline-flex items-center gap-2 rounded-full border border-base-600 px-6 py-3 text-sm font-medium tracking-tight text-base-200 transition-colors hover:border-base-400 hover:text-base-50"
            >
              See how it works
              <span aria-hidden className="text-base-400">↓</span>
            </SiteLink>
          </motion.div>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-16 max-w-2xl sm:mt-20"
        >
          {/* The app in front, as a dock-like row: the visitor sees the app
              change first and the controls follow, which is the product. */}
          <div className="mb-4 flex items-center justify-center gap-2" aria-hidden>
            {CYCLE.map((id, i) => (
              <span
                key={id}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-500 ${
                  i === index ? 'border-white/15 bg-white/[0.07] opacity-100' : 'border-transparent opacity-35'
                }`}
              >
                <AppIcon id={id} color={appProfiles[id].color} className="h-[18px] w-[18px]" />
              </span>
            ))}
          </div>

          <AdaptiveSurface appId={CYCLE[index]} size="lg" />

          <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-base-500">
            Switch apps · the controls follow
          </p>
        </motion.div>
      </div>
    </section>
  )
}
