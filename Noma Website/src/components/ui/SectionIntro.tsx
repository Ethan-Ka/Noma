import type { ReactNode } from 'react'
import Reveal from './Reveal'

/**
 * A section's words: a large headline (optionally broken over two lines)
 * and at most one short line under it. The visual below each
 * one does the explaining, so this stays small on purpose.
 *
 * Headlines are Sora at medium weight with -0.02em tracking (2026-10-06,
 * the user's pick over the earlier semibold at -0.035/-0.04em, which read
 * as cramped and heavy), in one colour, with the two lines set close. The
 * word a headline is about is wrapped in <Em> by the caller (Instrument
 * Serif italic), chosen per headline rather than styling a whole line.
 */
export default function SectionIntro({
  title,
  second,
  line,
  center = false,
  compact = false,
  className = '',
}: {
  title: ReactNode
  /** The headline's second line, after a line break. */
  second?: ReactNode
  line?: ReactNode
  center?: boolean
  /** A smaller headline, for a column beside a visual. */
  compact?: boolean
  className?: string
}) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} max-w-3xl ${className}`}>
      <Reveal>
        <h2
          className={`text-balance font-display text-[2rem] font-medium leading-[1.02] tracking-[-0.02em] text-base-50 ${
            compact ? 'sm:text-4xl md:text-[2.75rem]' : 'sm:text-5xl md:text-[3.4rem]'
          }`}
        >
          {title}
          {second && (
            <>
              <br />
              {second}
            </>
          )}
        </h2>
      </Reveal>
      {line && (
        <Reveal delay={0.08}>
          <p className={`mt-6 max-w-xl text-balance text-base leading-relaxed text-base-300 sm:text-lg ${center ? 'mx-auto' : ''}`}>
            {line}
          </p>
        </Reveal>
      )}
    </div>
  )
}
