import { describe, expect, it } from 'vitest'
import type { PivotRow } from '@/components/pivot-table/types'
import { transformPivotData } from '@/lib/pivot/transformPivotData'
import type { PivotValueField } from '@/stores/pivotStore'

const findRowByPath = (rows: PivotRow[], path: string[]): PivotRow | undefined => {
  for (const row of rows) {
    if (row.groupPath.join('|') === path.join('|')) return row
    if (row.children) {
      const match = findRowByPath(row.children, path)
      if (match) return match
    }
  }
  return undefined
}

describe('transformPivotData', () => {
  it('calculates percent of grand total for group by results', () => {
    const valueField: PivotValueField = {
      id: 'total',
      column: 'value',
      aggregation: 'sum',
      alias: 'total',
      format: { type: 'number', decimals: 2 },
      showValuesAs: 'percentOfGrandTotal',
    }

    const flatRows = [
      { category: 'A', total: 30, _row_type: 0, _sort_group: 'A' },
      { category: 'B', total: 70, _row_type: 0, _sort_group: 'B' },
      { category: null, total: 100, _row_type: 2, _sort_group: null },
    ]

    const result = transformPivotData(flatRows, {
      rowFields: ['category'],
      columnField: null,
      valueFields: [valueField],
      pivotValues: [],
    })

    const rowA = findRowByPath(result.rows, ['A'])
    const rowB = findRowByPath(result.rows, ['B'])
    const grandTotal = result.rows.find((row) => row.isGrandTotal)

    expect(rowA?.values.total).toBeCloseTo(30)
    expect(rowB?.values.total).toBeCloseTo(70)
    expect(grandTotal?.values.total).toBeCloseTo(100)
  })

  it('calculates percent of parent totals for nested groups', () => {
    const valueField: PivotValueField = {
      id: 'total',
      column: 'value',
      aggregation: 'sum',
      alias: 'total',
      format: { type: 'number', decimals: 2 },
      showValuesAs: 'percentOfParentTotal',
    }

    const flatRows = [
      { category: 'A', sub: 'A1', total: 40, _row_type: 0, _sort_group: 'A' },
      { category: 'A', sub: 'A2', total: 60, _row_type: 0, _sort_group: 'A' },
      { category: 'B', sub: 'B1', total: 50, _row_type: 0, _sort_group: 'B' },
      { category: 'A', sub: null, total: 100, _row_type: 1, _sort_group: 'A' },
      { category: 'B', sub: null, total: 50, _row_type: 1, _sort_group: 'B' },
      { category: null, sub: null, total: 150, _row_type: 3, _sort_group: null },
    ]

    const result = transformPivotData(flatRows, {
      rowFields: ['category', 'sub'],
      columnField: null,
      valueFields: [valueField],
      pivotValues: [],
    })

    const rowA1 = findRowByPath(result.rows, ['A', 'A1'])
    const rowA2 = findRowByPath(result.rows, ['A', 'A2'])
    const rowB1 = findRowByPath(result.rows, ['B', 'B1'])
    const grandTotal = result.rows.find((row) => row.isGrandTotal)

    expect(rowA1?.values.total).toBeCloseTo(40)
    expect(rowA2?.values.total).toBeCloseTo(60)
    expect(rowB1?.values.total).toBeCloseTo(100)
    expect(grandTotal?.values.total).toBeCloseTo(100)
  })

  it('calculates percent of column totals for pivot mode', () => {
    const valueField: PivotValueField = {
      id: 'sum_value',
      column: 'value',
      aggregation: 'sum',
      alias: 'sum_value',
      format: { type: 'number', decimals: 2 },
      showValuesAs: 'percentOfColumnTotal',
    }

    const flatRows = [
      { category: 'X', A_sum_value: 30, B_sum_value: 70, _row_type: 0, _sort_group: 'X' },
      { category: 'Y', A_sum_value: 70, B_sum_value: 30, _row_type: 0, _sort_group: 'Y' },
    ]

    const result = transformPivotData(flatRows, {
      rowFields: ['category'],
      columnField: 'segment',
      valueFields: [valueField],
      pivotValues: ['A', 'B'],
    })

    const rowX = findRowByPath(result.rows, ['X'])
    const rowY = findRowByPath(result.rows, ['Y'])

    expect(rowX?.values.A_sum_value).toBeCloseTo(30)
    expect(rowY?.values.A_sum_value).toBeCloseTo(70)
    expect(rowX?.values.B_sum_value).toBeCloseTo(70)
    expect(rowY?.values.B_sum_value).toBeCloseTo(30)
  })

  it('builds subtotal and grand total rows for grouped data', () => {
    const valueField: PivotValueField = {
      id: 'total',
      column: 'value',
      aggregation: 'sum',
      alias: 'total',
      format: { type: 'number', decimals: 2 },
      showValuesAs: 'normal',
    }

    const flatRows = [
      { category: 'A', sub: 'A1', total: 40, _row_type: 0, _sort_group: 'A' },
      { category: 'A', sub: 'A2', total: 60, _row_type: 0, _sort_group: 'A' },
      { category: 'A', sub: null, total: 100, _row_type: 1, _sort_group: 'A' },
      { category: null, sub: null, total: 100, _row_type: 3, _sort_group: null },
    ]

    const result = transformPivotData(flatRows, {
      rowFields: ['category', 'sub'],
      columnField: null,
      valueFields: [valueField],
      pivotValues: [],
    })

    const subtotal = findRowByPath(result.rows, ['A', '__subtotal__'])
    const grandTotal = result.rows.find((row) => row.isGrandTotal)

    expect(subtotal?.isSubtotal).toBe(true)
    expect(subtotal?.values.total).toBe(100)
    expect(grandTotal?.isGrandTotal).toBe(true)
    expect(grandTotal?.values.total).toBe(100)
  })
})
