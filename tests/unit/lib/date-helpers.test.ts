import { describe, expect, it } from 'vitest'
import {
  bucketExpression,
  dateAddExpression,
  dateDiffExpression,
  extractExpression,
  isDateTimeType,
  parseExpression,
  suggestedColumnName,
  supportsBucketing,
  supportsTimeExtraction,
} from '@/lib/date-helpers'

describe('bucketExpression', () => {
  it('generates DATE_TRUNC for day bucket', () => {
    const result = bucketExpression('created_at', 'day')
    expect(result).toBe('DATE_TRUNC(\'day\', "created_at")')
  })

  it('generates DATE_TRUNC for week bucket', () => {
    const result = bucketExpression('created_at', 'week')
    expect(result).toBe('DATE_TRUNC(\'week\', "created_at")')
  })

  it('generates DATE_TRUNC for month bucket', () => {
    const result = bucketExpression('created_at', 'month')
    expect(result).toBe('DATE_TRUNC(\'month\', "created_at")')
  })

  it('generates DATE_TRUNC for quarter bucket', () => {
    const result = bucketExpression('created_at', 'quarter')
    expect(result).toBe('DATE_TRUNC(\'quarter\', "created_at")')
  })

  it('generates DATE_TRUNC for year bucket', () => {
    const result = bucketExpression('created_at', 'year')
    expect(result).toBe('DATE_TRUNC(\'year\', "created_at")')
  })

  it('escapes column name with special characters', () => {
    const result = bucketExpression('my column', 'day')
    expect(result).toBe('DATE_TRUNC(\'day\', "my column")')
  })

  it('escapes column name with quotes', () => {
    const result = bucketExpression('col"name', 'day')
    expect(result).toBe('DATE_TRUNC(\'day\', "col""name")')
  })
})

describe('extractExpression', () => {
  it('generates EXTRACT for year', () => {
    const result = extractExpression('created_at', 'year')
    expect(result).toBe('EXTRACT(year FROM "created_at")')
  })

  it('generates EXTRACT for quarter', () => {
    const result = extractExpression('created_at', 'quarter')
    expect(result).toBe('EXTRACT(quarter FROM "created_at")')
  })

  it('generates EXTRACT for month', () => {
    const result = extractExpression('created_at', 'month')
    expect(result).toBe('EXTRACT(month FROM "created_at")')
  })

  it('generates EXTRACT for day', () => {
    const result = extractExpression('created_at', 'day')
    expect(result).toBe('EXTRACT(day FROM "created_at")')
  })

  it('generates EXTRACT for dow (day of week)', () => {
    const result = extractExpression('created_at', 'dow')
    expect(result).toBe('EXTRACT(dow FROM "created_at")')
  })

  it('generates EXTRACT for hour', () => {
    const result = extractExpression('created_at', 'hour')
    expect(result).toBe('EXTRACT(hour FROM "created_at")')
  })

  it('generates EXTRACT for minute', () => {
    const result = extractExpression('created_at', 'minute')
    expect(result).toBe('EXTRACT(minute FROM "created_at")')
  })

  it('generates DAYNAME for dayname', () => {
    const result = extractExpression('created_at', 'dayname')
    expect(result).toBe('DAYNAME("created_at")')
  })

  it('generates MONTHNAME for monthname', () => {
    const result = extractExpression('created_at', 'monthname')
    expect(result).toBe('MONTHNAME("created_at")')
  })

  it('escapes column name', () => {
    const result = extractExpression('my column', 'year')
    expect(result).toBe('EXTRACT(year FROM "my column")')
  })
})

describe('parseExpression', () => {
  it('generates CAST for DATE without format', () => {
    const result = parseExpression('date_string', 'DATE')
    expect(result).toBe('CAST("date_string" AS DATE)')
  })

  it('generates CAST for TIMESTAMP without format', () => {
    const result = parseExpression('date_string', 'TIMESTAMP')
    expect(result).toBe('CAST("date_string" AS TIMESTAMP)')
  })

  it('generates STRPTIME with format for DATE', () => {
    const result = parseExpression('date_string', 'DATE', '%Y-%m-%d')
    expect(result).toBe('STRPTIME("date_string", \'%Y-%m-%d\')::DATE')
  })

  it('generates STRPTIME with format for TIMESTAMP (no cast)', () => {
    const result = parseExpression('date_string', 'TIMESTAMP', '%Y-%m-%d %H:%M:%S')
    expect(result).toBe('STRPTIME("date_string", \'%Y-%m-%d %H:%M:%S\')')
  })

  it('escapes column name', () => {
    const result = parseExpression('my date', 'DATE')
    expect(result).toBe('CAST("my date" AS DATE)')
  })
})

describe('dateDiffExpression', () => {
  it('generates DATEDIFF for day unit', () => {
    const result = dateDiffExpression('birth_date', 'day')
    expect(result).toBe('DATEDIFF(\'day\', "birth_date", CURRENT_DATE)')
  })

  it('generates DATEDIFF for month unit', () => {
    const result = dateDiffExpression('birth_date', 'month')
    expect(result).toBe('DATEDIFF(\'month\', "birth_date", CURRENT_DATE)')
  })

  it('generates DATEDIFF for year unit', () => {
    const result = dateDiffExpression('birth_date', 'year')
    expect(result).toBe('DATEDIFF(\'year\', "birth_date", CURRENT_DATE)')
  })

  it('escapes column name', () => {
    const result = dateDiffExpression('my date', 'day')
    expect(result).toBe('DATEDIFF(\'day\', "my date", CURRENT_DATE)')
  })
})

describe('dateAddExpression', () => {
  it('generates positive interval for day', () => {
    const result = dateAddExpression('created_at', 7, 'day')
    expect(result).toBe('"created_at" + INTERVAL \'7 days\'')
  })

  it('generates negative interval for day', () => {
    const result = dateAddExpression('created_at', -7, 'day')
    expect(result).toBe('"created_at" - INTERVAL \'7 days\'')
  })

  it('generates singular unit for amount 1', () => {
    const result = dateAddExpression('created_at', 1, 'day')
    expect(result).toBe('"created_at" + INTERVAL \'1 day\'')
  })

  it('generates singular unit for amount -1', () => {
    const result = dateAddExpression('created_at', -1, 'day')
    expect(result).toBe('"created_at" - INTERVAL \'1 day\'')
  })

  it('generates interval for week', () => {
    const result = dateAddExpression('created_at', 2, 'week')
    expect(result).toBe('"created_at" + INTERVAL \'2 weeks\'')
  })

  it('generates interval for month', () => {
    const result = dateAddExpression('created_at', 3, 'month')
    expect(result).toBe('"created_at" + INTERVAL \'3 months\'')
  })

  it('generates interval for year', () => {
    const result = dateAddExpression('created_at', 5, 'year')
    expect(result).toBe('"created_at" + INTERVAL \'5 years\'')
  })

  it('handles zero amount', () => {
    const result = dateAddExpression('created_at', 0, 'day')
    expect(result).toBe('"created_at" + INTERVAL \'0 days\'')
  })

  it('escapes column name', () => {
    const result = dateAddExpression('my date', 1, 'day')
    expect(result).toBe('"my date" + INTERVAL \'1 day\'')
  })
})

describe('suggestedColumnName', () => {
  it('generates clean column name from operation', () => {
    const result = suggestedColumnName('created_at', 'Year')
    expect(result).toBe('created_at_year')
  })

  it('handles special characters in operation', () => {
    const result = suggestedColumnName('date', 'Day of Week')
    expect(result).toBe('date_day_of_week')
  })

  it('converts operation to lowercase', () => {
    const result = suggestedColumnName('timestamp', 'MONTH')
    expect(result).toBe('timestamp_month')
  })

  it('handles numbers in operation', () => {
    const result = suggestedColumnName('date', 'Quarter 1-4')
    expect(result).toBe('date_quarter_1_4')
  })

  it('handles empty operation', () => {
    const result = suggestedColumnName('date', '')
    expect(result).toBe('date_')
  })

  it('preserves original column name', () => {
    const result = suggestedColumnName('My Date Column', 'year')
    expect(result).toBe('My Date Column_year')
  })
})

describe('isDateTimeType', () => {
  it('returns true for date', () => {
    expect(isDateTimeType('date')).toBe(true)
    expect(isDateTimeType('DATE')).toBe(true)
  })

  it('returns true for time', () => {
    expect(isDateTimeType('time')).toBe(true)
    expect(isDateTimeType('TIME')).toBe(true)
  })

  it('returns true for timestamp', () => {
    expect(isDateTimeType('timestamp')).toBe(true)
    expect(isDateTimeType('TIMESTAMP')).toBe(true)
  })

  it('returns true for interval', () => {
    expect(isDateTimeType('interval')).toBe(true)
    expect(isDateTimeType('INTERVAL')).toBe(true)
  })

  it('returns false for non-datetime types', () => {
    expect(isDateTimeType('string')).toBe(false)
    expect(isDateTimeType('number')).toBe(false)
    expect(isDateTimeType('boolean')).toBe(false)
    expect(isDateTimeType('varchar')).toBe(false)
  })
})

describe('supportsBucketing', () => {
  it('returns true for date', () => {
    expect(supportsBucketing('date')).toBe(true)
    expect(supportsBucketing('DATE')).toBe(true)
  })

  it('returns true for timestamp', () => {
    expect(supportsBucketing('timestamp')).toBe(true)
    expect(supportsBucketing('TIMESTAMP')).toBe(true)
  })

  it('returns false for time', () => {
    expect(supportsBucketing('time')).toBe(false)
    expect(supportsBucketing('TIME')).toBe(false)
  })

  it('returns false for interval', () => {
    expect(supportsBucketing('interval')).toBe(false)
  })

  it('returns false for non-date types', () => {
    expect(supportsBucketing('string')).toBe(false)
    expect(supportsBucketing('number')).toBe(false)
  })
})

describe('supportsTimeExtraction', () => {
  it('returns true for time', () => {
    expect(supportsTimeExtraction('time')).toBe(true)
    expect(supportsTimeExtraction('TIME')).toBe(true)
  })

  it('returns true for timestamp', () => {
    expect(supportsTimeExtraction('timestamp')).toBe(true)
    expect(supportsTimeExtraction('TIMESTAMP')).toBe(true)
  })

  it('returns false for date', () => {
    expect(supportsTimeExtraction('date')).toBe(false)
    expect(supportsTimeExtraction('DATE')).toBe(false)
  })

  it('returns false for interval', () => {
    expect(supportsTimeExtraction('interval')).toBe(false)
  })

  it('returns false for non-date types', () => {
    expect(supportsTimeExtraction('string')).toBe(false)
    expect(supportsTimeExtraction('number')).toBe(false)
  })
})
