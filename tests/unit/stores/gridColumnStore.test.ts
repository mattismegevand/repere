import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isInternalColumn, useGridColumnStore } from '@/stores/gridColumnStore'

describe('gridColumnStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGridColumnStore.setState({
      allColumnSizes: {},
      hiddenColumns: new Set(),
      pinnedColumns: new Set(),
      currentStorageKey: null,
    })
  })

  describe('isInternalColumn', () => {
    it('returns true for _row_type', () => {
      expect(isInternalColumn('_row_type')).toBe(true)
    })

    it('returns true for _sort_group', () => {
      expect(isInternalColumn('_sort_group')).toBe(true)
    })

    it('returns false for regular column', () => {
      expect(isInternalColumn('id')).toBe(false)
      expect(isInternalColumn('name')).toBe(false)
    })
  })

  describe('initForTable', () => {
    it('resets state when storageKey is undefined', () => {
      useGridColumnStore.getState().initForTable(undefined)
      const state = useGridColumnStore.getState()
      expect(state.hiddenColumns.size).toBe(0)
      expect(state.pinnedColumns.size).toBe(0)
      expect(state.currentStorageKey).toBeNull()
    })

    it('sets currentStorageKey when provided', () => {
      useGridColumnStore.getState().initForTable('test-table')
      expect(useGridColumnStore.getState().currentStorageKey).toBe('test-table')
    })

    it('uses existing column sizes from allColumnSizes', () => {
      useGridColumnStore.setState({
        allColumnSizes: { 'test-table': { id: 200, name: 300 } },
      })
      useGridColumnStore.getState().initForTable('test-table')
      expect(useGridColumnStore.getState().getColumnSize('id')).toBe(200)
      expect(useGridColumnStore.getState().getColumnSize('name')).toBe(300)
    })

    it('returns default size for tables without stored sizes', () => {
      useGridColumnStore.getState().initForTable('test-table')
      expect(useGridColumnStore.getState().getColumnSize('unknown')).toBe(150)
    })

    it('clears hidden and pinned columns on init', () => {
      useGridColumnStore.setState({
        hiddenColumns: new Set(['a', 'b']),
        pinnedColumns: new Set(['c']),
      })
      useGridColumnStore.getState().initForTable('test-table')
      expect(useGridColumnStore.getState().hiddenColumns.size).toBe(0)
      expect(useGridColumnStore.getState().pinnedColumns.size).toBe(0)
    })
  })

  describe('getColumnSize', () => {
    it('returns stored size if exists', () => {
      useGridColumnStore.setState({
        currentStorageKey: 'test',
        allColumnSizes: { test: { id: 250 } },
      })
      expect(useGridColumnStore.getState().getColumnSize('id')).toBe(250)
    })

    it('returns default 150 if not stored', () => {
      expect(useGridColumnStore.getState().getColumnSize('unknown')).toBe(150)
    })
  })

  describe('resizeColumn', () => {
    it('updates column size', () => {
      useGridColumnStore.setState({ currentStorageKey: 'test' })
      useGridColumnStore.getState().resizeColumn('name', 300)
      expect(useGridColumnStore.getState().allColumnSizes.test?.name).toBe(300)
    })

    it('stores sizes under current storage key', () => {
      useGridColumnStore.setState({ currentStorageKey: 'my-table' })
      useGridColumnStore.getState().resizeColumn('col1', 400)
      expect(useGridColumnStore.getState().allColumnSizes['my-table']?.col1).toBe(400)
    })

    it('does not update when storageKey is null', () => {
      useGridColumnStore.setState({ currentStorageKey: null })
      useGridColumnStore.getState().resizeColumn('name', 300)
      expect(useGridColumnStore.getState().allColumnSizes).toEqual({})
    })
  })

  describe('setAllColumnSizes', () => {
    it('sets all column sizes at once', () => {
      useGridColumnStore.setState({ currentStorageKey: 'test' })
      useGridColumnStore.getState().setAllColumnSizes({ id: 100, name: 200 })
      expect(useGridColumnStore.getState().allColumnSizes.test).toEqual({ id: 100, name: 200 })
    })

    it('does not update when storageKey is null', () => {
      useGridColumnStore.setState({ currentStorageKey: null })
      useGridColumnStore.getState().setAllColumnSizes({ id: 100 })
      expect(useGridColumnStore.getState().allColumnSizes).toEqual({})
    })
  })

  describe('toggleColumnVisibility', () => {
    it('hides visible column', () => {
      useGridColumnStore.getState().toggleColumnVisibility('name')
      expect(useGridColumnStore.getState().hiddenColumns.has('name')).toBe(true)
    })

    it('shows hidden column', () => {
      useGridColumnStore.setState({ hiddenColumns: new Set(['name']) })
      useGridColumnStore.getState().toggleColumnVisibility('name')
      expect(useGridColumnStore.getState().hiddenColumns.has('name')).toBe(false)
    })
  })

  describe('showAllColumns', () => {
    it('clears all hidden columns', () => {
      useGridColumnStore.setState({ hiddenColumns: new Set(['a', 'b', 'c']) })
      useGridColumnStore.getState().showAllColumns()
      expect(useGridColumnStore.getState().hiddenColumns.size).toBe(0)
    })
  })

  describe('isColumnHidden', () => {
    it('returns true for hidden column', () => {
      useGridColumnStore.setState({ hiddenColumns: new Set(['name']) })
      expect(useGridColumnStore.getState().isColumnHidden('name')).toBe(true)
    })

    it('returns false for visible column', () => {
      expect(useGridColumnStore.getState().isColumnHidden('name')).toBe(false)
    })

    it('returns true for internal columns', () => {
      expect(useGridColumnStore.getState().isColumnHidden('_row_type')).toBe(true)
      expect(useGridColumnStore.getState().isColumnHidden('_sort_group')).toBe(true)
    })
  })

  describe('toggleColumnPin', () => {
    it('pins unpinned column', () => {
      useGridColumnStore.getState().toggleColumnPin('id')
      expect(useGridColumnStore.getState().pinnedColumns.has('id')).toBe(true)
    })

    it('unpins pinned column', () => {
      useGridColumnStore.setState({ pinnedColumns: new Set(['id']) })
      useGridColumnStore.getState().toggleColumnPin('id')
      expect(useGridColumnStore.getState().pinnedColumns.has('id')).toBe(false)
    })
  })

  describe('unpinAllColumns', () => {
    it('clears all pinned columns', () => {
      useGridColumnStore.setState({ pinnedColumns: new Set(['a', 'b', 'c']) })
      useGridColumnStore.getState().unpinAllColumns()
      expect(useGridColumnStore.getState().pinnedColumns.size).toBe(0)
    })
  })

  describe('isColumnPinned', () => {
    it('returns true for pinned column', () => {
      useGridColumnStore.setState({ pinnedColumns: new Set(['id']) })
      expect(useGridColumnStore.getState().isColumnPinned('id')).toBe(true)
    })

    it('returns false for unpinned column', () => {
      expect(useGridColumnStore.getState().isColumnPinned('id')).toBe(false)
    })
  })
})
