import { SiGithub, SiFigma, SiBlender, SiDiscord, SiSpotify, SiNotion, SiClaude, SiYoutube } from 'react-icons/si'
import { VscVscode } from 'react-icons/vsc'
import type { IconType } from 'react-icons'

// Real brand marks, where the simple-icons set this project pulls from still
// carries them. Several were pulled from that set after trademark takedown
// requests (VS Code, the Adobe apps, plain Slack) and aren't available as a
// clean single-color icon at all anymore, at any version.
const REAL_ICONS: Record<string, IconType> = {
  github: SiGithub,
  figma: SiFigma,
  blender: SiBlender,
  discord: SiDiscord,
  spotify: SiSpotify,
  notion: SiNotion,
  claude: SiClaude,
  youtube: SiYoutube,
  // The VS Code mark from Microsoft's own Codicons set (2026-10-07: the user
  // wanted the real logos, not the "</>" badge).
  vscode: VscVscode,
}

/** Adobe Premiere Pro's real icon (2026-10-07): the dark navy rounded square
 *  with "Pr" in Premiere's lavender. No icon set carries it, and its colours
 *  are the logo, so it ignores the `color` prop. */
function PremiereIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1" y="1.5" width="22" height="21" rx="4.6" fill="#00005B" stroke="#9999FF" strokeOpacity="0.45" strokeWidth="0.75" />
      <text
        x="12"
        y="16.2"
        textAnchor="middle"
        fill="#9999FF"
        fontFamily="Inter, 'Segoe UI', Arial, sans-serif"
        fontSize="11"
        fontWeight="600"
        letterSpacing="-0.3"
      >
        Pr
      </text>
    </svg>
  )
}

// For everything else: a short letterform badge, not a traced logo. Reads as
// "that app" at a glance next to the real marks above without reproducing a
// trademark pixel-for-pixel. Terminal isn't a brand at all, so it gets a
// generic prompt glyph instead of an initialism.
const BADGE_LABELS: Record<string, string> = {
  photoshop: 'Ps',
  aftereffects: 'Ae',
  slack: '#',
  solidworks: 'SW',
  terminal: '>_',
}

interface AppIconProps {
  id: string
  className?: string
  color?: string
}

/** Chrome's real full-colour mark (2026-10-07): three segments, each bounded
 *  by a line tangent to the white ring, around the blue centre. Drawn from
 *  that geometry because icon sets only carry a one-colour Chrome. Its
 *  colours are the logo, so it ignores the `color` prop. */
function ChromeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M14.56 29.45L3.87 10.93A24 24 0 0 1 45.38 13.10L24 13.10A10.9 10.9 0 0 0 14.56 29.45Z" />
      <path fill="#FBBC04" d="M24 13.10L45.38 13.10A24 24 0 0 1 22.75 47.97L33.44 29.45A10.9 10.9 0 0 0 24 13.10Z" />
      <path fill="#34A853" d="M33.44 29.45L22.75 47.97A24 24 0 0 1 3.87 10.93L14.56 29.45A10.9 10.9 0 0 0 33.44 29.45Z" />
      <circle cx="24" cy="24" r="10.9" fill="#fff" />
      <circle cx="24" cy="24" r="8.7" fill="#4285F4" />
    </svg>
  )
}

export default function AppIcon({ id, className = '', color }: AppIconProps) {
  if (id === 'premiere') return <PremiereIcon className={className} />
  if (id === 'chrome') return <ChromeIcon className={className} />

  const Icon = REAL_ICONS[id]

  if (Icon) {
    return <Icon className={className} style={{ color: color ?? 'currentColor' }} aria-hidden />
  }

  const label = BADGE_LABELS[id] ?? id.slice(0, 2).toUpperCase()

  return (
    <span
      className={`inline-flex items-center justify-center font-mono font-semibold leading-none ${className}`}
      style={{ color: color ?? 'currentColor' }}
      aria-hidden
    >
      {label}
    </span>
  )
}
