import {
  GetRawInputDeviceInfoW,
  GetRawInputDeviceList,
  RAWINPUTDEVICELIST_SIZE,
  RID_DEVICE_INFO_SIZE,
  RIDI_DEVICEINFO,
  RIDI_DEVICENAME,
  RIM_TYPEHID
} from '../actions/win32'

/**
 * The raw input devices Windows knows about, and what kind each is (by HID
 * usage page / usage). Used to find precision touchpads for Holo's
 * swipe-ins (trackpadGestureService.ts, touchpadReports.ts).
 */
export interface RawDevice {
  handle: number
  type: number
  name: string
  usagePage: number
  usage: number
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
