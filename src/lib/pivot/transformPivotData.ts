import type { PivotColumn, PivotRow, PivotTableData } from '@/components/pivot-table/types'
import type { PivotValueField } from '@/stores/pivotStore'
import type { Filter } from '@/types/dataset'

interface TransformOptions {
  rowFields: string[]
  columnField: string | null
  valueFields: PivotValueField[]
  pivotValues: string[]
}

interface FlatRow {
  [key: string]: unknown
  _row_type?: number
  _sort_group?: unknown
}

// Convert various number types (including typed arrays from DuckDB) to plain number
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  // Handle typed arrays (DuckDB returns these for numeric columns)
  if (ArrayBuffer.isView(value)) {
    // For typed arrays, get the first element
    const arr = value as unknown as ArrayLike<number>
    if (arr.length > 0) {
      return Number(arr[0])
    }
    return null
  }
  // Handle regular arrays
  if (Array.isArray(value) && value.length > 0) {
    return toNumber(value[0])
  }
  // Try to convert to number
  const num = Number(value)
  return isNaN(num) ? null : num
}

export function transformPivotData(flatRows: FlatRow[], options: TransformOptions): PivotTableData {
  const { rowFields, columnField, valueFields, pivotValues } = options

  // Build column definitions
  const columns: PivotColumn[] = []

  // Build mapping of column keys to their showValuesAs settings
  const showValuesAsMap = new Map<string, string>()

  // Single row header column for hierarchical display (contains all row groupings via indentation)
  if (rowFields.length > 0) {
    columns.push({
      key: '__row_label__',
      label: 'Row Labels',
      isRowHeader: true,
    })
  }

  // Value columns
  if (columnField && pivotValues.length > 0) {
    // Pivot mode: one column per pivot value per aggregation
    for (const pivotVal of pivotValues) {
      for (const valField of valueFields) {
        const colKey = `${pivotVal}_${valField.alias}`
        const isPercentage = valField.showValuesAs && valField.showValuesAs !== 'normal'
        columns.push({
          key: colKey,
          label: `${pivotVal} - ${valField.alias}`,
          isRowHeader: false,
          // Override format for percentage display (value is already 0-100)
          format: isPercentage ? { type: 'number', decimals: 1, suffix: '%' } : valField.format,
        })
        if (isPercentage) {
          showValuesAsMap.set(colKey, valField.showValuesAs!)
        }
      }
    }
  } else {
    // Group by mode: one column per aggregation
    for (const valField of valueFields) {
      const isPercentage = valField.showValuesAs && valField.showValuesAs !== 'normal'
      columns.push({
        key: valField.alias,
        label: valField.alias,
        isRowHeader: false,
        // Override format for percentage display (value is already 0-100)
        format: isPercentage ? { type: 'number', decimals: 1, suffix: '%' } : valField.format,
      })
      if (isPercentage) {
        showValuesAsMap.set(valField.alias, valField.showValuesAs!)
      }
    }
  }

  // Transform rows into hierarchical structure
  const rows = buildHierarchy(flatRows, rowFields, columns)

  // Apply "Show Values As" transformations if any
  if (showValuesAsMap.size > 0) {
    applyShowValuesAs(rows, showValuesAsMap, columnField, pivotValues)
  }

  return { columns, rows }
}

// Apply "Show Values As" percentage calculations to all rows
function applyShowValuesAs(
  rows: PivotRow[],
  showValuesAsMap: Map<string, string>,
  columnField: string | null,
  pivotValues: string[]
): void {
  // Find grand total row
  const grandTotalRow = rows.find((r) => r.isGrandTotal)
  const grandTotalValues = grandTotalRow?.values ?? {}

  // Compute column totals for percentOfColumnTotal (sum of all non-subtotal, non-grandtotal rows per column)
  const columnTotals: Record<string, number> = {}
  if (columnField && pivotValues.length > 0) {
    for (const colKey of showValuesAsMap.keys()) {
      if (showValuesAsMap.get(colKey) === 'percentOfColumnTotal') {
        columnTotals[colKey] = computeColumnTotal(rows, colKey)
      }
    }
  }

  // Process each row recursively
  const processRow = (row: PivotRow, parentValues: Record<string, unknown> | null) => {
    // Get subtotal values for this row (to use as parent total for children)
    const subtotalChild = row.children?.find((c) => c.isSubtotal)
    const rowSubtotalValues = subtotalChild?.values ?? row.values

    // Transform values based on showValuesAs
    for (const [colKey, showAs] of showValuesAsMap) {
      const rawValue = toNumber(row.values[colKey])
      if (rawValue === null) continue

      let percentValue: number | null = null

      switch (showAs) {
        case 'percentOfGrandTotal': {
          const grandTotal = toNumber(grandTotalValues[colKey])
          if (grandTotal !== null && grandTotal !== 0) {
            percentValue = (rawValue / grandTotal) * 100
          }
          break
        }
        case 'percentOfParentTotal': {
          if (row.isGrandTotal) {
            percentValue = 100
          } else if (parentValues) {
            const parentTotal = toNumber(parentValues[colKey])
            if (parentTotal !== null && parentTotal !== 0) {
              percentValue = (rawValue / parentTotal) * 100
            }
          } else {
            // Top level - use grand total as parent
            const grandTotal = toNumber(grandTotalValues[colKey])
            if (grandTotal !== null && grandTotal !== 0) {
              percentValue = (rawValue / grandTotal) * 100
            }
          }
          break
        }
        case 'percentOfColumnTotal': {
          const colTotal = columnTotals[colKey]
          if (colTotal && colTotal !== 0) {
            percentValue = (rawValue / colTotal) * 100
          }
          break
        }
      }

      if (percentValue !== null) {
        row.values[colKey] = percentValue
      }
    }

    // Process children recursively
    if (row.children) {
      for (const child of row.children) {
        if (!child.isSubtotal) {
          processRow(child, rowSubtotalValues)
        } else {
          // Subtotals also need transformation
          processRow(child, parentValues)
        }
      }
    }
  }

  // Process all root rows
  for (const row of rows) {
    processRow(row, null)
  }
}

// Compute the total for a column (sum of leaf values only)
function computeColumnTotal(rows: PivotRow[], colKey: string): number {
  let total = 0

  const traverse = (row: PivotRow) => {
    // Only count leaf rows (no children or only subtotal children)
    const dataChildren = row.children?.filter((c) => !c.isSubtotal) ?? []
    if (dataChildren.length === 0 && !row.isSubtotal && !row.isGrandTotal) {
      const value = row.values[colKey]
      if (typeof value === 'number') {
        total += value
      }
    }
    // Traverse children
    if (row.children) {
      for (const child of row.children) {
        traverse(child)
      }
    }
  }

  for (const row of rows) {
    if (!row.isGrandTotal) {
      traverse(row)
    }
  }

  return total
}

function buildHierarchy(flatRows: FlatRow[], rowFields: string[], columns: PivotColumn[]): PivotRow[] {
  if (rowFields.length === 0) {
    // No row grouping - flat structure
    return flatRows.map((row, index) => ({
      id: `row-${index}`,
      level: 0,
      isExpanded: true,
      isSubtotal: (row._row_type ?? 0) > 0 && row._sort_group !== null,
      isGrandTotal: row._sort_group === null && (row._row_type ?? 0) > 0,
      groupPath: [],
      groupValue: null,
      values: extractValues(row, columns),
    }))
  }

  // Group rows by row fields
  const rootRows: PivotRow[] = []
  const groupMap = new Map<string, PivotRow>()

  for (const flatRow of flatRows) {
    const rowType = (flatRow._row_type ?? 0) as number
    const isData = rowType === 0
    const isGrandTotal = flatRow._sort_group === null && rowType > 0

    if (isGrandTotal) {
      rootRows.push({
        id: 'grand-total',
        level: 0,
        isExpanded: false,
        isSubtotal: false,
        isGrandTotal: true,
        groupPath: ['__grand_total__'],
        groupValue: 'Grand Total',
        values: extractValues(flatRow, columns),
      })
      continue
    }

    const path: string[] = []
    for (let i = 0; i < rowFields.length; i++) {
      const fieldValue = flatRow[rowFields[i]]
      if (fieldValue === null || fieldValue === undefined) break
      path.push(String(fieldValue))
    }

    if (path.length === 0) continue

    const isSubtotal = rowType > 0

    if (isSubtotal) {
      const level = rowType - 1
      const parentPath = path.slice(0, level + 1)
      const parentKey = parentPath.join('|')
      const parent = groupMap.get(parentKey)

      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push({
          id: `subtotal-${parentKey}`,
          level: level + 1,
          isExpanded: false,
          isSubtotal: true,
          isGrandTotal: false,
          groupPath: [...parentPath, '__subtotal__'],
          groupValue: path[level],
          values: extractValues(flatRow, columns),
        })
      }
    } else if (isData) {
      addToHierarchy(rootRows, groupMap, flatRow, path, columns)
    }
  }

  return rootRows
}

function addToHierarchy(
  rootRows: PivotRow[],
  groupMap: Map<string, PivotRow>,
  flatRow: FlatRow,
  path: string[],
  columns: PivotColumn[]
): void {
  let currentLevel: PivotRow[] = rootRows
  let currentPath: string[] = []

  for (let i = 0; i < path.length; i++) {
    const value = path[i]
    currentPath = [...currentPath, value]
    const key = currentPath.join('|')

    let existing = groupMap.get(key)

    if (!existing) {
      existing = {
        id: `group-${key}`,
        level: i,
        isExpanded: true,
        isSubtotal: false,
        isGrandTotal: false,
        groupPath: [...currentPath],
        groupValue: value,
        values: i === path.length - 1 ? extractValues(flatRow, columns) : {},
        children: [],
      }
      groupMap.set(key, existing)
      currentLevel.push(existing)
    } else if (i === path.length - 1) {
      existing.values = extractValues(flatRow, columns)
    }

    if (existing.children) {
      currentLevel = existing.children
    }
  }
}

function extractValues(row: FlatRow, columns: PivotColumn[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const col of columns) {
    if (row[col.key] !== undefined) {
      values[col.key] = row[col.key]
    }
  }
  return values
}

// Build WHERE clause from filters
function buildWhereClause(filters: Filter[]): string {
  if (filters.length === 0) return ''

  const escapeId = (s: string) => `"${s.replace(/"/g, '""')}"`

  const conditions = filters.map((f) => {
    const col = escapeId(f.column)
    const val = typeof f.value === 'string' ? `'${f.value.replace(/'/g, "''")}'` : f.value

    switch (f.operator) {
      case 'eq':
        return f.value === null ? `${col} IS NULL` : `${col} = ${val}`
      case 'neq':
        return f.value === null ? `${col} IS NOT NULL` : `${col} != ${val}`
      case 'gt':
        return `${col} > ${val}`
      case 'gte':
        return `${col} >= ${val}`
      case 'lt':
        return `${col} < ${val}`
      case 'lte':
        return `${col} <= ${val}`
      case 'contains':
        return `${col} ILIKE '%${String(f.value).replace(/'/g, "''")}%'`
      case 'startsWith':
        return `${col} ILIKE '${String(f.value).replace(/'/g, "''")}%'`
      case 'endsWith':
        return `${col} ILIKE '%${String(f.value).replace(/'/g, "''")}'`
      case 'isNull':
        return `${col} IS NULL`
      case 'isNotNull':
        return `${col} IS NOT NULL`
      default:
        return `${col} = ${val}`
    }
  })

  return `WHERE ${conditions.join(' AND ')}`
}

// Build GROUP BY SQL (rows only, no pivot column)
function buildGroupBySql(
  sourceTableName: string,
  rowFields: string[],
  valueFields: PivotValueField[],
  filters: Filter[],
  showSubtotals: boolean,
  showGrandTotal: boolean
): string {
  const escapeId = (s: string) => `"${s.replace(/"/g, '""')}"`
  const rowCols = rowFields.map(escapeId)
  const whereClause = buildWhereClause(filters)

  // Build aggregation columns
  const aggCols = valueFields
    .map((vf) => {
      const func = vf.aggregation.toUpperCase()
      const col = escapeId(vf.column)
      return `${func}(${col}) AS ${escapeId(vf.alias)}`
    })
    .join(', ')

  const source = escapeId(sourceTableName)
  const groupBy = rowCols.length > 0 ? `GROUP BY ${rowCols.join(', ')}` : ''

  // Base query
  const baseSelect = rowCols.length > 0 ? `${rowCols.join(', ')}, ${aggCols}` : aggCols
  const baseQuery = `SELECT ${baseSelect} FROM ${source} ${whereClause} ${groupBy}`

  if (!showSubtotals && !showGrandTotal) {
    return baseQuery
  }

  // Build CTEs for subtotals
  const ctes: string[] = [`base AS (${baseQuery})`]
  const resultCols = valueFields.map((vf) => escapeId(vf.alias))

  if (showSubtotals && rowCols.length > 1) {
    for (let level = 0; level < rowCols.length - 1; level++) {
      const groupCols = rowCols.slice(0, level + 1)
      const nullCols = rowCols.slice(level + 1)

      const selectCols = [
        ...groupCols,
        ...nullCols.map((c) => `NULL AS ${c}`),
        ...resultCols.map((c) => `SUM(${c}) AS ${c}`),
      ].join(', ')

      ctes.push(`subtotal_level_${level} AS (
    SELECT ${selectCols}
    FROM base
    GROUP BY ${groupCols.join(', ')}
  )`)
    }
  }

  if (showGrandTotal) {
    const nullRowCols = rowCols.map((c) => `NULL AS ${c}`).join(', ')
    const sumCols = resultCols.map((c) => `SUM(${c}) AS ${c}`).join(', ')
    const selectPart = rowCols.length > 0 ? `${nullRowCols}, ${sumCols}` : sumCols

    ctes.push(`grand_total AS (
    SELECT ${selectPart}
    FROM base
  )`)
  }

  // Build UNION query
  const allCols = rowCols.length > 0 ? `${rowCols.join(', ')}, ${resultCols.join(', ')}` : resultCols.join(', ')
  const sortGroupExpr = rowCols.length > 0 ? rowCols[0] : 'NULL'

  const unions: string[] = [`SELECT ${allCols}, 0 AS _row_type, ${sortGroupExpr} AS _sort_group FROM base`]

  if (showSubtotals && rowCols.length > 1) {
    for (let level = 0; level < rowCols.length - 1; level++) {
      unions.push(
        `SELECT ${allCols}, ${level + 1} AS _row_type, ${sortGroupExpr} AS _sort_group FROM subtotal_level_${level}`
      )
    }
  }

  if (showGrandTotal) {
    unions.push(`SELECT ${allCols}, ${rowCols.length + 1} AS _row_type, NULL AS _sort_group FROM grand_total`)
  }

  const orderByParts = ['_sort_group NULLS LAST', '_row_type']
  if (rowCols.length > 1) {
    orderByParts.push(...rowCols.slice(1).map((c) => `${c} NULLS LAST`))
  }

  return `WITH ${ctes.join(',\n')}\n${unions.join('\nUNION ALL\n')}\nORDER BY ${orderByParts.join(', ')}`
}

// Build PIVOT SQL (with column field)
function buildPivotSql(
  sourceTableName: string,
  rowFields: string[],
  columnField: string,
  valueFields: PivotValueField[],
  pivotValues: string[],
  filters: Filter[],
  showSubtotals: boolean,
  showGrandTotal: boolean
): string {
  const escapeId = (s: string) => `"${s.replace(/"/g, '""')}"`
  const escapeStr = (s: string) => `'${String(s).replace(/'/g, "''")}'`

  const pivotCol = escapeId(columnField)
  const rowCols = rowFields.map(escapeId)
  const whereClause = buildWhereClause(filters)

  // Build USING clause
  const usingClauses = valueFields
    .map((vf) => {
      const func = vf.aggregation.toUpperCase()
      const col = escapeId(vf.column)
      return `${func}(${col}) AS ${escapeId(vf.alias)}`
    })
    .join(', ')

  const values = pivotValues.map(escapeStr).join(', ')

  // Build filtered source if needed
  const baseSource = escapeId(sourceTableName)
  const filteredSource = whereClause ? `(SELECT * FROM ${baseSource} ${whereClause})` : baseSource

  // Handle no row columns case
  const pivotSource = rowCols.length > 0 ? filteredSource : `(SELECT *, 1 as "_dummy" FROM ${filteredSource})`
  const groupByClause = rowCols.length > 0 ? ` GROUP BY ${rowCols.join(', ')}` : ' GROUP BY "_dummy"'

  const basePivot = `PIVOT ${pivotSource} ON ${pivotCol} IN (${values}) USING ${usingClauses}${groupByClause}`

  // Generate pivot column names
  const pivotResultCols: string[] = []
  for (const val of pivotValues) {
    for (const vf of valueFields) {
      pivotResultCols.push(`${val}_${vf.alias}`)
    }
  }

  // Build CTEs
  const ctes: string[] = [`pivoted AS (${basePivot})`]

  if (showSubtotals && rowCols.length > 1) {
    for (let level = 0; level < rowCols.length - 1; level++) {
      const groupCols = rowCols.slice(0, level + 1)
      const nullCols = rowCols.slice(level + 1)

      const selectCols = [
        ...groupCols,
        ...nullCols.map((c) => `NULL AS ${c}`),
        ...pivotResultCols.map((c) => `SUM(${escapeId(c)}) AS ${escapeId(c)}`),
      ].join(', ')

      ctes.push(`subtotal_level_${level} AS (
    SELECT ${selectCols}
    FROM pivoted
    GROUP BY ${groupCols.join(', ')}
  )`)
    }
  }

  if (showGrandTotal) {
    const nullRowCols = rowCols.map((c) => `NULL AS ${c}`).join(', ')
    const sumCols = pivotResultCols.map((c) => `SUM(${escapeId(c)}) AS ${escapeId(c)}`).join(', ')
    const selectPart = rowCols.length > 0 ? `${nullRowCols}, ${sumCols}` : sumCols

    ctes.push(`grand_total AS (
    SELECT ${selectPart}
    FROM pivoted
  )`)
  }

  // Build UNION query
  const rowColsList = rowCols.join(', ')
  const pivotColsList = pivotResultCols.map(escapeId).join(', ')
  const allCols = rowCols.length > 0 ? `${rowColsList}, ${pivotColsList}` : pivotColsList
  const sortGroupExpr = rowCols.length > 0 ? rowCols[0] : 'NULL'

  const unions: string[] = [`SELECT ${allCols}, 0 AS _row_type, ${sortGroupExpr} AS _sort_group FROM pivoted`]

  if (showSubtotals && rowCols.length > 1) {
    for (let level = 0; level < rowCols.length - 1; level++) {
      unions.push(
        `SELECT ${allCols}, ${level + 1} AS _row_type, ${sortGroupExpr} AS _sort_group FROM subtotal_level_${level}`
      )
    }
  }

  if (showGrandTotal) {
    unions.push(`SELECT ${allCols}, ${rowCols.length + 1} AS _row_type, NULL AS _sort_group FROM grand_total`)
  }

  const orderByParts = ['_sort_group NULLS LAST', '_row_type']
  if (rowCols.length > 1) {
    orderByParts.push(...rowCols.slice(1).map((c) => `${c} NULLS LAST`))
  }

  return `WITH ${ctes.join(',\n')}\n${unions.join('\nUNION ALL\n')}\nORDER BY ${orderByParts.join(', ')}`
}

// Main export: Build preview SQL based on configuration
export function buildPivotPreviewSql(
  sourceTableName: string,
  rowFields: string[],
  columnField: string | null,
  valueFields: PivotValueField[],
  pivotValues: string[],
  filters: Filter[],
  showSubtotals: boolean,
  showGrandTotal: boolean
): string {
  if (columnField && pivotValues.length > 0) {
    // Pivot mode
    return buildPivotSql(
      sourceTableName,
      rowFields,
      columnField,
      valueFields,
      pivotValues,
      filters,
      showSubtotals,
      showGrandTotal
    )
  } else {
    // Group by mode (rows only)
    return buildGroupBySql(sourceTableName, rowFields, valueFields, filters, showSubtotals, showGrandTotal)
  }
}
