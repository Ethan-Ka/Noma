import type { LearnedAction } from '../lib/useLearnedActions'
import { WorkflowChain } from './WorkflowChain'
import { formatAbsoluteTime, formatRelativeTime } from '../lib/formatRelativeTime'
import { CARD } from '../lib/surfaces'
import { DEMO_MACRO_TRIGGER } from '@shared/constants'
import { useGlideStore } from '../stores/glideStore'
import { zoneNameForSlot } from './WorkflowDetailModal'

/**
 * One entry in "Your workflows" — the accepted counterpart to the pending
 * `NomaMoment` cards above it. Deliberately a real card (`CARD`, the app's
 * one solid-surface recipe — see `lib/surfaces.ts`'s v4 note on why this
 * isn't glass), not the plain divided row `LearnedActionCard` uses on
 * Controls: this page's whole point is to make a learned workflow feel like
 * an object in a library, and Controls' denser list-of-everything context
 * doesn't call for that same weight. Both read the exact same
 * `useLearnedActions` data — no second model, just a second presentation.
 */
export function WorkflowCard({ action, onSelect }: { action: LearnedAction; onSelect: () => void }) {
  const { macro, chain, usageCount, applicationName, lastUsedAt, assignments } = action
  const zoneCount = useGlideStore((state) => state.state?.zoneCount ?? 4)
  const where = assignments[0]
  const isDemo = macro.trigger === DEMO_MACRO_TRIGGER

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ animation: 'noma-settle 300ms ease-out' }}
      className={`w-full p-5 text-left transition-colors duration-150 hover:border-accent-muted/60 ${CARD}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="truncate font-display text-base font-semibold text-neutral-100">{macro.name}</span>
            {!macro.enabled && (
              <span className="shrink-0 rounded border border-base-600 px-1.5 py-px text-[10px] text-neutral-400">Paused</span>
            )}
            {isDemo && (
              <span className="shrink-0 rounded border border-base-600 px-1.5 py-px text-[10px] text-neutral-400">Demo</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {where
              ? `${zoneNameForSlot(where.slot, zoneCount)} in ${where.applicationName}${assignments.length > 1 ? ` and ${assignments.length - 1} more` : ''}`
              : `Not on any zone${applicationName ? ` · ${applicationName}` : ''}`}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-neutral-500">
          <p>
            Used {usageCount} time{usageCount === 1 ? '' : 's'}
          </p>
          {lastUsedAt && (
            <p className="mt-0.5" title={formatAbsoluteTime(lastUsedAt)}>
              Last used {formatRelativeTime(lastUsedAt)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <WorkflowChain steps={chain} size="md" />
      </div>
    </button>
  )
}
