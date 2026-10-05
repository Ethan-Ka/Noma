import koffi from 'koffi'
import { isMac } from '../platform'
import type { TouchContact, TouchFrame } from './trackpadGesture'

/**
 * Glide's finger positions on macOS: the built-in trackpad (and a Magic
 * Trackpad) through MultitouchSupport, the private framework every Mac
 * trackpad utility reads (BetterTouchTool, OpenMultitouchSupport). It is
 * the macOS counterpart of the raw HID reports touchpadReports.ts decodes on
 * Windows, already split into fingers, and needs no permission.
 *
 * Private means undocumented, not unstable: these C functions and the
 * per-finger struct below have kept the same shape since Mac OS X 10.5.
 * Same rule as macos.ts: a wrong signature is a crash, so only the five
 * long-known functions are declared.
 *
 * Threading: MultitouchSupport calls back on its own thread. koffi blocks
 * that thread until the JS callback has run on the main thread, so the
 * finger array is still valid while it's read. For the same reason the
 * devices are never stopped once started: stopping from the main thread
 * while the touch thread waits on the main thread could deadlock. With no
 * subscribers a frame is dropped at once, and frames only arrive while a
 * finger is on the pad.
 */

type Listener = (frame: TouchFrame) => void

/** MTTouch.state: 4 = touch starting, 5 = touching. 1-3 are hovering /
 *  in range, 6-7 lifting, so not "finger on the pad". */
const TOUCHING_STATES = new Set([4, 5])
/** MTTouch.majorAxis above this is a palm or the side of a hand, not a
 *  fingertip. Fingertips measure about 6-15; provisional until checked on
 *  more Macs with the touch check. */
const PALM_MAJOR_AXIS = 30
/** Trackpads only: the Touch Bar and a Magic Mouse are multitouch devices
 *  too. Surface size in hundredths of a millimetre; the smallest MacBook
 *  trackpad is about 105 x 76 mm, a Magic Mouse about 57 mm wide, the
 *  Touch Bar under 10 mm tall. */
const MIN_TRACKPAD_WIDTH = 7000
const MIN_TRACKPAD_HEIGHT = 4000

interface MacTouch {
  frame: number
  timestamp: number
  identifier: number
  state: number
  fingerId: number
  handId: number
  normalized: { pos: { x: number; y: number }; vel: { x: number; y: number } }
  size: number
  pressure: number
  angle: number
  majorAxis: number
  minorAxis: number
}

const listeners = new Set<Listener>()
let trackpads: number | null = null
let loadError: string | null = null
/** Multitouch devices seen, before the trackpad filter (diagnostics). */
let devicesSeen = 0

/** Starts every trackpad (once per process) and returns how many there
 *  are; 0 when there are none or MultitouchSupport couldn't be loaded. */
function startDevices(): number {
  if (trackpads !== null) return trackpads
  trackpads = 0
  if (!isMac) return trackpads
  try {
    const cf = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
    const mt = koffi.load('/System/Library/PrivateFrameworks/MultitouchSupport.framework/MultitouchSupport')
    const CFArrayGetCount = cf.func('intptr_t CFArrayGetCount(void *theArray)')
    const CFArrayGetValueAtIndex = cf.func('void *CFArrayGetValueAtIndex(void *theArray, intptr_t idx)')

    const point = koffi.struct('NomaMTPoint', { x: 'float', y: 'float' })
    const readout = koffi.struct('NomaMTReadout', { pos: point, vel: point })
    const touch = koffi.struct('NomaMTTouch', {
      frame: 'int',
      timestamp: 'double',
      identifier: 'int',
      state: 'int',
      fingerId: 'int',
      handId: 'int',
      normalized: readout,
      size: 'float',
      pressure: 'int',
      angle: 'float',
      majorAxis: 'float',
      minorAxis: 'float',
      millimeters: readout,
      reserved: koffi.array('int', 2),
      density: 'float'
    })
    if (koffi.sizeof(touch) !== 96) throw new Error(`unexpected MTTouch size ${koffi.sizeof(touch)}`)
    const callbackType = koffi.proto(
      'int NomaMTContactCallback(void *device, void *touches, int count, double timestamp, int frame)'
    )
    const MTDeviceCreateList = mt.func('void *MTDeviceCreateList()')
    const MTDeviceGetSensorSurfaceDimensions = mt.func(
      'int MTDeviceGetSensorSurfaceDimensions(void *device, _Out_ int *width, _Out_ int *height)'
    )
    const MTRegisterContactFrameCallback = mt.func(
      'void MTRegisterContactFrameCallback(void *device, NomaMTContactCallback *callback)'
    )
    const MTDeviceStart = mt.func('void MTDeviceStart(void *device, int mode)')

    // The list (and the devices in it) are kept for the process lifetime.
    const list = MTDeviceCreateList()
    if (!list) return trackpads
    const count = Number(CFArrayGetCount(list))
    devicesSeen = count
    for (let index = 0; index < count; index++) {
      const device = CFArrayGetValueAtIndex(list, index)
      if (!device) continue
      const width = [0]
      const height = [0]
      if (MTDeviceGetSensorSurfaceDimensions(device, width, height) !== 0) continue
      if (width[0] < MIN_TRACKPAD_WIDTH || height[0] < MIN_TRACKPAD_HEIGHT) continue
      const deviceNumber = index
      const callback = koffi.register(
        (_device: unknown, touches: unknown, fingers: number): number => {
          if (listeners.size === 0) return 0
          try {
            const raw = fingers > 0 && touches ? (koffi.decode(touches, touch, fingers) as MacTouch[]) : []
            const frame = toFrame(deviceNumber, raw)
            for (const listener of listeners) listener(frame)
          } catch (error) {
            console.warn('[glide] could not read a trackpad frame:', error)
          }
          return 0
        },
        koffi.pointer(callbackType)
      )
      MTRegisterContactFrameCallback(device, callback)
      MTDeviceStart(device, 0)
      trackpads++
    }
  } catch (error) {
    loadError = String(error)
    console.warn('[glide] MultitouchSupport unavailable:', error)
  }
  return trackpads
}

/** One MultitouchSupport frame as the gesture detector's TouchFrame. Its y
 *  runs bottom to top; the detector's runs top to bottom. Exported for
 *  tests. */
export function toFrame(device: number, touches: MacTouch[]): TouchFrame {
  const contacts: TouchContact[] = touches.map((each) => ({
    id: each.identifier,
    tip: TOUCHING_STATES.has(each.state),
    confident: each.majorAxis <= PALM_MAJOR_AXIS,
    x: clamp(each.normalized.pos.x),
    y: clamp(1 - each.normalized.pos.y)
  }))
  return { device, contacts, contactCount: contacts.filter((contact) => contact.tip).length }
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Starts delivering trackpad frames to `listener`. Returns the number of
 *  trackpads and the unsubscribe function, or null when there are none. */
export function subscribeMacTrackpad(listener: Listener): { touchpads: number; unsubscribe: () => void } | null {
  const touchpads = startDevices()
  if (touchpads === 0) return null
  listeners.add(listener)
  return { touchpads, unsubscribe: () => listeners.delete(listener) }
}

/** What MultitouchSupport reported, for diagnostics and the CI launch check. */
export function macTrackpadStatus(): { trackpads: number; devicesSeen: number; error: string | null } {
  return { trackpads: startDevices(), devicesSeen, error: loadError }
}

export type { MacTouch }
