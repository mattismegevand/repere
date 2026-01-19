import { Replace } from 'lucide-react'
import { escapeIdentifier, escapeValue } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { FillNullOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Fill Null',
  icon: Replace,
  color: 'amber',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'fillNull',
  description: 'Fill null values in a column using various strategies.',
  parameters: {
    type: 'object',
    properties: {
      column: { type: 'string', description: 'Column with nulls to fill' },
      strategy: {
        type: 'string',
        enum: ['value', 'forward', 'backward', 'mean', 'median', 'mode'],
        description:
          'Fill strategy: value (specific value), forward (previous row), backward (next row), mean/median/mode (for numeric columns)',
      },
      value: {
        type: ['string', 'number'],
        description: 'Value to use when strategy is "value"',
      },
    },
    required: ['column', 'strategy'],
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
  const strategy = args.strategy as string

  if (!column) {
    errors.push('fillNull requires a column name')
    return { valid: false, errors, warnings }
  }
  if (!strategy) {
    errors.push('fillNull requires a strategy')
    return { valid: false, errors, warnings }
  }

  validateColumn(column, columns, errors)

  const validStrategies = ['value', 'forward', 'backward', 'mean', 'median', 'mode']
  if (!validStrategies.includes(strategy)) {
    errors.push(`Invalid strategy "${strategy}". Use one of: ${validStrategies.join(', ')}`)
  }

  if (strategy === 'value' && args.value === undefined) {
    errors.push('fillNull with strategy "value" requires a value')
  }

  const col = columns.find((c) => c.name === column)
  if (col && ['mean', 'median'].includes(strategy) && col.type !== 'number') {
    errors.push(`Strategy "${strategy}" can only be used on numeric columns`)
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: FillNullOperation = {
    type: 'fillNull',
    column,
    strategy: strategy as FillNullOperation['strategy'],
    value: args.value,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: FillNullOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const col = escapeIdentifier(op.column)
  let fillExpr: string

  switch (op.strategy) {
    case 'value':
      fillExpr = `COALESCE(${col}, ${escapeValue(op.value)})`
      break
    case 'forward':
      fillExpr = `COALESCE(${col}, LAST_VALUE(${col} IGNORE NULLS) OVER (ORDER BY __row_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW))`
      break
    case 'backward':
      fillExpr = `COALESCE(${col}, FIRST_VALUE(${col} IGNORE NULLS) OVER (ORDER BY __row_id ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING))`
      break
    case 'mean':
      fillExpr = `COALESCE(${col}, AVG(${col}) OVER ())`
      break
    case 'median':
      fillExpr = `COALESCE(${col}, MEDIAN(${col}) OVER ())`
      break
    case 'mode':
      fillExpr = `COALESCE(${col}, MODE(${col}) OVER ())`
      break
    default:
      fillExpr = col
  }

  const cols = context.sourceColumns
    .map((c) => {
      if (c.name === op.column) {
        return `${fillExpr} AS ${escapeIdentifier(c.name)}`
      }
      return escapeIdentifier(c.name)
    })
    .join(', ')

  if (op.strategy === 'forward' || op.strategy === 'backward') {
    return `SELECT ${cols} FROM (SELECT *, ROW_NUMBER() OVER () AS __row_id FROM ${source}) sub`
  }
  return `SELECT ${cols} FROM ${source}`
}

function getSummary(op: FillNullOperation): string {
  const strategies: Record<string, string> = {
    value: `${op.column} = ${op.value}`,
    forward: `${op.column} (forward fill)`,
    backward: `${op.column} (backward fill)`,
    mean: `${op.column} (mean)`,
    median: `${op.column} (median)`,
    mode: `${op.column} (mode)`,
  }
  return strategies[op.strategy] || `Fill nulls in ${op.column}`
}

export const fillNullPlugin: OperationPlugin<FillNullOperation> = {
  type: 'fillNull',
  category: 'cell',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
