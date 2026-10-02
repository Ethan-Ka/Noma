import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetSelfInjectedClickGuardForTesting, isSelfInjectedClick, markSelfInjectedClick } from './selfInjectedClicks'

afterEach(() => {
  __resetSelfInjectedClickGuardForTesting()
  vi.useRealTimers()
})

describe('selfInjectedClicks', () => {
  it('swallows exactly the synthetic click it was marked for', () => {
    markSelfInjectedClick()
    expect(isSelfInjectedClick()).toBe(true)
    expect(isSelfInjectedClick()).toBe(false)
  })

  it('keeps one mark per synthetic click, so two close together are both swallowed', () => {
    markSelfInjectedClick()
    markSelfInjectedClick()
    expect(isSelfInjectedClick()).toBe(true)
    expect(isSelfInjectedClick()).toBe(true)
    expect(isSelfInjectedClick()).toBe(false)
  })

  it('lets a mark expire, so a real click later is never swallowed', () => {
    vi.useFakeTimers()
    markSelfInjectedClick()
    vi.advanceTimersByTime(600)
    expect(isSelfInjectedClick()).toBe(false)
  })
})
