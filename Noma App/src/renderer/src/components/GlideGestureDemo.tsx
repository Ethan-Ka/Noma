/**
 * The Glide gesture, drawn as it really is: the palm rest either side of
 * the trackpad, a fingertip resting there, sliding onto the trackpad, and
 * the zone it lands in lighting up. Left first, then right, on a loop
 * (still frame with arrows under reduced motion, see globals.css).
 *
 * Drawn from above, flat, with no device mockup: the point is where the
 * finger starts and which way it moves, nothing else.
 */
export function GlideGestureDemo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 150"
      role="img"
      aria-label="A fingertip on the palm rest beside the trackpad slides onto the trackpad. The zone it lands in runs its action."
      className={className}
    >
      {/* Palm rest (the laptop deck below the keyboard). */}
      <rect x="1" y="1" width="358" height="148" rx="14" className="fill-white/[0.02] stroke-white/10" />
      <line x1="16" y1="14" x2="344" y2="14" className="stroke-white/10" strokeDasharray="3 5" />
      <text x="180" y="11" textAnchor="middle" className="fill-neutral-600 text-[8px]">
        keyboard
      </text>

      {/* Trackpad, split into an upper and lower half on each side. */}
      <rect x="110" y="34" width="140" height="102" rx="10" className="fill-white/[0.04] stroke-white/20" />
      <line x1="110" y1="85" x2="144" y2="85" className="stroke-white/15" strokeDasharray="2 3" />
      <line x1="216" y1="85" x2="250" y2="85" className="stroke-white/15" strokeDasharray="2 3" />
      <line x1="144" y1="34" x2="144" y2="136" className="stroke-white/10" />
      <line x1="216" y1="34" x2="216" y2="136" className="stroke-white/10" />

      {/* The zone each swipe lands in. */}
      <path d="M120 34 H144 V85 H110 V44 A10 10 0 0 1 120 34 Z" className="glide-zone-left fill-accent/35" opacity="0" />
      <path d="M216 34 H240 A10 10 0 0 1 250 44 V85 H216 Z" className="glide-zone-right fill-accent/35" opacity="0" />

      <text x="180" y="90" textAnchor="middle" className="fill-neutral-500 text-[9px]">
        trackpad
      </text>
      <text x="55" y="128" textAnchor="middle" className="fill-neutral-600 text-[8px]">
        palm rest
      </text>
      <text x="305" y="128" textAnchor="middle" className="fill-neutral-600 text-[8px]">
        palm rest
      </text>

      {/* Direction of travel, always visible. */}
      <path d="M92 60 H124" className="stroke-neutral-500" strokeWidth="1.2" markerEnd="url(#glide-arrow)" />
      <path d="M268 60 H236" className="stroke-neutral-500" strokeWidth="1.2" markerEnd="url(#glide-arrow)" />
      <defs>
        <marker id="glide-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" className="fill-neutral-500" />
        </marker>
      </defs>

      {/* The fingertip. */}
      <g className="glide-finger-left" style={{ transformBox: 'fill-box' }}>
        <circle cx="86" cy="70" r="9" className="fill-neutral-100/90" />
      </g>
      <g className="glide-finger-right" style={{ transformBox: 'fill-box' }}>
        <circle cx="274" cy="70" r="9" className="fill-neutral-100/90" />
      </g>
    </svg>
  )
}
