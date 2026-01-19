import { X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Button, Checkbox } from '@/components/ui'
import { useDuckDB } from '@/lib/duckdb'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { usePanelStore, usePipelineStore, usePivotStore } from '@/stores'
import type { FilterOperator } from '@/types/dataset'
import type { AggregateFunction, PivotAggregation, PivotOperation } from '@/types/pipeline'
import { DropZone } from './DropZone'
import { FieldList } from './FieldList'
import { FilterRow } from './FilterRow'
import { ValueFieldConfig } from './ValueFieldConfig'

export function PivotPanel() {
  const { client } = useDuckDB()
  const closePivotPanel = usePanelStore((s) => s.closePivotPanel)
  const activeEditingPanel = usePanelStore((s) => s.activeEditingPanel)
  const { nodes } = usePipelineStore()
  const { applyOperation, openTab, deleteNode } = usePipeline()

  // Derive pivot-specific values from the discriminated union
  const pivotSourceNodeId = activeEditingPanel.type === 'pivot' ? activeEditingPanel.sourceNodeId : null
  const pivotEditingNodeId = activeEditingPanel.type === 'pivot' ? activeEditingPanel.editingNodeId : null

  // Track the pivot node we created/editing so we can update it instead of creating new ones
  // Initialize with editing node ID if we're editing an existing pivot
  const createdPivotIdRef = useRef<string | null>(pivotEditingNodeId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    rowFields,
    columnField,
    valueFields,
    filters,
    showSubtotals,
    showGrandTotal,
    addRowField,
    removeRowField,
    reorderRowFields,
    setColumnField,
    addValueField,
    removeValueField,
    updateValueField,
    addFilter,
    updateFilter,
    removeFilter,
    setShowSubtotals,
    setShowGrandTotal,
    reset,
  } = usePivotStore()

  const sourceNode = pivotSourceNodeId ? nodes[pivotSourceNodeId] : null
  const columns = sourceNode?.columns ?? []

  const usedFields = useMemo(() => {
    const used = new Set<string>()
    for (const f of rowFields) used.add(f)
    if (columnField) used.add(columnField)
    return used
  }, [rowFields, columnField])

  // Valid if we have values AND at least one of rows or columns
  const isValid = valueFields.length > 0 && (rowFields.length > 0 || columnField !== null)

  // Sync ref when editing node changes (e.g., when opening panel to edit existing pivot)
  useEffect(() => {
    if (pivotEditingNodeId) {
      createdPivotIdRef.current = pivotEditingNodeId
    }
  }, [pivotEditingNodeId])

  // Auto-create/update pivot node when config changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!client || !sourceNode || !pivotSourceNodeId || !isValid) {
      return
    }

    debounceRef.current = setTimeout(async () => {
      try {
        // Delete existing pivot if we created one before
        if (createdPivotIdRef.current) {
          await deleteNode(createdPivotIdRef.current)
          createdPivotIdRef.current = null
        }

        if (columnField) {
          // PIVOT mode - has column field
          const sql = `SELECT DISTINCT "${columnField.replace(/"/g, '""')}" AS val
                       FROM "${sourceNode.tableName.replace(/"/g, '""')}"
                       WHERE "${columnField.replace(/"/g, '""')}" IS NOT NULL
                       ORDER BY val
                       LIMIT 100`
          const result = await client.query<{ val: unknown }>(sql)
          const pivotValues = result.rows.map((row) => String(row.val))

          if (pivotValues.length === 0) return

          const aggregations: PivotAggregation[] = valueFields.map((vf) => ({
            column: vf.column,
            function: vf.aggregation,
            alias: vf.alias,
            showValuesAs: vf.showValuesAs,
          }))

          const operation: PivotOperation = {
            type: 'pivot',
            rowColumns: rowFields,
            pivotColumn: columnField,
            pivotValues,
            aggregations,
            filters: filters.length > 0 ? filters : undefined,
            showSubtotals: rowFields.length > 1 ? showSubtotals : false,
            showGrandTotal,
            isTerminal: true,
          }

          const newView = await applyOperation(pivotSourceNodeId, operation)
          if (newView) {
            createdPivotIdRef.current = newView.id
            openTab(newView.id)
          }
        } else {
          // GROUP BY mode - pivot without column field
          const aggregations: PivotAggregation[] = valueFields.map((vf) => ({
            column: vf.column,
            function: vf.aggregation,
            alias: vf.alias,
            showValuesAs: vf.showValuesAs,
          }))

          const operation: PivotOperation = {
            type: 'pivot',
            rowColumns: rowFields,
            pivotColumn: null,
            pivotValues: [],
            aggregations,
            filters: filters.length > 0 ? filters : undefined,
            showSubtotals: rowFields.length > 1 ? showSubtotals : false,
            showGrandTotal,
            isTerminal: true,
          }

          const newView = await applyOperation(pivotSourceNodeId, operation)
          if (newView) {
            createdPivotIdRef.current = newView.id
            openTab(newView.id)
          }
        }
      } catch (err) {
        console.error('Failed to create pivot:', err)
      }
    }, 500)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [
    client,
    sourceNode,
    pivotSourceNodeId,
    rowFields,
    columnField,
    valueFields,
    filters,
    showSubtotals,
    showGrandTotal,
    isValid,
    applyOperation,
    openTab,
    deleteNode,
  ])

  const handleColumnFieldDrop = (field: string) => {
    if (rowFields.includes(field)) {
      removeRowField(field)
    }
    setColumnField(field)
  }

  const handleRowFieldDrop = (field: string) => {
    if (columnField === field) {
      setColumnField(null)
    }
    addRowField(field)
  }

  const handleValueDrop = (field: string) => {
    const column = columns.find((c) => c.name === field)
    const isNumeric = column && ['integer', 'float', 'decimal'].includes(column.type)
    const defaultAgg: AggregateFunction = isNumeric ? 'sum' : 'count'

    addValueField({
      column: field,
      aggregation: defaultAgg,
      alias: `${defaultAgg}_${field}`,
      format: { type: 'number', decimals: 2 },
    })
  }

  const handleAddFilter = () => {
    if (columns.length === 0) return
    addFilter({
      column: columns[0].name,
      operator: 'eq' as FilterOperator,
      value: '',
    })
  }

  const handleClose = () => {
    reset()
    closePivotPanel()
  }

  return (
    <div className="w-72 border-l-2 border-[var(--color-border)] bg-[var(--color-bg-primary)] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-[11px] font-medium uppercase tracking-wide">Pivot Table Fields</span>
        <button
          onClick={handleClose}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {!sourceNode ? (
          <div className="text-[11px] text-[var(--color-text-muted)] text-center py-8">
            Select a dataset or view to create a pivot table
          </div>
        ) : (
          <>
            <FieldList columns={columns} usedFields={usedFields} />

            <DropZone
              label="Rows"
              fields={rowFields}
              onDrop={handleRowFieldDrop}
              onRemove={removeRowField}
              onReorder={reorderRowFields}
              accepts="multiple"
              emptyText="Drag fields for row grouping"
            />

            <DropZone
              label="Columns"
              fields={columnField ? [columnField] : []}
              onDrop={handleColumnFieldDrop}
              onRemove={() => setColumnField(null)}
              accepts="single"
              emptyText="Drag field for column headers"
            />

            <div className="mb-3">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">Values</div>
              <div
                className="min-h-[60px] border-2 border-dashed p-2 border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const field = e.dataTransfer.getData('text/plain')
                  if (field) handleValueDrop(field)
                }}
              >
                {valueFields.length === 0 ? (
                  <div className="text-[10px] text-[var(--color-text-muted)] text-center py-2">
                    Drag fields to aggregate
                  </div>
                ) : (
                  valueFields.map((field) => (
                    <ValueFieldConfig
                      key={field.id}
                      field={field}
                      onUpdate={(updates) => updateValueField(field.id, updates)}
                      onRemove={() => removeValueField(field.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Filters</div>
                <Button variant="ghost" size="xs" onClick={handleAddFilter}>
                  + Add
                </Button>
              </div>
              <div className="space-y-1">
                {filters.length === 0 ? (
                  <div className="text-[10px] text-[var(--color-text-muted)] py-2 text-center border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    No filters applied
                  </div>
                ) : (
                  filters.map((filter, index) => (
                    <FilterRow
                      key={index}
                      filter={filter}
                      columns={columns}
                      onUpdate={(updated) => updateFilter(index, updated)}
                      onRemove={() => removeFilter(index)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Options */}
            <div className="border-t border-[var(--color-border)] pt-3 mt-3">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Options</div>

              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <Checkbox checked={showSubtotals} onCheckedChange={setShowSubtotals} disabled={rowFields.length < 2} />
                <span className={`text-[11px] ${rowFields.length < 2 ? 'text-[var(--color-text-muted)]' : ''}`}>
                  Show subtotals
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={showGrandTotal} onCheckedChange={setShowGrandTotal} />
                <span className="text-[11px]">Show grand total</span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] p-3">
        <Button variant="primary" size="sm" onClick={handleClose} className="w-full">
          Done
        </Button>
      </div>
    </div>
  )
}
