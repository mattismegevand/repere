import { describe, expect, it } from 'vitest'
import { formatShortcut, isMacPlatform, isModKey } from '@/lib/platform'

describe('formatShortcut', () => {
  it('formats mac shortcuts with symbols', () => {
    expect(formatShortcut('CMD+K', true)).toBe('⌘K')
    expect(formatShortcut('SHIFT+CMD+Z', true)).toBe('⇧⌘Z')
  })

  it('converts symbols to ctrl/shift on non-mac', () => {
    expect(formatShortcut('⌘K', false)).toBe('Ctrl+K')
    expect(formatShortcut('⇧⌘Z', false)).toBe('Shift+Ctrl+Z')
  })

  it('normalizes CMD/SHIFT on non-mac', () => {
    expect(formatShortcut('CMD+/', false)).toBe('Ctrl+/')
    expect(formatShortcut('SHIFT+CMD+/', false)).toBe('Shift+Ctrl+/')
  })
})

describe('isMacPlatform', () => {
  it('detects mac-like platform strings', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'MacIntel', userAgent: '' },
      configurable: true,
    })

    expect(isMacPlatform()).toBe(true)
  })

  it('returns false for non-mac platforms', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32', userAgent: 'Windows NT' },
      configurable: true,
    })

    expect(isMacPlatform()).toBe(false)
  })
})

describe('isModKey', () => {
  it('returns metaKey on Mac', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'MacIntel', userAgent: '' },
      configurable: true,
    })

    const metaEvent = { metaKey: true, ctrlKey: false } as KeyboardEvent
    const ctrlEvent = { metaKey: false, ctrlKey: true } as KeyboardEvent

    expect(isModKey(metaEvent)).toBe(true)
    expect(isModKey(ctrlEvent)).toBe(false)
  })

  it('returns ctrlKey on Windows/Linux', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32', userAgent: 'Windows NT' },
      configurable: true,
    })

    const metaEvent = { metaKey: true, ctrlKey: false } as KeyboardEvent
    const ctrlEvent = { metaKey: false, ctrlKey: true } as KeyboardEvent

    expect(isModKey(metaEvent)).toBe(false)
    expect(isModKey(ctrlEvent)).toBe(true)
  })
})
