import { useState } from 'react'
import type { Control } from '@shared/types'
import type { LearnedAction } from '../lib/useLearnedActions'
import { WorkflowChain } from './WorkflowChain'
import { AppIcon } from './AppIcon'
import { ControlEditorModal } from './ControlEditorModal'
import { formatAbsoluteTime, formatRelativeTime } from '../lib/formatRelativeTime'
import { GLASS_PANEL, MODAL_SCRIM } from '../lib/surfaces'

/**
 * The Workflows page's detail view for an already-added workflow. Every
 * field here is read straight off `LearnedAction` — nothing invented.
 *
 * "Edit" and "remove" are deliberately not new affordances: a learned
 * workflow *is* a macro assigned to one or more controls, and the only real
 * way to change or clear that today is the same `ControlEditorModal` the
 * Controls page already uses (its "Reset to default" is the actual removal
 * path — there is no separate delete-this-workflow call). Reusing it here,
 * per control, is the honest option; inventing a one-click "remove workflow"
 * button would either silently pick one of several assignments to clear or
 * promise behavior (a clean multi-assignment delete) the backend doesn't have.
 */
export function WorkflowDetailModal({ action, onClose }: { action: LearnedAction; onClose: () => void }) {
  const { macro, chain, usageCount, applicationName, lastUsedAt, assignments } = action
  const [editingAssignment, setEditingAssignment] = useState<(typeof assignments)[number] | null>(null)

  const editingControl: Control | null = editingAssignment
    ? {
        id: editingAssignment.controlId,
        slot: editingAssignment.slot,
        label: editingAssignment.label,
        action: { type: 'macro', macroId: macro.id }
      }
    : null

  return (
    <div className={MODAL_SCRIM}>
      <div className={`w-full max-w-lg p-6 ${GLASS_PANEL}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-600">
              Created from a repeated workflow{applicationName ? ` · ${applicationName}` : ''}
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-neutral-100">{macro.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-sm text-neutral-500 hover:text-neutral-100">
            Close
          </button>
        </div>

        <div className="mt-6">
          <WorkflowChain steps={chain} size="lg" />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-base-700 py-4">
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-neutral-600">Used</dt>
            <dd className="mt-1 text-sm text-neutral-200">
              {usageCount} time{usageCount === 1 ? '' : 's'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-neutral-600">Last used</dt>
            <dd className="mt-1 text-sm text-neutral-200" title={lastUsedAt ? formatAbsoluteTime(lastUsedAt) : undefined}>
              {lastUsedAt ? formatRelativeTime(lastUsedAt) : 'Not yet'}
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <p className="mb-2.5 text-[10px] uppercase tracking-widest text-neutral-600">
            Assigned to {assignments.length} control{assignments.length === 1 ? '' : 's'}
          </p>
          <div className="space-y-1.5">
            {assignments.map((assignment) => (
              <div
                key={assignment.controlId}
                className="flex items-center justify-between gap-3 rounded-lg border border-base-700 bg-base-900 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <AppIcon applicationId={assignment.applicationId} name={assignment.applicationName} size={18} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-100">{assignment.applicationName}</p>
                    <p className="text-xs text-neutral-600">
                      Control {assignment.slot} · {assignment.label}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAssignment(assignment)}
                  className="shrink-0 text-xs text-accent hover:opacity-80"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editingControl && editingAssignment && (
        <ControlEditorModal
          applicationId={editingAssignment.applicationId}
          applicationName={editingAssignment.applicationName}
          slot={editingAssignment.slot}
          control={editingControl}
          onClose={() => setEditingAssignment(null)}
          onSaved={() => {
            setEditingAssignment(null)
            // The control this workflow was on may have just changed to
            // something else entirely (or reset to default) — closing the
            // whole detail view rather than showing now-stale assignment
            // data is the honest move; the Workflows page's own list
            // refreshes independently via useLearnedActions' subscription.
            onClose()
          }}
        />
      )}
    </div>
  )
}
