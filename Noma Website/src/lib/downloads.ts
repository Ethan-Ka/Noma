import { useEffect, useState } from 'react'

/**
 * Where the beta's installers live: the newest GitHub release of the app,
 * published by the app repo's release workflow. Every link is a direct file
 * download (the visitor never lands on GitHub). File names carry the version
 * (Noma-Setup-0.1.2.exe), so the newest files are looked up from the
 * release itself; until that answer arrives, or if GitHub can't be reached
 * or rate-limits the visitor, the links point straight at KNOWN_RELEASE's
 * files, which always exist. Bump it now and then so the fallback isn't old.
 */
export const RELEASES_PAGE = 'https://github.com/awnsh/Noma/releases/latest'
const KNOWN_RELEASE = '0.1.2'
const DOWNLOAD_BASE = `https://github.com/awnsh/Noma/releases/download/v${KNOWN_RELEASE}`
const LATEST_RELEASE_API = 'https://api.github.com/repos/awnsh/Noma/releases/latest'

export interface Downloads {
  version: string | null
  windows: string
  macAppleSilicon: string
  macIntel: string
}

const FALLBACK: Downloads = {
  version: KNOWN_RELEASE,
  windows: `${DOWNLOAD_BASE}/Noma-Setup-${KNOWN_RELEASE}.exe`,
  macAppleSilicon: `${DOWNLOAD_BASE}/Noma-${KNOWN_RELEASE}-arm64.dmg`,
  macIntel: `${DOWNLOAD_BASE}/Noma-${KNOWN_RELEASE}-x64.dmg`,
}

interface ReleaseAsset {
  name: string
  browser_download_url: string
}

/** Picks each installer out of a release's files. Exported for tests. */
export function pickDownloads(tag: string, assets: ReleaseAsset[]): Downloads {
  const find = (test: (name: string) => boolean) => assets.find((asset) => test(asset.name))?.browser_download_url
  const windows = find((name) => /^Noma-Setup-.*\.exe$/.test(name))
  const macAppleSilicon = find((name) => /-arm64\.dmg$/.test(name))
  const macIntel = find((name) => /-x64\.dmg$/.test(name))
  // A release still uploading (or missing a platform) keeps the known files.
  if (!windows || !macAppleSilicon || !macIntel) return FALLBACK
  return { version: tag.replace(/^v/, ''), windows, macAppleSilicon, macIntel }
}

export function useLatestDownloads(): Downloads {
  const [downloads, setDownloads] = useState<Downloads>(FALLBACK)
  useEffect(() => {
    const controller = new AbortController()
    fetch(LATEST_RELEASE_API, { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((release: { tag_name?: string; assets?: ReleaseAsset[] } | null) => {
        if (release?.tag_name && release.assets) setDownloads(pickDownloads(release.tag_name, release.assets))
      })
      .catch(() => {
        // Offline, rate-limited or aborted: the release page links still work.
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
