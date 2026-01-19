import { describe, expect, it } from 'vitest'
import {
  addFilterToExpression,
  countConditions,
  createExpression,
  flattenExpression,
  getRootCombineMode,
  isComplexExpression,
  removeFilterFromExpression,
  simplifyExpression,
  updateFilterInExpression,
} from '@/lib/filter-utils'
import type { Filter, FilterCondition, FilterExpression, FilterGroup } from '@/types'

// Helper to create a filter
function createFilter(column: string, value: unknown = 'test'): Filter {
  return { column, operator: 'eq', value }
}

// Helper to create a condition
function createCondition(column: string, value: unknown = 'test'): FilterCondition {
  return { type: 'condition', filter: createFilter(column, value) }
}

// Helper to create a group
function createGroup(children: FilterExpression[], combineMode: 'and' | 'or' = 'and'): FilterGroup {
  return { type: 'group', combineMode, children }
}

describe('flattenExpression', () => {
  it('returns single filter from condition', () => {
    const condition = createCondition('name')
    const result = flattenExpression(condition)

    expect(result).toHaveLength(1)
    expect(result[0].column).toBe('name')
  })

  it('returns all filters from flat group', () => {
    const group = createGroup([createCondition('name'), createCondition('age')])
    const result = flattenExpression(group)

    expect(result).toHaveLength(2)
    expect(result[0].column).toBe('name')
    expect(result[1].column).toBe('age')
  })

  it('flattens nested groups recursively', () => {
    const nested = createGroup([
      createCondition('name'),
      createGroup([createCondition('age'), createCondition('city')], 'or'),
    ])
    const result = flattenExpression(nested)

    expect(result).toHaveLength(3)
    expect(result.map((f) => f.column)).toEqual(['name', 'age', 'city'])
  })

  it('returns empty array for empty group', () => {
    const emptyGroup = createGroup([])
    const result = flattenExpression(emptyGroup)

    expect(result).toHaveLength(0)
  })

  it('handles deeply nested structures', () => {
    const deep = createGroup([createGroup([createGroup([createCondition('a')], 'or')]), createCondition('b')])
    const result = flattenExpression(deep)

    expect(result).toHaveLength(2)
    expect(result.map((f) => f.column)).toEqual(['a', 'b'])
  })
})

describe('createExpression', () => {
  it('creates AND group by default', () => {
    const filters = [createFilter('name'), createFilter('age')]
    const result = createExpression(filters)

    expect(result.type).toBe('group')
    expect(result.combineMode).toBe('and')
    expect(result.children).toHaveLength(2)
  })

  it('creates OR group when specified', () => {
    const filters = [createFilter('name'), createFilter('age')]
    const result = createExpression(filters, 'or')

    expect(result.combineMode).toBe('or')
  })

  it('handles single filter', () => {
    const filters = [createFilter('name')]
    const result = createExpression(filters)

    expect(result.children).toHaveLength(1)
    expect((result.children[0] as FilterCondition).filter.column).toBe('name')
  })

  it('handles empty filter array', () => {
    const result = createExpression([])

    expect(result.type).toBe('group')
    expect(result.children).toHaveLength(0)
  })

  it('wraps each filter in a condition', () => {
    const filters = [createFilter('name')]
    const result = createExpression(filters)
    const child = result.children[0]

    expect(child.type).toBe('condition')
    expect((child as FilterCondition).filter).toEqual(filters[0])
  })
})

describe('addFilterToExpression', () => {
  it('wraps condition in AND group when adding', () => {
    const condition = createCondition('name')
    const newFilter = createFilter('age')
    const result = addFilterToExpression(condition, newFilter)

    expect(result.type).toBe('group')
    expect((result as FilterGroup).combineMode).toBe('and')
    expect((result as FilterGroup).children).toHaveLength(2)
  })

  it('appends to existing group', () => {
    const group = createGroup([createCondition('name')])
    const newFilter = createFilter('age')
    const result = addFilterToExpression(group, newFilter)

    expect(result.type).toBe('group')
    expect((result as FilterGroup).children).toHaveLength(2)
  })

  it('preserves existing combineMode', () => {
    const orGroup = createGroup([createCondition('name')], 'or')
    const newFilter = createFilter('age')
    const result = addFilterToExpression(orGroup, newFilter)

    expect((result as FilterGroup).combineMode).toBe('or')
  })

  it('adds new condition as last child', () => {
    const group = createGroup([createCondition('name'), createCondition('age')])
    const newFilter = createFilter('city')
    const result = addFilterToExpression(group, newFilter) as FilterGroup
    const lastChild = result.children[result.children.length - 1] as FilterCondition

    expect(lastChild.filter.column).toBe('city')
  })
})

describe('updateFilterInExpression', () => {
  it('replaces existing filter for same column', () => {
    const condition = createCondition('name', 'old')
    const newFilter = createFilter('name', 'new')
    const result = updateFilterInExpression(condition, 'name', newFilter)

    expect(result.type).toBe('condition')
    expect((result as FilterCondition).filter.value).toBe('new')
  })

  it('wraps in AND group when updating different column on condition', () => {
    const condition = createCondition('name')
    const newFilter = createFilter('age')
    const result = updateFilterInExpression(condition, 'age', newFilter)

    expect(result.type).toBe('group')
    expect((result as FilterGroup).combineMode).toBe('and')
    expect((result as FilterGroup).children).toHaveLength(2)
  })

  it('updates column in flat group', () => {
    const group = createGroup([createCondition('name', 'old'), createCondition('age')])
    const newFilter = createFilter('name', 'new')
    const result = updateFilterInExpression(group, 'name', newFilter) as FilterGroup
    const firstChild = result.children[0] as FilterCondition

    expect(firstChild.filter.value).toBe('new')
  })

  it('adds new filter when column not found in group', () => {
    const group = createGroup([createCondition('name')])
    const newFilter = createFilter('age')
    const result = updateFilterInExpression(group, 'age', newFilter) as FilterGroup

    expect(result.children).toHaveLength(2)
  })

  it('updates deeply nested column', () => {
    const nested = createGroup([createCondition('name'), createGroup([createCondition('age', 'old')], 'or')])
    const newFilter = createFilter('age', 'new')
    const result = updateFilterInExpression(nested, 'age', newFilter) as FilterGroup
    const innerGroup = result.children[1] as FilterGroup
    const ageCondition = innerGroup.children[0] as FilterCondition

    expect(ageCondition.filter.value).toBe('new')
  })

  it('preserves group structure when updating nested', () => {
    const nested = createGroup([createGroup([createCondition('name', 'old')], 'or')], 'and')
    const newFilter = createFilter('name', 'new')
    const result = updateFilterInExpression(nested, 'name', newFilter) as FilterGroup

    expect(result.combineMode).toBe('and')
    expect((result.children[0] as FilterGroup).combineMode).toBe('or')
  })
})

describe('removeFilterFromExpression', () => {
  it('returns null when removing only condition', () => {
    const condition = createCondition('name')
    const result = removeFilterFromExpression(condition, 'name')

    expect(result).toBeNull()
  })

  it('returns unchanged when column not found in condition', () => {
    const condition = createCondition('name')
    const result = removeFilterFromExpression(condition, 'age')

    expect(result).toEqual(condition)
  })

  it('returns null when group becomes empty', () => {
    const group = createGroup([createCondition('name')])
    const result = removeFilterFromExpression(group, 'name')

    expect(result).toBeNull()
  })

  it('unwraps single remaining condition', () => {
    const group = createGroup([createCondition('name'), createCondition('age')])
    const result = removeFilterFromExpression(group, 'name')

    expect(result?.type).toBe('condition')
    expect((result as FilterCondition).filter.column).toBe('age')
  })

  it('keeps group with multiple remaining children', () => {
    const group = createGroup([createCondition('name'), createCondition('age'), createCondition('city')])
    const result = removeFilterFromExpression(group, 'name') as FilterGroup

    expect(result.type).toBe('group')
    expect(result.children).toHaveLength(2)
  })

  it('removes from nested groups', () => {
    const nested = createGroup([
      createCondition('name'),
      createGroup([createCondition('age'), createCondition('city')], 'or'),
    ])
    const result = removeFilterFromExpression(nested, 'age') as FilterGroup
    const innerGroup = result.children[1] as FilterCondition

    // Inner group had 2 children, removing 1 leaves 1, which gets unwrapped
    expect(innerGroup.type).toBe('condition')
    expect(innerGroup.filter.column).toBe('city')
  })

  it('collapses nested group that becomes single condition', () => {
    const nested = createGroup([createGroup([createCondition('name')], 'or'), createCondition('age')])
    const result = removeFilterFromExpression(nested, 'name') as FilterCondition

    // The inner OR group becomes empty after removal and is filtered out
    // Leaving only 'age' condition which gets unwrapped
    expect(result.type).toBe('condition')
    expect(result.filter.column).toBe('age')
  })

  it('preserves combineMode when removing', () => {
    const orGroup = createGroup([createCondition('name'), createCondition('age'), createCondition('city')], 'or')
    const result = removeFilterFromExpression(orGroup, 'name') as FilterGroup

    expect(result.combineMode).toBe('or')
  })
})

describe('getRootCombineMode', () => {
  it('returns and for condition', () => {
    const condition = createCondition('name')
    const result = getRootCombineMode(condition)

    expect(result).toBe('and')
  })

  it('returns combineMode for AND group', () => {
    const group = createGroup([createCondition('name')], 'and')
    const result = getRootCombineMode(group)

    expect(result).toBe('and')
  })

  it('returns combineMode for OR group', () => {
    const group = createGroup([createCondition('name')], 'or')
    const result = getRootCombineMode(group)

    expect(result).toBe('or')
  })
})

describe('isComplexExpression', () => {
  it('returns false for condition', () => {
    const condition = createCondition('name')
    const result = isComplexExpression(condition)

    expect(result).toBe(false)
  })

  it('returns false for flat group (no nested groups)', () => {
    const group = createGroup([createCondition('name'), createCondition('age')])
    const result = isComplexExpression(group)

    expect(result).toBe(false)
  })

  it('returns true when group has nested groups', () => {
    const nested = createGroup([createCondition('name'), createGroup([createCondition('age')], 'or')])
    const result = isComplexExpression(nested)

    expect(result).toBe(true)
  })

  it('returns false for empty group', () => {
    const emptyGroup = createGroup([])
    const result = isComplexExpression(emptyGroup)

    expect(result).toBe(false)
  })

  it('returns true for deeply nested structure', () => {
    const deep = createGroup([createGroup([createGroup([createCondition('a')])])])
    const result = isComplexExpression(deep)

    expect(result).toBe(true)
  })
})

describe('simplifyExpression', () => {
  it('returns condition unchanged', () => {
    const condition = createCondition('name')
    const result = simplifyExpression(condition)

    expect(result).toEqual(condition)
  })

  it('flattens AND(AND(a, b), c) to AND(a, b, c)', () => {
    const nested = createGroup([createGroup([createCondition('a'), createCondition('b')], 'and'), createCondition('c')])
    const result = simplifyExpression(nested) as FilterGroup

    expect(result.children).toHaveLength(3)
    expect(result.combineMode).toBe('and')
  })

  it('flattens OR(OR(x), OR(y, z)) to OR(x, y, z)', () => {
    const nested = createGroup(
      [createGroup([createCondition('x')], 'or'), createGroup([createCondition('y'), createCondition('z')], 'or')],
      'or'
    )
    const result = simplifyExpression(nested) as FilterGroup

    expect(result.children).toHaveLength(3)
    expect(result.combineMode).toBe('or')
  })

  it('preserves AND(OR(a, b), c) (different modes)', () => {
    const nested = createGroup([createGroup([createCondition('a'), createCondition('b')], 'or'), createCondition('c')])
    const result = simplifyExpression(nested) as FilterGroup

    expect(result.children).toHaveLength(2)
    expect(result.children[0].type).toBe('group')
    expect((result.children[0] as FilterGroup).combineMode).toBe('or')
  })

  it('handles deeply nested same-mode groups', () => {
    const deep = createGroup([
      createGroup([createGroup([createCondition('a'), createCondition('b')])]),
      createCondition('c'),
    ])
    const result = simplifyExpression(deep) as FilterGroup

    // All AND groups should be flattened
    expect(result.children).toHaveLength(3)
  })

  it('preserves empty group', () => {
    const emptyGroup = createGroup([])
    const result = simplifyExpression(emptyGroup) as FilterGroup

    expect(result.children).toHaveLength(0)
  })

  it('simplifies recursively preserving different modes', () => {
    // AND(AND(a), OR(OR(b), c))
    const complex = createGroup([
      createGroup([createCondition('a')]),
      createGroup([createGroup([createCondition('b')], 'or'), createCondition('c')], 'or'),
    ])
    const result = simplifyExpression(complex) as FilterGroup

    // Outer AND should flatten inner AND(a) to just a
    // Inner OR should flatten OR(b) to just b
    expect(result.children).toHaveLength(2)
    expect(result.children[0].type).toBe('condition') // a was unwrapped from AND
    expect((result.children[1] as FilterGroup).children).toHaveLength(2) // b and c
  })
})

describe('countConditions', () => {
  it('returns 1 for single condition', () => {
    const condition = createCondition('name')
    const result = countConditions(condition)

    expect(result).toBe(1)
  })

  it('counts all conditions in flat group', () => {
    const group = createGroup([createCondition('name'), createCondition('age'), createCondition('city')])
    const result = countConditions(group)

    expect(result).toBe(3)
  })

  it('counts conditions in nested groups', () => {
    const nested = createGroup([
      createCondition('name'),
      createGroup([createCondition('age'), createCondition('city')], 'or'),
    ])
    const result = countConditions(nested)

    expect(result).toBe(3)
  })

  it('returns 0 for empty group', () => {
    const emptyGroup = createGroup([])
    const result = countConditions(emptyGroup)

    expect(result).toBe(0)
  })

  it('handles deeply nested structures', () => {
    const deep = createGroup([
      createGroup([createGroup([createCondition('a'), createCondition('b')])]),
      createCondition('c'),
    ])
    const result = countConditions(deep)

    expect(result).toBe(3)
  })
})
