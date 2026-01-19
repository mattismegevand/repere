import { beforeEach, describe, expect, it } from 'vitest'
import { usePivotStore } from '@/stores/pivotStore'
import type { PivotOperation } from '@/types'

const pivotOperation: PivotOperation = {
  type: 'pivot',
  rowColumns: ['category'],
  pivotColumn: null,
  pivotValues: [],
  aggregations: [
    {
      column: 'value',
      function: 'sum',
      alias: 'sum_value',
      showValuesAs: 'normal',
    },
  ],
  showSubtotals: false,
  showGrandTotal: false,
  isTerminal: true,
}

describe('pivotStore', () => {
  beforeEach(() => {
    usePivotStore.getState().reset()
  })

  it('prevents duplicate row fields', () => {
    usePivotStore.getState().addRowField('category')
    usePivotStore.getState().addRowField('category')

    expect(usePivotStore.getState().rowFields).toEqual(['category'])
  })

  it('loads operations with expected defaults', () => {
    usePivotStore.getState().loadFromOperation(pivotOperation)

    const state = usePivotStore.getState()
    expect(state.rowFields).toEqual(['category'])
    expect(state.columnField).toBeNull()
    expect(state.valueFields[0]?.alias).toBe('sum_value')
    expect(state.showSubtotals).toBe(true)
    expect(state.showGrandTotal).toBe(false)
  })

  it('updates value field configuration', () => {
    usePivotStore.getState().addValueField({
      column: 'value',
      aggregation: 'avg',
      alias: 'avg_value',
      format: { type: 'number', decimals: 2 },
    })

    const fieldId = usePivotStore.getState().valueFields[0]?.id
    expect(fieldId).toBeTruthy()

    if (fieldId) {
      usePivotStore.getState().updateValueField(fieldId, { format: { type: 'percent', decimals: 1, suffix: '%' } })
    }

    const updated = usePivotStore.getState().valueFields[0]
    expect(updated?.format.type).toBe('percent')
    expect(updated?.format.decimals).toBe(1)
    expect(updated?.format.suffix).toBe('%')
  })

  it('reorders row fields and maintains order', () => {
    usePivotStore.getState().setRowFields(['category', 'sub', 'region'])
    usePivotStore.getState().reorderRowFields(2, 0)

    expect(usePivotStore.getState().rowFields).toEqual(['region', 'category', 'sub'])
  })

  it('expands and collapses all groups', () => {
    usePivotStore.getState().toggleGroupExpand('A')
    usePivotStore.getState().expandAll()
    expect(usePivotStore.getState().expandedGroups.has('__all__')).toBe(true)

    usePivotStore.getState().collapseAll()
    expect(usePivotStore.getState().expandedGroups.size).toBe(0)
  })

  it('adds and updates pivot filters', () => {
    usePivotStore.getState().addFilter({ column: 'category', operator: 'eq', value: 'A' })

    expect(usePivotStore.getState().filters).toEqual([{ column: 'category', operator: 'eq', value: 'A' }])

    usePivotStore.getState().updateFilter(0, { column: 'category', operator: 'neq', value: 'B' })
    expect(usePivotStore.getState().filters[0]).toEqual({ column: 'category', operator: 'neq', value: 'B' })

    usePivotStore.getState().removeFilter(0)
    expect(usePivotStore.getState().filters).toHaveLength(0)
  })

  it('sets sort state for pivot output', () => {
    usePivotStore.getState().setSort('total', 'desc')

    expect(usePivotStore.getState().sortColumn).toBe('total')
    expect(usePivotStore.getState().sortDirection).toBe('desc')

    usePivotStore.getState().setSort(null, 'asc')
    expect(usePivotStore.getState().sortColumn).toBeNull()
    expect(usePivotStore.getState().sortDirection).toBe('asc')
  })
})
