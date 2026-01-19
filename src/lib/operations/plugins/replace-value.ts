import { Replace } from 'lucide-react'
import { escapeIdentifier, escapeValue } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { ReplaceValueOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Replace',
  icon: Replace,
  color: 'amber',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'replaceValue',
  description: 'Find and replace specific values in a column.',
  parameters: {
    type: 'object',
    properties: {
      column: { type: 'string', description: 'Column to search in' },
      find: { type: ['string', 'number', 'boolean', 'null'], description: 'Value to find' },
      replace: { type: ['string', 'number', 'boolean', 'null'], description: 'Replacement value' },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether to match case sensitively (for strings)',
        default: true,
      },
    },
    required: ['column', 'find', 'replace'],
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

  const column = args.column as string
  if (!column) {
    errors.push('replaceValue requires a column name')
    return { valid: false, errors, warnings }
  }

  validateColumn(column, columns, errors)

  if (args.find === undefined) {
    errors.push('replaceValue requires a find value')
  }
  if (args.replace === undefined) {
    errors.push('replaceValue requires a replace value')
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: ReplaceValueOperation = {
    type: 'replaceValue',
    column,
    find: args.find,
    replace: args.replace,
    caseSensitive: args.caseSensitive as boolean | undefined,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: ReplaceValueOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const col = escapeIdentifier(op.column)
  const findVal = escapeValue(op.find)
  const replaceVal = escapeValue(op.replace)

  const cols = context.sourceColumns
    .map((c) => {
      if (c.name === op.column) {
        return `CASE WHEN ${col} = ${findVal} THEN ${replaceVal} ELSE ${col} END AS ${escapeIdentifier(c.name)}`
      }
      return escapeIdentifier(c.name)
    })
    .join(', ')
  return `SELECT ${cols} FROM ${source}`
}

function getSummary(op: ReplaceValueOperation): string {
  return `${op.column}: ${op.find} -> ${op.replace}`
}

export const replaceValuePlugin: OperationPlugin<ReplaceValueOperation> = {
  type: 'replaceValue',
  category: 'cell',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
