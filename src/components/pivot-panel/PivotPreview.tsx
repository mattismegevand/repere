import { useCallback } from 'react'
import { PivotTable } from '@/components/pivot-table'
import type { PivotRow } from '@/components/pivot-table/types'
import { createExpression } from '@/lib/filter-utils'
import { usePipeline } from '@/lib/pipeline'
import { usePivotQuery } from '@/lib/pivot'
import { usePanelStore } from '@/stores/panelStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import { usePivotStore } from '@/stores/pivotStore'
import type { Filter } from '@/types/dataset'

export function PivotPreview() {
  const { data, loading, error } = usePivotQuery()
  const rowFields = usePivotStore((s) => s.rowFields)
  const columnField = usePivotStore((s) => s.columnField)
  const pivotFilters = usePivotStore((s) => s.filters)
  const activeEditingPanel = usePanelStore((s) => s.activeEditingPanel)
  const { applyOperation, openTab } = usePipeline()

  // Derive pivot source from discriminated union
  const pivotSourceNodeId = activeEditingPanel.type === 'pivot' ? activeEditingPanel.sourceNodeId : null

  // Click-to-filter: create filtered view from pivot cell context
  // Must be defined before any early returns (React hooks rules)
  const handleCellClick = useCallback(
    async (row: PivotRow, columnKey: string) => {
      if (!pivotSourceNodeId || row.isSubtotal || row.isGrandTotal) return

      // Build filters from row's group path (row field values)
      const filters: Filter[] = [...pivotFilters]

      // Add filters for each row field based on groupPath
      row.groupPath.forEach((value, index) => {
        if (index < rowFields.length && value !== '__subtotal__' && value !== '__grand_total__') {
          filters.push({
            column: rowFields[index],
            operator: 'eq',
            value: value,
          })
        }
      })

      // If clicking a pivot column (not row label), add filter for column field
      if (columnField && columnKey !== '__row_label__') {
        // Extract pivot value from column key (format: "pivotValue_alias")
        const pivotValue = columnKey.split('_')[0]
        if (pivotValue) {
          filters.push({
            column: columnField,
            operator: 'eq',
            value: pivotValue,
          })
        }
      }

      // Apply filter operation on the pivot node itself (not the source)
      // This creates a child of the pivot, which is more intuitive on the canvas
      const pivotNodeId = usePipelineStore.getState().activeNodeId
      if (!pivotNodeId) return

      const newView = await applyOperation(pivotNodeId, {
        type: 'filter',
        expression: createExpression(filters),
      })

      if (newView) {
        openTab(newView.id)
      }
    },
    [pivotSourceNodeId, rowFields, columnField, pivotFilters, applyOperation, openTab]
  )

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-[12px]">
        Loading preview...
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-error)] text-[12px]">
        Error: {error}
      </div>
    )
  }

  if (!data || data.columns.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-[12px]">
        <div className="text-center">
          <div className="mb-2">Configure your pivot table</div>
          <div className="text-[10px]">Drag fields to Rows, Columns, and Values zones</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full border-2 border-[var(--color-border)] overflow-hidden">
      <PivotTable data={data} onCellClick={handleCellClick} />
    </div>
  )
}
