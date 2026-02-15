import { beforeEach, describe, expect, it } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { usePanelStore } from '../../../src/stores/panelStore'
import { useThemeStore } from '../../../src/stores/themeStore'

const memoryStorage = (() => {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  configurable: true,
})

describe('themeStore', () => {
  beforeEach(() => {
    memoryStorage.clear()
    useThemeStore.persist.setOptions({
      storage: createJSONStorage(() => memoryStorage),
    })
    useThemeStore.setState({
      theme: 'light',
      colorPalette: 'modern',
      structureStyle: 'modern',
    })
  })

  it('cycles theme from light to dark to system', () => {
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('dark')

    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('system')

    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('light')
  })

  it('sets color palette', () => {
    useThemeStore.getState().setColorPalette('ocean')
    expect(useThemeStore.getState().colorPalette).toBe('ocean')

    useThemeStore.getState().setColorPalette('modern')
    expect(useThemeStore.getState().colorPalette).toBe('modern')
  })

  it('sets structure style', () => {
    useThemeStore.getState().setStructureStyle('classic')
    expect(useThemeStore.getState().structureStyle).toBe('classic')

    useThemeStore.getState().setStructureStyle('modern')
    expect(useThemeStore.getState().structureStyle).toBe('modern')
  })
})

describe('panelStore', () => {
  beforeEach(() => {
    memoryStorage.clear()
    usePanelStore.persist.setOptions({
      storage: createJSONStorage(() => memoryStorage),
    })
    usePanelStore.setState({
      sqlPanelHeight: 250,
      preservedScroll: null,
      lastRestoredScrollVersion: 0,
    })
  })

  it('clamps sql panel height within bounds', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })

    usePanelStore.getState().setSqlPanelHeight(50)
    expect(usePanelStore.getState().sqlPanelHeight).toBe(150)

    usePanelStore.getState().setSqlPanelHeight(900)
    expect(usePanelStore.getState().sqlPanelHeight).toBe(700)
  })

  it('tracks scroll preservation versions', () => {
    usePanelStore.getState().saveScrollPosition(5, 120)

    const first = usePanelStore.getState().preservedScroll
    expect(first?.row).toBe(5)
    expect(first?.scrollLeft).toBe(120)
    expect(first?.version).toBeGreaterThan(0) // Now uses Date.now()

    const firstVersion = first!.version
    usePanelStore.getState().markScrollRestored(firstVersion)
    expect(usePanelStore.getState().lastRestoredScrollVersion).toBe(firstVersion)

    usePanelStore.getState().saveScrollPosition(10, 40)
    const second = usePanelStore.getState().preservedScroll
    expect(second?.version).toBeGreaterThanOrEqual(firstVersion) // New timestamp >= old
  })
})
