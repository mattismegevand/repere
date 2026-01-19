import { Table2 } from 'lucide-react'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { ReorderColumnsOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Reorder',
  icon: Table2,
  color: 'green',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'reorderColumns',
  description: 'Change the order of columns in the dataset.',
  parameters: {
    type: 'object',
    properties: {
      order: {
        type: 'array',
        items: { type: 'string' },
        description: 'New column order (must include all columns)',
      },
    },
    required: ['order'],
  },
}

function validate(args: Record<string, unknown>, columns: Column[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const order = args.order as string[]
  if (!order || !Array.isArray(order)) {
    errors.push('reorderColumns requires an order array')
    return { valid: false, errors, warnings }
  }

  const existingNames = new Set(columns.map((c) => c.name))
  const orderSet = new Set(order)

  for (const col of columns) {
    if (!orderSet.has(col.name)) {
      errors.push(`Column "${col.name}" is missing from the order`)
    }
  }
  for (const col of order) {
    if (!existingNames.has(col)) {
      errors.push(`Column "${col}" does not exist`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: ReorderColumnsOperation = {
    type: 'reorderColumns',
    order,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: ReorderColumnsOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const cols = op.order.map(escapeIdentifier).join(', ')
  return `SELECT ${cols} FROM ${source}`
}

function getSummary(): string {
  return 'Column order changed'
}

export const reorderColumnsPlugin: OperationPlugin<ReorderColumnsOperation> = {
  type: 'reorderColumns',
  category: 'column',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
