import Table2 from 'lucide-react/dist/esm/icons/table-2'
import { buildAggregate, buildWhereClause, escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { PivotOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Pivot',
  icon: Table2,
  color: 'purple',
  editable: true,
  editor: { type: 'pivot' },
}

const toolDefinition: ToolDefinition = {
  name: 'pivot',
  description:
    "Group data and compute aggregations. Can optionally pivot a column's values into separate columns. Use for summarizing and analyzing data.",
  parameters: {
    type: 'object',
    properties: {
      rowColumns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Columns to group by (row dimensions)',
      },
      pivotColumn: {
        type: 'string',
        description: 'Optional: column whose values become separate columns in the result',
      },
      pivotValues: {
        type: 'array',
        items: { type: 'string' },
        description: 'When pivotColumn is set: which values to pivot into columns',
      },
      aggregations: {
        type: 'array',
        description: 'Aggregation functions to apply',
        items: {
          type: 'object',
          properties: {
            column: { type: 'string', description: 'Column to aggregate' },
            function: {
              type: 'string',
              enum: [
                'count',
                'countDistinct',
                'sum',
                'avg',
                'min',
                'max',
                'first',
                'last',
                'stddev',
                'variance',
                'list',
              ],
              description: 'Aggregation function',
            },
            alias: { type: 'string', description: 'Name for the result column' },
          },
          required: ['column', 'function'],
        },
      },
      showSubtotals: { type: 'boolean', description: 'Show subtotal rows after each group' },
      showGrandTotal: { type: 'boolean', description: 'Show grand total row at end' },
    },
    required: ['rowColumns', 'aggregations'],
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

  const rowColumns = args.rowColumns as string[]
  const aggregations = args.aggregations as { column: string; function: string; alias?: string }[]

  if (!rowColumns || !Array.isArray(rowColumns)) {
    errors.push('pivot requires rowColumns array')
    return { valid: false, errors, warnings }
  }
  if (!aggregations || !Array.isArray(aggregations) || aggregations.length === 0) {
    errors.push('pivot requires at least one aggregation')
    return { valid: false, errors, warnings }
  }

  validateColumns(rowColumns, columns, errors)

  for (const agg of aggregations) {
    validateColumn(agg.column, columns, errors)
    const validFuncs = [
      'count',
      'countDistinct',
      'sum',
      'avg',
      'min',
      'max',
      'first',
      'last',
      'stddev',
      'variance',
      'list',
    ]
    if (!validFuncs.includes(agg.function)) {
      errors.push(`Invalid aggregation function "${agg.function}"`)
    }
  }

  if (args.pivotColumn) {
    validateColumn(args.pivotColumn as string, columns, errors)
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const operation: PivotOperation = {
    type: 'pivot',
    rowColumns,
    pivotColumn: args.pivotColumn as string | undefined,
    pivotValues: args.pivotValues as string[] | undefined,
    aggregations: aggregations.map((a) => ({
      column: a.column,
      function: a.function as PivotOperation['aggregations'][0]['function'],
      alias: a.alias,
    })),
    showSubtotals: args.showSubtotals as boolean | undefined,
    showGrandTotal: args.showGrandTotal as boolean | undefined,
  }

  return { valid: true, operation, errors, warnings }
}

function buildPivotWithSubtotals(op: PivotOperation, source: string, sortedValues: string[]): string {
  const pivotCol = escapeIdentifier(op.pivotColumn!)
  const rowCols = op.rowColumns.map(escapeIdentifier)

  const usingClauses = op.aggregations
    .map((agg) => {
      const func = agg.function.toUpperCase()
      const col = escapeIdentifier(agg.column)
      const alias = agg.alias ? ` AS ${escapeIdentifier(agg.alias)}` : ''
      return `${func}(${col})${alias}`
    })
    .join(', ')

  const values = sortedValues.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ')

  const pivotSource = rowCols.length > 0 ? source : `(SELECT *, 1 as "_dummy" FROM ${source})`
  const groupByClause = rowCols.length > 0 ? ` GROUP BY ${rowCols.join(', ')}` : ' GROUP BY "_dummy"'

  const basePivot = `PIVOT ${pivotSource} ON ${pivotCol} IN (${values}) USING ${usingClauses}${groupByClause}`

  const pivotResultCols: string[] = []
  for (const val of sortedValues) {
    for (const agg of op.aggregations) {
      const alias = agg.alias || agg.function
      pivotResultCols.push(`${val}_${alias}`)
    }
  }

  const ctes: string[] = [`pivoted AS (${basePivot})`]

  if (op.showSubtotals && rowCols.length > 1) {
    for (let level = 0; level < rowCols.length - 1; level++) {
      const groupCols = rowCols.slice(0, level + 1)
      const nullCols = rowCols.slice(level + 1)

      const selectCols = [
        ...groupCols,
        ...nullCols.map((c) => `NULL AS ${c}`),
        ...pivotResultCols.map((c) => `SUM(${escapeIdentifier(c)}) AS ${escapeIdentifier(c)}`),
      ].join(', ')

      ctes.push(`subtotal_level_${level} AS (
    SELECT ${selectCols}
    FROM pivoted
    GROUP BY ${groupCols.join(', ')}
  )`)
    }
  }

  if (op.showGrandTotal) {
    const nullRowCols = rowCols.map((c) => `NULL AS ${c}`).join(', ')
    const sumCols = pivotResultCols.map((c) => `SUM(${escapeIdentifier(c)}) AS ${escapeIdentifier(c)}`).join(', ')
    const selectPart = rowCols.length > 0 ? `${nullRowCols}, ${sumCols}` : sumCols

    ctes.push(`grand_total AS (
    SELECT ${selectPart}
    FROM pivoted
  )`)
  }

  const rowColsList = rowCols.join(', ')
  const pivotColsList = pivotResultCols.map(escapeIdentifier).join(', ')
  const allCols = rowCols.length > 0 ? `${rowColsList}, ${pivotColsList}` : pivotColsList

  const sortGroupExpr = rowCols.length > 0 ? rowCols[0] : 'NULL'

  const unions: string[] = [`SELECT ${allCols}, 0 AS _row_type, ${sortGroupExpr} AS _sort_group FROM pivoted`]

  if (op.showSubtotals && rowCols.length > 1) {
    for (let level = 0; level < rowCols.length - 1; level++) {
      unions.push(
        `SELECT ${allCols}, ${level + 1} AS _row_type, ${sortGroupExpr} AS _sort_group FROM subtotal_level_${level}`
      )
    }
  }

  if (op.showGrandTotal) {
    unions.push(`SELECT ${allCols}, ${rowCols.length + 1} AS _row_type, NULL AS _sort_group FROM grand_total`)
  }

  const orderByParts = ['_sort_group NULLS LAST', '_row_type']
  if (rowCols.length > 1) {
    orderByParts.push(...rowCols.slice(1).map((c) => `${c} NULLS LAST`))
  }

  return `WITH ${ctes.join(',\n')}\n${unions.join('\nUNION ALL\n')}\nORDER BY ${orderByParts.join(', ')}`
}

function buildSql(op: PivotOperation, context: OperationContext): string {
  const source = escapeIdentifier(context.sourceTableName)

  let filteredSource = source
  if (op.filters && op.filters.length > 0) {
    const whereClause = buildWhereClause(op.filters)
    filteredSource = `(SELECT * FROM ${source} ${whereClause})`
  }

  if (!op.pivotColumn) {
    const groupCols = op.rowColumns.map(escapeIdentifier)
    const aggCols = op.aggregations.map(buildAggregate)
    const selectCols = [...groupCols, ...aggCols].join(', ')
    const groupBy = groupCols.length > 0 ? `GROUP BY ${groupCols.join(', ')}` : ''
    return `SELECT ${selectCols} FROM ${filteredSource} ${groupBy}`
  }

  const pivotCol = escapeIdentifier(op.pivotColumn)
  const pivotValues = op.pivotValues ?? []

  const usingClauses = op.aggregations
    .map((agg) => {
      const func = agg.function.toUpperCase()
      const col = escapeIdentifier(agg.column)
      const alias = agg.alias ? ` AS ${escapeIdentifier(agg.alias)}` : ''
      return `${func}(${col})${alias}`
    })
    .join(', ')

  const sortedValues = [...pivotValues].sort((a, b) => a.localeCompare(b))
  const values = sortedValues.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ')

  const groupByClause =
    op.rowColumns.length > 0 ? ` GROUP BY ${op.rowColumns.map(escapeIdentifier).join(', ')}` : ' GROUP BY "_dummy"'

  const pivotSource = op.rowColumns.length > 0 ? filteredSource : `(SELECT *, 1 as "_dummy" FROM ${filteredSource})`

  const basePivot = `PIVOT ${pivotSource} ON ${pivotCol} IN (${values}) USING ${usingClauses}${groupByClause}`

  if (!op.showSubtotals && !op.showGrandTotal) {
    if (op.rowColumns.length === 0) {
      return `SELECT * EXCLUDE (_dummy) FROM (${basePivot})`
    }
    return basePivot
  }

  return buildPivotWithSubtotals(op, filteredSource, sortedValues)
}

function getSummary(op: PivotOperation): string {
  const groupBy = op.rowColumns.join(', ')
  const aggs = op.aggregations.map((a) => `${a.function}(${a.column})`).join(', ')

  if (op.pivotColumn) {
    return `${groupBy} x ${op.pivotColumn}: ${aggs}`
  }
  return `Group by ${groupBy}: ${aggs}`
}

export const pivotPlugin: OperationPlugin<PivotOperation> = {
  type: 'pivot',
  category: 'aggregate',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
