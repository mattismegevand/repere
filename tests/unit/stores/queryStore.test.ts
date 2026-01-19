import { beforeEach, describe, expect, it } from 'vitest'
import { useQueryStore } from '@/stores/queryStore'

describe('queryStore', () => {
  beforeEach(() => {
    useQueryStore.getState().reset()
  })

  it('sets and removes filters', () => {
    useQueryStore.getState().setFilter({ column: 'age', operator: 'gt', value: 30 })

    let state = useQueryStore.getState()
    expect(state.filters).toHaveLength(1)
    expect(state.filters[0]).toEqual({ column: 'age', operator: 'gt', value: 30 })

    useQueryStore.getState().removeFilter('age')
    state = useQueryStore.getState()
    expect(state.filters).toHaveLength(0)
  })

  it('replaces filter for same column', () => {
    useQueryStore.getState().setFilter({ column: 'age', operator: 'gt', value: 30 })
    useQueryStore.getState().setFilter({ column: 'age', operator: 'lt', value: 50 })

    const state = useQueryStore.getState()
    expect(state.filters).toHaveLength(1)
    expect(state.filters[0].operator).toBe('lt')
  })

  it('clears all filters', () => {
    useQueryStore.getState().setFilter({ column: 'age', operator: 'gt', value: 30 })
    useQueryStore.getState().setFilter({ column: 'name', operator: 'contains', value: 'John' })
    useQueryStore.getState().clearFilters()

    expect(useQueryStore.getState().filters).toHaveLength(0)
  })

  it('sets sort', () => {
    useQueryStore.getState().setSort({ column: 'name', direction: 'asc' })

    const state = useQueryStore.getState()
    expect(state.sort).toEqual({ column: 'name', direction: 'asc' })
  })

  it('clears sort', () => {
    useQueryStore.getState().setSort({ column: 'name', direction: 'asc' })
    useQueryStore.getState().setSort(null)

    expect(useQueryStore.getState().sort).toBeNull()
  })

  it('sets search and resets offset', () => {
    useQueryStore.getState().setPage(100)
    useQueryStore.getState().setSearch('test')

    const state = useQueryStore.getState()
    expect(state.search).toBe('test')
    expect(state.offset).toBe(0)
  })

  it('resets to initial state', () => {
    useQueryStore.getState().setFilter({ column: 'age', operator: 'gt', value: 30 })
    useQueryStore.getState().setSort({ column: 'name', direction: 'desc' })
    useQueryStore.getState().setSearch('test')
    useQueryStore.getState().reset()

    const state = useQueryStore.getState()
    expect(state.filters).toHaveLength(0)
    expect(state.sort).toBeNull()
    expect(state.search).toBe('')
    expect(state.offset).toBe(0)
  })

  it('toggles case sensitivity and resets offset', () => {
    useQueryStore.getState().setPage(100)
    useQueryStore.getState().toggleSearchCaseSensitive()

    let state = useQueryStore.getState()
    expect(state.searchCaseSensitive).toBe(true)
    expect(state.offset).toBe(0)

    useQueryStore.getState().toggleSearchCaseSensitive()
    state = useQueryStore.getState()
    expect(state.searchCaseSensitive).toBe(false)
  })
})
