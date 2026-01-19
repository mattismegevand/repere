import { GitMerge } from 'lucide-react'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { JoinOperation, PipelineNode } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Join',
  icon: GitMerge,
  color: 'orange',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'join',
  description: 'Combine two tables based on matching columns. Use to enrich data with information from another table.',
  parameters: {
    type: 'object',
    properties: {
      joinType: {
        type: 'string',
        enum: ['inner', 'left', 'right', 'full', 'cross'],
        description:
          'Join type: inner (only matches), left (all from current + matches), right (all from other + matches), full (all from both), cross (cartesian product)',
      },
      rightSourceId: {
        type: 'string',
        description: 'ID of the table to join with',
      },
      conditions: {
        type: 'array',
        description: 'Join conditions',
        items: {
          type: 'object',
          properties: {
            leftColumn: { type: 'string', description: 'Column from current table' },
            rightColumn: { type: 'string', description: 'Column from other table' },
            operator: {
              type: 'string',
              enum: ['=', '!=', '>', '<', '>=', '<=', 'BETWEEN'],
              description: 'Comparison operator',
            },
          },
          required: ['leftColumn', 'rightColumn', 'operator'],
        },
      },
      conditionCombineMode: {
        type: 'string',
        enum: ['and', 'or'],
        description: 'How to combine multiple conditions',
        default: 'and',
      },
    },
    required: ['joinType', 'rightSourceId', 'conditions'],
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

function validate(
  args: Record<string, unknown>,
  columns: Column[],
  nodes?: Record<string, PipelineNode>
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const joinType = args.joinType as string
  const rightSourceId = args.rightSourceId as string
  const conditions = args.conditions as { leftColumn: string; rightColumn: string; operator: string }[]

  if (!joinType) {
    errors.push('join requires a joinType')
    return { valid: false, errors, warnings }
  }
  if (!['inner', 'left', 'right', 'full', 'cross'].includes(joinType)) {
    errors.push(`Invalid join type "${joinType}"`)
  }
  if (!rightSourceId) {
    errors.push('join requires a rightSourceId')
    return { valid: false, errors, warnings }
  }

  const rightNode = nodes?.[rightSourceId]
  if (!rightNode) {
    errors.push(`Table with ID "${rightSourceId}" does not exist`)
    return { valid: false, errors, warnings }
  }

  if (joinType !== 'cross') {
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      errors.push('Non-cross joins require at least one condition')
      return { valid: false, errors, warnings }
    }

    for (const c of conditions) {
      validateColumn(c.leftColumn, columns, errors)
      validateColumn(c.rightColumn, rightNode.columns, errors)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: JoinOperation = {
    type: 'join',
    joinType: joinType as JoinOperation['joinType'],
    rightSourceId,
    conditions:
      conditions?.map((c) => ({
        leftColumn: c.leftColumn,
        rightColumn: c.rightColumn,
        operator: c.operator as JoinOperation['conditions'][0]['operator'],
      })) ?? [],
    conditionCombineMode: args.conditionCombineMode as 'and' | 'or' | undefined,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: JoinOperation, context: OperationContext): string {
  if (!context.additionalSources || !context.additionalSources[op.rightSourceId]) {
    throw new Error('Join requires additionalSources with rightSourceId')
  }

  const source = escapeIdentifier(context.sourceTableName)
  const rightInfo = context.additionalSources[op.rightSourceId]
  const rightTable = escapeIdentifier(rightInfo.tableName)
  const joinType = op.joinType.toUpperCase()

  const leftCols = context.sourceColumns.map((c) => `l.${escapeIdentifier(c.name)} AS ${escapeIdentifier(c.name)}`)
  const rightCols = rightInfo.columns.map((c) => {
    const leftHasCol = context.sourceColumns.some((lc) => lc.name === c.name)
    const alias = leftHasCol ? `${rightInfo.tableName}_${c.name}` : c.name
    return `r.${escapeIdentifier(c.name)} AS ${escapeIdentifier(alias)}`
  })
  const selectCols = [...leftCols, ...rightCols].join(', ')

  if (op.joinType === 'cross') {
    return `SELECT ${selectCols} FROM ${source} l CROSS JOIN ${rightTable} r`
  }

  const separator = op.conditionCombineMode === 'or' ? ' OR ' : ' AND '
  const conditions = op.conditions
    .map((c) => {
      const leftCol = `l.${escapeIdentifier(c.leftColumn)}`
      const rightCol = `r.${escapeIdentifier(c.rightColumn)}`
      return `${leftCol} ${c.operator} ${rightCol}`
    })
    .join(separator)

  return `SELECT ${selectCols} FROM ${source} l ${joinType} JOIN ${rightTable} r ON ${conditions}`
}

function getSummary(op: JoinOperation): string {
  const joinSymbol = op.joinType === 'cross' ? '×' : '⋈'
  const type = op.joinType.toUpperCase()
  const conditions = op.conditions.map((c) => `${c.leftColumn}=${c.rightColumn}`).join(', ')
  return `${joinSymbol} ${type}: ${conditions}`
}

export const joinPlugin: OperationPlugin<JoinOperation> = {
  type: 'join',
  category: 'combine',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
