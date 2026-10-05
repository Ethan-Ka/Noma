import { useEffect, useState } from 'react'

/**
 * Where the beta's installers live: the newest GitHub release of the app.
 * Every release also gets copies of its installers under stable, versionless
 * names (.github/workflows/noma-app-release-aliases.yml), so these links use
 * GitHub's permanent "latest release" address and always download the
 * current version directly: no website change or redeploy per release, no
 * API call, no rate limit. The visitor never lands on GitHub.
 *
 * The only thing looked up live is the version number shown beside the
 * buttons; if GitHub can't be reached it is simply left out.
 */
export const RELEASES_PAGE = 'https://github.com/awnsh/Noma/releases/latest'
const LATEST = 'https://github.com/awnsh/Noma/releases/latest/download'
const LATEST_RELEASE_API = 'https://api.github.com/repos/awnsh/Noma/releases/latest'

export interface Downloads {
  version: string | null
  windows: string
  macAppleSilicon: string
  macIntel: string
}

const LINKS: Downloads = {
  version: null,
  windows: `${LATEST}/Noma-Setup.exe`,
  macAppleSilicon: `${LATEST}/Noma-arm64.dmg`,
  macIntel: `${LATEST}/Noma-x64.dmg`,
}

export function useLatestDownloads(): Downloads {
  const [downloads, setDownloads] = useState<Downloads>(LINKS)
  useEffect(() => {
    const controller = new AbortController()
    fetch(LATEST_RELEASE_API, { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((release: { tag_name?: string } | null) => {
        if (release?.tag_name) setDownloads({ ...LINKS, version: release.tag_name.replace(/^v/, '') })
      })
      .catch(() => {
        // Offline, rate-limited or aborted: the links work regardless.
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
