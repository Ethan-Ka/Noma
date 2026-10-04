import { useEffect, useState } from 'react'
import { useSuggestionsStore } from '../stores/suggestionsStore'
import { useLearnedActions, type LearnedAction } from '../lib/useLearnedActions'
import { NomaMoment } from '../components/NomaMoment'
import { WorkflowCard } from '../components/WorkflowCard'
import { WorkflowDetailModal } from '../components/WorkflowDetailModal'
import { EmptyState } from '../components/EmptyState'
import { useWorkflowStore } from '../stores/workflowStore'
import { CARD } from '../lib/surfaces'
import { COMMAND_MODIFIERS_COPY } from '../lib/platform'

/**
 * Workflows — "what has Noma learned that I actually do?"
 *
 * Deliberately not a new data model: pending suggestions come from the same
 * `useSuggestionsStore` Home's hero and Controls' `SuggestionsPanel` already
 * read, and already-added workflows come from the same `useLearnedActions`
 * Home's preview and Controls' list already read. This page's only job is
 * to give that existing lifecycle — Noma notices → you review → you add it
 * → it's yours to use — a place where the whole arc is visible at once,
 * as real objects rather than list rows. Nothing here is fabricated: an
 * empty section is shown as empty, never padded with example cards.
 */
export function Workflows() {
  const { suggestions, isLoading: suggestionsLoading, refresh, subscribe, resolve } = useSuggestionsStore()
  const learnedActions = useLearnedActions()
  const [selected, setSelected] = useState<LearnedAction | null>(null)
  const { enabled: flowEnabled, isLoading: flowLoading, refresh: refreshFlow, setEnabled: setFlowEnabled } =
    useWorkflowStore()

  useEffect(() => {
    refresh()
    void refreshFlow()
    const unsubscribe = subscribe()
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the open detail view in sync with the underlying list — a usage
  // count ticking up, or the workflow being edited away entirely from
  // inside the modal itself, both flow through here rather than freezing
  // the modal on stale data.
  useEffect(() => {
    if (!selected || !learnedActions) return
    const fresh = learnedActions.find((action) => action.macro.id === selected.macro.id)
    setSelected(fresh ?? null)
  }, [learnedActions, selected])

  const isLoading = suggestionsLoading || learnedActions === null
  const hasPending = suggestions.length > 0
  const hasLearned = (learnedActions?.length ?? 0) > 0

  return (
    <div className="mx-auto max-w-3xl px-12 py-16">
      <div className="mb-14">
        <h1 className="font-display text-2xl font-semibold text-neutral-100">Workflows</h1>
        <p className="mt-2 max-w-xl text-sm text-neutral-500">
          Flow notices shortcut sequences you repeat. You review the exact steps, then save one to a Glide zone so a
          single swipe runs it. Nothing is saved or run without you.
        </p>
      </div>

      {!flowLoading && !flowEnabled && (
        <div className={`mb-12 flex items-start justify-between gap-6 p-5 ${CARD}`}>
          <div>
            <p className="text-sm font-medium text-neutral-100">Flow is off, so Noma isn&apos;t noticing anything.</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-neutral-500">
              When on, Flow records which app is in front and which shortcuts you press that hold {COMMAND_MODIFIERS_COPY}.
              Never what you type, never screenshots. It all stays on this computer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void setFlowEnabled(true)}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
          >
            Turn on Flow
          </button>
        </div>
      )}

      {isLoading ? null : !hasPending && !hasLearned ? (
        // Case 1 — nothing at all: the page should read as active, not empty.
        flowEnabled && (
          <EmptyState
            title="Nothing noticed yet."
            hint="Keep working normally. Once you've repeated the same shortcut sequence about three times, it shows up here for you to review. Shortcuts that hold Ctrl, Alt or Win count; plain typing never does."
          />
        )
      ) : (
        <>
          <section className="mb-14">
            <h2 className="mb-1 font-display text-lg font-semibold text-neutral-100">Noma noticed</h2>
            <p className="mb-5 text-sm text-neutral-600">
              {hasPending
                ? 'Patterns Noma has detected, waiting on you.'
                : "Nothing new right now — you'll see it here the moment Noma notices something."}
            </p>
            {hasPending && (
              <div className="space-y-4">
                {suggestions.map((suggestion) => (
                  <NomaMoment
                    key={suggestion.id}
                    suggestion={suggestion}
                    variant="hero"
                    onReject={(id) => resolve(id, 'rejected')}
                    onDismiss={(id) => resolve(id, 'dismissed')}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-1 font-display text-lg font-semibold text-neutral-100">Your workflows</h2>
            <p className="mb-5 text-sm text-neutral-600">
              {hasLearned
                ? 'Click one to pause it, change its zone, or remove it.'
                : 'Workflows you save appear here, with the Glide zone that runs them.'}
            </p>
            {hasLearned ? (
              <div className="space-y-4">
                {(learnedActions ?? []).map((action) => (
                  <WorkflowCard key={action.macro.id} action={action} onSelect={() => setSelected(action)} />
                ))}
              </div>
            ) : (
              hasPending && (
                <p className="text-sm text-neutral-600">
                  Review what Noma noticed above to add your first one.
                </p>
              )
            )}
          </section>
        </>
      )}

      {selected && <WorkflowDetailModal action={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
