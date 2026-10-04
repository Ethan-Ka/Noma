import { describe, expect, it } from 'vitest'
import { glideZoneForSlot, glideZonesFor } from '@shared/constants'
import type { GlideState } from '@shared/types'
import { glideActivityMessage, glideStatusLine } from './glideMessages'

const BASE: GlideState = { enabled: true, zoneCount: 4, platformSupported: true, touchpads: 1, error: null }

describe('Glide zones and slots', () => {
  it('maps four zones to slots 1-4 and two zones to the upper (whole-side) slots', () => {
    expect(glideZonesFor(4)).toEqual(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'])
    expect(glideZonesFor(2)).toEqual(['topLeft', 'topRight'])
    expect(glideZoneForSlot(3, 4)).toBe('bottomLeft')
    expect(glideZoneForSlot(3, 2)).toBeNull()
  })
})

describe('glideActivityMessage', () => {
  it('says what ran and where', () => {
    expect(
      glideActivityMessage(
        { type: 'fire', zone: 'topLeft', slot: 1, at: 0, outcome: 'pressed', controlLabel: 'NEW TAB', applicationName: 'Google Chrome' },
        4
      )
    ).toBe('Upper left: ran “NEW TAB” in Google Chrome.')
  })

  it('explains practice mode and empty zones instead of failing silently', () => {
    expect(glideActivityMessage({ type: 'fire', zone: 'topRight', slot: 2, at: 0, outcome: 'practice' }, 2)).toMatch(
      /^Right: recognised\. Practice only/
    )
    expect(
      glideActivityMessage({ type: 'fire', zone: 'bottomRight', slot: 4, at: 0, outcome: 'no-control', applicationName: 'Notepad' }, 4)
    ).toBe('Lower right: recognised, but nothing is set on this zone in Notepad.')
  })

  it('coaches on misses', () => {
    expect(glideActivityMessage({ type: 'miss', zone: 'topLeft', at: 0, reason: 'too-slow' }, 4)).toMatch(/Flick in quickly/)
  })
})

describe('glideStatusLine', () => {
  it('distinguishes on, off, unsupported and broken', () => {
    expect(glideStatusLine(BASE)).toEqual({ tone: 'on', text: 'On, watching your trackpad' })
    expect(glideStatusLine({ ...BASE, enabled: false }).tone).toBe('off')
    expect(glideStatusLine({ ...BASE, platformSupported: false }).tone).toBe('problem')
    expect(glideStatusLine({ ...BASE, enabled: false, error: 'No precision touchpad found.' })).toEqual({
      tone: 'problem',
      text: 'No precision touchpad found.'
    })
  })
})
