import type { HoloInputGateStatus } from '@shared/types'

/**
 * Decides which HoloTrackpadCoverage case this computer is in, from the raw
 * input device list touchActivity.ts reads. Kept pure (no koffi, no
 * user32.dll) so it can be tested with device lists from other laptops.
 * The constants mirror actions/win32.ts.
 */

const RIM_TYPEMOUSE = 0
const RIM_TYPEHID = 2
const DIGITIZER = 0x0d
const PEN = 0x02
const TOUCH_SCREEN = 0x04
const TOUCH_PAD = 0x05

/** Device names of trackpads whose drivers only expose a mouse: ACPI IDs of
 *  the PS/2 ones (Synaptics, ELAN, Alps, FocalTech, Cypress, Dell-branded)
 *  and USB vendor IDs of the main trackpad makers. Used only to word the
 *  Holo page's coverage line; nothing is blocked or allowed based on it. */
const MOUSE_ONLY_TRACKPAD = /ACPI#(SYN|ETD|ELAN|ALP|DLL|FTE|CYAP)|VID_(06CB|04F3|044E|2808)&|touch ?pad|trackpad/i

export interface RawDevice {
  handle: number
  type: number
  name: string
  usagePage: number
  usage: number
}

/**
 * A digitizer touchpad with no USB vendor ID in its name is the laptop's
 * own (I2C/SPI, e.g. `HID#ASCE1206`, `HID#ELAN0662`). One *with* a vendor ID
 * may be an external keyboard's touchpad (a Logitech receiver exposes one),
 * so it only counts as `direct` when no mouse-only built-in trackpad was found.
 */
export function describeCoverage(devices: RawDevice[]): HoloInputGateStatus {
  const digitizers = devices.filter((d) => d.type === RIM_TYPEHID && d.usagePage === DIGITIZER)
  const touchpads = digitizers.filter((d) => d.usage === TOUCH_PAD)
  const touchscreen = digitizers.some((d) => d.usage === TOUCH_SCREEN || d.usage === PEN)
  const builtInPrecision = touchpads.some((d) => !/VID_/i.test(d.name))
  const mouseOnly = devices.some((d) => d.type === RIM_TYPEMOUSE && MOUSE_ONLY_TRACKPAD.test(d.name))
  const trackpad = builtInPrecision ? 'direct' : mouseOnly ? 'movement-only' : touchpads.length ? 'direct' : 'none'
  return { trackpad, touchscreen }
}
