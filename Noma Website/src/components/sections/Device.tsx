import Reveal from '../ui/Reveal'
import SiteLink from '../layout/SiteLink'
import Em from '../ui/Em'

/**
 * The hardware, honestly: it doesn't exist yet. The homepage says it's
 * coming and why the software comes first; what it will be lives on its
 * own page, `/device` (moved there 2026-10-06 at the user's request). No
 * render here, so nothing reads as a shipping product.
 */
export default function Device() {
  return (
    <section id="device" className="relative scroll-mt-28 border-t border-base-800">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-20 md:py-24">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance font-display text-[2rem] font-medium leading-[1.02] tracking-[-0.02em] text-base-50 sm:text-5xl">
              And eventually,
              <br />
              Noma becomes <Em>physical.</Em>
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-balance text-base leading-relaxed text-base-300">
              The software comes first. The hardware is being designed around what Noma learns about how people
              actually work.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <span className="inline-flex items-center gap-2.5 rounded-full border border-base-700 px-4 py-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-base-400" />
                <span className="text-sm text-base-300">In development, not for sale yet</span>
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
