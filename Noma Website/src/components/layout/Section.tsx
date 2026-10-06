import type { ReactNode } from 'react'

interface SectionProps {
  id: string
  children: ReactNode
  className?: string
  bordered?: boolean
}

/** Consistent full-bleed section shell: id anchor, spacing rhythm, top hairline. */
export default function Section({ id, children, className = '', bordered = true }: SectionProps) {
  return (
    <section
      id={id}
      /* scroll-mt clears the fixed nav pill, so a jump to `#flow` lands on
         the heading rather than behind the bar covering it. */
      className={`relative scroll-mt-28 ${bordered ? 'border-t border-base-800' : ''} ${className}`}
    >
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-20 md:py-24">{children}</div>
    </section>
  )
}
