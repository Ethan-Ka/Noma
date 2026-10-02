import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import SiteLink from '../layout/SiteLink'
import { GLASS_ACCENT } from '../../lib/glass'

/**
 * The last thing read, so it is the one sentence worth remembering — a
 * statement about computers rather than a closing pitch about Noma. The
 * button under it is small on purpose; the page has already asked once.
 */
export default function Closing() {
  return (
    <Section id="closing">
      <div className="mx-auto max-w-3xl py-8 text-center sm:py-16">
        <Reveal>
          <p className="text-balance font-display text-3xl font-semibold leading-[1.12] tracking-[-0.035em] text-base-50 sm:text-5xl">
            Your computer already knows
            <br className="hidden sm:block" /> what you are doing.
          </p>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.12] tracking-[-0.035em] text-base-400 sm:text-5xl">
            Noma is learning what to do next.
          </p>
        </Reveal>
        <Reveal delay={0.24}>
          <SiteLink
            href="#beta"
            className={`mt-12 inline-flex items-center rounded-full px-6 py-3 text-sm font-medium tracking-tight ${GLASS_ACCENT}`}
          >
            Get Noma Beta
          </SiteLink>
        </Reveal>
      </div>
    </Section>
  )
}
