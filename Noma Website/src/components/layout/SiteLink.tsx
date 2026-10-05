import { Link, useLocation } from 'react-router-dom'
import type { MouseEvent, MouseEventHandler, ReactNode } from 'react'
import { useLenis } from 'lenis/react'

/** Clears the fixed top nav, same as ScrollToHash's offset. */
const NAV_OFFSET = -80

interface SiteLinkProps {
  href: string
  className?: string
  onClick?: MouseEventHandler
  children: ReactNode
}

/**
 * The one link component `Navigation` and `Footer` use for every href,
 * since routing added three real pages (`/contact`, `/privacy`, `/terms`)
 * alongside the homepage's own in-page anchors (`#product` etc.) and this
 * codebase now has three different kinds of link to render correctly:
 *
 * - A bare `#hash`: on the homepage, stays a plain `<a href="#hash">` so
 *   Lenis's own `anchors` option (see `App.tsx`) keeps intercepting it
 *   exactly as it did before routing existed — that's tuned smooth-scroll
 *   behavior worth not disturbing. Anywhere else, becomes a router `Link`
 *   to `/#hash`: it routes home first, then `ScrollToHash` (`App.tsx`)
 *   finishes the scroll once the target section exists in the DOM.
 * - A real path (`/privacy`): a router `Link`, client-side navigation
 *   from anywhere.
 * - Anything else (`mailto:`, `#` placeholder, external URL): a plain
 *   `<a>`, unchanged.
 */
export default function SiteLink({ href, className, onClick, children }: SiteLinkProps) {
  const { pathname } = useLocation()
  const lenis = useLenis()

  // Same-page anchors scroll smoothly here rather than as a native hash
  // jump: a native jump changes the URL, React Router sees that as a
  // navigation, and ScrollToHash then snaps there instantly, cancelling
  // Lenis's eased scroll. replaceState updates the address bar without
  // telling the router. Reduced-motion visitors have no Lenis and get the
  // browser's plain jump instead.
  const scrollInPage = (event: MouseEvent) => {
    onClick?.(event)
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    const target = href === '#top' ? 0 : href.length > 1 ? document.querySelector<HTMLElement>(href) : null
    if (target === null) return
    event.preventDefault()
    if (lenis) lenis.scrollTo(target, { offset: target === 0 ? 0 : NAV_OFFSET })
    else if (target === 0) window.scrollTo(0, 0)
    else target.scrollIntoView()
    history.replaceState(history.state, '', href === '#top' ? pathname : href)
  }

  if (href.startsWith('#')) {
    if (pathname === '/') {
      return (
        <a href={href} className={className} onClick={scrollInPage}>
          {children}
        </a>
      )
    }
    return (
      <Link to={`/${href}`} className={className} onClick={onClick}>
        {children}
      </Link>
    )
  }

  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {children}
      </Link>
    )
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  )
}
