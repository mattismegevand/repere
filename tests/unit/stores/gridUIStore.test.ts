import { beforeEach, describe, expect, it } from 'vitest'
import { useGridUIStore } from '@/stores/gridUIStore'

describe('gridUIStore', () => {
  beforeEach(() => {
    useGridUIStore.setState({
      contextMenu: null,
      columnHeaderMenu: null,
      hoverColumn: null,
      draggedColumn: null,
      dropTargetColumn: null,
      showSparklines: true,
      showColumnPicker: false,
      filterColumn: null,
      confirmDelete: null,
      imagePreviewUrl: null,
    })
  })

  describe('context menu', () => {
    it('setContextMenu opens menu', () => {
      useGridUIStore.getState().setContextMenu({
        x: 100,
        y: 200,
        row: 5,
        col: 3,
        colName: 'price',
        value: 99.99,
      })
      expect(useGridUIStore.getState().contextMenu).toMatchObject({
        x: 100,
        y: 200,
        row: 5,
        col: 3,
        colName: 'price',
        value: 99.99,
      })
    })

    it('setContextMenu closes menu with null', () => {
      useGridUIStore.getState().setContextMenu({
        x: 100,
        y: 200,
        row: 1,
        col: 1,
        colName: 'test',
        value: 'x',
      })
      useGridUIStore.getState().setContextMenu(null)
      expect(useGridUIStore.getState().contextMenu).toBeNull()
    })
  })

  describe('column header menu', () => {
    it('setColumnHeaderMenu opens menu', () => {
      useGridUIStore.getState().setColumnHeaderMenu({
        x: 150,
        y: 50,
        colName: 'id',
        colType: 'INTEGER',
      })
      expect(useGridUIStore.getState().columnHeaderMenu).toMatchObject({
        x: 150,
        y: 50,
        colName: 'id',
        colType: 'INTEGER',
      })
    })

    it('setColumnHeaderMenu closes menu with null', () => {
      useGridUIStore.getState().setColumnHeaderMenu({
        x: 100,
        y: 100,
        colName: 'test',
        colType: 'VARCHAR',
      })
      useGridUIStore.getState().setColumnHeaderMenu(null)
      expect(useGridUIStore.getState().columnHeaderMenu).toBeNull()
    })
  })

  describe('closeAllMenus', () => {
    it('closes both menus', () => {
      useGridUIStore.getState().setContextMenu({
        x: 100,
        y: 200,
        row: 1,
        col: 1,
        colName: 'test',
        value: 'x',
      })
      useGridUIStore.getState().setColumnHeaderMenu({
        x: 100,
        y: 50,
        colName: 'id',
        colType: 'INTEGER',
      })
      useGridUIStore.getState().closeAllMenus()
      expect(useGridUIStore.getState().contextMenu).toBeNull()
      expect(useGridUIStore.getState().columnHeaderMenu).toBeNull()
    })
  })

  describe('hover column', () => {
    it('setHoverColumn sets column', () => {
      useGridUIStore.getState().setHoverColumn('price')
      expect(useGridUIStore.getState().hoverColumn).toBe('price')
    })

    it('setHoverColumn clears with null', () => {
      useGridUIStore.getState().setHoverColumn('price')
      useGridUIStore.getState().setHoverColumn(null)
      expect(useGridUIStore.getState().hoverColumn).toBeNull()
    })
  })

  describe('column drag', () => {
    it('setDraggedColumn sets column', () => {
      useGridUIStore.getState().setDraggedColumn('name')
      expect(useGridUIStore.getState().draggedColumn).toBe('name')
    })

    it('setDropTargetColumn sets column', () => {
      useGridUIStore.getState().setDropTargetColumn('email')
      expect(useGridUIStore.getState().dropTargetColumn).toBe('email')
    })

    it('both can be cleared', () => {
      useGridUIStore.getState().setDraggedColumn('a')
      useGridUIStore.getState().setDropTargetColumn('b')
      useGridUIStore.getState().setDraggedColumn(null)
      useGridUIStore.getState().setDropTargetColumn(null)
      expect(useGridUIStore.getState().draggedColumn).toBeNull()
      expect(useGridUIStore.getState().dropTargetColumn).toBeNull()
    })
  })

  describe('sparklines', () => {
    it('toggleSparklines toggles from true to false', () => {
      expect(useGridUIStore.getState().showSparklines).toBe(true)
      useGridUIStore.getState().toggleSparklines()
      expect(useGridUIStore.getState().showSparklines).toBe(false)
    })

    it('toggleSparklines toggles from false to true', () => {
      useGridUIStore.getState().setShowSparklines(false)
      useGridUIStore.getState().toggleSparklines()
      expect(useGridUIStore.getState().showSparklines).toBe(true)
    })

    it('setShowSparklines sets directly', () => {
      useGridUIStore.getState().setShowSparklines(false)
      expect(useGridUIStore.getState().showSparklines).toBe(false)
      useGridUIStore.getState().setShowSparklines(true)
      expect(useGridUIStore.getState().showSparklines).toBe(true)
    })
  })

  describe('column picker', () => {
    it('toggleColumnPicker toggles from false to true', () => {
      expect(useGridUIStore.getState().showColumnPicker).toBe(false)
      useGridUIStore.getState().toggleColumnPicker()
      expect(useGridUIStore.getState().showColumnPicker).toBe(true)
    })

    it('toggleColumnPicker toggles from true to false', () => {
      useGridUIStore.getState().setShowColumnPicker(true)
      useGridUIStore.getState().toggleColumnPicker()
      expect(useGridUIStore.getState().showColumnPicker).toBe(false)
    })

    it('setShowColumnPicker sets directly', () => {
      useGridUIStore.getState().setShowColumnPicker(true)
      expect(useGridUIStore.getState().showColumnPicker).toBe(true)
    })
  })

  describe('filter column', () => {
    it('setFilterColumn sets state', () => {
      useGridUIStore.getState().setFilterColumn({ column: 'price' })
      expect(useGridUIStore.getState().filterColumn).toMatchObject({ column: 'price' })
    })

    it('setFilterColumn sets with position', () => {
      useGridUIStore.getState().setFilterColumn({
        column: 'status',
        position: { x: 100, y: 200 },
      })
      expect(useGridUIStore.getState().filterColumn?.position).toEqual({ x: 100, y: 200 })
    })

    it('setFilterColumn clears with null', () => {
      useGridUIStore.getState().setFilterColumn({ column: 'test' })
      useGridUIStore.getState().setFilterColumn(null)
      expect(useGridUIStore.getState().filterColumn).toBeNull()
    })
  })

  describe('confirm delete', () => {
    it('setConfirmDelete sets state', () => {
      useGridUIStore.getState().setConfirmDelete({ descendantCount: 5 })
      expect(useGridUIStore.getState().confirmDelete).toEqual({ descendantCount: 5 })
    })

    it('setConfirmDelete clears with null', () => {
      useGridUIStore.getState().setConfirmDelete({ descendantCount: 3 })
      useGridUIStore.getState().setConfirmDelete(null)
      expect(useGridUIStore.getState().confirmDelete).toBeNull()
    })
  })

  describe('image preview', () => {
    it('setImagePreviewUrl sets url', () => {
      useGridUIStore.getState().setImagePreviewUrl('https://example.com/image.png')
      expect(useGridUIStore.getState().imagePreviewUrl).toBe('https://example.com/image.png')
    })

    it('setImagePreviewUrl clears with null', () => {
      useGridUIStore.getState().setImagePreviewUrl('https://example.com/image.png')
      useGridUIStore.getState().setImagePreviewUrl(null)
      expect(useGridUIStore.getState().imagePreviewUrl).toBeNull()
    })
  })
})
