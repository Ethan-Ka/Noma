import { existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Compile-time flags shared by vite.config.ts and vite.ssr.config.ts.
 * __HAS_RECORDING__: whether the optional screen recording has been added
 * (public/media/noma-notice-recording.mp4). Without it the page renders no
 * video element at all, so nothing is requested and nothing 404s.
 */
export const buildFlags = {
  __HAS_RECORDING__: JSON.stringify(existsSync(resolve(import.meta.dirname, 'public/media/noma-notice-recording.mp4'))),
}
