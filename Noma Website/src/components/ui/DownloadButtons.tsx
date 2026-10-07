import { useMemo } from 'react'
import { SiApple } from 'react-icons/si'
// simple-icons dropped the Windows mark after a takedown; Font Awesome's
// brand set (same react-icons package) still has it.
import { FaWindows } from 'react-icons/fa6'
import { GLASS_ACCENT, SOLID_ON_LIGHT } from '../../lib/glass'
import { detectPlatform, useLatestDownloads } from '../../lib/downloads'

/** "Oct 6", or "Oct 6, 2026" outside the current year. A recent date is a
 *  quiet sign the beta is actively worked on. */
function formatDate(iso: string) {
  const date = new Date(iso)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

const SECONDARY =
  'border border-base-600 text-base-200 transition-colors hover:border-base-400 hover:text-base-50'

/**
 * The two beta downloads. The visitor's own platform goes first and gets the
 * accent; the other stays one click away, since the guess can be wrong (a
 * Mac user reading on a work PC). The Mac button is the Apple silicon build,
 * which is nearly every Mac sold since 2020; Intel gets a plain link below.
 */
export default function DownloadButtons({ onLight = false }: { onLight?: boolean }) {
  const downloads = useLatestDownloads()
  const platform = useMemo(detectPlatform, [])

  const buttons = [
    { id: 'mac', label: 'Download for Mac', href: downloads.macAppleSilicon, Logo: SiApple },
    { id: 'windows', label: 'Download for Windows', href: downloads.windows, Logo: FaWindows },
  ]
  if (platform === 'windows') buttons.reverse()
  const primary = platform ?? 'mac'

  return (
    <div>
      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        {buttons.map((button) => (
          <a
            key={button.id}
            href={button.href}
            download
            className={`inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3 text-sm font-medium tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              button.id === primary ? (onLight ? SOLID_ON_LIGHT : GLASS_ACCENT) : SECONDARY
            }`}
          >
            <button.Logo aria-hidden className="h-4 w-4 shrink-0" />
            {button.label}
          </a>
        ))}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-base-400">
        Mac download is for Apple silicon (M1 and later).{' '}
        <a href={downloads.macIntel} download className="text-base-300 underline underline-offset-4 hover:text-base-50">
          Intel Mac
        </a>
        {downloads.version && (
          <span className="text-base-500">
            {' '}
            · Version {downloads.version}
            {downloads.releasedAt && <>, updated {formatDate(downloads.releasedAt)}</>}
          </span>
        )}
      </p>

      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-base-400">
        The beta isn't signed yet, so your computer will ask once. Windows: More info, then Run anyway. Mac: System
        Settings, Privacy &amp; Security, Open Anyway.
      </p>
    </div>
  )
}
