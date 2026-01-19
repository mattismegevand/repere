import type { DuckDBClient } from '@/lib/duckdb/interface'
import type { Column } from '@/types'

export interface ColumnStats {
  column: string
  type: Column['type']
  count: number
  nullCount: number
  uniqueCount: number
  min?: number | string
  max?: number | string
  mean?: number
  stddev?: number
  histogram?: { bin: string; count: number }[]
  // Outlier detection (IQR method, numeric columns only)
  outlierCount?: number
  outlierLower?: number // Q1 - 1.5*IQR
  outlierUpper?: number // Q3 + 1.5*IQR
}

async function profileColumn(client: DuckDBClient, tableName: string, column: Column): Promise<ColumnStats> {
  const col = `"${column.name}"`

  const baseResult = await client.query<{
    count: number | bigint
    null_count: number | bigint
    unique_count: number | bigint
  }>(`
    SELECT
      COUNT(*) as count,
      COUNT(*) - COUNT(${col}) as null_count,
      COUNT(DISTINCT ${col}) as unique_count
    FROM "${tableName}"
  `)
  const base = baseResult.rows[0]

  const stats: ColumnStats = {
    column: column.name,
    type: column.type,
    count: Number(base.count),
    nullCount: Number(base.null_count),
    uniqueCount: Number(base.unique_count),
  }

  if (column.type === 'number') {
    const numResult = await client.query<{
      min_val: number | bigint | null
      max_val: number | bigint | null
      mean_val: number | bigint | null
      stddev_val: number | bigint | null
      q1: number | bigint | null
      q3: number | bigint | null
    }>(`
      SELECT
        MIN(${col}) as min_val,
        MAX(${col}) as max_val,
        AVG(${col}) as mean_val,
        STDDEV(${col}) as stddev_val,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${col}) as q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${col}) as q3
      FROM "${tableName}"
    `)
    const numRaw = numResult.rows[0]
    // Convert all BigInt values to Number for consistent arithmetic
    const num = {
      min_val: typeof numRaw.min_val === 'bigint' ? Number(numRaw.min_val) : numRaw.min_val,
      max_val: typeof numRaw.max_val === 'bigint' ? Number(numRaw.max_val) : numRaw.max_val,
      mean_val: typeof numRaw.mean_val === 'bigint' ? Number(numRaw.mean_val) : numRaw.mean_val,
      stddev_val: typeof numRaw.stddev_val === 'bigint' ? Number(numRaw.stddev_val) : numRaw.stddev_val,
      q1: typeof numRaw.q1 === 'bigint' ? Number(numRaw.q1) : numRaw.q1,
      q3: typeof numRaw.q3 === 'bigint' ? Number(numRaw.q3) : numRaw.q3,
    }
    stats.min = num.min_val ?? undefined
    stats.max = num.max_val ?? undefined
    stats.mean = num.mean_val ?? undefined
    stats.stddev = num.stddev_val ?? undefined

    // Calculate IQR outlier bounds
    if (num.q1 !== null && num.q3 !== null) {
      const iqr = num.q3 - num.q1
      stats.outlierLower = num.q1 - 1.5 * iqr
      stats.outlierUpper = num.q3 + 1.5 * iqr

      // Count outliers
      const outlierResult = await client.query<{ outlier_count: number | bigint }>(`
        SELECT COUNT(*) as outlier_count
        FROM "${tableName}"
        WHERE ${col} IS NOT NULL AND (${col} < ${stats.outlierLower} OR ${col} > ${stats.outlierUpper})
      `)
      stats.outlierCount = Number(outlierResult.rows[0].outlier_count)
    }

    if (num.min_val !== null && num.max_val !== null) {
      const histResult = await client.query<{ bin: number | bigint; count: number | bigint }>(`
        SELECT
          FLOOR((${col} - ${num.min_val}) / ((${num.max_val} - ${num.min_val} + 0.0001) / 10)) as bin,
          COUNT(*) as count
        FROM "${tableName}"
        WHERE ${col} IS NOT NULL
        GROUP BY bin
        ORDER BY bin
      `)
      stats.histogram = histResult.rows.map((r) => {
        const binNum = typeof r.bin === 'bigint' ? Number(r.bin) : r.bin
        const binStart = num.min_val! + (binNum * (num.max_val! - num.min_val!)) / 10
        const binEnd = num.min_val! + ((binNum + 1) * (num.max_val! - num.min_val!)) / 10
        return {
          bin: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
          count: Number(r.count),
        }
      })
    }
  } else if (column.type === 'string') {
    const topResult = await client.query<{ val: string; count: number | bigint }>(`
      SELECT ${col} as val, COUNT(*) as count
      FROM "${tableName}"
      WHERE ${col} IS NOT NULL
      GROUP BY ${col}
      ORDER BY count DESC
      LIMIT 10
    `)
    stats.histogram = topResult.rows.map((r) => ({
      bin: String(r.val).slice(0, 20),
      count: Number(r.count),
    }))
  }

  return stats
}

export async function profileDataset(
  client: DuckDBClient,
  tableName: string,
  columns: Column[]
): Promise<ColumnStats[]> {
  const results: ColumnStats[] = []
  for (const col of columns) {
    const stats = await profileColumn(client, tableName, col)
    results.push(stats)
  }
  return results
}
