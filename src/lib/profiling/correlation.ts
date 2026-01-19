import type { DuckDBClient } from '@/lib/duckdb/interface'
import type { Column } from '@/types'

export interface CorrelationPair {
  col1: string
  col2: string
  value: number
}

export interface CorrelationMatrix {
  columns: string[]
  correlations: CorrelationPair[]
}

export async function computeCorrelationMatrix(
  client: DuckDBClient,
  tableName: string,
  columns: Column[]
): Promise<CorrelationMatrix> {
  const numericColumns = columns.filter((c) => c.type === 'number')

  if (numericColumns.length < 2) {
    return { columns: numericColumns.map((c) => c.name), correlations: [] }
  }

  // Build all unique pairs (upper triangle including diagonal)
  const pairs: Array<{ col1: string; col2: string; alias: string }> = []
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i; j < numericColumns.length; j++) {
      pairs.push({
        col1: numericColumns[i].name,
        col2: numericColumns[j].name,
        alias: `corr_${i}_${j}`,
      })
    }
  }

  // Build single SQL query with all CORR() calls
  const selectClauses = pairs.map((p) => `CORR("${p.col1}", "${p.col2}") as ${p.alias}`)
  const sql = `SELECT ${selectClauses.join(', ')} FROM "${tableName}"`

  const result = await client.query<Record<string, number>>(sql)
  const row = result.rows[0] ?? {}

  // Convert to full correlation matrix (symmetric)
  const correlations: CorrelationPair[] = []
  for (const p of pairs) {
    const value = row[p.alias] ?? Number.NaN
    correlations.push({ col1: p.col1, col2: p.col2, value })
    // Add symmetric entry (skip diagonal)
    if (p.col1 !== p.col2) {
      correlations.push({ col1: p.col2, col2: p.col1, value })
    }
  }

  return {
    columns: numericColumns.map((c) => c.name),
    correlations,
  }
}
