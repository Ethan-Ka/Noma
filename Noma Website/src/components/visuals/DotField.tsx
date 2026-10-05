import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import nomaMark from '../../assets/noma-mark.png'

/**
 * The hero's background: a field of dim Noma Blue dots that a slow wave
 * moves through, and that gathers into the Noma mark wherever the cursor
 * is. As the cursor moves, dots ahead of it brighten into the mark and the
 * ones behind it ease back into the wave, so the mark flows after the
 * pointer instead of jumping. Scrolling carries the field up at a fraction
 * of the page's speed and rolls the wave on.
 *
 * History, all 2026-10-05 and all the user's asks: "subtle... a bunch of
 * dots moving"; briefly behind the whole site; then darker, Noma Blue and
 * hero-only; a timed cycle forming the mark; then "wherever the cursor is
 * it flows into a noma logo". Keep it faint.
 *
 * Canvas rather than DOM: around two thousand dots redrawn per frame. It
 * pauses in background tabs. Reduced-motion visitors get a still field
 * with no cursor effect; touch screens simply never show the mark.
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
/** The mark around the cursor: its width in dots, and how bright its dots get. */
const LOGO_COLS = 14
const LOGO_ALPHA = 0.55
/** How quickly a dot eases into / out of the mark (per second). Lower is
 *  a longer, more fluid trail. */
const LOGO_EASE = 7

interface LogoMask {
  cols: number
  rows: number
  on: Uint8Array
}

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
    let last = performance.now()
    const started = last

    // The mark, sampled once onto a LOGO_COLS-wide grid of dots.
    let logo: LogoMask | null = null
    const logoImage = new Image()
    logoImage.src = nomaMark
    logoImage.onload = () => {
      const cols = LOGO_COLS
      const rows = Math.round((cols * logoImage.naturalHeight) / logoImage.naturalWidth)
      const sample = document.createElement('canvas')
      sample.width = cols
      sample.height = rows
      const sampleContext = sample.getContext('2d', { willReadFrequently: true })
      if (!sampleContext) return
      sampleContext.drawImage(logoImage, 0, 0, cols, rows)
      const pixels = sampleContext.getImageData(0, 0, cols, rows).data
      const on = new Uint8Array(cols * rows)
      for (let i = 0; i < on.length; i++) on[i] = pixels[i * 4 + 3] > 100 ? 1 : 0
      logo = { cols, rows, on }
    }

    // Where the cursor is, in the canvas's own pixels; null when it isn't
    // over the hero.
    let pointer: { x: number; y: number } | null = null
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      pointer = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height ? { x, y } : null
    }
    const onPointerLeave = () => {
      pointer = null
    }

    /** How much each dot (keyed by field row/col) belongs to the mark right
     *  now, 0..1, eased toward where the mark currently is. */
    const strength = new Map<number, number>()
    const key = (row: number, col: number) => row * 4096 + col

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.fillStyle = NOMA_BLUE
    }

    const draw = (seconds: number, dt: number, scroll: number) => {
      context.clearRect(0, 0, width, height)
      const phase = (seconds / WAVE_PERIOD) * Math.PI * 2 + scroll * SCROLL_PHASE
      const shift = scroll * SCROLL_PARALLAX
      const firstRow = Math.floor(shift / SPACING)
      const rows = Math.ceil(height / SPACING) + 2
      const cols = Math.ceil(width / SPACING) + 1
      const offsetX = (width - (cols - 1) * SPACING) / 2

      // Where the mark sits this frame (top-left cell, in field rows/cols),
      // snapped to the grid and centred on the cursor.
      const target = new Set<number>()
      if (pointer && logo && !reduceMotion) {
        const left = Math.round((pointer.x - offsetX) / SPACING - logo.cols / 2)
        const top = Math.round((pointer.y + shift) / SPACING - logo.rows / 2)
        for (let r = 0; r < logo.rows; r++) {
          for (let c = 0; c < logo.cols; c++) {
            if (logo.on[r * logo.cols + c]) target.add(key(top + r, left + c))
          }
        }
      }
      // Ease every dot toward in-the-mark or not; drop the ones that have
      // fully faded so the map only ever holds the mark and its trail.
      const step = 1 - Math.exp(-dt * LOGO_EASE)
      for (const k of target) if (!strength.has(k)) strength.set(k, 0)
      for (const [k, value] of strength) {
        const next = value + ((target.has(k) ? 1 : 0) - value) * step
        if (next < 0.01 && !target.has(k)) strength.delete(k)
        else strength.set(k, next)
      }

      for (let r = 0; r < rows; r++) {
        const row = firstRow + r
        for (let col = 0; col < cols; col++) {
          const x = offsetX + col * SPACING
          const fieldY = row * SPACING
          const y = fieldY - shift
          // Two slow waves at different angles, so the motion never looks
          // like a single repeating stripe.
          const a = Math.sin(x * 0.011 + fieldY * 0.004 - phase)
          const b = Math.sin(fieldY * 0.017 - x * 0.006 + phase * 0.6 + 1.3)
          const lift = Math.max(0, (a + b) / 2) ** 2 // only the crests brighten
          let alpha = BASE_ALPHA + (PEAK_ALPHA - BASE_ALPHA) * lift
          let drift = DRIFT
          let radius = DOT_RADIUS + lift * 0.5
          const k = strength.get(key(row, col))
          if (k) {
            alpha += (LOGO_ALPHA - alpha) * k
            drift *= 1 - k // settles onto the grid to draw the mark
            radius += k * 0.4
          }
          context.globalAlpha = alpha
          context.beginPath()
          context.arc(x + b * drift, y + a * drift, radius, 0, Math.PI * 2)
          context.fill()
        }
      }
      context.globalAlpha = 1
    }

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      draw((now - started) / 1000, dt, window.scrollY)
      frame = document.hidden ? 0 : requestAnimationFrame(tick)
    }
    const resume = () => {
      if (!frame && !document.hidden && !reduceMotion) {
        last = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }

    resize()
    if (reduceMotion) draw(0, 0, 0)
    else resume()

    const onResize = () => {
      resize()
      if (reduceMotion) draw(0, 0, 0)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', resume)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [reduceMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none ${className}`}
      // Fades out toward the bottom of the hero only: the mark follows the
      // cursor anywhere, so the sides have to stay visible.
      style={{
        maskImage: 'linear-gradient(to bottom, black 55%, transparent 95%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 95%)',
      }}
    />
  )
}
