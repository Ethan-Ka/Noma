/** Whether the renderer is running on macOS (the sandboxed renderer has no
 *  `process`, so this reads the user agent). */
export const isMacRenderer = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)

/** The modifier keys Flow records shortcuts for, named the way this OS's
 *  keyboard labels them. */
export const COMMAND_MODIFIERS_COPY = isMacRenderer ? 'Control, Option, or Command' : 'Control, Alt, or the Windows key'
