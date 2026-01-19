import { Columns } from 'lucide-react'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { SelectOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Select',
  icon: Columns,
  color: 'green',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'select',
  description: 'Select specific columns to keep, removing all others. Use to focus on relevant columns.',
  parameters: {
    type: 'object',
    properties: {
      columns: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of column names to keep',
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
    errors.push('Select requires at least one column')
    return { valid: false, errors, warnings }
  }

  validateColumns(colNames, columns, errors)

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: SelectOperation = {
    type: 'select',
    columns: colNames,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: SelectOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const cols = op.columns.map(escapeIdentifier).join(', ')
  return `SELECT ${cols} FROM ${source}`
}

function getSummary(op: SelectOperation): string {
  const count = op.columns.length
  if (count <= 3) {
    return op.columns.join(', ')
  }
  return `${count} columns selected`
}

export const selectPlugin: OperationPlugin<SelectOperation> = {
  type: 'select',
  category: 'column',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
