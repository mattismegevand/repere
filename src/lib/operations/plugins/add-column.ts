import FunctionSquare from 'lucide-react/dist/esm/icons/function-square'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { AddColumnOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Add Column',
  icon: FunctionSquare,
  color: 'green',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'addColumn',
  description:
    'Add one or more computed columns using SQL expressions. Use for calculations, transformations, or derived values.',
  parameters: {
    type: 'object',
    properties: {
      columns: {
        type: 'array',
        description: 'Columns to add',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name for the new column' },
            expression: {
              type: 'string',
              description:
                'SQL expression for the column value. Can reference other columns. Examples: "price * quantity", "UPPER(name)", "CASE WHEN age > 18 THEN \'adult\' ELSE \'minor\' END"',
            },
          },
          required: ['name', 'expression'],
        },
      },
    },
    required: ['columns'],
  },
}

function validate(args: Record<string, unknown>, columns: Column[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const newCols = args.columns as { name: string; expression: string }[]
  if (!newCols || !Array.isArray(newCols) || newCols.length === 0) {
    errors.push('addColumn requires at least one column definition')
    return { valid: false, errors, warnings }
  }

  for (const col of newCols) {
    if (!col.name || typeof col.name !== 'string') {
      errors.push('Each column must have a name')
    }
    if (!col.expression || typeof col.expression !== 'string') {
      errors.push('Each column must have an expression')
    }
    if (columns.some((c) => c.name === col.name)) {
      warnings.push(`Column "${col.name}" already exists and will be replaced`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: AddColumnOperation = {
    type: 'addColumn',
    columns: newCols,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: AddColumnOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const computedCols = op.columns.map((c) => `(${c.expression}) AS ${escapeIdentifier(c.name)}`).join(', ')
  return `SELECT *, ${computedCols} FROM ${source}`
}

function getSummary(op: AddColumnOperation): string {
  if (op.columns.length === 1) {
    return `+ ${op.columns[0].name}`
  }
  return `+ ${op.columns.length} columns`
}

function merge(existing: AddColumnOperation, incoming: AddColumnOperation): AddColumnOperation {
  const colMap = new Map(existing.columns.map((c) => [c.name, c]))
  for (const col of incoming.columns) {
    colMap.set(col.name, col)
  }
  return {
    ...incoming,
    columns: Array.from(colMap.values()),
  }
}

export const addColumnPlugin: OperationPlugin<AddColumnOperation> = {
  type: 'addColumn',
  category: 'column',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
  canMerge: () => true,
  merge,
}
