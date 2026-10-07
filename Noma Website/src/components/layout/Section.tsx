import type { ReactNode } from 'react'

interface SectionProps {
  id: string
  children: ReactNode
  className?: string
  /** Sit directly on the page instead of in a glass panel. Used on
   *  alternating sections (2026-10-07) so the page isn't one card after
   *  another, which read as templated. */
  bare?: boolean
}

/**
 * A homepage section: its own glass panel floating over the page backdrop
 * (2026-10-06). The user found the (then) stardust running through text
 * hard to read and asked for each section in its own Apple-style glass
 * container; the panel blurs and darkens what's behind it, so text sits on
 * a calm surface while the dust still moves around and through it. See
 * `.glass-panel` in index.css for the recipe (restrained: no colour, no
 * glow, no sheen).
 *
 * scroll-mt clears the fixed nav pill, so a jump to `#flow` lands on the
 * heading rather than behind the bar covering it.
 */
export default function Section({ id, children, className = '', bare = false }: SectionProps) {
  if (bare) {
    return (
      <section id={id} className={`relative scroll-mt-28 px-3 sm:px-5 ${className}`}>
        <span aria-hidden className="thread-node" />
        {/* Same content edges as a panel's, so text lines up down the page. */}
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-10 sm:py-20 md:px-12 md:py-28">{children}</div>
      </section>
    )
  }
  return (
    <section id={id} className={`relative scroll-mt-24 px-3 py-3 sm:px-5 sm:py-4 ${className}`}>
      {/* This section's stop on the page's thread (see ScrollThread). */}
      <span aria-hidden className="thread-node" />
      <div className="glass-panel mx-auto max-w-[76rem] rounded-[28px] sm:rounded-[36px]">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-10 sm:py-16 md:px-12 md:py-20">{children}</div>
      </div>
    </section>
  )
}
