import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import HoloDemo from '../visuals/HoloDemo'

/**
 * The pillar that needs nothing but the laptop you already have.
 *
 * Shown by letting the visitor do it: swipe in from a side of the trackpad
 * on the plan view, watch the control fire underneath. The geometry is the
 * explanation — a palm rest seen from above, a finger sliding from beside
 * the trackpad onto it, says it better than any amount of prose.
 */

export default function Holo() {
  return (
    <Section id="glide">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
        <div>
          <Reveal>
            <h2 className="max-w-md text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-4xl">
              Or swipe in from beside the trackpad.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-md text-balance text-base leading-relaxed text-base-300">
              Four controls on the trackpad you already have. Nothing to buy.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.06}>
          <HoloDemo />
        </Reveal>
      </div>
    </Section>
  )
}
