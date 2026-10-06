import Section from '../layout/Section'
import SectionIntro from '../ui/SectionIntro'
import Reveal from '../ui/Reveal'
import WorkflowDemo from '../visuals/WorkflowDemo'

/**
 * Noma working, right under the hero: someone fixes a bug the way they
 * always do, three times, and Noma's notice arrives. Labelled as a
 * demonstration; the notice itself is drawn exactly as the app draws it.
 */
export default function Demo() {
  return (
    <Section id="demo">
      <SectionIntro
        center
        title="You work."
        quiet="Noma notices."
        line="Screenshot the bug, paste it into Claude, commit the fix. By the third time, Noma has seen the pattern."
      />
      <Reveal delay={0.1}>
        <WorkflowDemo className="mt-14" />
      </Reveal>
      <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-base-500">
        Product demonstration · the notice is Noma&rsquo;s own
      </p>
    </Section>
  )
}
