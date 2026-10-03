import { useEffect } from 'react'
import { useHoloStore } from '../stores/holoStore'
import { useFlowStore } from '../stores/flowStore'
import { HoloTrackpadPanel } from '../components/HoloTrackpadPanel'
import { AppIcon } from '../components/AppIcon'

export function Holo() {
  const { inputSource, error, refresh, stopListening } = useHoloStore()
  const { context, refresh: refreshContext, subscribeToContext } = useFlowStore()

  useEffect(() => {
    void refresh()
    refreshContext()
    return subscribeToContext()
  }, [refresh, refreshContext, subscribeToContext])

  // Holo exists to work while the user is in *other* apps, so it stays on
  // after leaving this page when Holo is the chosen Input Source. As a
  // test-only session (Input Source = Keyboard) it stops on leave.
  useEffect(
    () => () => {
      if (useHoloStore.getState().inputSource !== 'holo') stopListening()
    },
    [stopListening]
  )

  return (
    <div className="mx-auto max-w-3xl px-10 py-10">
      <div className="mb-8">
        <h1 className="font-display text-xl font-semibold text-neutral-100">Holo</h1>
        <p className="mt-1 max-w-xl text-sm text-neutral-600">
          No physical keyboard needed. Swipe a finger onto your trackpad from the empty space beside it, and Noma
          presses the control for that side, exactly as if a real button were pressed. Free, and keeps working in the
          background while Holo is your chosen input (Settings).
        </p>
      </div>

      {inputSource !== 'holo' && (
        <div className="mb-6 rounded-lg border border-base-700 bg-base-900 px-4 py-3 text-xs text-neutral-600">
          Input Source is currently <span className="text-neutral-100">Keyboard</span>. Holo still works here for
          testing, but stops when you leave this page until you switch Input Source to Holo in Settings.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2.5 text-sm text-neutral-600">
        {context.application && (
          <AppIcon applicationId={context.application.id} name={context.application.name} size={22} variant="tile" />
        )}
        {context.application ? (
          <span>
            Controls for <span className="text-neutral-100">{context.application.name}</span>
          </span>
        ) : (
          'No application detected'
        )}
      </div>

      {/* Holo's own self-contained dark surface — "a piece of Noma hardware
          translated into software," deliberately not the app's light canvas. */}
      <HoloTrackpadPanel controls={context.profile?.controls ?? []} />
    </div>
  )
}
