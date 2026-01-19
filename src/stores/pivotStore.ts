import { create } from 'zustand'
import type { Filter } from '@/types/dataset'
import type { AggregateFunction, PivotOperation } from '@/types/pipeline'

export type ValueFormatType = 'number' | 'currency' | 'percent' | 'decimal'

// "Show Values As" options (like Excel)
export type ShowValuesAs =
  | 'normal' // Raw aggregate value (default)
  | 'percentOfGrandTotal' // value / grand_total
  | 'percentOfParentTotal' // value / parent_subtotal
  | 'percentOfColumnTotal' // value / column_total (for pivot mode)

export interface ValueFormat {
  type: ValueFormatType
  decimals: number
  prefix?: string
  suffix?: string
}

export interface PivotValueField {
  id: string
  column: string
  aggregation: AggregateFunction
  alias: string
  format: ValueFormat
  showValuesAs?: ShowValuesAs
}

interface PivotState {
  // Field assignments
  rowFields: string[]
  columnField: string | null
  valueFields: PivotValueField[]

  // Filters
  filters: Filter[]

  // Options
  showSubtotals: boolean
  showGrandTotal: boolean

  // UI state
  expandedGroups: Set<string>
  sortColumn: string | null
  sortDirection: 'asc' | 'desc'
}

interface PivotActions {
  // Field management
  setRowFields: (fields: string[]) => void
  addRowField: (field: string) => void
  removeRowField: (field: string) => void
  reorderRowFields: (fromIndex: number, toIndex: number) => void

  setColumnField: (field: string | null) => void

  setValueFields: (fields: PivotValueField[]) => void
  addValueField: (field: Omit<PivotValueField, 'id'>) => void
  removeValueField: (id: string) => void
  updateValueField: (id: string, updates: Partial<PivotValueField>) => void

  // Filters
  setFilters: (filters: Filter[]) => void
  addFilter: (filter: Filter) => void
  updateFilter: (index: number, filter: Filter) => void
  removeFilter: (index: number) => void

  // Options
  setShowSubtotals: (show: boolean) => void
  setShowGrandTotal: (show: boolean) => void

  // UI state
  toggleGroupExpand: (groupPath: string) => void
  expandAll: () => void
  collapseAll: () => void
  setSort: (column: string | null, direction: 'asc' | 'desc') => void

  // Reset
  reset: () => void

  // Load from existing operation (for edit mode)
  loadFromOperation: (op: PivotOperation) => void
}

const initialState: PivotState = {
  rowFields: [],
  columnField: null,
  valueFields: [],
  filters: [],
  showSubtotals: true,
  showGrandTotal: true,
  expandedGroups: new Set(),
  sortColumn: null,
  sortDirection: 'asc',
}

export const usePivotStore = create<PivotState & PivotActions>()((set) => ({
  ...initialState,

  setRowFields: (fields) => set({ rowFields: fields }),

  addRowField: (field) =>
    set((s) => ({
      rowFields: s.rowFields.includes(field) ? s.rowFields : [...s.rowFields, field],
    })),

  removeRowField: (field) =>
    set((s) => ({
      rowFields: s.rowFields.filter((f) => f !== field),
    })),

  reorderRowFields: (fromIndex, toIndex) =>
    set((s) => {
      const newFields = [...s.rowFields]
      const [removed] = newFields.splice(fromIndex, 1)
      newFields.splice(toIndex, 0, removed)
      return { rowFields: newFields }
    }),

  setColumnField: (field) => set({ columnField: field }),

  setValueFields: (fields) => set({ valueFields: fields }),

  addValueField: (field) =>
    set((s) => ({
      valueFields: [...s.valueFields, { ...field, id: `${field.column}_${field.aggregation}_${Date.now()}` }],
    })),

  removeValueField: (id) =>
    set((s) => ({
      valueFields: s.valueFields.filter((f) => f.id !== id),
    })),

  updateValueField: (id, updates) =>
    set((s) => ({
      valueFields: s.valueFields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),

  setFilters: (filters) => set({ filters }),
  addFilter: (filter) => set((s) => ({ filters: [...s.filters, filter] })),
  updateFilter: (index, filter) =>
    set((s) => ({
      filters: s.filters.map((f, i) => (i === index ? filter : f)),
    })),
  removeFilter: (index) =>
    set((s) => ({
      filters: s.filters.filter((_, i) => i !== index),
    })),

  setShowSubtotals: (show) => set({ showSubtotals: show }),
  setShowGrandTotal: (show) => set({ showGrandTotal: show }),

  toggleGroupExpand: (groupPath) =>
    set((s) => {
      const newExpanded = new Set(s.expandedGroups)
      if (newExpanded.has(groupPath)) {
        newExpanded.delete(groupPath)
      } else {
        newExpanded.add(groupPath)
      }
      return { expandedGroups: newExpanded }
    }),

  expandAll: () => set({ expandedGroups: new Set(['__all__']) }),
  collapseAll: () => set({ expandedGroups: new Set() }),

  setSort: (column, direction) => set({ sortColumn: column, sortDirection: direction }),

  reset: () => set({ ...initialState, expandedGroups: new Set() }),

  loadFromOperation: (op) =>
    set({
      rowFields: op.rowColumns,
      columnField: op.pivotColumn ?? null,
      valueFields: op.aggregations.map((agg, i) => ({
        id: `agg-${i}`,
        column: agg.column,
        aggregation: agg.function,
        alias: agg.alias ?? `${agg.function}_${agg.column}`,
        format: { type: 'number' as const, decimals: 2 },
        showValuesAs: agg.showValuesAs,
      })),
      filters: op.filters ?? [],
      // If operation only had 1 row field, showSubtotals was forced to false
      // Default to true so user can enable subtotals when adding more row fields
      showSubtotals: op.rowColumns.length <= 1 ? true : (op.showSubtotals ?? true),
      showGrandTotal: op.showGrandTotal ?? true,
      expandedGroups: new Set(),
    }),
}))
