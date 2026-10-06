import type { ReactNode } from 'react'
import { SERIF_LINE } from '../../lib/type'

/**
 * The word or phrase a headline is about, set in Instrument Serif italic
 * against the Sora around it. Use it once per headline, on the part that
 * carries the meaning (Noma *notices*, stop *repeating* yourself), never on
 * a whole line out of habit.
 */
export default function Em({ children }: { children: ReactNode }) {
  return <span className={`${SERIF_LINE} leading-none`}>{children}</span>
}
