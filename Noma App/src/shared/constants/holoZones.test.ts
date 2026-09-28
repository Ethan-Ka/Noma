import { describe, expect, it } from 'vitest'
import { getHoloZoneLabel, getHoloZones, recommendHoloZoneCount } from './index'

describe('recommendHoloZoneCount', () => {
  it('gives a MacBook 4 zones', () => {
    expect(recommendHoloZoneCount({ platform: 'darwin', manufacturer: 'Apple', model: 'MacBookPro18,3' }).count).toBe(4)
  })

  it('gives a Windows laptop (ROG Zephyrus G14) 2 zones', () => {
    const g14 = { platform: 'win32', manufacturer: 'ASUSTeK COMPUTER INC.', model: 'ROG Zephyrus G14 GA402' }
    expect(recommendHoloZoneCount(g14).count).toBe(2)
  })

  it('falls back to 2 when the laptop is unknown', () => {
    expect(recommendHoloZoneCount(null).count).toBe(2)
  })
})

describe('zone sets', () => {
  it('puts the 2-zone pair beside the trackpad, left and right, regardless of mic side', () => {
    expect(getHoloZones(2)).toEqual(['frontLeft', 'frontRight'])
    expect(getHoloZones(2).map((zone) => getHoloZoneLabel(zone, 2))).toEqual(['Left', 'Right'])
  })

  it('keeps the full canonical order for 4 zones', () => {
    expect(getHoloZones(4)).toEqual(['frontLeft', 'frontRight', 'rearLeft', 'rearRight'])
  })
})
