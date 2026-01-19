import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'

export type DateBucket = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type DatePart = 'year' | 'quarter' | 'month' | 'day' | 'dow' | 'hour' | 'minute' | 'dayname' | 'monthname'
export type DateDiffUnit = 'day' | 'month' | 'year'
export type DateAddUnit = 'day' | 'week' | 'month' | 'year'

export function bucketExpression(column: string, bucket: DateBucket): string {
  const col = escapeIdentifier(column)
  return `DATE_TRUNC('${bucket}', ${col})`
}

export function extractExpression(column: string, part: DatePart): string {
  const col = escapeIdentifier(column)
  switch (part) {
    case 'dayname':
      return `DAYNAME(${col})`
    case 'monthname':
      return `MONTHNAME(${col})`
    default:
      return `EXTRACT(${part} FROM ${col})`
  }
}

export function parseExpression(column: string, toType: 'DATE' | 'TIMESTAMP', format?: string): string {
  const col = escapeIdentifier(column)
  if (format) {
    // Use STRPTIME for custom format parsing
    return `STRPTIME(${col}, '${format}')${toType === 'DATE' ? '::DATE' : ''}`
  }
  return `CAST(${col} AS ${toType})`
}

export function dateDiffExpression(column: string, unit: DateDiffUnit): string {
  const col = escapeIdentifier(column)
  return `DATEDIFF('${unit}', ${col}, CURRENT_DATE)`
}

export function dateAddExpression(column: string, amount: number, unit: DateAddUnit): string {
  const col = escapeIdentifier(column)
  const sign = amount >= 0 ? '+' : '-'
  const absAmount = Math.abs(amount)
  return `${col} ${sign} INTERVAL '${absAmount} ${unit}${absAmount !== 1 ? 's' : ''}'`
}

export function suggestedColumnName(originalColumn: string, operation: string): string {
  // Clean the operation string for use in column name
  const cleanOp = operation.toLowerCase().replace(/[^a-z0-9]/g, '_')
  return `${originalColumn}_${cleanOp}`
}

export const DATE_BUCKET_LABELS: Record<DateBucket, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
}

export const DATE_PART_LABELS: Record<DatePart, string> = {
  year: 'Year',
  quarter: 'Quarter (1-4)',
  month: 'Month (1-12)',
  day: 'Day (1-31)',
  dow: 'Day of week (0-6)',
  hour: 'Hour (0-23)',
  minute: 'Minute (0-59)',
  dayname: 'Day name',
  monthname: 'Month name',
}

export const DATE_DIFF_LABELS: Record<DateDiffUnit, string> = {
  day: 'Days since',
  month: 'Months since',
  year: 'Years since (age)',
}

export function isDateTimeType(type: string): boolean {
  const dateTypes = ['date', 'time', 'timestamp', 'interval']
  return dateTypes.includes(type.toLowerCase())
}

export function supportsBucketing(type: string): boolean {
  const bucketTypes = ['date', 'timestamp']
  return bucketTypes.includes(type.toLowerCase())
}

export function supportsTimeExtraction(type: string): boolean {
  const timeTypes = ['time', 'timestamp']
  return timeTypes.includes(type.toLowerCase())
}
