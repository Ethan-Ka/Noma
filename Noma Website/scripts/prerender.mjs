// Writes the homepage's rendered HTML into dist/index.html, inside
// <div id="root">, after `vite build` has produced the client bundle and the
// SSR build has produced dist-ssr/entry-server.js. Head tags (meta, OG,
// icons) are untouched; only the empty root is filled.
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve } from 'path'

// fileURLToPath rather than import.meta.dirname, which older Node lacks.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { render } = await import(pathToFileURL(resolve(root, 'dist-ssr/entry-server.js')).href)

const file = resolve(root, 'dist/index.html')
const template = readFileSync(file, 'utf8')
const EMPTY_ROOT = '<div id="root"></div>'
if (!template.includes(EMPTY_ROOT)) throw new Error('dist/index.html has no empty #root to fill')

const html = render('/')
writeFileSync(file, template.replace(EMPTY_ROOT, `<div id="root">${html}</div>`))
console.log(`prerendered / into dist/index.html (${Math.round(html.length / 1024)} KB of markup)`)
