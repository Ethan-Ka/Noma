import { execFile } from 'child_process'
import { existsSync } from 'fs'

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
 *
 * The script draws the icon into a fresh 128x128 bitmap and saves that as
 * PNG: the standard AppKit recipe, using numeric constants because the
 * scripting bridge doesn't expose every AppKit enum by name
 * (2 = NSCompositingOperationSourceOver, 4 = NSBitmapImageFileTypePNG).
 */

const PIXELS = 128
const TIMEOUT_MS = 8000

const SCRIPT = `
ObjC.import('AppKit');
function run(argv) {
  const size = ${PIXELS};
  const icon = $.NSWorkspace.sharedWorkspace.iconForFile(argv[0]);
  const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
    null, size, size, 8, 4, true, false, 'NSCalibratedRGBColorSpace', 0, 0);
  $.NSGraphicsContext.saveGraphicsState;
  $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep));
  icon.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, size, size), $.NSMakeRect(0, 0, 0, 0), 2, 1.0);
  $.NSGraphicsContext.restoreGraphicsState;
  const png = rep.representationUsingTypeProperties(4, $());
  return png.base64EncodedStringWithOptions(0).js;
}
`

export interface MacIconResult {
  dataUrl: string | null
  /** Why there is no icon, for logs and tests. */
  error?: string
}

export function readMacAppIconResult(bundlePath: string): Promise<MacIconResult> {
  // NSWorkspace hands back a generic document icon for a path that doesn't
  // exist; the app's own fallback glyph is better than that.
  if (!existsSync(bundlePath)) return Promise.resolve({ dataUrl: null, error: 'no such path' })
  return new Promise((resolve) => {
    execFile(
      'osascript',
      ['-l', 'JavaScript', '-e', SCRIPT, bundlePath],
      { timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const base64 = stdout?.trim()
        if (!error && base64) resolve({ dataUrl: `data:image/png;base64,${base64}` })
        else resolve({ dataUrl: null, error: (stderr?.trim() || error?.message || 'empty output').slice(0, 500) })
      }
    )
  })
}

export async function readMacAppIcon(bundlePath: string): Promise<string | null> {
  const result = await readMacAppIconResult(bundlePath)
  if (result.error && result.error !== 'no such path') console.warn('[icons] could not read', bundlePath, result.error)
  return result.dataUrl
}
