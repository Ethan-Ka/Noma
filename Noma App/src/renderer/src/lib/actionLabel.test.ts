import { describe, expect, it } from 'vitest'
import type { Macro } from '@shared/types'
import { defaultLabelForAction } from './actionLabel'

const macro = (id: string, name: string): Macro => ({ id, name, trigger: 'manual', actions: [], delayMs: 0, enabled: true })

describe('defaultLabelForAction', () => {
  it('names a shortcut by its keys', () => {
    expect(defaultLabelForAction({ type: 'shortcut', keys: ['Control', 'F5'] }, [])).toBe('Ctrl+F5')
  })

  it('leaves the name alone until a shortcut has keys', () => {
    expect(defaultLabelForAction({ type: 'shortcut', keys: [] }, [])).toBeNull()
  })

  it('names a system or flow action in capitals', () => {
    expect(defaultLabelForAction({ type: 'systemCommand', command: 'volumeMute' }, [])).toBe('VOLUME MUTE')
    expect(defaultLabelForAction({ type: 'flowAction', action: 'closeWindow' }, [])).toBe('CLOSE WINDOW')
  })

  it('names a workflow for where it ends, and waits until one is chosen', () => {
    const macros = [macro('m1', 'Visual Studio Code → GitHub Desktop'), macro('m2', 'Morning setup')]
    expect(defaultLabelForAction({ type: 'macro', macroId: 'm1' }, macros)).toBe('GitHub Deskt')
    expect(defaultLabelForAction({ type: 'macro', macroId: 'm2' }, macros)).toBe('Morning setu')
    expect(defaultLabelForAction({ type: 'macro', macroId: '' }, macros)).toBeNull()
  })

  it('never exceeds the 12 characters a small display can show', () => {
    expect(defaultLabelForAction({ type: 'shortcut', keys: ['Control', 'Shift', 'Alt', 'F12'] }, [])!.length).toBeLessThanOrEqual(12)
  })
})
