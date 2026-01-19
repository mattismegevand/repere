import type { ValueFormat } from '@/stores/pivotStore'

export interface PivotRow {
  id: string
  level: number
  isExpanded: boolean
  isSubtotal: boolean
  isGrandTotal: boolean
  groupPath: string[]
  groupValue: string | null
  values: Record<string, unknown>
  children?: PivotRow[]
  childCount?: number
}

export interface PivotColumn {
  key: string
  label: string
  isRowHeader: boolean
  format?: ValueFormat
}

export interface PivotTableData {
  columns: PivotColumn[]
  rows: PivotRow[]
}
