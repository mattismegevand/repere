import { Trash } from 'lucide-react'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { RemoveColumnsOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Drop',
  icon: Trash,
  color: 'green',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'removeColumns',
  description: 'Remove specific columns from the dataset. Use to drop irrelevant or sensitive columns.',
  parameters: {
    type: 'object',
    properties: {
      columns: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of column names to remove',
      },
    },
    required: ['columns'],
  },
}

function validateColumns(colNames: string[], columns: Column[], errors: string[]): boolean {
  let valid = true
  for (const col of colNames) {
    if (!columns.some((c) => c.name === col)) {
      errors.push(`Column "${col}" does not exist. Available: ${columns.map((c) => c.name).join(', ')}`)
      valid = false
    }
  }
  return valid
}

function validate(args: Record<string, unknown>, columns: Column[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const colNames = args.columns as string[]
  if (!colNames || !Array.isArray(colNames) || colNames.length === 0) {
    errors.push('removeColumns requires at least one column')
    return { valid: false, errors, warnings }
  }

  validateColumns(colNames, columns, errors)

  if (colNames.length >= columns.length) {
    warnings.push('This will remove all columns from the dataset')
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: RemoveColumnsOperation = {
    type: 'removeColumns',
    columns: colNames,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: RemoveColumnsOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const removeSet = new Set(op.columns)
  const keepCols = context.sourceColumns
    .filter((c) => !removeSet.has(c.name))
    .map((c) => escapeIdentifier(c.name))
    .join(', ')
  return `SELECT ${keepCols} FROM ${source}`
}

function getSummary(op: RemoveColumnsOperation): string {
  if (op.columns.length === 1) {
    return `- ${op.columns[0]}`
  }
  return `- ${op.columns.length} columns`
}

function merge(existing: RemoveColumnsOperation, incoming: RemoveColumnsOperation): RemoveColumnsOperation {
  return {
    ...incoming,
    columns: [...new Set([...existing.columns, ...incoming.columns])],
  }
}

export const removeColumnsPlugin: OperationPlugin<RemoveColumnsOperation> = {
  type: 'removeColumns',
  category: 'column',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
  canMerge: () => true,
  merge,
}
