import { create } from 'zustand'
import type { Filter, Sort } from '@/types'

interface QueryState {
  filters: Filter[]
  sort: Sort | null
  search: string
  searchCaseSensitive: boolean
  limit: number
  offset: number
}

interface QueryActions {
  setFilter: (filter: Filter) => void
  removeFilter: (column: string) => void
  clearFilters: () => void
  setSort: (sort: Sort | null) => void
  setSearch: (search: string) => void
  toggleSearchCaseSensitive: () => void
  setPage: (offset: number) => void
  reset: () => void
}

const initial: QueryState = {
  filters: [],
  sort: null,
  search: '',
  searchCaseSensitive: false,
  limit: 50000,
  offset: 0,
}

export const useQueryStore = create<QueryState & QueryActions>((set) => ({
  ...initial,

  setFilter: (filter) =>
    set((state) => ({
      filters: [...state.filters.filter((f) => f.column !== filter.column), filter],
      offset: 0,
    })),

  removeFilter: (column) =>
    set((state) => ({
      filters: state.filters.filter((f) => f.column !== column),
      offset: 0,
    })),

  clearFilters: () => set({ filters: [], offset: 0 }),

  setSort: (sort) => set({ sort }),

  setSearch: (search) => set({ search, offset: 0 }),

  toggleSearchCaseSensitive: () => set((state) => ({ searchCaseSensitive: !state.searchCaseSensitive, offset: 0 })),

  setPage: (offset) => set({ offset }),

  reset: () => set(initial),
}))
