import { useCallback, useEffect, useState } from 'react'
import { useDuckDB } from '@/lib/duckdb'
import { createExpression } from '@/lib/filter-utils'
import { usePipeline } from '@/lib/pipeline'
import { buildPivotPreviewSql, transformPivotData } from '@/lib/pivot/transformPivotData'
import { usePipelineStore, usePivotStore } from '@/stores'
import type { PivotValueField } from '@/stores/pivotStore'
import type { Filter } from '@/types/dataset'
import type { PivotAggregation } from '@/types/pipeline'
import { PivotTable } from './PivotTable'
import type { PivotRow, PivotTableData } from './types'

/**
 * Renders a pivot node using our hierarchical PivotTable component.
 * This is used when viewing saved pivot nodes (after closing the pivot panel).
 * Handles both full pivot (with column field) and group-by mode (without column field).
 */
export function PivotNodeView() {
  const { client } = useDuckDB()
  const { activeNode, activeNodeId, applyOperation, openTab, materializeNode } = usePipeline()
  const { nodes } = usePipelineStore()
  const { reset, expandAll, collapseAll, expandedGroups } = usePivotStore()

  const [data, setData] = useState<PivotTableData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Extract pivot config from the node's operation
  const operation = activeNode?.type === 'view' ? activeNode.operation : null
  const isPivot = operation?.type === 'pivot'

  // Get source node (parent of current node)
  const sourceNodeId = activeNode?.type === 'view' ? activeNode.parentIds[0] : null
  const sourceNode = sourceNodeId ? nodes[sourceNodeId] : null

  useEffect(() => {
    if (!client || !activeNode || !sourceNode || !isPivot || operation?.type !== 'pivot') {
      setData(null)
      setLoading(false)
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const rowFields = operation.rowColumns
        const columnField = operation.pivotColumn ?? null
        const pivotValues = operation.pivotValues ?? []
        const valueFields: PivotValueField[] = operation.aggregations.map((agg: PivotAggregation, i: number) => ({
          id: `agg-${i}`,
          column: agg.column,
          aggregation: agg.function,
          alias: agg.alias ?? `${agg.function}_${agg.column}`,
          format: { type: 'number' as const, decimals: 2 },
          showValuesAs: agg.showValuesAs,
        }))
        const filters = operation.filters ?? []
        const showSubtotals = operation.showSubtotals ?? true
        const showGrandTotal = operation.showGrandTotal ?? true

        // Build and execute the pivot SQL against the source node
        const sql = buildPivotPreviewSql(
          sourceNode.tableName,
          rowFields,
          columnField,
          valueFields,
          pivotValues,
          filters,
          showSubtotals,
          showGrandTotal
        )

        const result = await client.query(sql)
        const flatRows = result.rows

        const tableData = transformPivotData(flatRows, {
          rowFields,
          columnField,
          valueFields,
          pivotValues,
        })

        setData(tableData)
      } catch (err) {
        console.error('Failed to load pivot view:', err)
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [client, activeNode, sourceNode, isPivot, operation])

  // Reset expand state when node changes
  useEffect(() => {
    reset()
  }, [activeNodeId, reset])

  // Click-to-filter handler
  const handleCellClick = useCallback(
    async (row: PivotRow, columnKey: string) => {
      if (!activeNodeId || !operation || operation.type !== 'pivot' || row.isSubtotal || row.isGrandTotal) return

      const filters: Filter[] = []

      // Get row fields from operation
      const rowFields = operation.rowColumns

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
      if (operation.pivotColumn && columnKey !== '__row_label__') {
        const pivotValue = columnKey.split('_')[0]
        if (pivotValue) {
          filters.push({
            column: operation.pivotColumn,
            operator: 'eq',
            value: pivotValue,
          })
        }
      }

      // Apply filter operation on the pivot node itself (not the source)
      // This creates a child of the pivot, which is more intuitive on the canvas
      const newView = await applyOperation(activeNodeId, {
        type: 'filter',
        expression: createExpression(filters),
      })

      if (newView) {
        openTab(newView.id)
      }
    },
    [activeNodeId, operation, applyOperation, openTab]
  )

  // Materialize pivot to flat table
  const handleMaterialize = useCallback(async () => {
    if (!activeNodeId) return
    const newView = await materializeNode(activeNodeId)
    if (newView) {
      openTab(newView.id)
    }
  }, [activeNodeId, materializeNode, openTab])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-[12px]">
        Loading...
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

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-[12px]">No data</div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <button
          onClick={expandedGroups.has('__all__') ? collapseAll : expandAll}
          className="w-6 h-6 text-[14px] text-[var(--color-text-secondary)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex items-center justify-center"
          title={expandedGroups.has('__all__') ? 'Collapse all groups' : 'Expand all groups'}
          data-tour="pivot-expand"
        >
          {expandedGroups.has('__all__') ? '−' : '+'}
        </button>
        <button
          onClick={handleMaterialize}
          className="px-2 py-1 text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]"
          title="Convert to flat table for further transformations"
        >
          Flatten to table
        </button>
        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">Click cells to filter</span>
      </div>
      {/* Pivot table */}
      <div className="flex-1 overflow-hidden">
        <PivotTable data={data} onCellClick={handleCellClick} />
      </div>
    </div>
  )
}
