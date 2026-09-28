/**
 * Distinguishes a real user click from Flow's own synthetic one — the click
 * counterpart to selfInjectedKeys.ts, same reason: click.ts's executeClick()
 * calls SendInput to actually fire a mouse-down/up, and clickCaptureService.ts
 * watches the same OS-level mouse hook that synthetic click also fires
 * through. Without this, a macro's own click step would immediately get
 * captured as if the user had clicked it, manufacturing a fake repeated
 * pattern purely from Flow replaying its own workflow.
 *
 * Simpler than the keyed version: a click has no "combo" identity to match,
 * so this is just a short-lived flag rather than a list of pending entries —
 * markSelfInjectedClick() is called immediately before SendInput, and the
 * very next mousedown the hook sees within the TTL is assumed to be it.
 */

const SUPPRESS_MS = 500

let suppressUntil = 0

/** Call immediately before firing a synthetic click via SendInput. */
export function markSelfInjectedClick(): void {
  suppressUntil = Date.now() + SUPPRESS_MS
}

/** Reports whether a mousedown right now is (most likely) Flow's own
 *  synthetic click, and consumes the mark so a genuine next click isn't
 *  also swallowed. */
export function isSelfInjectedClick(): boolean {
  if (Date.now() > suppressUntil) return false
  suppressUntil = 0
  return true
}

/** Test-only: resets state between tests. */
export function __resetSelfInjectedClickGuardForTesting(): void {
  suppressUntil = 0
}
