import { describe, expect, it } from 'vitest'
import { compareVersions, notesSince, RELEASE_NOTES } from './releaseNotes'

describe('compareVersions', () => {
  it('compares each part as a number', () => {
    expect(compareVersions('0.1.10', '0.1.9')).toBe(1)
    expect(compareVersions('0.1.8', '0.1.8')).toBe(0)
    expect(compareVersions('0.1.8', '0.2.0')).toBe(-1)
  })
})

describe('notesSince', () => {
  it('shows only versions after the last one seen, newest first, up to the running one', () => {
    expect(notesSince('0.1.7', '0.1.9').map((release) => release.version)).toEqual(['0.1.9', '0.1.8'])
    expect(notesSince('0.1.8', '0.1.9').map((release) => release.version)).toEqual(['0.1.9'])
    expect(notesSince('0.1.8', '0.1.8')).toEqual([])
  })

  it('without a last-seen version, shows the latest few', () => {
    expect(notesSince(null, '0.1.9', 1).map((release) => release.version)).toEqual(['0.1.9'])
  })

  it('every entry has at least one note', () => {
    for (const notes of Object.values(RELEASE_NOTES)) expect(notes.length).toBeGreaterThan(0)
  })
})
