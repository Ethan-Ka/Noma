import { motion, useReducedMotion } from 'framer-motion'
import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import NoticeCard from '../visuals/NoticeCard'
import type { WorkflowStep } from '../visuals/WorkflowSteps'

/**
 * The one moment a visitor will actually experience on their own machine, so
 * it gets a whole section and a real stage.
 *
 * It is drawn inside a window rather than floating in the layout, because
 * where it appears is most of the point: the corner of a screen you are
 * already working in, over something else, without taking focus. A card
 * centred on a marketing page would show the styling and lose the behaviour.
 */

const STEPS: WorkflowStep[] = [
  { kind: 'action', label: 'Screenshot' },
  { kind: 'app', label: 'Claude Code', appId: 'claude' },
  { kind: 'action', label: 'Send' },
]

export default function Notice() {
  const reduceMotion = useReducedMotion()

  return (
    <Section id="notice">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center lg:gap-16">
        <div>
          <Reveal>
            <h2 className="max-w-md text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-4xl">
              It tells you once, quietly.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-md text-base leading-relaxed text-base-300">
              A small glass card in the corner of the screen. It does not take focus, it does not interrupt
              what you were typing, and it leaves on its own after a few seconds.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 max-w-md text-base leading-relaxed text-base-400">
              If it is worth keeping, one click adds it. If it is not, it never asks again.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.06}>
          {/* A believable desktop, drawn with the page's own materials rather
              than a screenshot: a real screenshot would date instantly and
              would drag someone else's window chrome into Noma's brand. */}
          <div className="relative aspect-[16/11] overflow-hidden rounded-2xl border border-base-800 bg-base-950">
            <div aria-hidden className="absolute inset-0 bg-grid-fade opacity-60" />

            <div aria-hidden className="absolute inset-0 p-4 sm:p-6">
              <div className="h-full w-full rounded-xl border border-base-800 bg-base-900/70">
                <div className="flex items-center gap-1.5 border-b border-base-800 px-3 py-2.5">
                  <span className="h-2 w-2 rounded-full bg-base-700" />
                  <span className="h-2 w-2 rounded-full bg-base-700" />
                  <span className="h-2 w-2 rounded-full bg-base-700" />
                </div>
                <div className="space-y-2.5 p-4 sm:p-5">
                  {[88, 64, 76, 40, 82, 56, 70].map((width, index) => (
                    <div
                      key={index}
                      className="h-2 rounded-full bg-base-800"
                      style={{ width: `${width}%`, opacity: 1 - index * 0.09 }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <motion.div
              className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20% 0px' }}
              transition={{ duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <NoticeCard steps={STEPS} occurrences={4} className="max-w-[260px] sm:max-w-[300px]" />
            </motion.div>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
