import { FunctionSquare } from 'lucide-react'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { EditColumnOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Edit Column',
  icon: FunctionSquare,
  color: 'amber',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'editColumn',
  description:
    'Transform all values in a column using a SQL expression. Use for bulk transformations like trimming, case changes, or calculations.',
  parameters: {
    type: 'object',
    properties: {
      column: { type: 'string', description: 'Column to transform' },
      expression: {
        type: 'string',
        description:
          'SQL expression that transforms the column. Reference the column by name. Examples: "TRIM(email)", "LOWER(name)", "price * 1.1"',
      },
    },
    required: ['column', 'expression'],
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
  const expression = args.expression as string

  if (!column) {
    errors.push('editColumn requires a column name')
    return { valid: false, errors, warnings }
  }
  if (!expression) {
    errors.push('editColumn requires an expression')
    return { valid: false, errors, warnings }
  }

  validateColumn(column, columns, errors)

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: EditColumnOperation = {
    type: 'editColumn',
    column,
    expression,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: EditColumnOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const cols = context.sourceColumns
    .map((c) => {
      if (c.name === op.column) {
        return `(${op.expression}) AS ${escapeIdentifier(c.name)}`
      }
      return escapeIdentifier(c.name)
    })
    .join(', ')
  return `SELECT ${cols} FROM ${source}`
}

function getSummary(op: EditColumnOperation): string {
  const expr = op.expression
  return expr.length > 40 ? `${op.column}: ${expr.slice(0, 35)}...` : `${op.column}: ${expr}`
}

export const editColumnPlugin: OperationPlugin<EditColumnOperation> = {
  type: 'editColumn',
  category: 'cell',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
