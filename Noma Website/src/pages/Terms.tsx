import Reveal from '../components/ui/Reveal'
import LegalSection from '../components/ui/LegalSection'
import SiteLink from '../components/layout/SiteLink'

// Rewritten 2026-10-06 for the downloadable beta: the old version said the
// product didn't exist yet. Still deliberately names no legal entity,
// address or governing law, since none is known here; a lawyer should fill
// those in (and review the rest) before Noma leaves beta.
const LAST_UPDATED = 'October 6, 2026'

const EMAIL = 'hello@nomashift.com'
const LINK = 'text-accent-bright transition-colors hover:text-accent'

export default function Terms() {
  return (
    <div className="border-t border-base-800 bg-base-950 pb-24 pt-40 sm:pt-48">
      <div className="mx-auto max-w-2xl px-6 sm:px-8">
        <Reveal>
          <p className="text-sm font-medium text-base-400">Legal</p>
          <h1 className="mt-3 text-balance font-display text-[clamp(2rem,5vw,3rem)] font-medium leading-[1.1] tracking-[-0.02em] text-base-50">
            Terms of Service
          </h1>
          <p className="mt-4 text-sm text-base-500">Last updated {LAST_UPDATED}</p>
          <p className="mt-6 max-w-lg text-balance text-base leading-relaxed text-base-400">
            These terms cover the Noma app, this website, and our email list. By downloading Noma or using this
            site, you agree to them.
          </p>
        </Reveal>

        <Reveal delay={0.06} className="mt-14">
          <LegalSection title="Noma is in beta">
            <p>
              The app is free while it&rsquo;s in beta. It&rsquo;s early software: it will have bugs, features may
              change or be removed, and the final version isn&rsquo;t out yet. We may stop offering the beta at any
              time.
            </p>
          </LegalSection>

          <LegalSection title="Using the app">
            <p>
              You may install Noma on computers you own or are allowed to use, and use it for your own work.
              Please don&rsquo;t sell it, or share modified copies of it as Noma.
            </p>
          </LegalSection>

          <LegalSection title="Actions run in other apps">
            <p>
              Noma presses shortcuts and clicks buttons in other apps for you. In a beta, an action can sometimes
              land in the wrong place or do something you didn&rsquo;t expect. Check what an action does before
              relying on it, keep your own backups, and don&rsquo;t use Noma for anything where a mistaken key
              press or click could cause serious harm.
            </p>
          </LegalSection>

          <LegalSection title="Updates">
            <p>
              Noma checks for new versions and updates itself. On Windows, an update installs when Noma quits, or
              straight away from the tray menu. Using an older version may stop working as we change things.
            </p>
          </LegalSection>

          <LegalSection title="Your data">
            <p>
              What Noma learns about how you work stays on your computer and belongs to you. The{' '}
              <SiteLink href="/privacy" className={LINK}>
                Privacy Policy
              </SiteLink>{' '}
              explains exactly what it records and how to delete it.
            </p>
          </LegalSection>

          <LegalSection title="Noma Device">
            <p>
              The Noma Device is in development and not for sale. Signing up for updates isn&rsquo;t a purchase or
              a pre-order, and doesn&rsquo;t guarantee a price, a date, or that it ships.
            </p>
          </LegalSection>

          <LegalSection title="What belongs to us">
            <p>
              The Noma name, logo, app and the content of this site belong to Noma. You&rsquo;re welcome to link to
              the site and talk about Noma; please don&rsquo;t use our name or logo in a way that suggests
              we&rsquo;re connected to something we aren&rsquo;t.
            </p>
          </LegalSection>

          <LegalSection title="What you agree not to do">
            <ul className="list-disc space-y-2 pl-5">
              <li>Use Noma to record or control someone else&rsquo;s computer without their permission.</li>
              <li>Try to disrupt or overload this site, or scrape it at scale.</li>
              <li>Sign someone else up for our emails without their consent.</li>
              <li>Use Noma or this site for anything illegal or that infringes someone else&rsquo;s rights.</li>
            </ul>
          </LegalSection>

          <LegalSection title="No warranty">
            <p>
              Noma and this site are provided as they are, without warranties of any kind. We work to keep them
              accurate, safe and working, but we can&rsquo;t promise they&rsquo;re free of errors or always
              available.
            </p>
          </LegalSection>

          <LegalSection title="Limitation of liability">
            <p>
              To the extent the law allows, Noma isn&rsquo;t liable for indirect, incidental or consequential
              damages, or for lost data or work, arising from your use of the app or this site. Nothing here
              limits liability where the law doesn&rsquo;t allow it to be limited.
            </p>
          </LegalSection>

          <LegalSection title="Changes">
            <p>
              We&rsquo;ll update these terms as Noma changes, especially when it leaves beta, and change the date at
              the top when we do. Continuing to use Noma after a change means you accept the new terms.
            </p>
          </LegalSection>

          <LegalSection title="Contact">
            <p>
              Questions about these terms: write to{' '}
              <a href={`mailto:${EMAIL}`} className={LINK}>
                {EMAIL}
              </a>
              .
            </p>
          </LegalSection>
        </Reveal>
      </div>
    </div>
  )
}
