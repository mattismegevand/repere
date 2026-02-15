import Binary from 'lucide-react/dist/esm/icons/binary'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { CastColumnOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Cast',
  icon: Binary,
  color: 'green',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'castColumn',
  description: 'Change the data type of a column. Use when a column was parsed incorrectly or needs type conversion.',
  parameters: {
    type: 'object',
    properties: {
      column: { type: 'string', description: 'Column to cast' },
      toType: {
        type: 'string',
        description: 'Target DuckDB type: VARCHAR, INTEGER, BIGINT, DOUBLE, BOOLEAN, DATE, TIMESTAMP, etc.',
      },
    },
    required: ['column', 'toType'],
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
  const toType = args.toType as string

  if (!column) {
    errors.push('castColumn requires a column name')
    return { valid: false, errors, warnings }
  }
  if (!toType) {
    errors.push('castColumn requires a target type')
    return { valid: false, errors, warnings }
  }

  validateColumn(column, columns, errors)

  const validTypes = [
    'VARCHAR',
    'TEXT',
    'INTEGER',
    'INT',
    'BIGINT',
    'SMALLINT',
    'DOUBLE',
    'FLOAT',
    'REAL',
    'DECIMAL',
    'BOOLEAN',
    'DATE',
    'TIME',
    'TIMESTAMP',
    'INTERVAL',
    'UUID',
    'JSON',
    'BLOB',
  ]
  if (!validTypes.includes(toType.toUpperCase())) {
    warnings.push(`Type "${toType}" may not be a standard DuckDB type`)
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: CastColumnOperation = {
    type: 'castColumn',
    column,
    toType,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: CastColumnOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const cols = context.sourceColumns
    .map((c) => {
      if (c.name === op.column) {
        return `CAST(${escapeIdentifier(c.name)} AS ${op.toType}) AS ${escapeIdentifier(c.name)}`
      }
      return escapeIdentifier(c.name)
    })
    .join(', ')
  return `SELECT ${cols} FROM ${source}`
}

function getSummary(op: CastColumnOperation): string {
  return `${op.column} -> ${op.toType}`
}

export const castColumnPlugin: OperationPlugin<CastColumnOperation> = {
  type: 'castColumn',
  category: 'column',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
