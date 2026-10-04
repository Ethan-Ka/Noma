import { useEffect, useState } from 'react'
import type { Application, ControlUsageStat, Macro } from '@shared/types'
import { DEMO_MACRO_TRIGGER, LEARNED_MACRO_TRIGGER } from '@shared/constants'
import { macroChainSteps, type WorkflowChainStep } from './workflowChain'
import { useSuggestionsStore } from '../stores/suggestionsStore'

export interface LearnedActionAssignment {
  controlId: string
  applicationId: string
  applicationName: string
  slot: number
  label: string
}

export interface LearnedAction {
  macro: Macro
  chain: WorkflowChainStep[]
  usageCount: number
  applicationId: string | null
  applicationName: string | null
  /** Most recent press across every control this macro is assigned to, or
   *  null if it has never been pressed yet — real data only, never a guess. */
  lastUsedAt: number | null
  /** Every control (across every app profile) this macro is currently
   *  assigned to — the Workflows detail view's "Assigned to" list, and the
   *  only real way to edit or remove a learned workflow (see
   *  `ControlEditorModal`; there is no separate delete-macro affordance). */
  assignments: LearnedActionAssignment[]
}

/**
 * Every macro Noma has actually learned from a repeated workflow (as
 * opposed to a hand-configured one), with the real usage count and
 * application context needed to render a `LearnedActionCard`. Shared by
 * Home (the most recent few, as a preview) and Controls (the full list) —
 * both need the exact same real data, just a different amount of it.
 */
export function useLearnedActions(): LearnedAction[] | null {
  const [learnedActions, setLearnedActions] = useState<LearnedAction[] | null>(null)
  const workflowsVersion = useSuggestionsStore((state) => state.workflowsVersion)

  useEffect(() => {
    const load = async (): Promise<void> => {
      const [macros, applications, usageStats] = await Promise.all([
        window.flow.getMacros(),
        window.flow.getAllApplications(),
        window.flow.getControlUsageStats()
      ])

      const applicationNames = Object.fromEntries(applications.map((app: Application) => [app.id, app.name]))
      const usageByControlId = new Map<string, ControlUsageStat>(usageStats.map((stat) => [stat.controlId, stat]))

      const learned = macros.filter(
        (macro) => macro.trigger === LEARNED_MACRO_TRIGGER || macro.trigger === DEMO_MACRO_TRIGGER
      )
      const withContext = await Promise.all(
        learned.map(async (macro): Promise<LearnedAction> => {
          const referencing = await window.flow.getControlsReferencingMacro(macro.id)
          const usageCount = referencing.reduce(
            (sum, ref) => sum + (usageByControlId.get(ref.controlId)?.count ?? 0),
            0
          )
          const lastUsedTimes = referencing
            .map((ref) => usageByControlId.get(ref.controlId)?.lastUsed)
            .filter((value): value is number => value !== undefined)
          return {
            macro,
            chain: macroChainSteps(macro.actions, applicationNames),
            usageCount,
            applicationId: referencing[0]?.applicationId ?? null,
            applicationName: referencing[0]?.applicationName ?? null,
            lastUsedAt: lastUsedTimes.length ? Math.max(...lastUsedTimes) : null,
            assignments: referencing
          }
        })
      )

      setLearnedActions(withContext)
    }

    void load()
    const unsubscribe = window.flow.onSuggestionsChanged(() => void load())
    return unsubscribe
  }, [workflowsVersion])

  return learnedActions
}
