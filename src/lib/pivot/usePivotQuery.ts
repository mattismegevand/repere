import { useCallback, useEffect, useRef, useState } from 'react'
import type { PivotTableData } from '@/components/pivot-table/types'
import { useDuckDB } from '@/lib/duckdb'
import { normalizeRowDates } from '@/lib/formatters'
import { useHydratedNodes } from '@/lib/pipeline/hooks/useHydratedNodes'
import { usePanelStore } from '@/stores/panelStore'
import { usePivotStore } from '@/stores/pivotStore'
import { buildPivotPreviewSql, transformPivotData } from './transformPivotData'

interface UsePivotQueryResult {
  data: PivotTableData | null
  loading: boolean
  error: string | null
  pivotValues: string[]
}

const DEBOUNCE_MS = 300

export function usePivotQuery(): UsePivotQueryResult {
  const { client } = useDuckDB()
  const activeEditingPanel = usePanelStore((s) => s.activeEditingPanel)
  const nodes = useHydratedNodes()
  const rowFields = usePivotStore((s) => s.rowFields)
  const columnField = usePivotStore((s) => s.columnField)
  const valueFields = usePivotStore((s) => s.valueFields)
  const filters = usePivotStore((s) => s.filters)
  const showSubtotals = usePivotStore((s) => s.showSubtotals)
  const showGrandTotal = usePivotStore((s) => s.showGrandTotal)

  // Derive pivot source from discriminated union
  const pivotSourceNodeId = activeEditingPanel.type === 'pivot' ? activeEditingPanel.sourceNodeId : null

  const [data, setData] = useState<PivotTableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pivotValues, setPivotValues] = useState<string[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sourceNode = pivotSourceNodeId ? nodes[pivotSourceNodeId] : null

  // Fetch distinct values for pivot column (only if columnField is set)
  const fetchPivotValues = useCallback(async (): Promise<string[]> => {
    if (!client || !sourceNode || !sourceNode.tableName || !columnField) {
      setPivotValues([])
      return []
    }

    try {
      const sql = `SELECT DISTINCT "${columnField.replace(/"/g, '""')}" AS val
                   FROM "${sourceNode.tableName.replace(/"/g, '""')}"
                   WHERE "${columnField.replace(/"/g, '""')}" IS NOT NULL
                   ORDER BY val
                   LIMIT 100`

      const result = await client.query<{ val: unknown }>(sql)
      const values = result.rows.map((row) => String(row.val))
      setPivotValues(values)
      return values
    } catch (err) {
      console.error('Failed to fetch pivot values:', err)
      setPivotValues([])
      return []
    }
  }, [client, sourceNode, columnField])

  // Execute pivot/group by query
  const executeQuery = useCallback(
    async (values: string[]) => {
      if (!client || !sourceNode || !sourceNode.tableName || valueFields.length === 0) {
        setData(null)
        return
      }

      // Need either rows or columns
      if (rowFields.length === 0 && !columnField) {
        setData(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const sql = buildPivotPreviewSql(
          sourceNode.tableName,
          rowFields,
          columnField,
          valueFields,
          values,
          filters,
          showSubtotals,
          showGrandTotal
        )

        const result = await client.query(sql)
        const columns = sourceNode.columns ?? []
        const flatRows = result.rows.map((row) => normalizeRowDates(row, columns))

        const tableData = transformPivotData(flatRows, {
          rowFields,
          columnField,
          valueFields,
          pivotValues: values,
        })

        setData(tableData)
      } catch (err) {
        console.error('Pivot query failed:', err)
        setError(err instanceof Error ? err.message : 'Query failed')
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [client, sourceNode, rowFields, columnField, valueFields, filters, showSubtotals, showGrandTotal]
  )

  // Debounced query execution
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Need values and at least one of rows or columns
    if (valueFields.length === 0 || (rowFields.length === 0 && !columnField)) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)

    debounceRef.current = setTimeout(async () => {
      if (columnField) {
        // Pivot mode - need to fetch pivot values first
        const values = await fetchPivotValues()
        if (values.length > 0) {
          await executeQuery(values)
        } else {
          setData(null)
          setLoading(false)
        }
      } else {
        // Group by mode - no pivot values needed
        await executeQuery([])
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [columnField, valueFields, rowFields, filters, showSubtotals, showGrandTotal, fetchPivotValues, executeQuery])

  return { data, loading, error, pivotValues }
}
