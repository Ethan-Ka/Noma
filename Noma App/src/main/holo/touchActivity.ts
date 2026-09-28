import type { BrowserWindow } from 'electron'
import type { HoloInputGateStatus } from '@shared/types'
import { describeCoverage, type RawDevice } from './touchCoverage'
import {
  GetRawInputData,
  GetRawInputDeviceInfoW,
  GetRawInputDeviceList,
  HID_USAGE_DIGITIZER_PEN,
  HID_USAGE_DIGITIZER_TOUCH_PAD,
  HID_USAGE_DIGITIZER_TOUCH_SCREEN,
  HID_USAGE_PAGE_DIGITIZER,
  RAWINPUTDEVICE_SIZE,
  RAWINPUTDEVICELIST_SIZE,
  RAWINPUTHEADER_SIZE,
  RegisterRawInputDevices,
  RID_DEVICE_INFO_SIZE,
  RID_HEADER,
  RIDEV_INPUTSINK,
  RIDEV_REMOVE,
  RIDI_DEVICEINFO,
  RIDI_DEVICENAME,
  RIM_TYPEHID,
  WM_INPUT
} from '../actions/win32'

/**
 * Tells Holo when a finger is on the trackpad, touchscreen or pen surface.
 *
 * On any laptop the trackpad sits a few centimetres from the built-in mic,
 * and a finger landing on it is a small knock on the same chassis, which is
 * exactly the kind of sound Holo listens for. A tap on a touchscreen is the
 * same. The mouse hook in inputActivityService only sees these once they
 * produce a click, a scroll or pointer movement. A bare touch produces none
 * of those, and a tap-to-click only fires after the finger lifts, too late
 * to stop the sound before Holo has acted on it.
 *
 * Windows precision touchpads and touchscreens report every contact as a
 * raw HID digitizer report, from the moment a finger lands until it lifts.
 * This works the same on any laptop and needs no per-model code. The
 * watcher registers for those reports (RIDEV_INPUTSINK, so they arrive
 * while other apps are focused too) and forwards "something is touching",
 * nothing else. Report bodies are never read. Contact positions and finger
 * counts aren't parsed or kept; only the header is checked, to confirm the
 * report came from a digitizer.
 *
 * Older trackpad drivers (pre-precision Synaptics/ELAN/Alps) don't produce
 * digitizer reports at all. They behave as a mouse, so only their movement
 * and clicks reach the gate. `start` reports which case this machine is in,
 * and the Holo page says so rather than promising full protection everywhere.
 */

const DIGITIZER_USAGES = [HID_USAGE_DIGITIZER_TOUCH_PAD, HID_USAGE_DIGITIZER_TOUCH_SCREEN, HID_USAGE_DIGITIZER_PEN]

export class TouchActivityWatcher {
  private window: BrowserWindow | null = null
  /** hDevice -> whether it is a digitizer, filled in lazily per report. */
  private readonly digitizers = new Map<number, boolean>()

  constructor(private readonly onActivity: () => void) {}

  /** Registers for touch reports on `window`. Returns what this machine's
   *  hardware allows, or null when raw input isn't available at all. */
  start(window: BrowserWindow): HoloInputGateStatus | null {
    if (process.platform !== 'win32') return null
    this.stop()
    try {
      const status = describeCoverage(listRawDevices())
      const hwnd = readHandle(window.getNativeWindowHandle())
      const ok = RegisterRawInputDevices(
        DIGITIZER_USAGES.map((usage) => ({
          usUsagePage: HID_USAGE_PAGE_DIGITIZER,
          usUsage: usage,
          dwFlags: RIDEV_INPUTSINK,
          hwndTarget: hwnd
        })),
        DIGITIZER_USAGES.length,
        RAWINPUTDEVICE_SIZE
      )
      if (!ok) return { ...status, trackpad: status.trackpad === 'direct' ? 'movement-only' : status.trackpad }
      window.hookWindowMessage(WM_INPUT, (_wParam, lParam) => {
        if (this.isDigitizerReport(readHandle(lParam))) this.onActivity()
      })
      this.window = window
      return status
    } catch (error) {
      console.warn('[holo] touch gate unavailable:', error)
      return null
    }
  }

  stop(): void {
    const window = this.window
    if (!window) return
    this.window = null
    this.digitizers.clear()
    try {
      if (!window.isDestroyed()) window.unhookWindowMessage(WM_INPUT)
      RegisterRawInputDevices(
        DIGITIZER_USAGES.map((usage) => ({
          usUsagePage: HID_USAGE_PAGE_DIGITIZER,
          usUsage: usage,
          dwFlags: RIDEV_REMOVE,
          hwndTarget: 0
        })),
        DIGITIZER_USAGES.length,
        RAWINPUTDEVICE_SIZE
      )
    } catch (error) {
      console.warn('[holo] failed to release touch gate:', error)
    }
  }

  /** Header-only check. Chromium can register raw input of its own (pointer
   *  lock, gamepads), so a WM_INPUT isn't proof of a touch by itself. */
  private isDigitizerReport(hRawInput: number): boolean {
    const header: { dwType?: number; hDevice?: number | bigint } = {}
    const read = GetRawInputData(hRawInput, RID_HEADER, header, [RAWINPUTHEADER_SIZE], RAWINPUTHEADER_SIZE)
    if (read === 0xffffffff || read === 0 || header.dwType !== RIM_TYPEHID) return false
    const device = Number(header.hDevice ?? 0)
    let known = this.digitizers.get(device)
    if (known === undefined) {
      // A device plugged in after start() is looked up on its first report.
      known = readDeviceInfo(device)?.usagePage === HID_USAGE_PAGE_DIGITIZER
      this.digitizers.set(device, known)
    }
    return known
  }
}

export function listRawDevices(): RawDevice[] {
  const count = [0]
  GetRawInputDeviceList(null, count, RAWINPUTDEVICELIST_SIZE)
  if (!count[0]) return []
  const list = Buffer.alloc(count[0] * RAWINPUTDEVICELIST_SIZE)
  const got = GetRawInputDeviceList(list, count, RAWINPUTDEVICELIST_SIZE)
  if (got === 0xffffffff) return []
  const pointer = RAWINPUTDEVICELIST_SIZE / 2
  const devices: RawDevice[] = []
  for (let i = 0; i < got; i++) {
    const offset = i * RAWINPUTDEVICELIST_SIZE
    const handle = Number(pointer === 8 ? list.readBigUInt64LE(offset) : list.readUInt32LE(offset))
    const info = readDeviceInfo(handle)
    if (info) devices.push({ handle, name: readDeviceName(handle), ...info })
  }
  return devices
}

/** RID_DEVICE_INFO: cbSize, dwType, then a union whose HID member has
 *  usUsagePage/usUsage at offsets 20/22. */
function readDeviceInfo(handle: number): { type: number; usagePage: number; usage: number } | null {
  const info = Buffer.alloc(RID_DEVICE_INFO_SIZE)
  info.writeUInt32LE(RID_DEVICE_INFO_SIZE, 0)
  const read = GetRawInputDeviceInfoW(handle, RIDI_DEVICEINFO, info, [RID_DEVICE_INFO_SIZE])
  if (read === 0xffffffff || read === 0) return null
  const type = info.readUInt32LE(4)
  return type === RIM_TYPEHID
    ? { type, usagePage: info.readUInt16LE(20), usage: info.readUInt16LE(22) }
    : { type, usagePage: 0, usage: 0 }
}

function readDeviceName(handle: number): string {
  const chars = [0]
  GetRawInputDeviceInfoW(handle, RIDI_DEVICENAME, null, chars)
  if (!chars[0]) return ''
  const name = Buffer.alloc(chars[0] * 2)
  if (GetRawInputDeviceInfoW(handle, RIDI_DEVICENAME, name, chars) === 0xffffffff) return ''
  return name.toString('utf16le').replace(/\0.*$/s, '')
}

/** An HWND / HRAWINPUT handed over by Electron as a pointer-sized buffer. */
function readHandle(buffer: Buffer): number {
  return Number(buffer.length >= 8 ? buffer.readBigUInt64LE(0) : buffer.readUInt32LE(0))
}
