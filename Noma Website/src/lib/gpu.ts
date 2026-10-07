/**
 * Whether the browser has real graphics acceleration. With it off (a setting
 * many people turn off, or a driver the browser blocks), effects that are
 * nearly free on a GPU, like the glass panels' backdrop blur and the moving
 * stardust layer, fall back to the CPU and can slow the whole page.
 *
 * The check is the standard one: ask for a WebGL context with
 * failIfMajorPerformanceCaveat, which the browser refuses when it would have
 * to render in software. One-time, well under a millisecond.
 */
export function hasHardwareAcceleration(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const options = { failIfMajorPerformanceCaveat: true }
    const gl = canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)
    if (!gl) return false
    // Release it straight away; we only needed the answer.
    ;(gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/** Tags <html> with `no-gpu` when there's no acceleration, so CSS can turn
 *  the expensive effects off (see index.css). Run once, before first paint. */
export function markGraphicsCapability(): boolean {
  const accelerated = hasHardwareAcceleration()
  if (!accelerated) document.documentElement.classList.add('no-gpu')
  return accelerated
}
