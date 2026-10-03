import { GetForegroundWindow, IsWindow, SetForegroundWindow } from './win32'
import { frontmostPid, requestActivation } from './macos'
import { isMac } from '../platform'

/**
 * Focuses the target window and confirms the switch actually landed
 * before returning true. Fails closed: if it can't confirm, the caller
 * must not send a synthetic keystroke — a misdirected one is worse than a
 * missed one (unchanged from the original design).
 *
 * REDESIGNED after two real incidents (see docs/architecture.md's "Real
 * execution" section for the full account) with the old
 * AttachThreadInput-based approach, which ran inside a freshly-spawned
 * PowerShell child process. That child process had never itself received
 * any user input, which is exactly the condition Windows' foreground-lock
 * is designed to block — AttachThreadInput was a workaround for fighting
 * that restriction, and workarounds for OS security restrictions are
 * exactly the kind of thing worth being suspicious of after two crashes.
 *
 * This version calls SetForegroundWindow directly from Flow's own main
 * process — no spawned process, no AttachThreadInput, no workaround
 * needed at all. That's because the call happens synchronously inside the
 * same event-loop tick as the click that triggered it: Flow's process is
 * *itself* the current foreground process at that moment (it just
 * received the click), and Windows explicitly permits the foreground
 * process to hand foreground status to another window — this is the
 * ordinary, sanctioned case the API exists for, not an edge case being
 * routed around.
 */
export async function focusWindowAndVerify(targetHwnd: number): Promise<boolean> {
  if (isMac) return focusAppAndVerify(targetHwnd)
  if (!IsWindow(targetHwnd)) return false
  SetForegroundWindow(targetHwnd)
  return GetForegroundWindow() === targetHwnd
}

/** How long macOS gets to bring an app forward: activation there is
 *  asynchronous, unlike SetForegroundWindow. */
const MAC_ACTIVATION_WAIT_MS = 600
const MAC_ACTIVATION_POLL_MS = 30

/**
 * macOS: the "handle" is the target app's pid (see macAdapter.ts). Usually
 * that app is already in front (the user pressed a key or tapped while in
 * it), so nothing changes. Otherwise it is asked to come forward, and the
 * same rule applies as on Windows: no confirmation, no keystroke.
 */
async function focusAppAndVerify(pid: number): Promise<boolean> {
  if (pid <= 0) return false
  if (frontmostPid() === pid) return true
  if (!requestActivation(pid)) return false
  const deadline = Date.now() + MAC_ACTIVATION_WAIT_MS
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, MAC_ACTIVATION_POLL_MS))
    if (frontmostPid() === pid) return true
  }
  return false
}
