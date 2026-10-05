import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import WaitlistForm from '../ui/WaitlistForm'
import DownloadButtons from '../ui/DownloadButtons'

/**
 * The ask.
 *
 * Software-first is stated as a decision rather than apologised for, because
 * it is one: the intelligence is the product, and shipping it without asking
 * anyone to buy a device first is how the idea gets tested at all. The
 * downloads are the real beta builds (the app repo's latest GitHub release,
 * looked up live in lib/downloads.ts); the waitlist stays below them for
 * people who want release notes by email.
 */

const FACTS = ['Free during the beta']

export default function Beta() {
  return (
    <Section id="beta">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <h2 className="text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-5xl">
            Noma starts with software.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mx-auto mt-6 max-w-lg text-balance text-base leading-relaxed text-base-300">
            The adaptive interface runs on the computer you already own. Try it there first. The device can
            come later, once the thing driving it is worth putting on a desk.
          </p>
        </Reveal>

        <Reveal delay={0.14}>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            {FACTS.map((fact) => (
              <li
                key={fact}
                className="rounded-full border border-base-700 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-base-300"
              >
                {fact}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-10">
            <DownloadButtons />
          </div>
        </Reveal>

        <Reveal delay={0.26}>
          <div className="mx-auto mt-12 max-w-md border-t border-base-800 pt-8">
            <p className="mb-4 text-sm text-base-400">
              Early and experimental. Leave your email for release notes and what changes next.
            </p>
            <WaitlistForm submitLabel="Get updates" />
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
