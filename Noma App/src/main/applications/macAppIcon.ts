import { execFile } from 'child_process'

/**
 * An app's icon on macOS, as a PNG data URL, read in a separate osascript
 * (JavaScript for Automation) process rather than with Electron's
 * app.getFileIcon.
 *
 * Why: app.getFileIcon builds the icon from NSImage on one of Chromium's
 * background threads, and on macOS 26 that kills the whole app (Mac testing,
 * 2026-10-05: EXC_BREAKPOINT on ThreadPoolForegroundWorker with NSImage and
 * UniformTypeIdentifiers in the registers, the moment the Glide page first
 * showed an app icon). osascript runs NSWorkspace on its own main thread, in
 * its own process, so the worst a bad icon can do is fail this call. Same
 * approach as macAdapter.ts's app watcher. One call per app, cached by
 * iconService.ts.
 */

/** Points; the bitmap comes back at the screen's scale (128 px on Retina),
 *  enough for the 16-56 px the app draws icons at. */
const ICON_POINTS = 64
const TIMEOUT_MS = 8000

const SCRIPT = `
ObjC.import('AppKit');
function run(argv) {
  const image = $.NSWorkspace.sharedWorkspace.iconForFile(argv[0]);
  if (!image || image.isNil()) return '';
  image.setSize($.NSMakeSize(${ICON_POINTS}, ${ICON_POINTS}));
  const cg = image.CGImageForProposedRectContextHints(null, null, null);
  if (!cg) return '';
  const rep = $.NSBitmapImageRep.alloc.initWithCGImage(cg);
  const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
  if (!png || png.isNil()) return '';
  return png.base64EncodedStringWithOptions(0).js;
}
`

export function readMacAppIcon(bundlePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'osascript',
      ['-l', 'JavaScript', '-e', SCRIPT, bundlePath],
      { timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => {
        const base64 = stdout?.trim()
        resolve(!error && base64 ? `data:image/png;base64,${base64}` : null)
      }
    )
  })
}
