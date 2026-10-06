import logo from '../assets/logo.png'
import { OnboardingButton } from './OnboardingButton'
import { BetaBadge } from './BetaBadge'
import { IS_BETA } from '@shared/constants'

interface OnboardingWelcomeScreenProps {
  onContinue: () => void
}

/** Screen 1: what Noma is, in two sentences, and one button. */
export function OnboardingWelcomeScreen({ onContinue }: OnboardingWelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <img src={logo} alt="" className="mb-6 h-9 w-14" />
      <div className="mb-5 flex items-center gap-2.5">
        <span className="font-display text-xs font-medium uppercase tracking-[0.4em] text-neutral-500">Noma</span>
        <BetaBadge />
      </div>
      <h1 className="font-display text-4xl font-semibold leading-tight text-neutral-50 sm:text-5xl">
        Your next action, one swipe away.
      </h1>
      <p className="mt-6 max-w-md text-base text-neutral-400">
        Noma gives every app four actions you run by sliding a finger onto your trackpad. As you work, it notices the
        shortcut sequences you repeat and offers to turn them into one of those actions.
      </p>
      <div className="mt-10">
        <OnboardingButton onClick={onContinue}>Get started</OnboardingButton>
      </div>
      <p className="mt-5 text-xs text-neutral-500">About a minute. No account, no extra hardware.</p>
      {IS_BETA && (
        <p className="mt-2 text-xs text-neutral-500">This is a beta, so some things may change before the final release.</p>
      )}
    </div>
  )
}
