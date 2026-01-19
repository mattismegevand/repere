import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/lib/id'

interface SavedQuery {
  id: string
  name: string
  sql: string
  createdAt: number
}

interface SqlState {
  savedQueries: SavedQuery[]
  history: string[] // Last 20 executed queries
}

interface SqlActions {
  // Saved queries
  saveQuery: (name: string, sql: string) => void
  deleteQuery: (id: string) => void
  renameQuery: (id: string, name: string) => void

  // History
  addToHistory: (sql: string) => void
  clearHistory: () => void
}

const MAX_HISTORY = 20

export const useSqlStore = create<SqlState & SqlActions>()(
  persist(
    (set) => ({
      savedQueries: [],
      history: [],

      saveQuery: (name, sql) => {
        const id = generateId('query', 5)
        set((state) => ({
          savedQueries: [{ id, name, sql, createdAt: Date.now() }, ...state.savedQueries],
        }))
      },

      deleteQuery: (id) => {
        set((state) => ({
          savedQueries: state.savedQueries.filter((q) => q.id !== id),
        }))
      },

      renameQuery: (id, name) => {
        set((state) => ({
          savedQueries: state.savedQueries.map((q) => (q.id === id ? { ...q, name } : q)),
        }))
      },

      addToHistory: (sql) => {
        set((state) => {
          // Don't add duplicates of the most recent query
          if (state.history[0] === sql) return state
          // Add to front, keep only MAX_HISTORY
          const newHistory = [sql, ...state.history.filter((h) => h !== sql)].slice(0, MAX_HISTORY)
          return { history: newHistory }
        })
      },

      clearHistory: () => {
        set({ history: [] })
      },
    }),
    {
      name: 'repere-sql',
    }
  )
)
