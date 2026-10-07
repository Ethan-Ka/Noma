interface ArrowProps {
  className?: string
  /** Rotates the whole glyph. 90 for a downward arrow on stacked layouts. */
  rotate?: number
}

/**
 * The connector between two steps of a workflow.
 *
 * Drawn rather than typed. A `→` character is whatever the loaded font
 * happens to draw: its weight, length and optical centre change between
 * Inter and JetBrains Mono, and it sits on the text baseline rather than on
 * the centre of the things it connects. This is one stroke at one weight,
 * aligned to the middle of its box everywhere it appears.
 */
export default function Arrow({ className = '', rotate = 0 }: ArrowProps) {
  return (
    <svg
      viewBox="0 0 24 12"
      fill="none"
      aria-hidden
      className={className}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      <path
        d="M1 6h21M17 1.5 22 6l-5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
