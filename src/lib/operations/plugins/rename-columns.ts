import { Pencil } from 'lucide-react'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { RenameColumnsOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Rename',
  icon: Pencil,
  color: 'green',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'renameColumns',
  description: 'Rename one or more columns. Use for clarity or to match expected schemas.',
  parameters: {
    type: 'object',
    properties: {
      renames: {
        type: 'array',
        description: 'List of rename operations',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Current column name' },
            to: { type: 'string', description: 'New column name' },
          },
          required: ['from', 'to'],
        },
      },
    },
    required: ['renames'],
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

  const renames = args.renames as { from: string; to: string }[]
  if (!renames || !Array.isArray(renames) || renames.length === 0) {
    errors.push('renameColumns requires at least one rename')
    return { valid: false, errors, warnings }
  }

  for (const r of renames) {
    validateColumn(r.from, columns, errors)
    if (!r.to || typeof r.to !== 'string') {
      errors.push(`Rename target for "${r.from}" must be a non-empty string`)
    }
    if (columns.some((c) => c.name === r.to && c.name !== r.from)) {
      errors.push(`Column "${r.to}" already exists`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: RenameColumnsOperation = {
    type: 'renameColumns',
    renames,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: RenameColumnsOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const renameMap = new Map(op.renames.map((r) => [r.from, r.to]))
  const cols = context.sourceColumns
    .map((c) => {
      const newName = renameMap.get(c.name)
      if (newName) {
        return `${escapeIdentifier(c.name)} AS ${escapeIdentifier(newName)}`
      }
      return escapeIdentifier(c.name)
    })
    .join(', ')
  return `SELECT ${cols} FROM ${source}`
}

function getSummary(op: RenameColumnsOperation): string {
  if (op.renames.length === 1) {
    return `${op.renames[0].from} -> ${op.renames[0].to}`
  }
  return `Rename ${op.renames.length} columns`
}

function merge(existing: RenameColumnsOperation, incoming: RenameColumnsOperation): RenameColumnsOperation {
  const renameMap = new Map(existing.renames.map((r) => [r.from, r]))
  for (const rename of incoming.renames) {
    renameMap.set(rename.from, rename)
  }
  return {
    ...incoming,
    renames: Array.from(renameMap.values()),
  }
}

export const renameColumnsPlugin: OperationPlugin<RenameColumnsOperation> = {
  type: 'renameColumns',
  category: 'column',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
  canMerge: () => true,
  merge,
}
