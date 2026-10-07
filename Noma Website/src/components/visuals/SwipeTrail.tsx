/**
 * The hero's background: an abstract touchpad swipe. Two flat strokes, one on
 * each side, are drawn across the background the way a finger slides in from
 * the palm rest onto the trackpad, ending off to the side of the headline,
 * then fade. One color, one width, one opacity: it should read as a stroke,
 * not an effect. Pure SVG and CSS (see `.swipe-stroke` in index.css), no
 * script, hidden for reduced-motion visitors. Keep it faint.
 */

// Drawn in a 1600 by 900 space and scaled to cover the hero. Each path enters
// from beyond its own edge and ends on that side, clear of the headline.
const STROKES = [
  { d: 'M -120 560 C 160 560, 300 330, 540 250', delay: '0.6s' },
  { d: 'M 1720 520 C 1440 520, 1300 300, 1070 230', delay: '7.6s' },
] as const

export default function SwipeTrail({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden ${className}`}>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="h-full w-full" fill="none">
        {STROKES.map((stroke) => (
          <path
            key={stroke.d}
            d={stroke.d}
            pathLength={1}
            stroke="var(--color-accent)"
            strokeOpacity={0.24}
            strokeWidth={34}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
            className="swipe-stroke"
            style={{ animationDelay: stroke.delay }}
          />
        ))}
      </svg>
    </div>
  )
}
