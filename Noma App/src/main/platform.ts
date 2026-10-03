/**
 * Which OS-specific implementation the main process uses. Noma ships for
 * Windows and macOS from one codebase: every native call (window focus,
 * clicks, the foreground-app watcher, UI inspection) branches on these,
 * and everything above that layer is shared.
 */
export const isWindows = process.platform === 'win32'
export const isMac = process.platform === 'darwin'
