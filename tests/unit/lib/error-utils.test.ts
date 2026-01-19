import { describe, expect, it } from 'vitest'
import { formatSqlError } from '@/lib/duckdb/error-utils'
import type { Column } from '@/types'

describe('formatSqlError', () => {
  describe('column not found errors', () => {
    it('formats column not found error', () => {
      const error = 'Referenced column "nonexistent" not found in FROM clause'
      const result = formatSqlError(error)
      expect(result).toBe('Column "nonexistent" not found')
    })

    it('suggests similar columns when available', () => {
      const columns: Column[] = [
        { name: 'user_name', type: 'VARCHAR' },
        { name: 'user_id', type: 'INTEGER' },
        { name: 'email', type: 'VARCHAR' },
      ]
      const error = 'Referenced column "user" not found in FROM clause'
      const result = formatSqlError(error, columns)
      expect(result).toContain('Did you mean:')
      expect(result).toContain('user_name')
      expect(result).toContain('user_id')
    })

    it('does not suggest when no similar columns', () => {
      const columns: Column[] = [
        { name: 'alpha', type: 'VARCHAR' },
        { name: 'beta', type: 'INTEGER' },
      ]
      const error = 'Referenced column "xyz" not found in FROM clause'
      const result = formatSqlError(error, columns)
      expect(result).toBe('Column "xyz" not found')
      expect(result).not.toContain('Did you mean')
    })

    it('limits suggestions to 3 columns', () => {
      const columns: Column[] = [
        { name: 'test_a', type: 'VARCHAR' },
        { name: 'test_b', type: 'VARCHAR' },
        { name: 'test_c', type: 'VARCHAR' },
        { name: 'test_d', type: 'VARCHAR' },
        { name: 'test_e', type: 'VARCHAR' },
      ]
      const error = 'Referenced column "test" not found'
      const result = formatSqlError(error, columns)
      // Should only suggest first 3 matches
      const matches = result.match(/test_/g) || []
      expect(matches.length).toBeLessThanOrEqual(3)
    })
  })

  describe('type mismatch errors', () => {
    it('formats string to integer conversion error', () => {
      const error = "Could not convert string 'abc' to INT64"
      const result = formatSqlError(error)
      expect(result).toBe('Invalid value "abc" for integer column')
    })

    it('formats empty string conversion error', () => {
      const error = "Could not convert string '' to BIGINT"
      const result = formatSqlError(error)
      expect(result).toBe('Empty value not allowed for integer column')
    })

    it('formats string to boolean conversion error', () => {
      const error = "Could not convert string 'maybe' to BOOLEAN"
      const result = formatSqlError(error)
      expect(result).toBe('Invalid value "maybe" for boolean column')
    })

    it('formats string to decimal conversion error', () => {
      const error = "Could not convert string 'not a number' to DOUBLE"
      const result = formatSqlError(error)
      expect(result).toBe('Invalid value "not a number" for decimal column')
    })
  })

  describe('date format errors', () => {
    it('formats invalid date error with format hint', () => {
      const error = 'invalid date field format: "13/01/2024", expected format is (YYYY-MM-DD)'
      const result = formatSqlError(error)
      expect(result).toBe('Invalid date "13/01/2024", expected format: YYYY-MM-DD')
    })

    it('formats empty date value error', () => {
      const error = 'invalid date field format: ""'
      const result = formatSqlError(error)
      expect(result).toBe('Empty value not allowed for date column')
    })

    it('uses default date format when not specified', () => {
      const error = 'invalid date field format: "bad-date"'
      const result = formatSqlError(error)
      expect(result).toContain('expected format: YYYY-MM-DD')
    })
  })

  describe('time/timestamp format errors', () => {
    it('formats invalid time error', () => {
      const error = 'invalid time field format: "25:00:00"'
      const result = formatSqlError(error)
      expect(result).toBe('Invalid time "25:00:00"')
    })

    it('formats empty time value error', () => {
      const error = 'invalid time field format: ""'
      const result = formatSqlError(error)
      expect(result).toBe('Empty value not allowed for time column')
    })

    it('formats invalid timestamp error', () => {
      const error = 'invalid timestamp field format: "not a timestamp"'
      const result = formatSqlError(error)
      expect(result).toBe('Invalid timestamp "not a timestamp"')
    })

    it('formats empty timestamp value error', () => {
      const error = 'invalid timestamp field format: ""'
      const result = formatSqlError(error)
      expect(result).toBe('Empty value not allowed for timestamp column')
    })
  })

  describe('syntax errors', () => {
    it('formats syntax error', () => {
      const error = 'Parser Error: syntax error at or near "SELEC"'
      const result = formatSqlError(error)
      expect(result).toBe('Invalid filter syntax')
    })

    it('formats parser error', () => {
      const error = 'Parser Error: Invalid SQL'
      const result = formatSqlError(error)
      expect(result).toBe('Invalid filter syntax')
    })
  })

  describe('conversion errors', () => {
    it('extracts message from conversion error', () => {
      const error = 'Conversion Error: Failed to cast value'
      const result = formatSqlError(error)
      expect(result).toBe('Failed to cast value')
    })

    it('cleans SQL context from conversion error', () => {
      const error = 'Conversion Error: Failed to cast LINE 1: SELECT...'
      const result = formatSqlError(error)
      expect(result).not.toContain('LINE 1')
    })
  })

  describe('binder errors', () => {
    it('extracts message from binder error', () => {
      const error = 'Binder Error: Table "unknown" does not exist'
      const result = formatSqlError(error)
      expect(result).toBe('Table "unknown" does not exist')
    })
  })

  describe('catalog errors', () => {
    it('extracts message from catalog error', () => {
      const error = 'Catalog Error: Table with name "missing" does not exist'
      const result = formatSqlError(error)
      expect(result).toBe('Table with name "missing" does not exist')
    })
  })

  describe('LINE context stripping', () => {
    it('removes LINE context from error', () => {
      const error = 'Some error message\nLINE 1: SELECT * FROM table\n                      ^'
      const result = formatSqlError(error)
      expect(result).not.toContain('LINE 1')
      expect(result).not.toContain('^')
    })

    it('handles error with only LINE context', () => {
      const error = 'LINE 1: invalid'
      const result = formatSqlError(error)
      expect(result).toBe('')
    })
  })

  describe('message truncation', () => {
    it('truncates very long error messages', () => {
      const longMessage = 'A'.repeat(200)
      const result = formatSqlError(longMessage)
      expect(result.length).toBeLessThanOrEqual(123) // 120 + "..."
      expect(result).toContain('...')
    })

    it('does not truncate short messages', () => {
      const shortMessage = 'Short error'
      const result = formatSqlError(shortMessage)
      expect(result).toBe('Short error')
      expect(result).not.toContain('...')
    })
  })

  describe('edge cases', () => {
    it('handles empty error message', () => {
      const result = formatSqlError('')
      expect(result).toBe('')
    })

    it('handles whitespace-only error', () => {
      const result = formatSqlError('   ')
      expect(result).toBe('')
    })

    it('handles error with only SQL fragments', () => {
      const error = '"table" WHERE x = 1'
      const result = formatSqlError(error)
      expect(result).toBe('')
    })

    it('preserves useful part of mixed error', () => {
      const error = 'Useful message\nLINE 1: garbage'
      const result = formatSqlError(error)
      expect(result).toBe('Useful message')
    })
  })

  describe('real-world error examples', () => {
    it('handles DuckDB column reference error', () => {
      const error = `Binder Error: Referenced column "amount" not found in FROM clause!
Candidate bindings: "orders.quantity"
LINE 1: SELECT amount FROM orders
               ^`
      const result = formatSqlError(error)
      expect(result).toContain('amount')
    })

    it('handles DuckDB aggregate without group by', () => {
      const error = 'Binder Error: column "name" must appear in the GROUP BY clause or be used in an aggregate function'
      const result = formatSqlError(error)
      expect(result).toContain('GROUP BY')
    })

    it('handles DuckDB division by zero', () => {
      const error = 'Out of Range Error: Overflow in division'
      const result = formatSqlError(error)
      expect(result).toContain('Overflow')
    })
  })
})
