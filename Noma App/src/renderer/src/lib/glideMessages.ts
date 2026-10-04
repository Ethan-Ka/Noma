import { GLIDE_ZONE_LABELS } from '@shared/constants'
import type { GlideActivity, GlideState, HoloTrackpadZoneCount } from '@shared/types'

/** What the last swipe-in came to, in one plain sentence. */
export function glideActivityMessage(activity: GlideActivity, zoneCount: HoloTrackpadZoneCount): string {
  const zone = GLIDE_ZONE_LABELS[zoneCount][activity.zone]
  if (activity.type === 'miss') {
    switch (activity.reason) {
      case 'too-slow':
        return `${zone}: not counted. That was slow, like moving the pointer. Flick in quickly.`
      case 'not-sideways':
        return `${zone}: not counted. That went up or down more than across. Swipe straight in.`
      case 'second-finger':
        return `${zone}: not counted. A second finger touched the trackpad.`
      case 'palm':
        return `${zone}: not counted. The trackpad flagged that touch as a palm.`
      case 'typing':
        return `${zone}: not counted. You were typing; Glide waits until you've stopped for a moment.`
      case 'click':
        return `${zone}: not counted. The trackpad was pressed down (a click).`
    }
  }
  const action = activity.controlLabel ? `“${activity.controlLabel}”` : 'this zone'
  const app = activity.applicationName ?? 'the app'
  switch (activity.outcome) {
    case 'pressed':
      return `${zone}: ran ${action} in ${app}.`
    case 'practice':
      return `${zone}: recognised. Practice only while Noma is in front; switch to another app to run ${action}.`
    case 'no-app':
      return `${zone}: recognised, but Noma doesn't know which app you're in, so nothing ran.`
    case 'no-control':
      return `${zone}: recognised, but nothing is set on this zone in ${app}.`
    case 'busy':
      return `${zone}: recognised, but another action was still running, so this one was skipped.`
    case 'paused':
      return `${zone}: recognised during the touch check, so nothing ran.`
  }
}

/** Glide's status in a few words, for the page header and Home. */
export function glideStatusLine(state: GlideState | null): { tone: 'on' | 'off' | 'problem'; text: string } {
  if (!state) return { tone: 'off', text: 'Checking…' }
  if (!state.platformSupported) return { tone: 'problem', text: 'Not available on this computer (Windows only for now)' }
  if (state.error) return { tone: 'problem', text: state.error }
  if (!state.enabled) return { tone: 'off', text: 'Off' }
  const pads = state.touchpads === 1 ? 'your trackpad' : `${state.touchpads ?? 0} touchpads`
  return { tone: 'on', text: `On, watching ${pads}` }
}
