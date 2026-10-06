import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { buildFlags } from './buildFlags.ts'

// Only for the build-time prerender (scripts/prerender.mjs). Kept apart from
// vite.config.ts because the Cloudflare plugin there builds the deployed
// Worker, which this one-off Node render doesn't need.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: buildFlags,
  build: {
    ssr: 'src/entry-server.tsx',
    outDir: 'dist-ssr',
    emptyOutDir: true,
  },
})
