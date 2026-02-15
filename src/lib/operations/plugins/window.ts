import FunctionSquare from 'lucide-react/dist/esm/icons/function-square'
import { escapeIdentifier, escapeValue } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { WindowOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Window',
  icon: FunctionSquare,
  color: 'purple',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'window',
  description:
    'Compute values over a window of rows. Use for running totals, rankings, or comparing with previous/next rows.',
  parameters: {
    type: 'object',
    properties: {
      function: {
        type: 'string',
        enum: [
          'row_number',
          'rank',
          'dense_rank',
          'ntile',
          'lag',
          'lead',
          'first_value',
          'last_value',
          'sum',
          'avg',
          'count',
          'min',
          'max',
        ],
        description: 'Window function to apply',
      },
      column: {
        type: 'string',
        description: 'Source column (required for lag/lead/aggregates, not for ranking functions)',
      },
      outputColumn: { type: 'string', description: 'Name for the new column' },
      partitionBy: {
        type: 'array',
        items: { type: 'string' },
        description: 'Columns to partition by (like GROUP BY for windows)',
      },
      orderBy: {
        type: 'array',
        description: 'Columns to order by within each partition',
        items: {
          type: 'object',
          properties: {
            column: { type: 'string' },
            direction: { type: 'string', enum: ['ASC', 'DESC'] },
          },
          required: ['column', 'direction'],
        },
      },
      offset: { type: 'number', description: 'For LAG/LEAD: how many rows to look back/forward (default 1)' },
      defaultValue: { type: ['string', 'number', 'null'], description: 'For LAG/LEAD: value when no row exists' },
      ntileBuckets: { type: 'number', description: 'For NTILE: number of buckets (default 4)' },
    },
    required: ['function', 'outputColumn', 'partitionBy', 'orderBy'],
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

function validateColumns(colNames: string[], columns: Column[], errors: string[]): boolean {
  let valid = true
  for (const col of colNames) {
    if (!validateColumn(col, columns, errors)) {
      valid = false
    }
  }
  return valid
}

function validate(args: Record<string, unknown>, columns: Column[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const func = args.function as string
  const outputColumn = args.outputColumn as string
  const partitionBy = args.partitionBy as string[]
  const orderBy = args.orderBy as { column: string; direction: string }[]

  if (!func) {
    errors.push('window requires a function')
    return { valid: false, errors, warnings }
  }
  if (!outputColumn) {
    errors.push('window requires an outputColumn')
    return { valid: false, errors, warnings }
  }
  if (!partitionBy || !Array.isArray(partitionBy)) {
    errors.push('window requires partitionBy array')
    return { valid: false, errors, warnings }
  }
  if (!orderBy || !Array.isArray(orderBy)) {
    errors.push('window requires orderBy array')
    return { valid: false, errors, warnings }
  }

  validateColumns(partitionBy, columns, errors)
  for (const o of orderBy) {
    validateColumn(o.column, columns, errors)
  }

  const needsColumn = ['lag', 'lead', 'first_value', 'last_value', 'sum', 'avg', 'count', 'min', 'max']
  if (needsColumn.includes(func) && !args.column) {
    errors.push(`Window function "${func}" requires a source column`)
  }
  if (args.column) {
    validateColumn(args.column as string, columns, errors)
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: WindowOperation = {
    type: 'window',
    function: func as WindowOperation['function'],
    column: args.column as string | undefined,
    outputColumn,
    partitionBy,
    orderBy: orderBy.map((o) => ({
      column: o.column,
      direction: o.direction.toUpperCase() as 'ASC' | 'DESC',
    })),
    offset: args.offset as number | undefined,
    defaultValue: args.defaultValue,
    ntileBuckets: args.ntileBuckets as number | undefined,
  }

  return { valid: true, operation, errors, warnings }
}

function buildFunctionCall(op: WindowOperation): string {
  switch (op.function) {
    case 'row_number':
      return 'ROW_NUMBER()'
    case 'rank':
      return 'RANK()'
    case 'dense_rank':
      return 'DENSE_RANK()'
    case 'ntile':
      return `NTILE(${op.ntileBuckets ?? 4})`
    case 'lag': {
      const col = escapeIdentifier(op.column!)
      const offset = op.offset ?? 1
      const defaultVal = op.defaultValue !== undefined ? `, ${escapeValue(op.defaultValue)}` : ''
      return `LAG(${col}, ${offset}${defaultVal})`
    }
    case 'lead': {
      const col = escapeIdentifier(op.column!)
      const offset = op.offset ?? 1
      const defaultVal = op.defaultValue !== undefined ? `, ${escapeValue(op.defaultValue)}` : ''
      return `LEAD(${col}, ${offset}${defaultVal})`
    }
    case 'first_value':
      return `FIRST_VALUE(${escapeIdentifier(op.column!)})`
    case 'last_value':
      return `LAST_VALUE(${escapeIdentifier(op.column!)})`
    case 'sum':
    case 'avg':
    case 'count':
    case 'min':
    case 'max':
      return `${op.function.toUpperCase()}(${escapeIdentifier(op.column!)})`
  }
}

function buildWindowClause(op: WindowOperation): string {
  const parts: string[] = []

  if (op.partitionBy.length > 0) {
    parts.push(`PARTITION BY ${op.partitionBy.map(escapeIdentifier).join(', ')}`)
  }

  if (op.orderBy.length > 0) {
    const orderParts = op.orderBy.map((o) => `${escapeIdentifier(o.column)} ${o.direction}`)
    parts.push(`ORDER BY ${orderParts.join(', ')}`)
  }

  return parts.join(' ')
}

function buildSql(op: WindowOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const funcCall = buildFunctionCall(op)
  const windowClause = buildWindowClause(op)
  const outputCol = escapeIdentifier(op.outputColumn)

  return `SELECT *, ${funcCall} OVER (${windowClause}) AS ${outputCol} FROM ${source}`
}

function getSummary(op: WindowOperation): string {
  const partition = op.partitionBy.length > 0 ? ` over ${op.partitionBy.join(', ')}` : ''
  if (op.column) {
    return `${op.function}(${op.column})${partition}`
  }
  return `${op.function}()${partition}`
}

export const windowPlugin: OperationPlugin<WindowOperation> = {
  type: 'window',
  category: 'aggregate',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
