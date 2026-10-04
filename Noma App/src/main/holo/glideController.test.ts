import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApplicationContext, HoloTrackpadEvent } from '@shared/types'
import { __setDatabaseForTesting, runMigrations } from '../database/db'
import { getGlideEnabled, setGlideEnabled, setInputSource } from '../database/repositories/settingsRepository'

/** A stand-in for the touchpad reader: no Win32, and the test drives it. */
const fake = vi.hoisted(() => ({
  touchpads: 1 as number | null,
  running: false,
  emit: null as null | ((event: HoloTrackpadEvent) => void),
  startCalls: 0,
  stopCalls: 0
}))

vi.mock('./trackpadGestureService', () => ({
  TrackpadGestureService: class {
    constructor(emit: (event: HoloTrackpadEvent) => void) {
      fake.emit = emit
    }
    start() {
      fake.startCalls++
      fake.running = fake.touchpads !== null
      return fake.touchpads === null ? null : { touchpads: fake.touchpads }
    }
    stop() {
      fake.stopCalls++
      fake.running = false
    }
    startTrace() {
      return { touchpads: 1 }
    }
    stopTrace() {
      return null
    }
  }
}))

const { GlideController } = await import('./glideController')

const chrome: ApplicationContext = {
  application: { id: 'chrome', name: 'Google Chrome', processName: 'chrome.exe' },
  profile: {
    id: 'p',
    applicationId: 'chrome',
    name: 'Browsing',
    controls: [{ id: 'c1', slot: 1, label: 'NEW TAB', action: { type: 'shortcut', keys: ['Control', 'T'] } }],
    macroIds: [],
    moduleRecommendationIds: []
  }
}

function makeController(overrides: { focused?: boolean } = {}) {
  const host = {
    getWindow: vi.fn(() => ({}) as never),
    getContext: vi.fn(() => chrome),
    isNomaFocused: vi.fn(() => overrides.focused ?? false),
    isActionRunning: vi.fn(() => false),
    press: vi.fn(),
    emitState: vi.fn(),
    emitActivity: vi.fn()
  }
  return { controller: new GlideController(host), host }
}

const onWindows = process.platform === 'win32'

beforeEach(() => {
  const db = new Database(':memory:')
  runMigrations(db)
  __setDatabaseForTesting(db)
  Object.assign(fake, { touchpads: 1, running: false, startCalls: 0, stopCalls: 0 })
})

describe('Glide settings', () => {
  it('is off on a fresh install, and on for an older install that had chosen Glide as input', () => {
    expect(getGlideEnabled()).toBe(false)
    setInputSource('holo')
    expect(getGlideEnabled()).toBe(true)
    setGlideEnabled(false)
    expect(getGlideEnabled()).toBe(false)
  })
})

describe.runIf(onWindows)('GlideController', () => {
  it('turning on starts the reader and remembers it; turning off stops it at once', () => {
    const { controller, host } = makeController()
    expect(controller.setEnabled(true)).toMatchObject({ enabled: true, touchpads: 1, error: null })
    expect(getGlideEnabled()).toBe(true)
    expect(fake.running).toBe(true)

    expect(controller.setEnabled(false).enabled).toBe(false)
    expect(fake.running).toBe(false)
    expect(getGlideEnabled()).toBe(false)
    expect(host.emitState).toHaveBeenCalledTimes(2)
  })

  it('stays off, with a plain reason, when there is no precision touchpad', () => {
    fake.touchpads = 0
    const { controller } = makeController()
    const state = controller.setEnabled(true)
    expect(state.enabled).toBe(false)
    expect(state.error).toMatch(/precision touchpad/)
    expect(getGlideEnabled()).toBe(false)
  })

  it('comes back on at launch only if it was on', () => {
    const { controller } = makeController()
    controller.resume()
    expect(fake.startCalls).toBe(0)
    setGlideEnabled(true)
    controller.resume()
    expect(fake.running).toBe(true)
  })

  it('shutDown stops reading without forgetting the setting', () => {
    const { controller } = makeController()
    controller.setEnabled(true)
    controller.shutDown()
    expect(fake.running).toBe(false)
    expect(getGlideEnabled()).toBe(true)
  })

  it('a recognised swipe presses the zone’s control and reports what ran', () => {
    const { controller, host } = makeController()
    controller.setEnabled(true)
    fake.emit?.({ type: 'fire', zone: 'topLeft', at: 5 })
    expect(host.press).toHaveBeenCalledWith(chrome.profile!.controls[0])
    expect(host.emitActivity).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'pressed', controlLabel: 'NEW TAB', applicationName: 'Google Chrome' })
    )
  })

  it('with Noma in front a swipe is practice: reported, never pressed', () => {
    const { controller, host } = makeController({ focused: true })
    controller.setEnabled(true)
    fake.emit?.({ type: 'fire', zone: 'topLeft', at: 5 })
    expect(host.press).not.toHaveBeenCalled()
    expect(host.emitActivity).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'practice' }))
  })

  it('passes misses through for feedback without pressing anything', () => {
    const { controller, host } = makeController()
    controller.setEnabled(true)
    fake.emit?.({ type: 'miss', zone: 'topRight', at: 5, reason: 'typing' })
    expect(host.press).not.toHaveBeenCalled()
    expect(host.emitActivity).toHaveBeenCalledWith({ type: 'miss', zone: 'topRight', at: 5, reason: 'typing' })
  })
})
