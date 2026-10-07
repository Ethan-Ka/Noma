import type { ReactNode } from 'react'
import Reveal from './Reveal'

/**
 * The wrapper every plain page shares: top border, page background, the
 * clearance under the fixed nav, a centred column, and the opening block
 * (eyebrow, h1, optional "Last updated" line, optional intro paragraph).
 */
export default function PageShell({
  eyebrow,
  title,
  updated,
  width,
  center = false,
  intro,
  children,
}: {
  eyebrow: string
  title: ReactNode
  /** Shown as "Last updated {updated}". */
  updated?: string
  /** A max-width class, e.g. `max-w-2xl`. */
  width: string
  center?: boolean
  /** The paragraph under the heading, inside the same reveal. */
  intro?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="border-t border-base-800 bg-base-950 pb-24 pt-40 sm:pt-48">
      <div className={`mx-auto ${width} px-6 ${center ? 'text-center ' : ''}sm:px-8`}>
        <Reveal>
          <p className="text-sm font-medium text-base-400">{eyebrow}</p>
          <h1 className="mt-3 text-balance font-display text-[clamp(2rem,5vw,3rem)] font-medium leading-[1.1] tracking-[-0.02em] text-base-50">
            {title}
          </h1>
          {updated && <p className="mt-4 text-sm text-base-500">Last updated {updated}</p>}
          {intro}
        </Reveal>
        {children}
      </div>
    </div>
  )
}
