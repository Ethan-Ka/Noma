import Section from '../layout/Section'
import SectionIntro from '../ui/SectionIntro'
import Reveal from '../ui/Reveal'
import HoloDemo from '../visuals/HoloDemo'

/**
 * Glide: the four controls, at the edges of the trackpad you already have.
 * The demo is the explanation: try a zone and watch the control fire.
 */
export default function Holo() {
  return (
    <Section id="glide">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
        <SectionIntro
          compact
          title="Your four controls, on the trackpad."
          line="Glide puts them at the edges of the trackpad you already have. Swipe in from the palm rest to use one. No extra hardware."
        />
        <Reveal delay={0.06}>
          <HoloDemo />
        </Reveal>
      </div>
    </Section>
  )
}
