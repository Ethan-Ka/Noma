import { useEffect } from 'react'
import { AppShell } from './components/AppShell'
import { Home } from './pages/Home'
import { Controls } from './pages/Controls'
import { Workflows } from './pages/Workflows'
import { Demo } from './pages/Demo'
import { VirtualKeyboard } from './pages/VirtualKeyboard'
import { Holo } from './pages/Holo'
import { MacroStudio } from './pages/MacroStudio'
import { Learning } from './pages/Learning'
import { Activity } from './pages/Activity'
import { UsageStats } from './pages/UsageStats'
import { Profiles } from './pages/Profiles'
import { Settings } from './pages/Settings'
import { Developer } from './pages/Developer'
import { Onboarding } from './pages/Onboarding'
import { useUiStore } from './stores/uiStore'
import { useOnboardingStore } from './stores/onboardingStore'
import { useHoloStore } from './stores/holoStore'

function App() {
  const activePage = useUiStore((state) => state.activePage)
  const setActivePage = useUiStore((state) => state.setActivePage)
  const onboardingState = useOnboardingStore((state) => state.state)
  const isOnboardingLoading = useOnboardingStore((state) => state.isLoading)
  const loadOnboardingState = useOnboardingStore((state) => state.load)

  useEffect(() => {
    loadOnboardingState()
  }, [loadOnboardingState])

  // Noma Notice's "Review" finishes here: accepting a workflow ends in
  // picking a control slot, which the floating card is deliberately too
  // small to ask for. Workflows — not Home — is where the user lands: Home
  // only ever shows a single "most important" suggestion (`suggestions[0]`),
  // so the one just reviewed could easily not be it and effectively
  // disappear. Workflows' "Noma noticed" section lists every pending
  // suggestion, so the reviewed one is guaranteed to actually be there.
  useEffect(() => window.flow.onOpenSuggestionInApp(() => setActivePage('workflows')), [setActivePage])

  // Holo's trackpad corners carry on from the last run, without the Holo
  // page having to be opened first. Desk taps never auto-start: they open
  // the microphone, which only ever happens on an explicit click.
  useEffect(() => {
    void useHoloStore.getState().resumeTrackpad()
  }, [])

  // Blank instead of a spinner while the very first IPC round-trip is in
  // flight — same background as every other state below, so there's no
  // visible flash before we know whether to show onboarding or the app.
  if (isOnboardingLoading || !onboardingState) {
    return <div className="h-screen w-screen bg-base-950" />
  }

  // Onboarding replaces the whole app shell (no sidebar, no normal
  // navigation) until it's completed — never shown again after that on a
  // normal launch, since `completed` is persisted (see onboardingStore).
  if (!onboardingState.completed) {
    return <Onboarding />
  }

  return (
    <AppShell>
      {activePage === 'home' && <Home />}
      {activePage === 'controls' && <Controls />}
      {activePage === 'workflows' && <Workflows />}
      {activePage === 'learning' && <Learning />}
      {activePage === 'activity' && <Activity />}
      {activePage === 'settings' && <Settings />}
      {activePage === 'demo' && <Demo />}
      {activePage === 'virtual-keyboard' && <VirtualKeyboard />}
      {activePage === 'holo' && <Holo />}
      {activePage === 'macros' && <MacroStudio />}
      {activePage === 'usage-stats' && <UsageStats />}
      {activePage === 'profiles' && <Profiles />}
      {activePage === 'developer' && <Developer />}
    </AppShell>
  )
}

export default App
