import Section from '../layout/Section'
import SectionIntro from '../ui/SectionIntro'
import Em from '../ui/Em'
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
        title="You work."
        second={<>Noma <Em>notices.</Em></>}
        line="Screenshot the bug, paste it into Claude, commit the fix. By the third time, Noma has seen the pattern."
      />
      <Reveal delay={0.1}>
        <WorkflowDemo className="mt-14" />
      </Reveal>
      <p className="mt-5 text-center text-sm text-base-500">A product demonstration. The notice is Noma&rsquo;s own.</p>
      <ScreenRecording className="mt-14" caption="A screen recording of the Noma beta." />
    </Section>
  )
}
