import { describe, expect, it } from 'vitest'
import { macApplicationId, toMacApplication } from './macAdapter'

describe('macApplicationId', () => {
  it('maps well-known bundle ids onto the ids Windows uses', () => {
    expect(macApplicationId('com.microsoft.VSCode', 'Electron')).toBe('code')
    expect(macApplicationId('com.google.Chrome', 'Google Chrome')).toBe('chrome')
    expect(macApplicationId('com.spotify.client', 'Spotify')).toBe('spotify')
  })

  it('falls back to the lowercased executable name', () => {
    expect(macApplicationId('com.example.Thing', 'Thing App')).toBe('thing app')
    expect(macApplicationId(null, 'Figma')).toBe('figma')
  })
})

describe('toMacApplication', () => {
  it('keeps the executable as processName and the bundle as the icon path', () => {
    expect(
      toMacApplication({
        processId: 123,
        name: 'Visual Studio Code',
        executable: 'Electron',
        bundleId: 'com.microsoft.VSCode',
        bundlePath: '/Applications/Visual Studio Code.app'
      })
    ).toEqual({
      id: 'code',
      name: 'Visual Studio Code',
      processName: 'Electron',
      executablePath: '/Applications/Visual Studio Code.app'
    })
  })
})
