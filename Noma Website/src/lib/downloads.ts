import { useEffect, useState } from 'react'

/**
 * Where the beta's installers live (2026-10-07): Cloudflare R2, served at
 * downloads.nomashift.com, so downloads don't depend on the GitHub repo
 * being public. Every link points at the installer file itself, so clicking
 * a button downloads it straight away.
 *
 * The release workflow (.github/workflows/noma-app-release.yml) writes
 * latest.json only after every installer for a version is uploaded, so the
 * version it names is always complete. Until it answers, or if it can't be
 * reached, the buttons use the stable-name copies each release also gets.
 */
export const DOWNLOADS_BASE = 'https://downloads.nomashift.com'
const MANIFEST_URL = `${DOWNLOADS_BASE}/latest.json`

export interface Downloads {
  version: string | null
  /** When that version was published (ISO). */
  releasedAt: string | null
  windows: string
  macAppleSilicon: string
  macIntel: string
}

const FALLBACK: Downloads = {
  version: null,
  releasedAt: null,
  windows: `${DOWNLOADS_BASE}/Noma-Setup.exe`,
  macAppleSilicon: `${DOWNLOADS_BASE}/Noma-arm64.dmg`,
  macIntel: `${DOWNLOADS_BASE}/Noma-x64.dmg`,
}

/** latest.json, as the release workflow writes it. */
interface Manifest {
  version: string
  releasedAt?: string
  windows: string
  macAppleSilicon: string
  macIntel: string
}

/** Turns the manifest's file names into links, keeping the fallback for
 *  anything missing or malformed. */
export function fromManifest(manifest: Partial<Manifest> | null): Downloads {
  if (!manifest || typeof manifest.version !== 'string') return FALLBACK
  const file = (name: unknown, fallback: string) =>
    typeof name === 'string' && /^[\w.-]+$/.test(name) ? `${DOWNLOADS_BASE}/${name}` : fallback
  return {
    version: manifest.version,
    releasedAt: typeof manifest.releasedAt === 'string' ? manifest.releasedAt : null,
    windows: file(manifest.windows, FALLBACK.windows),
    macAppleSilicon: file(manifest.macAppleSilicon, FALLBACK.macAppleSilicon),
    macIntel: file(manifest.macIntel, FALLBACK.macIntel),
  }
}

export function useLatestDownloads(): Downloads {
  const [downloads, setDownloads] = useState<Downloads>(FALLBACK)
  useEffect(() => {
    const controller = new AbortController()
    fetch(MANIFEST_URL, { signal: controller.signal, cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest: Partial<Manifest> | null) => setDownloads(fromManifest(manifest)))
      .catch(() => {
        // Offline or aborted: the fallback links stay.
      })
    return () => controller.abort()
  }, [])
  return downloads
}

/** The visitor's computer, to put their download first. A guess, so both
 *  are always shown. */
export function detectPlatform(): 'mac' | 'windows' | null {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = `${nav.userAgentData?.platform ?? ''} ${navigator.platform ?? ''} ${navigator.userAgent}`.toLowerCase()
  if (/iphone|ipad|android/.test(platform)) return null
  if (/mac/.test(platform)) return 'mac'
  if (/win/.test(platform)) return 'windows'
  return null
}
