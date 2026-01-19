import { Filter } from 'lucide-react'
import { buildFilterExpression, escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { FilterOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Filter',
  icon: Filter,
  color: 'blue',
  editable: true,
}

const toolDefinition: ToolDefinition = {
  name: 'filter',
  description:
    'Filter rows based on conditions. Use for selecting subsets of data that match criteria. Supports nested AND/OR logic.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'object',
        description: 'Filter expression - either a condition or a group of conditions',
        properties: {
          type: {
            type: 'string',
            enum: ['condition', 'group'],
            description: 'Type of expression',
          },
          filter: {
            type: 'object',
            description: 'For type="condition": the filter to apply',
            properties: {
              column: { type: 'string', description: 'Column name to filter on' },
              operator: {
                type: 'string',
                enum: [
                  'eq',
                  'neq',
                  'gt',
                  'lt',
                  'gte',
                  'lte',
                  'contains',
                  'notContains',
                  'startsWith',
                  'endsWith',
                  'isNull',
                  'isNotNull',
                  'in',
                  'notIn',
                  'between',
                ],
                description: 'Comparison operator',
              },
              value: {
                description: 'Value to compare against. Use array for in/notIn/between operators.',
              },
            },
            required: ['column', 'operator'],
          },
          combineMode: {
            type: 'string',
            enum: ['and', 'or'],
            description: 'For type="group": how to combine children',
          },
          children: {
            type: 'array',
            description: 'For type="group": nested expressions',
            items: { type: 'object' },
          },
        },
        required: ['type'],
      },
    },
    required: ['expression'],
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

  const expr = args.expression as { type: string; filter?: { column: string }; children?: unknown[] }
  if (!expr || !expr.type) {
    errors.push('Filter requires an expression with a type')
    return { valid: false, errors, warnings }
  }

  function checkExpression(e: { type: string; filter?: { column: string }; children?: unknown[] }): void {
    if (e.type === 'condition' && e.filter?.column) {
      validateColumn(e.filter.column, columns, errors)
    } else if (e.type === 'group' && e.children) {
      for (const child of e.children as { type: string; filter?: { column: string }; children?: unknown[] }[]) {
        checkExpression(child)
      }
    }
  }
  checkExpression(expr)

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: FilterOperation = {
    type: 'filter',
    expression: args.expression as FilterOperation['expression'],
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: FilterOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const condition = buildFilterExpression(op.expression)
  return `SELECT * FROM ${source} WHERE ${condition}`
}

function getSummary(op: FilterOperation): string {
  try {
    const sql = buildFilterExpression(op.expression)
    return sql.length > 50 ? `${sql.slice(0, 47)}...` : sql
  } catch {
    return 'Custom filter'
  }
}

export const filterPlugin: OperationPlugin<FilterOperation> = {
  type: 'filter',
  category: 'query',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
