import SquareCode from 'lucide-react/dist/esm/icons/square-code'
import type { ToolDefinition } from '@/types/ai'
import type { SqlQueryOperation } from '@/types/pipeline'
import type { OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'SQL',
  icon: SquareCode,
  color: 'cyan',
  editable: true,
  editor: { type: 'sql' },
}

// Note: sql operation doesn't have a public tool definition - it's for power users only
const toolDefinition: ToolDefinition = {
  name: 'sql',
  description: 'Execute custom SQL query. For power users.',
  parameters: {
    type: 'object',
    properties: {
      sql: { type: 'string', description: 'The SQL query to execute' },
    },
    required: ['sql'],
  },
}

function validate(args: Record<string, unknown>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const sql = args.sql as string
  if (!sql || typeof sql !== 'string') {
    errors.push('sql requires a SQL query string')
    return { valid: false, errors, warnings }
  }

  const operation: SqlQueryOperation = {
    type: 'sql',
    sql,
    referencedTables: [], // Will be populated by the caller
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: SqlQueryOperation): string {
  return op.sql
}

function getSummary(op: SqlQueryOperation): string {
  const firstLine = op.sql.trim().split('\n')[0]
  return firstLine.length > 40 ? `${firstLine.slice(0, 37)}...` : firstLine
}

export const sqlPlugin: OperationPlugin<SqlQueryOperation> = {
  type: 'sql',
  category: 'custom',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
