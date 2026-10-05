import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import DashboardDemo from '../visuals/DashboardDemo'

/**
 * The actual application, not an impression of it.
 *
 * `DashboardDemo` is a faithful recreation of the desktop app's own Home
 * page — same layout, same control tiles, same suggestion card — driven by
 * local state because the real one is driven by an Electron IPC bridge that
 * cannot exist in a browser. Reused wholesale rather than redrawn: a
 * marketing-only mock of a product that already exists is a lie with extra
 * steps, and this one can be clicked.
 */
export default function Product() {
  return (
    <Section id="product">
      <div className="max-w-2xl">
        <Reveal>
          <h2 className="text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-5xl">
            This is the whole application.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-6 text-base leading-relaxed text-base-300">
            One window. Switch the app and watch it follow.
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.12}>
        <div className="mt-12">
          <DashboardDemo />
        </div>
      </Reveal>
    </Section>
  )
}
