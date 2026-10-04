import { OnboardingButton } from './OnboardingButton'
import { COMMAND_MODIFIERS_COPY } from '../lib/platform'

const SEES = [
  'Which app is in front',
  `Shortcuts that hold ${COMMAND_MODIFIERS_COPY}`,
  'Which Noma actions you run',
  'When each of those happened'
]

const NEVER = ['What you type', 'Passwords or messages', 'Screenshots or the screen', 'Clipboard contents']

interface OnboardingFlowScreenProps {
  onEnable: () => void
  onSkip: () => void
}

/**
 * Screen 3: Flow, and exactly what it records, before asking. Every claim
 * matches the code: capture is modifier-gated (workflow/captureFilter.ts),
 * everything is local SQLite with no network calls, and the switch is the
 * same one Settings shows.
 */
export function OnboardingFlowScreen({ onEnable, onSkip }: OnboardingFlowScreenProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="font-display text-3xl font-semibold text-neutral-50">Let Noma notice your repeats</h1>
      <p className="mt-3 max-w-md text-sm text-neutral-400">
        When you do the same shortcut sequence a few times, like bookmark then close tab, Flow offers to turn it into a
        Glide action. You see every step before anything is saved, and it never runs on its own.
      </p>

      <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-6 rounded-xl border border-base-700 bg-base-900 px-5 py-4 text-left">
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">Flow records</div>
          <ul className="space-y-1.5 text-xs text-neutral-300">
            {SEES.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-accent" aria-hidden>
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">Never</div>
          <ul className="space-y-1.5 text-xs text-neutral-400">
            {NEVER.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-neutral-500" aria-hidden>
                  ✕
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 max-w-md text-xs text-neutral-500">
        It all stays in a file on this computer. Pause Flow or clear what it learned any time in Settings.
      </p>

      <div className="mt-10 flex items-center gap-6">
        <OnboardingButton variant="secondary" onClick={onSkip}>
          Not now
        </OnboardingButton>
        <OnboardingButton onClick={onEnable}>Turn on Flow</OnboardingButton>
      </div>
    </div>
  )
}
