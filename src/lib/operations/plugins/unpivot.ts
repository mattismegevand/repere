import Table2 from 'lucide-react/dist/esm/icons/table-2'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { UnpivotOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Unpivot',
  icon: Table2,
  color: 'purple',
  editable: false,
}

const toolDefinition: ToolDefinition = {
  name: 'unpivot',
  description: 'Convert columns into rows (opposite of pivot). Useful for normalizing wide data.',
  parameters: {
    type: 'object',
    properties: {
      valueColumns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Columns to unpivot (their names become values in nameColumn)',
      },
      nameColumn: {
        type: 'string',
        description: 'Name for the new column that will contain the original column names',
      },
      valueColumn: {
        type: 'string',
        description: 'Name for the new column that will contain the values',
      },
    },
    required: ['valueColumns', 'nameColumn', 'valueColumn'],
  },
}

function validateColumns(colNames: string[], columns: Column[], errors: string[]): boolean {
  let valid = true
  for (const col of colNames) {
    if (!columns.some((c) => c.name === col)) {
      errors.push(`Column "${col}" does not exist. Available: ${columns.map((c) => c.name).join(', ')}`)
      valid = false
    }
  }
  return valid
}

function validate(args: Record<string, unknown>, columns: Column[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const valueColumns = args.valueColumns as string[]
  const nameColumn = args.nameColumn as string
  const valueColumn = args.valueColumn as string

  if (!valueColumns || !Array.isArray(valueColumns) || valueColumns.length === 0) {
    errors.push('unpivot requires at least one valueColumn')
    return { valid: false, errors, warnings }
  }
  if (!nameColumn) {
    errors.push('unpivot requires a nameColumn')
    return { valid: false, errors, warnings }
  }
  if (!valueColumn) {
    errors.push('unpivot requires a valueColumn')
    return { valid: false, errors, warnings }
  }

  validateColumns(valueColumns, columns, errors)

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: UnpivotOperation = {
    type: 'unpivot',
    valueColumns,
    nameColumn,
    valueColumn,
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: UnpivotOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)
  const valueCols = op.valueColumns.map(escapeIdentifier).join(', ')
  const nameCol = escapeIdentifier(op.nameColumn)
  const valueCol = escapeIdentifier(op.valueColumn)
  return `UNPIVOT ${source} ON ${valueCols} INTO NAME ${nameCol} VALUE ${valueCol}`
}

function getSummary(op: UnpivotOperation): string {
  return `${op.valueColumns.length} cols -> ${op.nameColumn}/${op.valueColumn}`
}

export const unpivotPlugin: OperationPlugin<UnpivotOperation> = {
  type: 'unpivot',
  category: 'aggregate',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
