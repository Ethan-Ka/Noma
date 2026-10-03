import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import AdaptiveSurface from '../visuals/AdaptiveSurface'
import AppIcon from '../visuals/AppIcon'
import { appProfiles } from '../../data/appProfiles'

/**
 * The section the page is built to reach: the visitor drives the product
 * themselves.
 *
 * It advances on its own until the first click, then stops for good. An
 * autoplaying demo proves the idea to someone who is scrolling past; a demo
 * that keeps moving under someone who has started clicking is fighting them.
 * Yielding permanently on the first interaction is the whole rule.
 */

const APPS = ['vscode', 'chrome', 'claude', 'figma', 'premiere', 'spotify']
const DWELL_MS = 3200

export default function Context() {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState('vscode')
  const [taken, setTaken] = useState(false)

  useEffect(() => {
    if (taken || reduceMotion) return
    // Functional update rather than a ref: the interval needs the *current*
    // app to pick the next one, and reading it from the previous state is the
    // one way to do that without writing a ref during render.
    const timer = setInterval(
      () => setActive((current) => APPS[(APPS.indexOf(current) + 1) % APPS.length]),
      DWELL_MS
    )
    return () => clearInterval(timer)
  }, [taken, reduceMotion])

  const choose = (id: string) => {
    setTaken(true)
    setActive(id)
  }

  return (
    <Section id="context">
      <Reveal>
        <h2 className="max-w-3xl text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-5xl">
          Same computer.
          <br />
          Different context.
          <br />
          <span className="text-base-400">Different interface.</span>
        </h2>
      </Reveal>

      <Reveal delay={0.08}>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-base-300">
          Pick an application. The controls underneath are the ones Noma would put in front of you there —
          and they are the same four keys every time.
        </p>
      </Reveal>

      {/* grid-cols-1 is minmax(0,1fr): without it the implicit mobile column
          sizes to the scrolling app rail's full width and pushes the surface
          off-screen. */}
      <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-12">
        <Reveal>
          {/* A real list on desktop, a scrollable rail on phones — not the
              desktop list squeezed, which would put six tap targets under the
              minimum comfortable size. */}
          <ul
            className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0"
            role="tablist"
            aria-label="Application"
          >
            {APPS.map((id) => {
              const app = appProfiles[id]
              const isActive = id === active
              return (
                <li key={id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => choose(id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200 ${
                      isActive
                        ? 'border-white/12 bg-white/[0.05] text-base-50'
                        : 'border-transparent text-base-400 hover:bg-white/[0.025] hover:text-base-200'
                    }`}
                  >
                    <AppIcon id={id} color={isActive ? app.color : undefined} className="h-5 w-5 shrink-0" />
                    <span className="whitespace-nowrap text-sm font-medium tracking-tight">{app.shortName}</span>
                    <span
                      aria-hidden
                      className={`ml-auto hidden h-1.5 w-1.5 rounded-full transition-opacity duration-200 lg:block ${
                        isActive ? 'opacity-100' : 'opacity-0'
                      }`}
                      style={{ background: app.color }}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </Reveal>

        <Reveal delay={0.06}>
          <AdaptiveSurface appId={active} size="lg" />
        </Reveal>
      </div>
    </Section>
  )
}
