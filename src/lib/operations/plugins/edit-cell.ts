import Pencil from 'lucide-react/dist/esm/icons/pencil'
import { escapeIdentifier, escapeValue } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { EditCellOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Edit',
  icon: Pencil,
  color: 'amber',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'editCell',
  description: 'Edit specific cell values by row number and column. Use for manual corrections.',
  parameters: {
    type: 'object',
    properties: {
      edits: {
        type: 'array',
        description: 'List of cell edits',
        items: {
          type: 'object',
          properties: {
            rowId: { type: 'number', description: 'Row number (1-indexed)' },
            column: { type: 'string', description: 'Column name' },
            value: { type: ['string', 'number', 'boolean', 'null'], description: 'New value' },
          },
          required: ['rowId', 'column', 'value'],
        },
      },
    },
    required: ['edits'],
  },
}

function validateColumn(column: string, columns: Column[], errors: string[]): boolean {
  const exists = columns.some((c) => c.name === column)
  if (!exists) {
    errors.push(`Column "${column}" does not exist. Available: ${columns.map((c) => c.name).join(', ')}`)
    return false
  }
  return true
}

function validate(args: Record<string, unknown>, columns: Column[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const edits = args.edits as { rowId: number; column: string; value: unknown }[]
  if (!edits || !Array.isArray(edits) || edits.length === 0) {
    errors.push('editCell requires at least one edit')
    return { valid: false, errors, warnings }
  }

  for (const edit of edits) {
    if (typeof edit.rowId !== 'number' || edit.rowId < 1) {
      errors.push('Each edit must have a valid rowId (1 or greater)')
    }
    validateColumn(edit.column, columns, errors)
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: EditCellOperation = {
    type: 'editCell',
    edits,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: EditCellOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)

  const editsByColumn = new Map<string, Array<{ rowId: number; value: unknown }>>()
  for (const edit of op.edits) {
    const existing = editsByColumn.get(edit.column) || []
    existing.push({ rowId: edit.rowId, value: edit.value })
    editsByColumn.set(edit.column, existing)
  }

  const cols = context.sourceColumns
    .map((c) => {
      const editsForCol = editsByColumn.get(c.name)
      if (editsForCol && editsForCol.length > 0) {
        const whenClauses = editsForCol.map((e) => `WHEN __row_id = ${e.rowId} THEN ${escapeValue(e.value)}`).join(' ')
        return `CASE ${whenClauses} ELSE ${escapeIdentifier(c.name)} END AS ${escapeIdentifier(c.name)}`
      }
      return escapeIdentifier(c.name)
    })
    .join(', ')

  return `SELECT ${cols} FROM (SELECT *, ROW_NUMBER() OVER () AS __row_id FROM ${source}) sub`
}

function getSummary(op: EditCellOperation): string {
  if (op.edits.length === 1) {
    return `Cell edit: row ${op.edits[0].rowId}`
  }
  return `${op.edits.length} cell edits`
}

export const editCellPlugin: OperationPlugin<EditCellOperation> = {
  type: 'editCell',
  category: 'cell',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
