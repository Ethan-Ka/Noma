import Section from '../layout/Section'
import SectionIntro from '../ui/SectionIntro'
import Reveal from '../ui/Reveal'
import WaitlistForm from '../ui/WaitlistForm'
import DownloadButtons from '../ui/DownloadButtons'

/**
 * The ask, as an invitation: the beta is real and downloadable today (the
 * app repo's newest GitHub release, see lib/downloads.ts), so joining means
 * installing it. The email form stays for people who want to hear what
 * changes.
 */
export default function Beta() {
  return (
    <Section id="beta" feature>
      <SectionIntro
        center
        title="Try the beta."
        line="It’s free. Use it for a week on your real work, then tell me what it got wrong. That feedback decides what gets built next."
      />

      <Reveal delay={0.14}>
        <div className="mx-auto mt-10 max-w-2xl text-center">
          <DownloadButtons onLight />
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <div className="mx-auto mt-12 max-w-md border-t border-base-800 pt-8 text-center">
          <p className="mb-4 text-sm text-base-400">Not ready to install? Get an email when something changes.</p>
          <WaitlistForm submitLabel="Get updates" onLight />
        </div>
      </Reveal>
    </Section>
  )
}
