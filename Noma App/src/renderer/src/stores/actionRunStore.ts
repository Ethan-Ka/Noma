import { create } from 'zustand'
import type { ActionExecutionEvent, ActionRunState } from '@shared/types'

/**
 * What's running right now (any control press or editor Test), and how the
 * last press ended. Fed by main pushes, so it's right whichever page is
 * open; the app shell's running bar and Home's first-action check read it.
 */
interface ActionRunStoreState {
  run: ActionRunState
  lastResult: (ActionExecutionEvent & { at: number }) | null
  /** Successful control presses seen since the app started. */
  successCount: number
}

export const useActionRunStore = create<ActionRunStoreState>(() => ({
  run: { running: false },
  lastResult: null,
  successCount: 0
}))

const unsubscribers =
  typeof window !== 'undefined' && window.flow
    ? [
        window.flow.onActionRunState((run) => useActionRunStore.setState({ run })),
        window.flow.onActionExecuted((event) =>
          useActionRunStore.setState((state) => ({
            lastResult: { ...event, at: Date.now() },
            successCount: state.successCount + (event.ok ? 1 : 0)
          }))
        )
      ]
    : []

if (typeof window !== 'undefined' && window.flow) {
  void window.flow.getActionRunState().then((run) => useActionRunStore.setState({ run }))
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const unsubscribe of unsubscribers) unsubscribe()
  })
}
