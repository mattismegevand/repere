import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGridEditingStore } from '@/components/data-grid/stores/gridEditingStore'

describe('gridEditingStore', () => {
  beforeEach(() => {
    useGridEditingStore.setState({
      editingCell: null,
      commitEditCallback: null,
    })
  })

  describe('setEditingCell', () => {
    it('sets editing cell', () => {
      useGridEditingStore.getState().setEditingCell({
        row: 5,
        col: 3,
        value: 'test',
      })
      expect(useGridEditingStore.getState().editingCell).toMatchObject({
        row: 5,
        col: 3,
        value: 'test',
      })
    })

    it('sets editing cell with validity', () => {
      useGridEditingStore.getState().setEditingCell({
        row: 1,
        col: 2,
        value: '123',
        isValid: true,
      })
      expect(useGridEditingStore.getState().editingCell?.isValid).toBe(true)
    })

    it('clears editing cell when set to null', () => {
      useGridEditingStore.getState().setEditingCell({ row: 1, col: 1, value: 'x' })
      useGridEditingStore.getState().setEditingCell(null)
      expect(useGridEditingStore.getState().editingCell).toBeNull()
    })
  })

  describe('updateEditValue', () => {
    it('updates value and validity', () => {
      useGridEditingStore.getState().setEditingCell({ row: 1, col: 1, value: 'old' })
      useGridEditingStore.getState().updateEditValue('new', true)
      const cell = useGridEditingStore.getState().editingCell
      expect(cell?.value).toBe('new')
      expect(cell?.isValid).toBe(true)
    })

    it('updates to invalid value', () => {
      useGridEditingStore.getState().setEditingCell({ row: 1, col: 1, value: 'old' })
      useGridEditingStore.getState().updateEditValue('', false)
      const cell = useGridEditingStore.getState().editingCell
      expect(cell?.value).toBe('')
      expect(cell?.isValid).toBe(false)
    })

    it('is no-op when no editing cell', () => {
      useGridEditingStore.getState().updateEditValue('test', true)
      expect(useGridEditingStore.getState().editingCell).toBeNull()
    })

    it('preserves row and col', () => {
      useGridEditingStore.getState().setEditingCell({ row: 5, col: 10, value: 'old' })
      useGridEditingStore.getState().updateEditValue('new', true)
      const cell = useGridEditingStore.getState().editingCell
      expect(cell?.row).toBe(5)
      expect(cell?.col).toBe(10)
    })
  })

  describe('cancelEdit', () => {
    it('clears editing cell', () => {
      useGridEditingStore.getState().setEditingCell({ row: 1, col: 1, value: 'test' })
      useGridEditingStore.getState().cancelEdit()
      expect(useGridEditingStore.getState().editingCell).toBeNull()
    })
  })

  describe('clearEditingCell', () => {
    it('clears editing cell', () => {
      useGridEditingStore.getState().setEditingCell({ row: 1, col: 1, value: 'test' })
      useGridEditingStore.getState().clearEditingCell()
      expect(useGridEditingStore.getState().editingCell).toBeNull()
    })
  })

  describe('setCommitEditCallback', () => {
    it('sets callback', () => {
      const callback = vi.fn()
      useGridEditingStore.getState().setCommitEditCallback(callback)
      expect(useGridEditingStore.getState().commitEditCallback).toBe(callback)
    })

    it('clears callback when set to null', () => {
      const callback = vi.fn()
      useGridEditingStore.getState().setCommitEditCallback(callback)
      useGridEditingStore.getState().setCommitEditCallback(null)
      expect(useGridEditingStore.getState().commitEditCallback).toBeNull()
    })
  })

  describe('commitEdit', () => {
    it('calls commit callback when set', async () => {
      const callback = vi.fn().mockResolvedValue(undefined)
      useGridEditingStore.getState().setCommitEditCallback(callback)
      await useGridEditingStore.getState().commitEdit()
      expect(callback).toHaveBeenCalledOnce()
    })

    it('does nothing when no callback set', async () => {
      // Should not throw
      await useGridEditingStore.getState().commitEdit()
    })
  })
})
