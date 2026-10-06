import type { ReactNode } from 'react'
import Reveal from './Reveal'

/**
 * A section's words: a large two-tone headline (the claim, then a quieter
 * second line) and at most one short line under it. The visual below each
 * one does the explaining, so this stays small on purpose.
 */
export default function SectionIntro({
  title,
  quiet,
  line,
  center = false,
  compact = false,
  className = '',
}: {
  title: ReactNode
  quiet?: ReactNode
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
          className={`text-balance font-display text-[2rem] font-semibold leading-[1.06] tracking-[-0.035em] text-base-50 ${
            compact ? 'sm:text-4xl md:text-[2.75rem]' : 'sm:text-5xl md:text-[3.4rem]'
          }`}
        >
          {title}
          {quiet && (
            <>
              <br />
              <span className="text-base-400">{quiet}</span>
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
