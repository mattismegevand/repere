import { Layers } from 'lucide-react'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { PipelineNode, UnionOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Union',
  icon: Layers,
  color: 'orange',
  editable: true,
}

const toolDefinition: ToolDefinition = {
  name: 'union',
  description: 'Stack multiple tables vertically. Tables must have compatible schemas.',
  parameters: {
    type: 'object',
    properties: {
      sourceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of tables to union with the current table',
      },
      mode: {
        type: 'string',
        enum: ['all', 'distinct'],
        description: 'all (keep duplicates) or distinct (remove duplicates)',
      },
    },
    required: ['sourceIds', 'mode'],
  },
}

function validate(
  args: Record<string, unknown>,
  _columns: unknown,
  nodes?: Record<string, PipelineNode>
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const sourceIds = args.sourceIds as string[]
  const mode = args.mode as string

  if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
    errors.push('union requires at least one sourceId')
    return { valid: false, errors, warnings }
  }
  if (!mode || !['all', 'distinct'].includes(mode)) {
    errors.push('union requires mode to be "all" or "distinct"')
    return { valid: false, errors, warnings }
  }

  for (const id of sourceIds) {
    if (!nodes?.[id]) {
      errors.push(`Table with ID "${id}" does not exist`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: UnionOperation = {
    type: 'union',
    sourceIds,
    mode: mode as 'all' | 'distinct',
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: UnionOperation, context: OperationContext): string {
  if (!context.additionalSources) {
    throw new Error('Union requires additionalSources')
  }

  const source = escapeIdentifier(context.sourceTableName)
  const unionMode = op.mode === 'all' ? 'UNION ALL' : 'UNION'
  const sources = [source, ...op.sourceIds.map((id) => escapeIdentifier(context.additionalSources![id].tableName))]
  return sources.map((s) => `SELECT * FROM ${s}`).join(` ${unionMode} `)
}

function getSummary(op: UnionOperation): string {
  const count = op.sourceIds.length
  return `Union ${count} sources (${op.mode})`
}

export const unionPlugin: OperationPlugin<UnionOperation> = {
  type: 'union',
  category: 'combine',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
