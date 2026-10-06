import Reveal from '../ui/Reveal'
import SiteLink from '../layout/SiteLink'

/**
 * The homepage only says the hardware is coming. What it is lives on its own
 * page, `/device` (moved there 2026-10-06 at the user's request).
 */
export default function Device() {
  return (
    // Its own shell rather than Section: one line does not need a full
    // section's worth of padding.
    <section id="device" className="relative scroll-mt-28 border-t border-base-800">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8 md:py-16">
        <Reveal>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-base-500">Coming soon</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-base-50 sm:text-3xl">
                Noma Device
              </h2>
            </div>
            <SiteLink
              href="/device"
              className="inline-flex shrink-0 items-center rounded-full border border-base-600 px-5 py-2.5 text-sm font-medium tracking-tight text-base-200 transition-colors hover:border-base-400 hover:text-base-50"
            >
              See what it is
            </SiteLink>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
