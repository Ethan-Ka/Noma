import { useState } from 'react'
import { useOnboardingStore } from '../stores/onboardingStore'
import { useUiStore } from '../stores/uiStore'
import { ONBOARDING_STEPS, stepIndexOf } from '../lib/onboardingSteps'
import { OnboardingLayout } from '../components/OnboardingLayout'
import { OnboardingStepTransition } from '../components/OnboardingStepTransition'
import { OnboardingWelcomeScreen } from '../components/OnboardingWelcomeScreen'
import { OnboardingGlideScreen } from '../components/OnboardingGlideScreen'
import { OnboardingFlowScreen } from '../components/OnboardingFlowScreen'
import { OnboardingFirstActionScreen } from '../components/OnboardingFirstActionScreen'

/**
 * First run, four short screens: what Noma is, try Glide, decide about
 * Flow, run one real action. Progress is saved on every step, so quitting
 * part-way resumes where you left off. Rendered by App.tsx instead of the
 * app shell until it's finished.
 */
export function Onboarding() {
  const persistedState = useOnboardingStore((state) => state.state)
  const save = useOnboardingStore((state) => state.save)
  const setActivePage = useUiStore((state) => state.setActivePage)
  const [stepIndex, setStepIndex] = useState(() => stepIndexOf(persistedState?.step))
  const currentStep = ONBOARDING_STEPS[stepIndex]

  function goTo(index: number, update?: Parameters<typeof save>[0]): void {
    const clamped = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, index))
    setStepIndex(clamped)
    void save({ ...update, step: ONBOARDING_STEPS[clamped] })
  }

  return (
    <OnboardingLayout
      stepIndex={stepIndex}
      onBack={stepIndex > 0 ? () => goTo(stepIndex - 1) : undefined}
      wide={currentStep === 'glide' || currentStep === 'firstAction'}
    >
      <OnboardingStepTransition stepKey={currentStep}>
        {currentStep === 'welcome' && <OnboardingWelcomeScreen onContinue={() => goTo(1)} />}

        {currentStep === 'glide' && <OnboardingGlideScreen onContinue={() => goTo(2)} />}

        {currentStep === 'flow' && (
          <OnboardingFlowScreen
            onEnable={async () => {
              // The same switch Settings shows; no second capture system.
              await window.flow.setWorkflowMonitoringEnabled(true)
              goTo(3, { flowEnabled: true })
            }}
            onSkip={() => goTo(3, { flowEnabled: false })}
          />
        )}

        {currentStep === 'firstAction' && (
          <OnboardingFirstActionScreen
            onFinish={async () => {
              await save({ completed: true, step: 'firstAction' })
              setActivePage('home')
            }}
          />
        )}
      </OnboardingStepTransition>
    </OnboardingLayout>
  )
}
