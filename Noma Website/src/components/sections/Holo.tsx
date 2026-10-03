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
    <Section id="holo">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
        <div>
          <Reveal>
            <h2 className="max-w-md text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-4xl">
              Or swipe in from beside the trackpad.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-md text-base leading-relaxed text-base-300">
              Holo turns the empty space either side of your trackpad into controls. Start a finger beside the
              trackpad and flick it on, and the control for that side runs. Nothing clicks, and your pointer goes
              back to where it was. Ordinary trackpad use rarely starts at the very edge and flicks inward, so
              moving the pointer, scrolling and resting your hands leave it alone.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 max-w-md text-base leading-relaxed text-base-400">
              No purchase, no accessory, nothing plugged in. It works with the precision touchpad in most Windows
              laptops, and it is part of the beta.
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
