import { beforeEach, describe, expect, it } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { useSqlStore } from '@/stores/sqlStore'

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

describe('sqlStore', () => {
  beforeEach(() => {
    memoryStorage.clear()
    useSqlStore.persist.setOptions({
      storage: createJSONStorage(() => memoryStorage),
    })
    useSqlStore.setState({ savedQueries: [], history: [] })
  })

  it('stores unique history entries and caps length', () => {
    useSqlStore.getState().addToHistory('select 1')
    useSqlStore.getState().addToHistory('select 1')

    expect(useSqlStore.getState().history).toEqual(['select 1'])

    for (let i = 0; i < 25; i += 1) {
      useSqlStore.getState().addToHistory(`select ${i}`)
    }

    const history = useSqlStore.getState().history
    expect(history).toHaveLength(20)
    expect(history[0]).toBe('select 24')
    expect(history[history.length - 1]).toBe('select 5')
  })

  it('saves, renames, and deletes queries', () => {
    useSqlStore.getState().saveQuery('Test Query', 'select 1')

    const saved = useSqlStore.getState().savedQueries[0]
    expect(saved?.name).toBe('Test Query')
    expect(saved?.sql).toBe('select 1')

    if (!saved) return

    useSqlStore.getState().renameQuery(saved.id, 'Renamed Query')
    expect(useSqlStore.getState().savedQueries[0]?.name).toBe('Renamed Query')

    useSqlStore.getState().deleteQuery(saved.id)
    expect(useSqlStore.getState().savedQueries).toHaveLength(0)
  })

  it('clears history entries', () => {
    useSqlStore.getState().addToHistory('select 1')
    useSqlStore.getState().addToHistory('select 2')

    expect(useSqlStore.getState().history).toHaveLength(2)

    useSqlStore.getState().clearHistory()
    expect(useSqlStore.getState().history).toHaveLength(0)
  })
})
