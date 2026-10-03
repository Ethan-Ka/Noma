import type { BrowserWindow } from 'electron'
import type { HoloInputGateStatus } from '@shared/types'
import { describeCoverage, type RawDevice } from './touchCoverage'
import {
  GetRawInputData,
  GetRawInputDeviceInfoW,
  GetRawInputDeviceList,
  HID_USAGE_PAGE_DIGITIZER,
  RAWINPUTDEVICELIST_SIZE,
  RAWINPUTHEADER_SIZE,
  RID_DEVICE_INFO_SIZE,
  RID_HEADER,
  RIDI_DEVICEINFO,
  RIDI_DEVICENAME,
  RIM_TYPEHID
} from '../actions/win32'
import { subscribeDigitizerInput } from './rawDigitizerInput'

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
 * watcher subscribes to those reports (rawDigitizerInput.ts; they arrive
 * while other apps are focused too) and forwards "something is touching",
 * nothing else. This watcher reads only the header, to confirm the report
 * came from a digitizer. (Holo's trackpad corners, a separate opt-in mode,
 * do read finger positions — see trackpadGestureService.ts.)
 *
 * Older trackpad drivers (pre-precision Synaptics/ELAN/Alps) don't produce
 * digitizer reports at all. They behave as a mouse, so only their movement
 * and clicks reach the gate. `start` reports which case this machine is in,
 * and the Holo page says so rather than promising full protection everywhere.
 */

export class TouchActivityWatcher {
  private unsubscribe: (() => void) | null = null
  /** hDevice -> whether it is a digitizer, filled in lazily per report. */
  private readonly digitizers = new Map<number, boolean>()

  constructor(private readonly onActivity: () => void) {}

  /** Starts watching touch reports (delivered to `window`). Returns what
   *  this machine's hardware allows, or null when raw input isn't available
   *  at all. */
  start(window: BrowserWindow): HoloInputGateStatus | null {
    if (process.platform !== 'win32') return null
    this.stop()
    try {
      const status = describeCoverage(listRawDevices())
      this.unsubscribe = subscribeDigitizerInput(window, (hRawInput) => {
        if (this.isDigitizerReport(hRawInput)) this.onActivity()
      })
      if (!this.unsubscribe) return { ...status, trackpad: status.trackpad === 'direct' ? 'movement-only' : status.trackpad }
      return status
    } catch (error) {
      console.warn('[holo] touch gate unavailable:', error)
      return null
    }
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.digitizers.clear()
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
export function readDeviceInfo(handle: number): { type: number; usagePage: number; usage: number } | null {
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
