import { IS_BETA } from '@shared/constants'

/** A small "Beta" pill: every downloaded build is a beta until IS_BETA
 *  flips, and this is the in-app reminder of that. Renders nothing after. */
export function BetaBadge({ className = '' }: { className?: string }) {
  if (!IS_BETA) return null
  return (
    <span
      title="Noma is in beta. The final version isn't out yet, so things may change."
      className={`inline-flex items-center rounded-full border border-accent/30 bg-accent-subtle shrink-0 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-[0.12em] text-accent ${className}`}
    >
      Beta
    </span>
  )
}
