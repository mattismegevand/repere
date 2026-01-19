import type { Column } from '@/types'
import type { ChartType, ColumnStats } from './types'

/**
 * Determines the best chart type for a column based on its data characteristics.
 *
 * Heuristics:
 * - Number: box-plot (default), histogram (fallback), horizontal-bar (low cardinality)
 * - Date: line (long span), histogram (short span), horizontal-bar (few dates)
 * - Boolean: pie (always)
 * - String: pie (low cardinality), horizontal-bar (moderate), none (high cardinality)
 */
export function determineChartType(
  columnType: Column['type'],
  stats: Pick<
    ColumnStats,
    'count' | 'uniqueCount' | 'uniqueRatio' | 'p25' | 'p75' | 'median' | 'dateSpanDays' | 'histogram'
  >
): ChartType {
  const { count, uniqueCount, uniqueRatio, dateSpanDays, histogram } = stats

  // Need minimum data
  if (count < 2) return 'none'
  if (!histogram || histogram.length === 0) return 'none'

  // Number columns
  if (columnType === 'number') {
    // Very low cardinality (binary or categorical numbers like ratings 1-5)
    if (uniqueCount <= 2) return 'horizontal-bar'
    if (uniqueCount <= 10 && uniqueRatio < 0.3) return 'horizontal-bar'

    // Default: box plot if we have quartile data
    if (stats.p25 != null && stats.p75 != null && stats.median != null) {
      return 'box-plot'
    }

    // Fallback to histogram
    return 'histogram'
  }

  // Date/timestamp columns - always use time-series (never horizontal-bar)
  if (columnType === 'date' || columnType === 'timestamp') {
    // Long time span: show trend line
    if (dateSpanDays != null && dateSpanDays > 30) return 'line'

    // Short span or low cardinality: histogram (time-series bar chart)
    return 'histogram'
  }

  // Boolean columns: always pie
  if (columnType === 'boolean') {
    return 'pie'
  }

  // String columns
  if (columnType === 'string') {
    // Very low cardinality: pie chart
    if (uniqueCount <= 7 && uniqueRatio < 0.3) return 'pie'

    // Moderate cardinality: horizontal bar
    if (uniqueCount <= 20 && uniqueRatio < 0.5) return 'horizontal-bar'

    // High cardinality: still show horizontal bar for top values (unless too unique)
    if (uniqueRatio > 0.8) return 'none'

    return 'horizontal-bar'
  }

  return 'none'
}

/**
 * Calculate the unique ratio (proportion of unique values)
 */
export function calculateUniqueRatio(count: number, nullCount: number, uniqueCount: number): number {
  const nonNullCount = count - nullCount
  if (nonNullCount <= 0) return 1
  return uniqueCount / nonNullCount
}
