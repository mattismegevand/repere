import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'

// Internal columns to always hide (used by pivot subtotals)
const INTERNAL_COLUMNS = new Set(['_row_type', '_sort_group'])

interface GridColumnState {
  // All column sizes across all tables (storageKey -> colName -> width)
  allColumnSizes: Record<string, Record<string, number>>
  // Current table's state (computed from allColumnSizes)
  hiddenColumns: Set<string>
  pinnedColumns: Set<string>
  // Current storage key for active table
  currentStorageKey: string | null
}

interface GridColumnActions {
  // Initialize for a new table
  initForTable: (storageKey: string | undefined) => void
  // Column size actions
  getColumnSize: (colName: string) => number
  resizeColumn: (colName: string, width: number) => void
  setAllColumnSizes: (sizes: Record<string, number>) => void
  // Visibility actions
  toggleColumnVisibility: (colName: string) => void
  showAllColumns: () => void
  isColumnHidden: (colName: string) => boolean
  // Pin actions
  toggleColumnPin: (colName: string) => void
  unpinAllColumns: () => void
  isColumnPinned: (colName: string) => boolean
}

// Helper to check if column should be hidden (internal columns)
export function isInternalColumn(colName: string): boolean {
  return INTERNAL_COLUMNS.has(colName)
}

export const useGridColumnStore = create<GridColumnState & GridColumnActions>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // State
        allColumnSizes: {},
        hiddenColumns: new Set(),
        pinnedColumns: new Set(),
        currentStorageKey: null,

        // Initialize for a new table
        initForTable: (storageKey) => {
          if (!storageKey) {
            set({
              hiddenColumns: new Set(),
              pinnedColumns: new Set(),
              currentStorageKey: null,
            })
            return
          }

          set({
            hiddenColumns: new Set(),
            pinnedColumns: new Set(),
            currentStorageKey: storageKey,
          })
        },

        getColumnSize: (colName) => {
          const { allColumnSizes, currentStorageKey } = get()
          if (!currentStorageKey) return 150
          return allColumnSizes[currentStorageKey]?.[colName] ?? 150
        },

        resizeColumn: (colName, width) => {
          const { currentStorageKey, allColumnSizes } = get()
          if (!currentStorageKey) return

          set({
            allColumnSizes: {
              ...allColumnSizes,
              [currentStorageKey]: {
                ...allColumnSizes[currentStorageKey],
                [colName]: width,
              },
            },
          })
        },

        setAllColumnSizes: (sizes) => {
          const { currentStorageKey, allColumnSizes } = get()
          if (!currentStorageKey) return

          set({
            allColumnSizes: {
              ...allColumnSizes,
              [currentStorageKey]: sizes,
            },
          })
        },

        toggleColumnVisibility: (colName) => {
          set((state) => {
            const next = new Set(state.hiddenColumns)
            if (next.has(colName)) {
              next.delete(colName)
            } else {
              next.add(colName)
            }
            return { hiddenColumns: next }
          })
        },

        showAllColumns: () => {
          set({ hiddenColumns: new Set() })
        },

        isColumnHidden: (colName) => {
          return get().hiddenColumns.has(colName) || INTERNAL_COLUMNS.has(colName)
        },

        toggleColumnPin: (colName) => {
          set((state) => {
            const next = new Set(state.pinnedColumns)
            if (next.has(colName)) {
              next.delete(colName)
            } else {
              next.add(colName)
            }
            return { pinnedColumns: next }
          })
        },

        unpinAllColumns: () => {
          set({ pinnedColumns: new Set() })
        },

        isColumnPinned: (colName) => {
          return get().pinnedColumns.has(colName)
        },
      }),
      {
        name: 'repere-grid-columns',
        partialize: (state) => ({
          allColumnSizes: state.allColumnSizes,
        }),
      }
    )
  )
)
