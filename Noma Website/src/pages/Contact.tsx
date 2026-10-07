import Reveal from '../components/ui/Reveal'
import PageShell from '../components/ui/PageShell'
import SiteLink from '../components/layout/SiteLink'
import { CONTACT_EMAIL, LINK_CLASS, MAILTO } from '../data/config'
import { GLASS } from '../lib/glass'

// A real mailto link, not a fake form with nowhere to submit to. This
// site's only working backend is the waitlist's Formspree endpoint (see
// `data/config.ts`), and inventing a second form with no endpoint behind
// it would be exactly the kind of "fake UI that looks generated" this
// codebase's own conventions avoid elsewhere (see `RealPrototype`-style
// honesty framing on the homepage). A real email address that actually
// reaches someone is more honest than a form that silently goes nowhere.
const REASONS = [
  { label: 'General', subject: 'Hello' },
  { label: 'Press', subject: 'Press inquiry' },
  { label: 'Partnerships', subject: 'Partnership inquiry' },
]

export default function Contact() {
  return (
    <PageShell
      eyebrow="Contact"
      title="Talk to us."
      width="max-w-lg"
      center
      intro={
        <p className="mx-auto mt-4 max-w-sm text-balance text-base text-base-400">
          We&rsquo;re a small team building Noma. A real person reads every email.
        </p>
      }
    >
      <Reveal delay={0.1}>
        <div className={`mt-12 rounded-3xl px-8 py-12 ${GLASS}`}>
          <a
            href={MAILTO()}
            className="text-balance font-display text-xl font-semibold text-base-50 transition-colors hover:text-accent-bright sm:text-2xl"
          >
            {CONTACT_EMAIL}
          </a>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 border-t border-white/10 pt-8">
            {REASONS.map((r) => (
              <a
                key={r.label}
                href={MAILTO(r.subject)}
                className="rounded-full border border-base-700 px-4 py-2 text-sm font-medium text-base-300 transition-colors hover:border-accent/40 hover:text-base-50"
              >
                {r.label}
              </a>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.16}>
        <p className="mt-10 text-sm text-base-500">
          Found a bug in the app?{' '}
          <SiteLink href="/feedback" className={LINK_CLASS}>
            Report an issue
          </SiteLink>
          . Looking to join the waitlist instead?{' '}
          <SiteLink href="#beta" className={LINK_CLASS}>
            Sign up here
          </SiteLink>
          .
        </p>
      </Reveal>
    </PageShell>
  )
}
