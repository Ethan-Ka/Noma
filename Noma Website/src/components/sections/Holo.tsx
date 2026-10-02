import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import HoloDemo from '../visuals/HoloDemo'

/**
 * The pillar that needs nothing but the laptop already on the desk.
 *
 * Shown by letting the visitor do it: tap a zone on the plan view, watch the
 * control fire underneath. The geometry is the explanation — any amount of
 * prose about acoustic classification would explain it worse than one desk
 * seen from above with four places to hit.
 */

export default function Holo() {
  return (
    <Section id="holo">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
        <div>
          <Reveal>
            <h2 className="max-w-md text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-4xl">
              Or just tap the desk.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-md text-base leading-relaxed text-base-300">
              Holo turns the bare desk around your laptop into four controls. It listens through the
              microphone already in the lid, learns how your desk sounds when you tap each spot, and tells
              those spots apart from then on.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 max-w-md text-base leading-relaxed text-base-400">
              No purchase, no accessory, nothing plugged in. It is part of the beta.
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
