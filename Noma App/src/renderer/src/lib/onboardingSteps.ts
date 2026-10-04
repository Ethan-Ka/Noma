import type { OnboardingStepId } from '@shared/types'

/** The fixed screen order — see Onboarding.tsx. */
export const ONBOARDING_STEPS: OnboardingStepId[] = ['welcome', 'glide', 'flow', 'firstAction']

/** Resolves a persisted step id to its index, defaulting to Welcome for an
 *  unrecognized or missing value (including an older build's step names)
 *  rather than throwing. */
export function stepIndexOf(step: OnboardingStepId | string | undefined): number {
  const index = step ? ONBOARDING_STEPS.indexOf(step as OnboardingStepId) : -1
  return index === -1 ? 0 : index
}
