import Hash from 'lucide-react/dist/esm/icons/hash'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { LimitOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Limit',
  icon: Hash,
  color: 'blue',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'limit',
  description: 'Limit the number of rows returned. Useful for sampling or pagination.',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of rows to return' },
      offset: { type: 'number', description: 'Number of rows to skip before returning results' },
    },
    required: ['limit'],
  },
}

function validate(args: Record<string, unknown>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const limit = args.limit as number
  if (typeof limit !== 'number' || limit <= 0) {
    errors.push('Limit must be a positive number')
    return { valid: false, errors, warnings }
  }

  const offset = args.offset as number | undefined
  if (offset !== undefined && (typeof offset !== 'number' || offset < 0)) {
    errors.push('Offset must be a non-negative number')
    return { valid: false, errors, warnings }
  }

  const operation: LimitOperation = {
    type: 'limit',
    limit,
    offset,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: LimitOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const offset = op.offset ? `OFFSET ${op.offset}` : ''
  return `SELECT * FROM ${source} LIMIT ${op.limit} ${offset}`
}

function getSummary(op: LimitOperation): string {
  if (op.offset) {
    return `Rows ${op.offset + 1}-${op.offset + op.limit}`
  }
  return `First ${op.limit.toLocaleString()} rows`
}

export const limitPlugin: OperationPlugin<LimitOperation> = {
  type: 'limit',
  category: 'query',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
