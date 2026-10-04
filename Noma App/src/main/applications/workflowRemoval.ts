import { getDatabase } from '../database/db'
import { deleteMacro, getMacroById } from '../database/repositories/macrosRepository'
import { assignControlAction, getControlsReferencingMacro } from '../database/repositories/controlsRepository'
import { getProfileForApplicationId } from '../database/repositories/profileRepository'
import { getSeedDefaultControl } from '../database/seed'

/**
 * Removes a saved workflow: every control it sits on goes back to what it
 * was before (the starter control for a seeded app, otherwise an empty
 * slot), then the workflow itself is deleted. One transaction, so a control
 * can never be left pointing at a workflow that no longer exists.
 *
 * Returns the applications whose controls changed (so the caller can push a
 * live update), or null when there is no such workflow.
 */
export function removeLearnedWorkflow(macroId: string): { applicationIds: string[] } | null {
  if (!getMacroById(macroId)) return null
  const referencing = getControlsReferencingMacro(macroId)

  const remove = getDatabase().transaction(() => {
    for (const control of referencing) {
      const profile = getProfileForApplicationId(control.applicationId)
      if (!profile) continue
      const seed = getSeedDefaultControl(control.applicationId, control.slot)
      if (seed) assignControlAction(profile.id, control.slot, seed.label, seed.action)
      else assignControlAction(profile.id, control.slot, `SLOT ${control.slot}`, { type: 'shortcut', keys: [] })
    }
    deleteMacro(macroId)
  })
  remove()

  return { applicationIds: [...new Set(referencing.map((control) => control.applicationId))] }
}
