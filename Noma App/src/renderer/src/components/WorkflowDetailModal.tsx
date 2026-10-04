import { useState } from 'react'
import type { Control } from '@shared/types'
import { DEMO_MACRO_TRIGGER, GLIDE_ZONE_LABELS, glideZoneForSlot } from '@shared/constants'
import type { LearnedAction } from '../lib/useLearnedActions'
import { WorkflowChain } from './WorkflowChain'
import { AppIcon } from './AppIcon'
import { ToggleSwitch } from './ToggleSwitch'
import { ControlEditorModal } from './ControlEditorModal'
import { formatAbsoluteTime, formatRelativeTime } from '../lib/formatRelativeTime'
import { GLASS_PANEL, MODAL_SCRIM } from '../lib/surfaces'
import { useGlideStore } from '../stores/glideStore'
import { useSuggestionsStore } from '../stores/suggestionsStore'

/** "Upper left zone" (or "Control 3" when two-zone Glide can't reach it). */
export function zoneNameForSlot(slot: number, zoneCount: 2 | 4): string {
  const zone = glideZoneForSlot(slot, zoneCount)
  return zone ? `${GLIDE_ZONE_LABELS[zoneCount][zone]} zone` : `Control ${slot} (no swipe with two zones)`
}

/**
 * A saved workflow: what it does, where it lives (which Glide zone in which
 * app), and the three things you can do with it: pause it, change which
 * zone runs something, or remove it. Removing puts every zone it was on
 * back to what it was before (the app's starter action, or empty).
 */
export function WorkflowDetailModal({ action, onClose }: { action: LearnedAction; onClose: () => void }) {
  const { macro, chain, usageCount, applicationName, lastUsedAt, assignments } = action
  const [editingAssignment, setEditingAssignment] = useState<(typeof assignments)[number] | null>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const zoneCount = useGlideStore((state) => state.state?.zoneCount ?? 4)
  const workflowsChanged = useSuggestionsStore((state) => state.workflowsChanged)
  const isDemo = macro.trigger === DEMO_MACRO_TRIGGER

  const editingControl: Control | null = editingAssignment
    ? {
        id: editingAssignment.controlId,
        slot: editingAssignment.slot,
        label: editingAssignment.label,
        action: { type: 'macro', macroId: macro.id }
      }
    : null

  const setEnabled = async (enabled: boolean): Promise<void> => {
    setBusy(true)
    setError(null)
    const updated = await window.flow.updateMacro(macro.id, { enabled })
    setBusy(false)
    if (!updated) setError('Couldn’t change it. It may have been removed.')
    workflowsChanged()
  }

  const remove = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const removed = await window.flow.removeWorkflow(macro.id)
    setBusy(false)
    if (!removed) {
      setError('Couldn’t remove it. It may already be gone.')
      return
    }
    workflowsChanged()
    onClose()
  }

  return (
    <div className={MODAL_SCRIM} role="dialog" aria-modal="true" aria-labelledby="workflow-detail-title">
      <div className={`max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 ${GLASS_PANEL}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">
              {isDemo ? 'Demo workflow (simulated, not learned from you)' : 'Saved from a workflow Noma noticed'}
              {applicationName ? ` · ${applicationName}` : ''}
            </p>
            <h2 id="workflow-detail-title" className="mt-1 font-display text-xl font-semibold text-neutral-100">
              {macro.name}
            </h2>
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
            <dt className="text-[10px] uppercase tracking-widest text-neutral-500">Used</dt>
            <dd className="mt-1 text-sm text-neutral-200">
              {usageCount} time{usageCount === 1 ? '' : 's'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-neutral-500">Last used</dt>
            <dd className="mt-1 text-sm text-neutral-200" title={lastUsedAt ? formatAbsoluteTime(lastUsedAt) : undefined}>
              {lastUsedAt ? formatRelativeTime(lastUsedAt) : 'Not yet'}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-100">{macro.enabled ? 'Active' : 'Paused'}</p>
            <p className="text-xs text-neutral-500">
              {macro.enabled ? 'Runs when you swipe its zone.' : 'Swiping its zone does nothing until you resume it.'}
            </p>
          </div>
          <ToggleSwitch checked={macro.enabled} onChange={(checked) => void setEnabled(checked)} label="Workflow active" />
        </div>

        <div className="mt-5">
          <p className="mb-2.5 text-[10px] uppercase tracking-widest text-neutral-500">
            {assignments.length === 0 ? 'Not on any zone' : 'Runs from'}
          </p>
          {assignments.length === 0 ? (
            <p className="text-xs text-neutral-500">
              Nothing runs it right now. Put it on a zone from the Glide page (choose “Saved workflow”).
            </p>
          ) : (
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
                      <p className="text-xs text-neutral-500">
                        {zoneNameForSlot(assignment.slot, zoneCount)} · shows as “{assignment.label}”
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingAssignment(assignment)}
                    className="shrink-0 text-xs text-accent hover:opacity-80"
                  >
                    Change
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-xs text-error">{error}</p>}

        <div className="mt-6 border-t border-base-700 pt-4">
          {confirmingRemove ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-neutral-400">
                Remove “{macro.name}”? {assignments.length > 0 ? 'Its zones go back to what they were before.' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-100"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                  className="rounded-md border border-error/50 bg-error-muted px-3 py-1.5 text-xs font-medium text-neutral-100 hover:border-error disabled:opacity-50"
                >
                  Remove workflow
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className="text-xs text-neutral-500 hover:text-error"
            >
              Remove this workflow…
            </button>
          )}
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
            workflowsChanged()
            // The zone may now run something else entirely, so the
            // assignment list above is stale; close rather than show it.
            onClose()
          }}
        />
      )}
    </div>
  )
}
