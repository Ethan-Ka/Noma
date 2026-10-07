import nomaMark from '../../assets/noma-mark.png'
import nomaWordmark from '../../assets/noma-wordmark.png'
import SiteLink from './SiteLink'
import DotWordmark from '../visuals/DotWordmark'

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '#how' },
      { label: 'Flow', href: '#flow' },
      { label: 'Glide', href: '#glide' },
      { label: 'Device', href: '/device' },
      { label: 'Beta', href: '#beta' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Report an issue', href: '/feedback' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Uninstall', href: '/uninstall' },
      { label: 'Terms', href: '/terms' },
    ],
  },
]

/** Every href now goes through `SiteLink` (see that file), so the
 *  homepage-anchor links here keep working from `/contact`, `/privacy`,
 *  and `/terms` — not just from the page they were written for — and the
 *  `Privacy`/`Terms`/`Contact` links are now real routed pages instead of
 *  `#` placeholders or a bare `mailto:`. */
export default function Footer() {
  return (
    <footer className="overflow-hidden border-t border-base-800">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <img src={nomaMark} alt="" className="h-6 w-auto" />
            <img src={nomaWordmark} alt="Noma" className="h-3.5 w-auto" />
          </div>
          <p className="max-w-[26ch] text-sm text-base-500">Your computer, adapting to you.</p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-medium text-base-400">{col.title}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <SiteLink href={l.href} className="text-sm text-base-300 transition-colors hover:text-base-50">
                    {l.label}
                  </SiteLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-base-800 px-6 py-6 sm:px-8">
        <p className="font-mono text-[11px] text-base-500">&copy; {new Date().getFullYear()} Noma</p>
      </div>

      {/* The oversized, faded closing wordmark — the "big startup footer"
          move (Linear/Stripe/Vercel etc.): huge, barely-there, emerging
          out of the footer above rather than starting on a hard edge, then
          cut clean by the container's own bottom edge. The wordmark's
          native aspect ratio is very wide/short (~7:1), so it has to be
          rendered noticeably wider than this wrapper to have any height
          left to crop at all — `clamp()` keeps that relationship at every
          viewport size instead of hand-tuning per breakpoint. */}
      {/* 2026-10-05: now drawn in Noma Blue dots (DotWordmark), about a
          quarter smaller, at the user's request. */}
      <div aria-hidden="true" className="relative select-none overflow-hidden" style={{ height: 'clamp(50px, 7.5vw, 116px)' }}>
        <DotWordmark
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{
            width: 'clamp(300px, 75vw, 1000px)',
            maskImage: 'linear-gradient(to bottom, transparent, black 45%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 45%)'
          }}
        />
      </div>
    </footer>
  )
}
