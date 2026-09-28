import { describe, expect, it } from 'vitest'
import { describeCoverage, type RawDevice } from './touchCoverage'

const hid = (name: string, usagePage: number, usage: number): RawDevice => ({ handle: 1, type: 2, name, usagePage, usage })
const mouse = (name: string): RawDevice => ({ handle: 1, type: 0, name, usagePage: 0, usage: 0 })

describe('describeCoverage', () => {
  it('reports direct for a built-in precision touchpad (ASUS G14 device list)', () => {
    const devices = [
      hid('\\?\HID#ASCE1206&Col02#4&128ca555&0&0001#{guid}', 0x0d, 0x05),
      hid('\\?\HID#VID_046D&PID_C548&MI_03#8&e7c08d6&0&0000#{guid}', 0x0d, 0x05),
      mouse('\\?\ACPI#MSFT0001#4&111a5b40&0#{guid}')
    ]
    expect(describeCoverage(devices)).toEqual({ trackpad: 'direct', touchscreen: false })
  })

  it('reports movement-only for a legacy PS/2 Synaptics or ELAN trackpad', () => {
    expect(describeCoverage([mouse('\\?\ACPI#SYN1B7F#4&1&0#{guid}')]).trackpad).toBe('movement-only')
    expect(describeCoverage([mouse('\\?\ACPI#ETD0501#4&1&0#{guid}')]).trackpad).toBe('movement-only')
  })

  it("doesn't let an external keyboard's touchpad hide a legacy built-in one", () => {
    const devices = [
      hid('\\?\HID#VID_046D&PID_C548&MI_03#8&1&0000#{guid}', 0x0d, 0x05),
      mouse('\\?\ACPI#SYN3286#4&1&0#{guid}')
    ]
    expect(describeCoverage(devices).trackpad).toBe('movement-only')
  })

  it('reports none on a desktop with just a mouse, and notices a touchscreen', () => {
    expect(describeCoverage([mouse('\\?\HID#VID_046D&PID_C077#1&0#{guid}')])).toEqual({
      trackpad: 'none',
      touchscreen: false
    })
    expect(describeCoverage([hid('\\?\HID#ELAN2514&Col01#1#{guid}', 0x0d, 0x04)]).touchscreen).toBe(true)
  })
})
