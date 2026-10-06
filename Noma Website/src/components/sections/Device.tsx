import Reveal from '../ui/Reveal'
import SiteLink from '../layout/SiteLink'

/**
 * The hardware, honestly: it doesn't exist yet. The homepage says it's
 * coming and why the software comes first; what it will be lives on its
 * own page, `/device` (moved there 2026-10-06 at the user's request). No
 * render here, so nothing reads as a shipping product.
 */
export default function Device() {
  return (
    <section id="device" className="relative scroll-mt-28 border-t border-base-800">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-8 md:py-32">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance font-display text-[2rem] font-semibold leading-[1.06] tracking-[-0.035em] text-base-50 sm:text-5xl">
              And eventually,
              <br />
              <span className="text-base-400">Noma becomes physical.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-balance text-base leading-relaxed text-base-300">
              The software comes first. The hardware is being designed around what Noma learns about how people
              actually work.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <span className="inline-flex items-center gap-2.5 rounded-full border border-base-700 px-4 py-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-base-400" />
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-base-300">
                  In development · not for sale
                </span>
              </span>
              <SiteLink href="/device" className="text-sm text-accent-bright transition-colors hover:text-accent">
                What it will be →
              </SiteLink>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
