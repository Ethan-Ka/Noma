import { GLIDE_ZONE_SLOTS } from '@shared/constants'
import type { ApplicationContext, Control, GlideOutcome, HoloTrackpadZone } from '@shared/types'

/** Everything that decides what one swipe-in may do. */
export interface GlidePressInput {
  zone: HoloTrackpadZone
  /** The app Noma would act on (Noma's own window is never it). */
  context: ApplicationContext
  /** Noma's own window is in front. */
  nomaFocused: boolean
  /** A touch check is recording. */
  touchCheckRunning: boolean
  /** Another action is still running. */
  actionRunning: boolean
}

export interface GlidePressDecision {
  outcome: GlideOutcome
  slot: number
  /** The control to press; only set when `outcome` is 'pressed'. */
  control?: Control
}

/** A slot with nothing configured on it: a fresh profile's "SLOT n", whose
 *  empty shortcut would only fail. */
export function isEmptyControl(control: Control): boolean {
  return control.action.type === 'shortcut' && control.action.keys.length === 0
}

/**
 * What a recognised swipe-in does. Only presses when the target is
 * unambiguous: a real app is behind the press, it has a configured control
 * on this zone's slot, and the user is looking at that app rather than at
 * Noma. With Noma in front the "current app" is whatever was behind it,
 * out of sight, so a swipe there is practice, not a press.
 */
export function resolveGlidePress(input: GlidePressInput): GlidePressDecision {
  const slot = GLIDE_ZONE_SLOTS[input.zone]
  if (input.touchCheckRunning) return { outcome: 'paused', slot }
  if (input.nomaFocused) return { outcome: 'practice', slot }
  if (!input.context.application) return { outcome: 'no-app', slot }
  const control = input.context.profile?.controls.find((item) => item.slot === slot)
  if (!control || isEmptyControl(control)) return { outcome: 'no-control', slot }
  if (input.actionRunning) return { outcome: 'busy', slot }
  return { outcome: 'pressed', slot, control }
}
