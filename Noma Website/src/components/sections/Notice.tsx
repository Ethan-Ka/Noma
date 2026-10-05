import Section from '../layout/Section'
import Reveal from '../ui/Reveal'
import NoticeDesktop from '../visuals/NoticeDesktop'

/**
 * The one moment a visitor will actually experience on their own machine, so
 * it gets a whole section and a real stage: a real-looking desktop (VS Code,
 * a Terminal running Claude Code) with the notice arriving in its corner,
 * exactly as the app draws it (ProductNotice.tsx). Where it appears is most
 * of the point: the corner of a screen you are already working in, over
 * something else, without taking focus. 2026-10-05: rebuilt spacefs.com
 * style at the user's request, replacing a stylised window of grey bars.
 */

export default function Notice() {
  return (
    <Section id="notice">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
        <Reveal>
          <h2 className="max-w-md text-balance font-display text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-base-50 sm:text-4xl">
            It tells you once, quietly.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="max-w-md text-base leading-relaxed text-base-300">
            A small card in the corner. One click to keep it, or it leaves on its own.
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.1}>
        <NoticeDesktop className="mt-14" />
      </Reveal>
    </Section>
  )
}
