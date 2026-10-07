import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * The hero's background: a field of dim Noma Blue dots that a slow wave
 * moves through. Scrolling carries the field up at a fraction of the page's
 * speed and rolls the wave on.
 *
 * History: all 2026-10-05 and the user's asks ("subtle... a bunch of dots
 * moving", darker, Noma Blue, hero-only), then a cursor effect that gathered
 * dots into the Noma mark. On 2026-10-06 the user let the cursor effect go
 * for performance, and the drawing was rebuilt to be cheap:
 * - Dots are grouped by brightness into a few buckets and each bucket is
 *   one path and one fill per frame, instead of a separate draw per dot
 *   (around two thousand of them).
 * - The fade toward the bottom is in the dots' brightness, not a CSS mask
 *   (masking a canvas that changes every frame is expensive in Chrome).
 * - 30 frames a second, plenty for a wave this slow.
 * - Only animates while the hero is on screen, pauses in background tabs.
 * Reduced-motion visitors get a still field. Keep it faint.
 */

const SPACING = 28
const DOT_RADIUS = 1
/** Resting and peak opacity of a dot in the wave. */
const BASE_ALPHA = 0.07
const PEAK_ALPHA = 0.3
/** How far (px) a dot drifts as the wave passes. */
const DRIFT = 3.2
/** Noma Blue, the site's one accent (--color-accent). */
const NOMA_BLUE = '#4c7eff'
/** Seconds for the main wave to cross the field once. */
const WAVE_PERIOD = 14
/** The field moves up at this fraction of the scroll speed (parallax). */
const SCROLL_PARALLAX = 0.35
/** Wave phase added per pixel scrolled, so scrolling rolls the wave on. */
const SCROLL_PHASE = 0.0016
/** Brightness levels dots are grouped into (one fill each per frame). */
const BUCKETS = 8
/** Minimum ms between frames (30 fps). */
const FRAME_MS = 32

export default function DotField({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    let width = 0
    let height = 0
    let frame = 0
    let last = -Infinity
    const started = performance.now()

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.fillStyle = NOMA_BLUE
    }

    const draw = (seconds: number, scroll: number) => {
      context.clearRect(0, 0, width, height)
      const phase = (seconds / WAVE_PERIOD) * Math.PI * 2 + scroll * SCROLL_PHASE
      const shift = scroll * SCROLL_PARALLAX
      const firstRow = Math.floor(shift / SPACING)
      const rows = Math.ceil(height / SPACING) + 2
      const cols = Math.ceil(width / SPACING) + 1
      const offsetX = (width - (cols - 1) * SPACING) / 2
      const paths: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D())

      for (let r = 0; r < rows; r++) {
        const fieldY = (firstRow + r) * SPACING
        const y = fieldY - shift
        // Fade toward the bottom of the hero, done in the dots' own
        // brightness: a CSS mask on the canvas would be re-applied to the
        // whole canvas every frame, which cost more than the drawing.
        const fade = Math.min(1, Math.max(0, (0.95 - y / height) / 0.4))
        if (fade <= 0) continue
        for (let col = 0; col < cols; col++) {
          const x = offsetX + col * SPACING
          // Two slow waves at different angles, so the motion never looks
          // like a single repeating stripe.
          const a = Math.sin(x * 0.011 + fieldY * 0.004 - phase)
          const b = Math.sin(fieldY * 0.017 - x * 0.006 + phase * 0.6 + 1.3)
          const lift = Math.max(0, (a + b) / 2) ** 2 // only the crests brighten
          const alpha = (BASE_ALPHA + (PEAK_ALPHA - BASE_ALPHA) * lift) * fade
          const bucket = Math.min(BUCKETS - 1, Math.round((alpha / PEAK_ALPHA) * (BUCKETS - 1)))
          if (alpha < 0.01) continue
          const radius = DOT_RADIUS + lift * 0.5
          const cx = x + b * DRIFT
          const cy = y + a * DRIFT
          const path = paths[bucket]
          path.moveTo(cx + radius, cy)
          path.arc(cx, cy, radius, 0, Math.PI * 2)
        }
      }
      for (let k = 0; k < BUCKETS; k++) {
        context.globalAlpha = Math.max(0.012, PEAK_ALPHA * (k / (BUCKETS - 1)))
        context.fill(paths[k])
      }
      context.globalAlpha = 1
    }

    // Only animate while the hero is actually on screen and the tab visible.
    let onScreen = true
    const tick = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now
        draw((now - started) / 1000, window.scrollY)
      }
      frame = document.hidden || !onScreen ? 0 : requestAnimationFrame(tick)
    }
    const resume = () => {
      if (!frame && onScreen && !document.hidden && !reduceMotion) frame = requestAnimationFrame(tick)
    }

    resize()
    if (reduceMotion) draw(0, 0)
    else resume()

    const onResize = () => {
      resize()
      if (reduceMotion) draw(0, 0)
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', resume)
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen) resume()
    })
    visibility.observe(canvas)
    return () => {
      visibility.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [reduceMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none ${className}`}
    />
  )
}
