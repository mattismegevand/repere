import type { Filter, FilterCondition, FilterExpression, FilterGroup } from '@/types'

/**
 * Extract flat list of filters from expression (for badges/chips)
 */
export function flattenExpression(expr: FilterExpression): Filter[] {
  if (expr.type === 'condition') {
    return [expr.filter]
  }
  return expr.children.flatMap(flattenExpression)
}

/**
 * Create a simple AND/OR-combined expression from a list of filters
 */
export function createExpression(filters: Filter[], combineMode: 'and' | 'or' = 'and'): FilterGroup {
  return {
    type: 'group',
    combineMode,
    children: filters.map((filter) => ({ type: 'condition', filter })),
  }
}

/**
 * Add a filter to an existing expression (appends to root group with AND)
 */
export function addFilterToExpression(expr: FilterExpression, filter: Filter): FilterExpression {
  const condition: FilterCondition = { type: 'condition', filter }

  if (expr.type === 'condition') {
    // Wrap existing condition + new condition in AND group
    return {
      type: 'group',
      combineMode: 'and',
      children: [expr, condition],
    }
  }

  // Add to existing group
  return {
    ...expr,
    children: [...expr.children, condition],
  }
}

/**
 * Check if expression contains a filter for a specific column (recursive)
 */
function hasColumnInExpression(expr: FilterExpression, columnName: string): boolean {
  if (expr.type === 'condition') {
    return expr.filter.column === columnName
  }
  return expr.children.some((child) => hasColumnInExpression(child, columnName))
}

/**
 * Recursively update a filter for a specific column
 */
function updateColumnRecursive(
  expr: FilterExpression,
  columnName: string,
  newCondition: FilterCondition
): FilterExpression {
  if (expr.type === 'condition') {
    if (expr.filter.column === columnName) {
      return newCondition
    }
    return expr
  }

  // Recursively update children
  return {
    ...expr,
    children: expr.children.map((child) => updateColumnRecursive(child, columnName, newCondition)),
  }
}

/**
 * Update a filter for a specific column in the expression
 * If column exists (anywhere in tree), replaces it. If not, adds it to root.
 */
export function updateFilterInExpression(
  expr: FilterExpression,
  columnName: string,
  newFilter: Filter
): FilterExpression {
  const condition: FilterCondition = { type: 'condition', filter: newFilter }

  if (expr.type === 'condition') {
    if (expr.filter.column === columnName) {
      return condition
    }
    // Different column - wrap both in AND group
    return {
      type: 'group',
      combineMode: 'and',
      children: [expr, condition],
    }
  }

  // Check if column exists anywhere in the expression tree
  if (hasColumnInExpression(expr, columnName)) {
    // Recursively update the existing condition for this column
    return updateColumnRecursive(expr, columnName, condition)
  }

  // Column not found anywhere - add new condition to root
  return {
    ...expr,
    children: [...expr.children, condition],
  }
}

/**
 * Remove a filter from expression by column name
 * Returns null if expression becomes empty
 */
export function removeFilterFromExpression(expr: FilterExpression, columnName: string): FilterExpression | null {
  if (expr.type === 'condition') {
    return expr.filter.column === columnName ? null : expr
  }

  const filtered = expr.children
    .map((child) => removeFilterFromExpression(child, columnName))
    .filter((child): child is FilterExpression => child !== null)

  if (filtered.length === 0) {
    return null
  }

  // If only one child left and it's a condition, unwrap it
  if (filtered.length === 1 && filtered[0].type === 'condition') {
    return filtered[0]
  }

  return { ...expr, children: filtered }
}

/**
 * Get the combine mode of the root group (defaults to 'and' for conditions)
 */
export function getRootCombineMode(expr: FilterExpression): 'and' | 'or' {
  return expr.type === 'group' ? expr.combineMode : 'and'
}

/**
 * Check if expression has nested groups (for showing "complex" badge)
 */
export function isComplexExpression(expr: FilterExpression): boolean {
  if (expr.type === 'condition') return false
  return expr.children.some((c) => c.type === 'group')
}

/**
 * Simplify expression by merging groups with same combineMode as parent
 * AND(AND(a, b), c) → AND(a, b, c)
 * OR(OR(x), OR(y, z)) → OR(x, y, z)
 * BUT keeps: AND(OR(a, b), c) (different modes)
 */
export function simplifyExpression(expr: FilterExpression): FilterExpression {
  if (expr.type === 'condition') return expr

  const newChildren: FilterExpression[] = []
  for (const child of expr.children) {
    const simplified = simplifyExpression(child)
    // If child is group with same combineMode, flatten its children
    if (simplified.type === 'group' && simplified.combineMode === expr.combineMode) {
      newChildren.push(...simplified.children)
    } else {
      newChildren.push(simplified)
    }
  }
  return { ...expr, children: newChildren }
}

/**
 * Count total conditions in expression (for badge display)
 */
export function countConditions(expr: FilterExpression): number {
  if (expr.type === 'condition') return 1
  return expr.children.reduce((sum, child) => sum + countConditions(child), 0)
}
