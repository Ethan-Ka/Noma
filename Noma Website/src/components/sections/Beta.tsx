import Section from '../layout/Section'
import SectionIntro from '../ui/SectionIntro'
import Em from '../ui/Em'
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
    <Section id="beta">
      <SectionIntro
        center
        title="Help build the computer"
        second={<>that <Em>adapts to you.</Em></>}
        line="Noma is in beta and free to use. Install it, use it for real, and help shape what comes next."
      />

      <Reveal delay={0.14}>
        <div className="mx-auto mt-10 max-w-2xl text-center">
          <DownloadButtons />
          <p className="mx-auto mt-5 max-w-md text-balance text-sm leading-relaxed text-base-300">
            Noma records which shortcut, in which app, in what order. Never what you type.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <div className="mx-auto mt-12 max-w-md border-t border-base-800 pt-8 text-center">
          <p className="mb-4 text-sm text-base-400">Not ready to install? Get an email when something changes.</p>
          <WaitlistForm submitLabel="Get updates" />
        </div>
      </Reveal>
    </Section>
  )
}
