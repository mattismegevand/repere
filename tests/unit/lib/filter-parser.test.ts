import { describe, expect, it } from 'vitest'
import { formatFilterExpression, parseFilterText, validateFilterText } from '@/lib/filter-parser'
import type { FilterCondition, FilterGroup } from '@/types'

describe('parseFilterText', () => {
  describe('empty and whitespace input', () => {
    it('returns success with undefined expression for empty string', () => {
      const result = parseFilterText('')
      expect(result.success).toBe(true)
      expect(result.expression).toBeUndefined()
      expect(result.errors).toHaveLength(0)
    })

    it('returns success with undefined expression for whitespace only', () => {
      const result = parseFilterText('   \n\t  ')
      expect(result.success).toBe(true)
      expect(result.expression).toBeUndefined()
    })
  })

  describe('simple equality conditions', () => {
    it('parses status = "active"', () => {
      const result = parseFilterText('status = "active"')
      expect(result.success).toBe(true)
      expect(result.expression?.type).toBe('condition')
      const cond = result.expression as FilterCondition
      expect(cond.filter.column).toBe('status')
      expect(cond.filter.operator).toBe('eq')
      expect(cond.filter.value).toBe('active')
    })

    it('parses with single-quoted strings', () => {
      const result = parseFilterText("status = 'active'")
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe('active')
    })

    it('parses with == operator', () => {
      const result = parseFilterText('status == "active"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('eq')
    })

    it('parses numeric values', () => {
      const result = parseFilterText('count = 42')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe(42)
    })

    it('parses decimal values', () => {
      const result = parseFilterText('price = 19.99')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe(19.99)
    })

    it('parses negative numbers', () => {
      const result = parseFilterText('temperature = -5')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe(-5)
    })

    it('parses boolean TRUE', () => {
      const result = parseFilterText('active = TRUE')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe(true)
    })

    it('parses boolean FALSE', () => {
      const result = parseFilterText('active = FALSE')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe(false)
    })

    it('parses NULL value', () => {
      const result = parseFilterText('value = NULL')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBeNull()
    })

    it('parses unquoted identifier as string value', () => {
      const result = parseFilterText('status = active')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe('active')
    })
  })

  describe('comparison operators', () => {
    it('parses != (not equal)', () => {
      const result = parseFilterText('status != "inactive"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('neq')
    })

    it('parses <> (not equal SQL style)', () => {
      const result = parseFilterText('status <> "inactive"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('neq')
    })

    it('parses > (greater than)', () => {
      const result = parseFilterText('age > 18')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('gt')
    })

    it('parses < (less than)', () => {
      const result = parseFilterText('price < 100')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('lt')
    })

    it('parses >= (greater or equal)', () => {
      const result = parseFilterText('count >= 5')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('gte')
    })

    it('parses <= (less or equal)', () => {
      const result = parseFilterText('rating <= 10')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('lte')
    })
  })

  describe('string operators', () => {
    it('parses CONTAINS', () => {
      const result = parseFilterText('name CONTAINS "john"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('contains')
      expect(cond.filter.value).toBe('john')
    })

    it('parses NOT CONTAINS', () => {
      const result = parseFilterText('name NOT CONTAINS "test"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('notContains')
    })

    it('parses STARTS', () => {
      const result = parseFilterText('name STARTS "Mr"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('startsWith')
    })

    it('parses ENDS', () => {
      const result = parseFilterText('email ENDS ".com"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('endsWith')
    })
  })

  describe('NULL checks', () => {
    it('parses IS NULL', () => {
      const result = parseFilterText('deleted_at IS NULL')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('isNull')
      expect(cond.filter.value).toBeNull()
    })

    it('parses IS NOT NULL', () => {
      const result = parseFilterText('email IS NOT NULL')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('isNotNull')
    })
  })

  describe('IN operator', () => {
    it('parses IN with array of strings', () => {
      const result = parseFilterText('category IN ["A", "B", "C"]')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('in')
      expect(cond.filter.value).toEqual(['A', 'B', 'C'])
    })

    it('parses IN with array of numbers', () => {
      const result = parseFilterText('priority IN [1, 2, 3]')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toEqual([1, 2, 3])
    })

    it('parses NOT IN', () => {
      const result = parseFilterText('status NOT IN ["deleted", "archived"]')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('notIn')
    })

    it('parses IN with empty array', () => {
      const result = parseFilterText('status IN []')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toEqual([])
    })

    it('parses IN with mixed types', () => {
      const result = parseFilterText('value IN [1, "two", TRUE, NULL]')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toEqual([1, 'two', true, null])
    })
  })

  describe('BETWEEN operator', () => {
    it('parses BETWEEN with numbers', () => {
      const result = parseFilterText('price BETWEEN 10 AND 100')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.operator).toBe('between')
      expect(cond.filter.value).toEqual([10, 100])
    })

    it('parses BETWEEN with strings', () => {
      const result = parseFilterText('date BETWEEN "2024-01-01" AND "2024-12-31"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toEqual(['2024-01-01', '2024-12-31'])
    })
  })

  describe('AND expressions', () => {
    it('parses two conditions with AND', () => {
      const result = parseFilterText('status = "active" AND priority > 3')
      expect(result.success).toBe(true)
      expect(result.expression?.type).toBe('group')
      const group = result.expression as FilterGroup
      expect(group.combineMode).toBe('and')
      expect(group.children).toHaveLength(2)
    })

    it('parses multiple conditions with AND', () => {
      const result = parseFilterText('a = 1 AND b = 2 AND c = 3')
      expect(result.success).toBe(true)
      const group = result.expression as FilterGroup
      expect(group.combineMode).toBe('and')
      expect(group.children).toHaveLength(3)
    })
  })

  describe('OR expressions', () => {
    it('parses two conditions with OR', () => {
      const result = parseFilterText('status = "active" OR status = "pending"')
      expect(result.success).toBe(true)
      const group = result.expression as FilterGroup
      expect(group.combineMode).toBe('or')
      expect(group.children).toHaveLength(2)
    })

    it('parses multiple conditions with OR', () => {
      const result = parseFilterText('x = 1 OR y = 2 OR z = 3')
      expect(result.success).toBe(true)
      const group = result.expression as FilterGroup
      expect(group.combineMode).toBe('or')
      expect(group.children).toHaveLength(3)
    })
  })

  describe('mixed AND/OR with precedence', () => {
    it('AND has higher precedence than OR', () => {
      // a OR b AND c should parse as a OR (b AND c)
      const result = parseFilterText('a = 1 OR b = 2 AND c = 3')
      expect(result.success).toBe(true)
      const group = result.expression as FilterGroup
      expect(group.combineMode).toBe('or')
      expect(group.children).toHaveLength(2)
      expect(group.children[0].type).toBe('condition')
      expect(group.children[1].type).toBe('group')
      expect((group.children[1] as FilterGroup).combineMode).toBe('and')
    })
  })

  describe('parentheses for grouping', () => {
    it('parses (a OR b) AND c', () => {
      const result = parseFilterText('(a = 1 OR b = 2) AND c = 3')
      expect(result.success).toBe(true)
      const group = result.expression as FilterGroup
      expect(group.combineMode).toBe('and')
      expect(group.children).toHaveLength(2)
      expect(group.children[0].type).toBe('group')
      expect((group.children[0] as FilterGroup).combineMode).toBe('or')
    })

    it('parses nested parentheses', () => {
      const result = parseFilterText('((a = 1))')
      expect(result.success).toBe(true)
      expect(result.expression?.type).toBe('condition')
    })

    it('parses complex nested expression', () => {
      const result = parseFilterText('(a = 1 AND b = 2) OR (c = 3 AND d = 4)')
      expect(result.success).toBe(true)
      const group = result.expression as FilterGroup
      expect(group.combineMode).toBe('or')
      expect(group.children).toHaveLength(2)
    })
  })

  describe('string escaping', () => {
    it('handles escaped quotes in strings', () => {
      const result = parseFilterText('name = "John \\"Doe\\""')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe('John "Doe"')
    })

    it('handles escaped backslash', () => {
      const result = parseFilterText('path = "C:\\\\Users"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe('C:\\Users')
    })

    it('handles escaped newline', () => {
      const result = parseFilterText('text = "line1\\nline2"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe('line1\nline2')
    })

    it('handles escaped tab', () => {
      const result = parseFilterText('text = "col1\\tcol2"')
      expect(result.success).toBe(true)
      const cond = result.expression as FilterCondition
      expect(cond.filter.value).toBe('col1\tcol2')
    })
  })

  describe('error handling', () => {
    it('returns error for unterminated string', () => {
      const result = parseFilterText('name = "unterminated')
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toContain('Unterminated string')
    })

    it('returns error for missing value', () => {
      const result = parseFilterText('name =')
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('returns error for missing operator', () => {
      const result = parseFilterText('name "value"')
      expect(result.success).toBe(false)
    })

    it('returns error for unexpected character', () => {
      const result = parseFilterText('name @ "value"')
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('Unexpected character')
    })

    it('returns error for unclosed parenthesis', () => {
      const result = parseFilterText('(a = 1')
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('parenthesis')
    })

    it('returns error for missing array bracket', () => {
      const result = parseFilterText('status IN ["a", "b"')
      expect(result.success).toBe(false)
    })

    it('returns error for unexpected token after expression', () => {
      const result = parseFilterText('a = 1 b = 2')
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('Unexpected token')
    })
  })

  describe('case insensitivity', () => {
    it('handles lowercase keywords', () => {
      const result = parseFilterText('status = "active" and priority > 3')
      expect(result.success).toBe(true)
    })

    it('handles mixed case keywords', () => {
      const result = parseFilterText('name Contains "john" Or name Contains "jane"')
      expect(result.success).toBe(true)
    })
  })
})

describe('validateFilterText', () => {
  it('returns empty array for valid expression', () => {
    const errors = validateFilterText('status = "active"')
    expect(errors).toHaveLength(0)
  })

  it('returns errors for invalid expression', () => {
    const errors = validateFilterText('status = "unterminated')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('returns errors with position information', () => {
    const errors = validateFilterText('name = "unterminated')
    expect(errors[0].position).toBeGreaterThanOrEqual(0)
    expect(errors[0].length).toBeGreaterThan(0)
  })
})

describe('formatFilterExpression', () => {
  it('formats simple condition', () => {
    const result = parseFilterText('status = "active"')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('status = "active"')
  })

  it('formats numeric value', () => {
    const result = parseFilterText('count = 42')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('count = 42')
  })

  it('formats boolean TRUE', () => {
    const result = parseFilterText('active = TRUE')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('active = TRUE')
  })

  it('formats boolean FALSE', () => {
    const result = parseFilterText('active = FALSE')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('active = FALSE')
  })

  it('formats NULL value', () => {
    const result = parseFilterText('value = NULL')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('value = NULL')
  })

  it('formats IS NULL', () => {
    const result = parseFilterText('deleted_at IS NULL')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('deleted_at IS NULL')
  })

  it('formats IS NOT NULL', () => {
    const result = parseFilterText('email IS NOT NULL')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('email IS NOT NULL')
  })

  it('formats BETWEEN', () => {
    const result = parseFilterText('price BETWEEN 10 AND 100')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('price BETWEEN 10 AND 100')
  })

  it('formats IN array', () => {
    const result = parseFilterText('status IN ["A", "B"]')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('status IN ["A", "B"]')
  })

  it('formats NOT IN array', () => {
    const result = parseFilterText('status NOT IN ["deleted"]')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('status NOT IN ["deleted"]')
  })

  it('formats AND expression', () => {
    const result = parseFilterText('a = 1 AND b = 2')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('a = 1 AND b = 2')
  })

  it('formats OR expression', () => {
    const result = parseFilterText('a = 1 OR b = 2')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('a = 1 OR b = 2')
  })

  it('formats mixed AND/OR with parentheses for clarity', () => {
    const result = parseFilterText('(a = 1 OR b = 2) AND c = 3')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toBe('(a = 1 OR b = 2) AND c = 3')
  })

  it('escapes quotes in string values', () => {
    const result = parseFilterText('name = "John \\"Doe\\""')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toContain('\\"')
  })

  it('escapes backslashes in string values', () => {
    const result = parseFilterText('path = "C:\\\\Users"')
    const formatted = formatFilterExpression(result.expression!)
    expect(formatted).toContain('\\\\')
  })

  it('formats comparison operators', () => {
    expect(formatFilterExpression(parseFilterText('a != 1').expression!)).toContain('!=')
    expect(formatFilterExpression(parseFilterText('a > 1').expression!)).toContain('>')
    expect(formatFilterExpression(parseFilterText('a < 1').expression!)).toContain('<')
    expect(formatFilterExpression(parseFilterText('a >= 1').expression!)).toContain('>=')
    expect(formatFilterExpression(parseFilterText('a <= 1').expression!)).toContain('<=')
  })

  it('formats string operators', () => {
    expect(formatFilterExpression(parseFilterText('a CONTAINS "x"').expression!)).toContain('CONTAINS')
    expect(formatFilterExpression(parseFilterText('a NOT CONTAINS "x"').expression!)).toContain('NOT CONTAINS')
    expect(formatFilterExpression(parseFilterText('a STARTS "x"').expression!)).toContain('STARTS')
    expect(formatFilterExpression(parseFilterText('a ENDS "x"').expression!)).toContain('ENDS')
  })
})

describe('roundtrip parsing and formatting', () => {
  const testCases = [
    'status = "active"',
    'count > 10',
    'price BETWEEN 10 AND 100',
    'category IN ["A", "B", "C"]',
    'deleted_at IS NULL',
    'a = 1 AND b = 2',
    'a = 1 OR b = 2',
    '(a = 1 OR b = 2) AND c = 3',
  ]

  for (const input of testCases) {
    it(`roundtrips: ${input}`, () => {
      const parsed = parseFilterText(input)
      expect(parsed.success).toBe(true)
      const formatted = formatFilterExpression(parsed.expression!)
      const reparsed = parseFilterText(formatted)
      expect(reparsed.success).toBe(true)
      // The formatted output should parse to an equivalent expression
      expect(reparsed.expression).toEqual(parsed.expression)
    })
  }
})
