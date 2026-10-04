import { describe, expect, it } from 'vitest'
import type { ApplicationContext, Control } from '@shared/types'
import { resolveGlidePress, type GlidePressInput } from './glidePress'

const controls: Control[] = [
  { id: 'c1', slot: 1, label: 'NEW TAB', action: { type: 'shortcut', keys: ['Control', 'T'] } },
  { id: 'c2', slot: 2, label: 'SLOT 2', action: { type: 'shortcut', keys: [] } },
  { id: 'c3', slot: 3, label: 'FLOW', action: { type: 'macro', macroId: 'm1' } }
]

const chrome: ApplicationContext = {
  application: { id: 'chrome', name: 'Google Chrome', processName: 'chrome.exe' },
  profile: { id: 'p', applicationId: 'chrome', name: 'Browsing', controls, macroIds: [], moduleRecommendationIds: [] }
}

function input(overrides: Partial<GlidePressInput> = {}): GlidePressInput {
  return { zone: 'topLeft', context: chrome, nomaFocused: false, touchCheckRunning: false, actionRunning: false, ...overrides }
}

describe('resolveGlidePress', () => {
  it('presses the control on the zone’s slot in the app in front', () => {
    expect(resolveGlidePress(input())).toEqual({ outcome: 'pressed', slot: 1, control: controls[0] })
    expect(resolveGlidePress(input({ zone: 'bottomLeft' }))).toMatchObject({ outcome: 'pressed', slot: 3 })
  })

  it('is practice only while Noma itself is in front (the target app is out of sight)', () => {
    expect(resolveGlidePress(input({ nomaFocused: true }))).toEqual({ outcome: 'practice', slot: 1 })
  })

  it('never presses without a known app', () => {
    expect(resolveGlidePress(input({ context: { application: null, profile: null } })).outcome).toBe('no-app')
  })

  it('does nothing on an empty or missing slot, rather than sending an empty shortcut', () => {
    expect(resolveGlidePress(input({ zone: 'topRight' })).outcome).toBe('no-control')
    expect(resolveGlidePress(input({ zone: 'bottomRight' })).outcome).toBe('no-control')
    expect(resolveGlidePress(input({ context: { ...chrome, profile: null } })).outcome).toBe('no-control')
  })

  it('skips while another action is running (no second run on top of the first)', () => {
    expect(resolveGlidePress(input({ actionRunning: true }))).toEqual({ outcome: 'busy', slot: 1 })
  })

  it('never presses during a touch check', () => {
    expect(resolveGlidePress(input({ touchCheckRunning: true })).outcome).toBe('paused')
  })
})
