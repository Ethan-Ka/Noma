import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App.tsx'

/**
 * Build-time render of a route to HTML (scripts/prerender.mjs), so the
 * page's content is in the static HTML for crawlers, link previews and
 * anyone without JavaScript. The browser then renders the app as usual
 * (main.tsx), replacing this markup.
 */
export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>,
  )
}
