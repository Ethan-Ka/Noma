import Reveal from '../components/ui/Reveal'
import LegalSection from '../components/ui/LegalSection'
import SiteLink from '../components/layout/SiteLink'

// Linked from the download section (2026-10-06). Paths checked against the
// app: its data lives in Electron's userData folder, named after the
// package ("noma"); the Windows installer is per-user NSIS, so it appears
// in Installed apps; uninstalling leaves the data folder behind
// (electron-builder's deleteAppDataOnUninstall is off), hence step 1.

const LINK = 'text-accent-bright transition-colors hover:text-accent'
const CODE = 'rounded border border-base-700 bg-base-900 px-1.5 py-0.5 font-mono text-[13px] text-base-100'

export default function Uninstall() {
  return (
    <div className="border-t border-base-800 bg-base-950 pb-24 pt-40 sm:pt-48">
      <div className="mx-auto max-w-2xl px-6 sm:px-8">
        <Reveal>
          <p className="text-sm font-medium text-base-400">Help</p>
          <h1 className="mt-3 text-balance font-display text-[clamp(2rem,5vw,3rem)] font-medium leading-[1.1] tracking-[-0.02em] text-base-50">
            Uninstalling Noma
          </h1>
          <p className="mt-6 max-w-lg text-balance text-base leading-relaxed text-base-400">
            A few steps on either computer. Removing the app doesn&rsquo;t delete what Noma has learned on its own,
            so start with step 1 if you want that gone too.
          </p>
        </Reveal>

        <Reveal delay={0.06} className="mt-14">
          <LegalSection title="1. Delete your data (optional)">
            <p>
              In Noma, open <span className="text-base-200">Settings</span> and choose{' '}
              <span className="text-base-200">Delete All Data</span>. This removes everything Noma has recorded and
              saved on this computer. Nothing was ever sent anywhere, so there&rsquo;s nothing else to delete.
            </p>
          </LegalSection>

          <LegalSection title="2. Quit Noma">
            <p>
              Noma keeps running in the background when its window is closed. Click the Noma icon in the system tray
              (Windows) or the menu bar (Mac) and choose <span className="text-base-200">Quit Noma</span>.
            </p>
          </LegalSection>

          <LegalSection title="3. Remove the app">
            <p>
              <span className="text-base-200">Windows:</span> open Settings, then Apps, then Installed apps. Find
              Noma, open its menu and choose Uninstall.
            </p>
            <p>
              <span className="text-base-200">Mac:</span> drag Noma from your Applications folder to the Trash. Then
              open System Settings, Privacy &amp; Security, and remove Noma from Accessibility (and Input
              Monitoring, if it&rsquo;s listed).
            </p>
          </LegalSection>

          <LegalSection title="4. Remove the data folder (if you skipped step 1)">
            <p>Noma&rsquo;s data stays in its folder until you delete it:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Windows: <span className={CODE}>%APPDATA%\noma</span>
              </li>
              <li>
                Mac: <span className={CODE}>~/Library/Application Support/noma</span>
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="Questions">
            <p>
              See what Noma records in the{' '}
              <SiteLink href="/privacy" className={LINK}>
                Privacy Policy
              </SiteLink>
              , or write to{' '}
              <a href="mailto:hello@nomashift.com" className={LINK}>
                hello@nomashift.com
              </a>
              .
            </p>
          </LegalSection>
        </Reveal>
      </div>
    </div>
  )
}
