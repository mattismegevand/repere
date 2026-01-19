import { ArrowDownUp } from 'lucide-react'
import { buildOrderByClause, escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { SortOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Sort',
  icon: ArrowDownUp,
  color: 'blue',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'sort',
  description: 'Sort rows by one or more columns. Useful for ordering data for analysis or display.',
  parameters: {
    type: 'object',
    properties: {
      sorts: {
        type: 'array',
        description: 'Array of sort specifications',
        items: {
          type: 'object',
          properties: {
            column: { type: 'string', description: 'Column to sort by' },
            direction: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction' },
            nulls: { type: 'string', enum: ['first', 'last'], description: 'Where to place nulls' },
          },
          required: ['column', 'direction'],
        },
      },
    },
    required: ['sorts'],
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

  const sorts = args.sorts as { column: string; direction: string; nulls?: string }[]
  if (!sorts || !Array.isArray(sorts) || sorts.length === 0) {
    errors.push('Sort requires at least one sort specification')
    return { valid: false, errors, warnings }
  }

  for (const s of sorts) {
    validateColumn(s.column, columns, errors)
    if (!['asc', 'desc'].includes(s.direction)) {
      errors.push(`Invalid sort direction "${s.direction}". Use "asc" or "desc"`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: SortOperation = {
    type: 'sort',
    sorts: sorts.map((s) => ({
      column: s.column,
      direction: s.direction as 'asc' | 'desc',
      nulls: s.nulls as 'first' | 'last' | undefined,
    })),
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: SortOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const orderBy = buildOrderByClause(op.sorts)
  return `SELECT * FROM ${source} ${orderBy}`
}

function getSummary(op: SortOperation): string {
  const parts = op.sorts.map((s) => `${s.column} ${s.direction}`)
  const summary = parts.join(', ')
  return summary.length > 50 ? `${summary.slice(0, 47)}...` : summary
}

export const sortPlugin: OperationPlugin<SortOperation> = {
  type: 'sort',
  category: 'query',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
