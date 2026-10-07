import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import nomaMark from '../../assets/noma-mark.png'
import nomaWordmark from '../../assets/noma-wordmark.png'
import { GLASS, GLASS_ACCENT } from '../../lib/glass'
import SiteLink from './SiteLink'

// Four, matching the page's three pillars plus the one section that shows
// the adaptation happening. Every href is a section id that exists on
// `Home`, checked against it, not inherited from an older page.
const links = [
  { label: 'How it works', href: '#how' },
  { label: 'Flow', href: '#flow' },
  { label: 'Glide', href: '#glide' },
  { label: 'Device', href: '/device' },
]

/**
 * Floating liquid-glass pill; kept by explicit request as the one
 * deliberately decorative material on an otherwise restrained page. See
 * `lib/glass.ts` for the shared recipe this and the site's buttons share.
 * Every href goes through `SiteLink` now that routing exists, so these
 * links (and the logo) still work correctly from `/contact`, `/privacy`,
 * and `/terms`, not just from the homepage they were originally written
 * for.
 */
export default function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-col items-center">
        <nav className={`flex items-center gap-6 rounded-full px-5 py-3 ${GLASS}`}>
          <SiteLink href="#top" className="flex items-center gap-2.5">
            <img src={nomaMark} alt="" className="h-6 w-auto" />
            <img src={nomaWordmark} alt="Noma" className="h-3 w-auto" />
          </SiteLink>

          <ul className="hidden items-center gap-7 lg:flex">
            {links.map((link) => (
              <li key={link.href}>
                <SiteLink href={link.href} className="text-[13px] font-medium text-base-300 transition-colors hover:text-base-50">
                  {link.label}
                </SiteLink>
              </li>
            ))}
          </ul>

          <SiteLink
            href="#beta"
            className={`hidden items-center rounded-full px-4 py-1.5 text-[13px] font-medium lg:inline-flex ${GLASS_ACCENT}`}
          >
            Get the beta
          </SiteLink>

          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            // The two lines are 20 by 8 pixels, far too small to tap. Padding makes the
            // button a 44 by 44 target and the negative margin keeps the pill's layout.
            className="-mx-3 -my-[18px] flex flex-col gap-1.5 px-3 py-[18px] lg:hidden"
          >
            <span className={`h-px w-5 bg-base-100 transition-transform duration-300 ${menuOpen ? 'translate-y-[3.5px] rotate-45' : ''}`} />
            <span className={`h-px w-5 bg-base-100 transition-transform duration-300 ${menuOpen ? '-translate-y-[3.5px] -rotate-45' : ''}`} />
          </button>
        </nav>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={`mt-2 w-56 overflow-hidden rounded-3xl lg:hidden ${GLASS}`}
            >
              <ul className="flex flex-col gap-1 px-5 py-4">
                {links.map((link) => (
                  <li key={link.href}>
                    <SiteLink href={link.href} onClick={() => setMenuOpen(false)} className="block py-2 text-base text-base-200">
                      {link.label}
                    </SiteLink>
                  </li>
                ))}
                <li className="pt-2">
                  <SiteLink
                    href="#beta"
                    onClick={() => setMenuOpen(false)}
                    className={`inline-flex items-center rounded-full px-4 py-2 text-base font-medium ${GLASS_ACCENT}`}
                  >
                    Get the beta
                  </SiteLink>
                </li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
