import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import WaitlistForm from '../ui/WaitlistForm'

/**
 * The ask.
 *
 * Software-first is stated as a decision rather than apologised for, because
 * it is one: the intelligence is the product, and shipping it without asking
 * anyone to buy a device first is how the idea gets tested at all. The form
 * is the existing waitlist — there is no installer to link to yet, and
 * pointing a download button at nothing would undo every honest sentence
 * above it.
 */

const FACTS = ['Free during the beta', 'Windows', 'Glide included']

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
          <div className="mx-auto mt-10 max-w-md">
            <WaitlistForm submitLabel="Get Noma Beta" />
          </div>
        </Reveal>

        <Reveal delay={0.26}>
          <p className="mt-5 text-sm text-base-500">
            Early and experimental. You will get the build and the notes that come with it.
          </p>
        </Reveal>
      </div>
    </Section>
  )
}
