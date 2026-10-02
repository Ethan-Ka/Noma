import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import KeyboardVisual from '../visuals/KeyboardVisual'
import { appProfiles } from '../../data/appProfiles'

/**
 * The hardware, told honestly.
 *
 * Noma is a hardware company as much as a software one, so this cannot be a
 * footnote — but no board has been assembled, so it cannot be a product shot
 * either. The way through is to show the *idea* precisely and state the
 * status plainly in the same breath.
 *
 * The board runs the same application cycle the rest of the page does, and
 * its display reads the same four labels the on-screen surface just showed.
 * That is the entire argument for the device in one image: it is not another
 * pad you assign things to, it is the same adaptive interface with somewhere
 * to put your hand. Drawn as a schematic rather than rendered as a product,
 * because it is a schematic — `showPinConnectors={false}` keeps the older
 * modular story out of it.
 */

const FACTS = [
  {
    term: 'What it is',
    detail:
      'A small surface with a display and four keys, sitting beside the keyboard. Its labels are whatever Noma currently believes you need.',
  },
  {
    term: 'Why it is not a macro pad',
    detail:
      'Nothing on it is assigned. It changes because Flow noticed something, which is the same reason the software changes.',
  },
  {
    term: 'Where it is',
    detail:
      'The host-to-device protocol is written and implemented, and firmware exists against it. No board has been built yet. That is the next step, not a shipping date.',
  },
]

/** The same cycle the on-screen surface runs, so the board is visibly
 *  following the software rather than demonstrating itself. */
const CYCLE = ['vscode', 'claude', 'premiere']
const DWELL_MS = 3000

export default function Device() {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduceMotion) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % CYCLE.length), DWELL_MS)
    return () => clearInterval(timer)
  }, [reduceMotion])

  const app = appProfiles[CYCLE[index]]

  return (
    <Section id="device">
      <Reveal>
        <div className="relative mx-auto mb-16 max-w-3xl">
          <KeyboardVisual
            appName={app.shortName}
            controls={app.controls}
            showPinConnectors={false}
            glow
            float
          />
          <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-base-500">
            The display follows the software · concept
          </p>
        </div>
      </Reveal>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <Reveal>
            <h2 className="max-w-md text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-4xl">
              And something to put it on.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-md text-base leading-relaxed text-base-300">
              The adaptive interface works on the screen today. It is better as a physical thing you can
              reach for without looking — a surface whose keys are already the right ones, because the
              software told it what they are.
            </p>
          </Reveal>

          <Reveal delay={0.14}>
            <div className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-base-700 px-4 py-2">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-base-400" />
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-base-300">
                In development · not for sale
              </span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.06}>
          <dl className="divide-y divide-base-800 border-y border-base-800">
            {FACTS.map((fact) => (
              <div key={fact.term} className="py-6">
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-base-500">{fact.term}</dt>
                <dd className="mt-3 text-base leading-relaxed text-base-200">{fact.detail}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </Section>
  )
}
