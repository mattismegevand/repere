import type { Column } from '@/types/dataset'

/**
 * Calculate Levenshtein distance between two strings for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Find similar column names using Levenshtein distance
 */
export function findSimilarColumns(target: string, columns: Column[], maxSuggestions = 3): string[] {
  const targetLower = target.toLowerCase()
  const scored = columns
    .map((col) => ({
      name: col.name,
      distance: levenshteinDistance(targetLower, col.name.toLowerCase()),
      // Bonus for substring match
      hasSubstring: col.name.toLowerCase().includes(targetLower) || targetLower.includes(col.name.toLowerCase()),
    }))
    .map((item) => ({
      ...item,
      score: item.hasSubstring ? item.distance - 2 : item.distance,
    }))
    .filter((item) => item.score < target.length * 0.6) // Only suggest if reasonably close
    .sort((a, b) => a.score - b.score)
    .slice(0, maxSuggestions)

  return scored.map((s) => s.name)
}

/**
 * Format validation errors with helpful hints for the AI
 */
export function formatValidationError(
  errors: string[],
  warnings: string[],
  context: { columns: Column[]; nodes?: Record<string, unknown> }
): string {
  const parts: string[] = ['VALIDATION ERROR:']

  for (const error of errors) {
    parts.push(`- ${error}`)

    // Try to extract column name from common error patterns and suggest alternatives
    const columnMatch = error.match(/Column "([^"]+)" does not exist/)
    if (columnMatch) {
      const badColumn = columnMatch[1]
      const suggestions = findSimilarColumns(badColumn, context.columns)
      if (suggestions.length > 0) {
        parts.push(`  Did you mean: ${suggestions.map((s) => `"${s}"`).join(', ')}?`)
      }
    }

    // Extract node ID from error patterns
    const nodeMatch = error.match(/Table with ID "([^"]+)" does not exist/)
    if (nodeMatch && context.nodes) {
      const availableNodes = Object.keys(context.nodes).slice(0, 5)
      if (availableNodes.length > 0) {
        parts.push(`  Available node IDs: ${availableNodes.map((id) => `"${id}"`).join(', ')}`)
      }
    }
  }

  if (warnings.length > 0) {
    parts.push('')
    parts.push('WARNINGS:')
    for (const warning of warnings) {
      parts.push(`- ${warning}`)
    }
  }

  parts.push('')
  parts.push('Please fix the errors and try again with valid column names from the context.')

  return parts.join('\n')
}

/**
 * Format operator type mismatch errors
 */
export function formatOperatorError(operator: string, column: Column, validOperators: string[]): string {
  return (
    `Operator "${operator}" is not valid for column "${column.name}" (type: ${column.type}). ` +
    `Valid operators for this type: ${validOperators.join(', ')}`
  )
}
