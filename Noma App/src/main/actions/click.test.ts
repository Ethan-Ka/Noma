import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { executeClick } from './click'
import { SendInput, SetCursorPos, WindowFromPoint } from './win32'
import { processForWindow } from './windowProcess'
import { uiaControlFinder } from './uiaControlFinder'
import { getApplicationById } from '../database/repositories/applicationsRepository'

// Real input and real UI Automation are mocked: these tests are about the
// checks click.ts makes *before* it will click, which is the part that
// decides whether a replayed workflow lands where it should.
vi.mock('./win32', () => ({
  GA_ROOT: 2,
  GetAncestor: vi.fn((hwnd: number) => hwnd),
  GetForegroundWindow: vi.fn(() => 100),
  GetWindowRect: vi.fn((_hwnd: number, rect: Record<string, number>) => {
    Object.assign(rect, { left: 0, top: 0, right: 1600, bottom: 1000 })
    return true
  }),
  IsWindow: vi.fn(() => true),
  SendInput: vi.fn(() => 2),
  SetCursorPos: vi.fn(() => true),
  WindowFromPoint: vi.fn(() => 100),
  INPUT_MOUSE: 0,
  INPUT_SIZE: 40,
  MOUSEEVENTF_LEFTDOWN: 2,
  MOUSEEVENTF_LEFTUP: 4
}))
vi.mock('./windowProcess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./windowProcess')>()),
  processForWindow: vi.fn()
}))
vi.mock('./uiaControlFinder', () => ({ uiaControlFinder: { find: vi.fn(), warmUp: vi.fn() } }))
vi.mock('../database/repositories/applicationsRepository', () => ({ getApplicationById: vi.fn() }))
vi.mock('../workflow/selfInjectedClicks', () => ({ markSelfInjectedClick: vi.fn() }))

const RESOLVE = { id: 'resolve', name: 'DaVinci Resolve', processName: 'Resolve.exe' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getApplicationById).mockReturnValue(RESOLVE)
  vi.mocked(processForWindow).mockReturnValue({ pid: 42, processName: 'Resolve.exe' })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('executeClick: the right app must be in front', () => {
  it('refuses, and clicks nothing, when a different app is in front', async () => {
    vi.mocked(processForWindow).mockReturnValue({ pid: 7, processName: 'chrome.exe' })
    const result = await executeClick('zone:3x3', 'resolve')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('Expected DaVinci Resolve to be in front, but chrome.exe was')
    expect(SendInput).not.toHaveBeenCalled()
  })

  it('treats "Resolve" and "resolve.exe" as the same process', async () => {
    vi.mocked(processForWindow).mockReturnValue({ pid: 42, processName: 'resolve.EXE' })
    expect((await executeClick('zone:3x3', 'resolve')).ok).toBe(true)
  })

  it('still runs a click saved before steps recorded their app', async () => {
    vi.mocked(processForWindow).mockReturnValue({ pid: 7, processName: 'anything.exe' })
    expect((await executeClick('zone:3x3')).ok).toBe(true)
  })
})

describe('executeClick: a named control is found again, not guessed', () => {
  it('clicks the control where it is now', async () => {
    vi.mocked(uiaControlFinder.find).mockResolvedValue({ status: 'found', x: 812, y: 44 })
    const result = await executeClick('label:Blade', 'resolve')
    expect(result.ok).toBe(true)
    expect(uiaControlFinder.find).toHaveBeenCalledWith(42, 'Blade')
    expect(SetCursorPos).toHaveBeenCalledWith(812, 44)
  })

  it('refuses when several controls share the name', async () => {
    vi.mocked(uiaControlFinder.find).mockResolvedValue({ status: 'several', count: 2 })
    const result = await executeClick('label:Close', 'resolve')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('Found 2 buttons named “Close”')
    expect(SendInput).not.toHaveBeenCalled()
  })

  it('refuses when something else is covering the control', async () => {
    vi.mocked(uiaControlFinder.find).mockResolvedValue({ status: 'found', x: 10, y: 10 })
    vi.mocked(WindowFromPoint).mockReturnValue(555)
    vi.mocked(processForWindow).mockImplementation((hwnd) =>
      hwnd === 555 ? { pid: 9, processName: 'Teams.exe' } : { pid: 42, processName: 'Resolve.exe' }
    )
    const result = await executeClick('label:Export', 'resolve')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('covering')
    expect(SendInput).not.toHaveBeenCalled()
  })

  it('waits for a control that is still appearing', async () => {
    vi.mocked(uiaControlFinder.find)
      .mockResolvedValueOnce({ status: 'none' })
      .mockResolvedValueOnce({ status: 'none' })
      .mockResolvedValue({ status: 'found', x: 5, y: 5 })
    vi.useFakeTimers()
    const pending = executeClick('label:Render', 'resolve')
    await vi.advanceTimersByTimeAsync(1000)
    expect((await pending).ok).toBe(true)
    expect(uiaControlFinder.find).toHaveBeenCalledTimes(3)
  })

  it('gives up after a couple of seconds if it never appears', async () => {
    vi.mocked(uiaControlFinder.find).mockResolvedValue({ status: 'none' })
    vi.useFakeTimers()
    const pending = executeClick('label:Render', 'resolve')
    await vi.advanceTimersByTimeAsync(3000)
    const result = await pending
    expect(result.ok).toBe(false)
    expect(result.reason).toContain("Couldn't find “Render”")
    expect(SendInput).not.toHaveBeenCalled()
  })
})

describe('executeClick: a position in a custom-drawn app', () => {
  it("maps the grid cell onto the window's current bounds", async () => {
    const result = await executeClick('zone:0x0')
    expect(result.ok).toBe(true)
    // 16x10 grid over 1600x1000: the centre of the top-left cell.
    expect(SetCursorPos).toHaveBeenCalledWith(50, 50)
  })

  it('refuses a cell outside the grid', async () => {
    expect((await executeClick('zone:40x2')).ok).toBe(false)
  })
})
