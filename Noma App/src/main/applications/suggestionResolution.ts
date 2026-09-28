import type { ApplicationProfile, MacroStep, Suggestion, WorkflowStep } from '@shared/types'
import { getProfileForApplicationId } from '../database/repositories/profileRepository'
import { assignControlAction, toDisplayLabel } from '../database/repositories/controlsRepository'
import { createMacro } from '../database/repositories/macrosRepository'
import { getSuggestionById, resolveSuggestion } from '../database/repositories/suggestionsRepository'
import { describeStep } from '../workflow/patternDetection'

/**
 * Accepts a suggestion by writing its action onto a control slot the user
 * explicitly picked — the only place a suggestion actually changes a
 * profile. Deliberately conservative: never called automatically, never
 * picks a slot itself, and fails closed (returns null) rather than
 * guessing when the suggestion, its application's profile, or the
 * requested slot doesn't check out.
 */
export function assignSuggestionToControl(
  suggestionId: string,
  slot: number
): { suggestion: Suggestion; profile: ApplicationProfile } | null {
  const suggestion = getSuggestionById(suggestionId)
  if (!suggestion || suggestion.status !== 'pending') return null
  if (!suggestion.applicationId || !suggestion.action) return null

  const profile = getProfileForApplicationId(suggestion.applicationId)
  if (!profile) return null

  const targetControl = profile.controls.find((control) => control.slot === slot)
  if (!targetControl) return null

  const { label, action } = buildControlUpdate(suggestion)
  const applied = assignControlAction(profile.id, slot, label, action)
  if (!applied) return null

  const resolved = resolveSuggestion(suggestionId, 'accepted')
  const updatedProfile = getProfileForApplicationId(suggestion.applicationId)
  if (!resolved || !updatedProfile) return null

  return { suggestion: resolved, profile: updatedProfile }
}

function buildControlUpdate(
  suggestion: Suggestion
): { label: string; action: import('@shared/types').ControlAction } {
  const action = suggestion.action
  if (!action) {
    throw new Error('buildControlUpdate called with a suggestion that has no action')
  }

  switch (action.kind) {
    case 'assignShortcutToControl':
      return {
        label: toDisplayLabel(action.comboKeys.join('+')),
        action: { type: 'shortcut', keys: action.comboKeys }
      }

    case 'createMacroAndAssignToControl': {
      const macro = createMacro({
        name: action.sequence.join(' → '),
        applicationId: suggestion.applicationId ?? undefined,
        trigger: 'flow-control',
        // A detected sequence is combo strings like 'Control+C' — convert
        // each into a proper shortcut step (Macro.actions is MacroStep[],
        // not the raw string[] a repeated-sequence pattern produces).
        actions: action.sequence.map((combo) => ({ type: 'shortcut' as const, keys: combo.split('+') })),
        delayMs: 0,
        enabled: true
      })
      return {
        label: toDisplayLabel(macro.name),
        action: { type: 'macro', macroId: macro.id }
      }
    }

    // WORKFLOW LEARNING: turns a detected chain (crossAppWorkflow or
    // multiStepWorkflow) into a real macro — see buildWorkflowMacroSteps.
    case 'createWorkflowMacroAndAssignToControl': {
      const macro = createMacro({
        name: action.steps.map(describeStep).join(' → '),
        applicationId: suggestion.applicationId ?? undefined,
        trigger: 'flow-control',
        actions: buildWorkflowMacroSteps(action.steps, action.stepDelaysMs),
        delayMs: 0,
        enabled: true
      })
      return {
        label: toDisplayLabel(macro.name),
        action: { type: 'macro', macroId: macro.id }
      }
    }
  }
}

/** A chain the same shortcut a paste uses, by combo — kept as a constant
 *  rather than reaching for shortcutDisplayLabel's "Paste" copy, which is
 *  presentation text, not something execution logic should pattern-match
 *  against. */
const PASTE_COMBO = 'Control+V'

function isPasteShortcut(step: WorkflowStep): boolean {
  return step.type === 'shortcut' && step.comboKeys.join('+') === PASTE_COMBO
}

/**
 * A detected workflow chain often ends by switching back to where it
 * started (the "...and switches back" tail in the product's own flagship
 * example) — that's what the workflow *leads to*, not part of *doing* it,
 * so it's dropped from the executable macro. Same "the closing step is
 * informational, not executable" rule `crossAppWorkflow` already follows
 * for its own trailing step.
 */
function trimTrailingAppSwitches(steps: WorkflowStep[]): WorkflowStep[] {
  let end = steps.length
  while (end > 0 && steps[end - 1].type === 'appSwitch') end -= 1
  return steps.slice(0, end)
}

/**
 * A replayed delay is capped well under the detection window
 * (WORKFLOW_STEP_WINDOW_MS, 20s) on purpose: a macro's whole promise is
 * "one press instead of the full sequence," and baking in a pause as long
 * as the original, occasionally-distracted gap between two steps would
 * undermine that. Below this, a real observed gap is honored as-is.
 */
const MAX_REPLAY_DELAY_MS = 2000
/** Below this, `executeMacroSteps`' own natural pacing (80ms between
 *  ordinary steps, 200ms after a focus change) already covers it — not
 *  worth a separate explicit `delay` step for a gap this small. */
const MIN_REPLAY_DELAY_MS = 300

/**
 * Converts a detected workflow's steps into a real, executable macro:
 * `shortcut` steps pass straight through, a `click` step passes through
 * unchanged too (see actionExecutor.ts's click.ts for how it actually
 * executes — only a `zone:` target does, today), an `appSwitch` becomes a
 * `focusApplication` step (see that ControlAction variant's doc comment in
 * shared/types for why "focus an existing window" is the safe capability
 * here, not `launchApplication`), a trailing "switched back" tail is
 * dropped (see trimTrailingAppSwitches), and a chain ending in a paste gets
 * a submit keystroke appended — reproducing the flagship "screenshot ->
 * paste -> submit" shape generically, without hardcoding any one
 * application (STEP 7: this has to generalize beyond Claude Code).
 *
 * `stepDelaysMs`, when given, is the real gap observed before each step in
 * the ORIGINAL (untrimmed) `steps` — a `delay` MacroStep is inserted ahead
 * of the corresponding action so pressing the resulting control reproduces
 * roughly the pace the user actually worked at, clamped to
 * MIN_REPLAY_DELAY_MS..MAX_REPLAY_DELAY_MS. Absent entirely for a
 * suggestion built before this existed — no delay steps then, same as
 * before.
 */
function buildWorkflowMacroSteps(steps: WorkflowStep[], stepDelaysMs?: number[]): MacroStep[] {
  const core = trimTrailingAppSwitches(steps)
  const macroSteps: MacroStep[] = []

  core.forEach((step, index) => {
    // stepDelaysMs[0] is always a placeholder (nothing precedes the first
    // step) — never insert a delay ahead of the macro's own first action.
    if (index > 0) {
      const delayMs = stepDelaysMs?.[index]
      if (delayMs !== undefined && delayMs >= MIN_REPLAY_DELAY_MS) {
        macroSteps.push({ type: 'delay', ms: Math.min(delayMs, MAX_REPLAY_DELAY_MS) })
      }
    }

    switch (step.type) {
      case 'shortcut':
        macroSteps.push({ type: 'shortcut', keys: step.comboKeys })
        break
      case 'click':
        macroSteps.push({
          type: 'click',
          target: step.target,
          ...(step.applicationId ? { applicationId: step.applicationId } : {})
        })
        break
      case 'appSwitch':
        macroSteps.push({ type: 'focusApplication', applicationId: step.applicationId ?? '' })
        break
    }
  })

  const lastStep = core[core.length - 1]
  if (lastStep && isPasteShortcut(lastStep)) {
    macroSteps.push({ type: 'shortcut', keys: ['Enter'] })
  }

  return macroSteps
}
