import { Scissors } from 'lucide-react'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { DistinctOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Distinct',
  icon: Scissors,
  color: 'orange',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'distinct',
  description: 'Remove duplicate rows from the dataset.',
  parameters: {
    type: 'object',
    properties: {
      columns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: columns to consider for uniqueness. If omitted, all columns are used.',
      },
    },
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

  const colNames = args.columns as string[] | undefined
  if (colNames && Array.isArray(colNames)) {
    validateColumns(colNames, columns, errors)
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: DistinctOperation = {
    type: 'distinct',
    columns: colNames,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: DistinctOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  if (op.columns && op.columns.length > 0) {
    const cols = op.columns.map(escapeIdentifier).join(', ')
    return `SELECT DISTINCT ON (${cols}) * FROM ${source}`
  }
  return `SELECT DISTINCT * FROM ${source}`
}

function getSummary(op: DistinctOperation): string {
  if (!op.columns || op.columns.length === 0) {
    return 'All columns'
  }
  if (op.columns.length <= 3) {
    return op.columns.join(', ')
  }
  return `${op.columns.length} columns`
}

export const distinctPlugin: OperationPlugin<DistinctOperation> = {
  type: 'distinct',
  category: 'query',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
