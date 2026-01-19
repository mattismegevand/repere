import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react'
import {
  bucketExpression,
  type DateAddUnit,
  type DateBucket,
  type DateDiffUnit,
  type DatePart,
  dateAddExpression,
  dateDiffExpression,
  extractExpression,
  parseExpression,
  suggestedColumnName,
} from '@/lib/date-helpers'
import { addFilterToExpression, createExpression } from '@/lib/filter-utils'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { useDialogStore, useGridColumnStore, useGridUIStore, useThemeStore } from '@/stores'
import type { FilterExpression, FilterOperation, SortOperation } from '@/types'
import { formatCell } from '../formatters'
import { useColumnsContext, useRowDataContext } from './DataContext'

export interface GridActionsContextValue {
  // Clipboard actions
  copyCell: () => Promise<void>
  copyRowCsv: () => Promise<void>
  copyRowJson: () => Promise<void>

  // Cell context menu actions
  filterByValue: () => Promise<void>
  hideColumn: () => void
  togglePinColumn: () => void

  // Column header menu actions
  sortAsc: () => void
  sortDesc: () => void
  openFilter: () => void
  hideHeaderColumn: () => void
  togglePinHeaderColumn: () => void
  renameColumn: () => void
  dropColumn: () => void

  // Number formatting
  setDecimals: (decimals: number) => void
  toggleThousandsSeparator: () => void
  resetFormat: () => void

  // Date operations
  dateBucket: (bucket: DateBucket) => void
  dateExtract: (part: DatePart) => void
  dateParse: (toType: 'DATE' | 'TIMESTAMP') => void
  dateDiff: (unit: DateDiffUnit) => void
  dateAdd: (amount: number, unit: DateAddUnit) => void

  // Window functions
  openWindowFunction: () => void
}

const GridActionsContext = createContext<GridActionsContextValue | null>(null)

export function useGridActions(): GridActionsContextValue {
  const ctx = useContext(GridActionsContext)
  if (!ctx) throw new Error('useGridActions must be used within GridActionsProvider')
  return ctx
}

interface GridActionsProviderProps {
  children: ReactNode
  filterExpression: FilterExpression | null | undefined
  currentSorts: Array<{ column: string; direction: 'asc' | 'desc' }>
  applyFilter: (operation: FilterOperation) => Promise<boolean>
}

export function GridActionsProvider({
  children,
  filterExpression,
  currentSorts,
  applyFilter,
}: GridActionsProviderProps) {
  // Get data from split contexts (we're inside DataGridProvider)
  const { visibleColumns, getFormat } = useColumnsContext()
  const { getRow } = useRowDataContext()

  // Get pipeline state and actions
  const { activeNode, activeNodeId, applyOrReplaceOperation } = usePipeline()

  // Read from stores
  const columnNumberFormats = useThemeStore((s) => s.columnNumberFormats)
  const setColumnNumberFormat = useThemeStore((s) => s.setColumnNumberFormat)
  const closeAllMenus = useGridUIStore((s) => s.closeAllMenus)
  const toggleColumnVisibility = useGridColumnStore((s) => s.toggleColumnVisibility)
  const toggleColumnPin = useGridColumnStore((s) => s.toggleColumnPin)
  const setFilterColumn = useGridUIStore((s) => s.setFilterColumn)
  const openDialog = useDialogStore((s) => s.openDialog)

  // Clipboard actions
  const copyCell = useCallback(async () => {
    const contextMenu = useGridUIStore.getState().contextMenu
    if (!contextMenu || !activeNode) return
    const column = visibleColumns[contextMenu.col]
    const text = formatCell(contextMenu.value, column?.type ?? 'string', getFormat(column?.name))
    await navigator.clipboard.writeText(text === '∅' ? '' : text)
    closeAllMenus()
  }, [activeNode, visibleColumns, getFormat, closeAllMenus])

  const copyRowCsv = useCallback(async () => {
    const contextMenu = useGridUIStore.getState().contextMenu
    if (!contextMenu || !activeNode) return
    const rowData = getRow(contextMenu.row)
    if (!rowData) return
    const values = activeNode.columns.map((col) => {
      const val = rowData[col.name]
      if (val === null || val === undefined) return ''
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return String(val)
    })
    await navigator.clipboard.writeText(values.join(','))
    closeAllMenus()
  }, [activeNode, getRow, closeAllMenus])

  const copyRowJson = useCallback(async () => {
    const contextMenu = useGridUIStore.getState().contextMenu
    if (!contextMenu) return
    const rowData = getRow(contextMenu.row)
    if (!rowData) return
    await navigator.clipboard.writeText(JSON.stringify(rowData, null, 2))
    closeAllMenus()
  }, [getRow, closeAllMenus])

  // Cell context menu actions
  const filterByValue = useCallback(async () => {
    const contextMenu = useGridUIStore.getState().contextMenu
    if (!contextMenu || !activeNode || !activeNodeId) return
    const column = visibleColumns[contextMenu.col]
    if (!column) return

    const newFilter: { column: string; operator: 'eq' | 'isNull'; value: unknown } = {
      column: column.name,
      operator: contextMenu.value === null ? 'isNull' : 'eq',
      value: contextMenu.value,
    }

    const expression = filterExpression
      ? addFilterToExpression(filterExpression, newFilter)
      : createExpression([newFilter])

    const operation: FilterOperation = { type: 'filter', expression }
    closeAllMenus()
    await applyFilter(operation)
  }, [activeNode, activeNodeId, visibleColumns, filterExpression, applyFilter, closeAllMenus])

  const hideColumn = useCallback(() => {
    const contextMenu = useGridUIStore.getState().contextMenu
    if (!contextMenu) return
    toggleColumnVisibility(contextMenu.colName)
    closeAllMenus()
  }, [toggleColumnVisibility, closeAllMenus])

  const togglePinColumn = useCallback(() => {
    const contextMenu = useGridUIStore.getState().contextMenu
    if (!contextMenu) return
    toggleColumnPin(contextMenu.colName)
    closeAllMenus()
  }, [toggleColumnPin, closeAllMenus])

  // Column header menu actions
  const sortAsc = useCallback(async () => {
    const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
    if (!columnHeaderMenu) return
    const colName = columnHeaderMenu.colName

    const existingIndex = currentSorts.findIndex((s) => s.column === colName)
    let newSorts: Array<{ column: string; direction: 'asc' | 'desc' }>

    if (existingIndex >= 0) {
      newSorts = currentSorts.map((s) => (s.column === colName ? { ...s, direction: 'asc' as const } : s))
    } else {
      newSorts = [...currentSorts, { column: colName, direction: 'asc' as const }]
    }

    closeAllMenus()
    await applyOrReplaceOperation({ type: 'sort', sorts: newSorts } as SortOperation)
  }, [currentSorts, applyOrReplaceOperation, closeAllMenus])

  const sortDesc = useCallback(async () => {
    const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
    if (!columnHeaderMenu) return
    const colName = columnHeaderMenu.colName

    const existingIndex = currentSorts.findIndex((s) => s.column === colName)
    let newSorts: Array<{ column: string; direction: 'asc' | 'desc' }>

    if (existingIndex >= 0) {
      newSorts = currentSorts.map((s) => (s.column === colName ? { ...s, direction: 'desc' as const } : s))
    } else {
      newSorts = [...currentSorts, { column: colName, direction: 'desc' as const }]
    }

    closeAllMenus()
    await applyOrReplaceOperation({ type: 'sort', sorts: newSorts } as SortOperation)
  }, [currentSorts, applyOrReplaceOperation, closeAllMenus])

  const openFilter = useCallback(() => {
    const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
    if (!columnHeaderMenu) return
    setFilterColumn({ column: columnHeaderMenu.colName })
    closeAllMenus()
  }, [setFilterColumn, closeAllMenus])

  const hideHeaderColumn = useCallback(() => {
    const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
    if (!columnHeaderMenu) return
    toggleColumnVisibility(columnHeaderMenu.colName)
    closeAllMenus()
  }, [toggleColumnVisibility, closeAllMenus])

  const togglePinHeaderColumn = useCallback(() => {
    const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
    if (!columnHeaderMenu) return
    toggleColumnPin(columnHeaderMenu.colName)
    closeAllMenus()
  }, [toggleColumnPin, closeAllMenus])

  const renameColumn = useCallback(() => {
    const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
    if (!columnHeaderMenu) return
    const newName = prompt('New column name:', columnHeaderMenu.colName)
    if (newName && newName !== columnHeaderMenu.colName) {
      applyOrReplaceOperation({
        type: 'renameColumns',
        renames: [{ from: columnHeaderMenu.colName, to: newName }],
      })
    }
    closeAllMenus()
  }, [applyOrReplaceOperation, closeAllMenus])

  const dropColumn = useCallback(() => {
    const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
    if (!columnHeaderMenu) return
    applyOrReplaceOperation({
      type: 'removeColumns',
      columns: [columnHeaderMenu.colName],
    })
    closeAllMenus()
  }, [applyOrReplaceOperation, closeAllMenus])

  // Number formatting
  const setDecimals = useCallback(
    (decimals: number) => {
      const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
      if (!columnHeaderMenu) return
      const existing = columnNumberFormats[columnHeaderMenu.colName] || {}
      setColumnNumberFormat(columnHeaderMenu.colName, { ...existing, decimals })
      closeAllMenus()
    },
    [columnNumberFormats, setColumnNumberFormat, closeAllMenus]
  )

  const toggleThousandsSeparator = useCallback(() => {
    const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
    if (!columnHeaderMenu) return
    const existing = columnNumberFormats[columnHeaderMenu.colName] || {}
    setColumnNumberFormat(columnHeaderMenu.colName, {
      ...existing,
      thousandsSeparator: !existing.thousandsSeparator,
    })
    closeAllMenus()
  }, [columnNumberFormats, setColumnNumberFormat, closeAllMenus])

  const resetFormat = useCallback(() => {
    const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
    if (!columnHeaderMenu) return
    setColumnNumberFormat(columnHeaderMenu.colName, null)
    closeAllMenus()
  }, [setColumnNumberFormat, closeAllMenus])

  // Date operations (defined internally, no longer props)
  const dateBucket = useCallback(
    (bucket: DateBucket) => {
      const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
      if (!columnHeaderMenu) return
      const expr = bucketExpression(columnHeaderMenu.colName, bucket)
      const newName = suggestedColumnName(columnHeaderMenu.colName, bucket)
      applyOrReplaceOperation({
        type: 'addColumn',
        columns: [{ name: newName, expression: expr }],
      })
      closeAllMenus()
    },
    [applyOrReplaceOperation, closeAllMenus]
  )

  const dateExtract = useCallback(
    (part: DatePart) => {
      const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
      if (!columnHeaderMenu) return
      const expr = extractExpression(columnHeaderMenu.colName, part)
      const newName = suggestedColumnName(columnHeaderMenu.colName, part)
      applyOrReplaceOperation({
        type: 'addColumn',
        columns: [{ name: newName, expression: expr }],
      })
      closeAllMenus()
    },
    [applyOrReplaceOperation, closeAllMenus]
  )

  const dateParse = useCallback(
    (toType: 'DATE' | 'TIMESTAMP') => {
      const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
      if (!columnHeaderMenu) return
      const expr = parseExpression(columnHeaderMenu.colName, toType)
      const newName = suggestedColumnName(columnHeaderMenu.colName, toType.toLowerCase())
      applyOrReplaceOperation({
        type: 'addColumn',
        columns: [{ name: newName, expression: expr }],
      })
      closeAllMenus()
    },
    [applyOrReplaceOperation, closeAllMenus]
  )

  const dateDiff = useCallback(
    (unit: DateDiffUnit) => {
      const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
      if (!columnHeaderMenu) return
      const expr = dateDiffExpression(columnHeaderMenu.colName, unit)
      const newName = suggestedColumnName(columnHeaderMenu.colName, `${unit}s_since`)
      applyOrReplaceOperation({
        type: 'addColumn',
        columns: [{ name: newName, expression: expr }],
      })
      closeAllMenus()
    },
    [applyOrReplaceOperation, closeAllMenus]
  )

  const dateAdd = useCallback(
    (amount: number, unit: DateAddUnit) => {
      const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
      if (!columnHeaderMenu) return
      const expr = dateAddExpression(columnHeaderMenu.colName, amount, unit)
      const sign = amount >= 0 ? 'plus' : 'minus'
      const newName = suggestedColumnName(columnHeaderMenu.colName, `${sign}_${Math.abs(amount)}_${unit}`)
      applyOrReplaceOperation({
        type: 'addColumn',
        columns: [{ name: newName, expression: expr }],
      })
      closeAllMenus()
    },
    [applyOrReplaceOperation, closeAllMenus]
  )

  // Window function dialog
  const openWindowFunction = useCallback(() => {
    const columnHeaderMenu = useGridUIStore.getState().columnHeaderMenu
    if (!columnHeaderMenu) return
    openDialog({ type: 'window', column: columnHeaderMenu.colName })
    closeAllMenus()
  }, [openDialog, closeAllMenus])

  const value = useMemo<GridActionsContextValue>(
    () => ({
      copyCell,
      copyRowCsv,
      copyRowJson,
      filterByValue,
      hideColumn,
      togglePinColumn,
      sortAsc,
      sortDesc,
      openFilter,
      hideHeaderColumn,
      togglePinHeaderColumn,
      renameColumn,
      dropColumn,
      setDecimals,
      toggleThousandsSeparator,
      resetFormat,
      dateBucket,
      dateExtract,
      dateParse,
      dateDiff,
      dateAdd,
      openWindowFunction,
    }),
    [
      copyCell,
      copyRowCsv,
      copyRowJson,
      filterByValue,
      hideColumn,
      togglePinColumn,
      sortAsc,
      sortDesc,
      openFilter,
      hideHeaderColumn,
      togglePinHeaderColumn,
      renameColumn,
      dropColumn,
      setDecimals,
      toggleThousandsSeparator,
      resetFormat,
      dateBucket,
      dateExtract,
      dateParse,
      dateDiff,
      dateAdd,
      openWindowFunction,
    ]
  )

  return <GridActionsContext.Provider value={value}>{children}</GridActionsContext.Provider>
}
