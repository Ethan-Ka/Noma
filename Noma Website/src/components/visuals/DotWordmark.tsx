import { useEffect, useRef } from 'react'
import nomaWordmark from '../../assets/noma-wordmark.png'

/**
 * The Noma wordmark drawn as a grid of small Noma Blue dots: the footer's
 * oversized closing mark, in the same dot language as the hero's field
 * (DotField.tsx). Sampled from the real wordmark image, so the letterforms
 * are exactly the logo's. Static and dim on purpose (2026-10-05: "a bit
 * smaller... little dots in noma blue and darker").
 */

const NOMA_BLUE = '#4c7eff'
/** Gap between dot centres, as a fraction of the drawn width. */
const SPACING_RATIO = 0.0072
const DOT_ALPHA = 0.32

export default function DotWordmark({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const image = new Image()
    image.src = nomaWordmark

    const draw = () => {
      if (!image.naturalWidth) return
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = canvas.clientWidth
      const height = (width * image.naturalHeight) / image.naturalWidth
      canvas.style.height = `${height}px`
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      const spacing = Math.max(4, width * SPACING_RATIO)
      const cols = Math.floor(width / spacing)
      const rows = Math.floor(height / spacing)
      const sample = document.createElement('canvas')
      sample.width = cols
      sample.height = rows
      const sampleContext = sample.getContext('2d', { willReadFrequently: true })
      if (!sampleContext) return
      sampleContext.drawImage(image, 0, 0, cols, rows)
      const pixels = sampleContext.getImageData(0, 0, cols, rows).data

      context.clearRect(0, 0, width, height)
      context.fillStyle = NOMA_BLUE
      context.globalAlpha = DOT_ALPHA
      const radius = spacing * 0.28
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (pixels[(row * cols + col) * 4 + 3] < 110) continue
          context.beginPath()
          context.arc((col + 0.5) * spacing, (row + 0.5) * spacing, radius, 0, Math.PI * 2)
          context.fill()
        }
      }
    }

    image.onload = draw
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])

  return <canvas ref={canvasRef} aria-hidden className={className} style={style} />
}
