import Section from '../layout/Section'
import SectionIntro from '../ui/SectionIntro'
import Reveal from '../ui/Reveal'
import WorkflowDemo from '../visuals/WorkflowDemo'
import ScreenRecording from '../visuals/ScreenRecording'

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
        title="Here’s Noma catching a workflow."
        line="Screenshot the bug, paste it into Claude, commit the fix. The third time, Noma recognizes the sequence and offers to save it."
      />
      <Reveal delay={0.1}>
        <WorkflowDemo className="mt-14" />
      </Reveal>
      <p className="mt-5 text-center text-sm text-base-500">Recreated for this page. The notice is drawn the way the app shows it.</p>
      <ScreenRecording className="mt-14" caption="A screen recording of the Noma beta." />
    </Section>
  )
}
