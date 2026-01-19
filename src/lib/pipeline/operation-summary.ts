import { getOperationSummary as getSummaryFromPlugin } from '@/lib/operations'
import type { ViewOperation } from '@/types'

/**
 * Generate a human-readable summary of an operation for display in nodes.
 * Returns a concise string (typically <50 chars) describing what the operation does.
 *
 * Delegates to the operation plugin system.
 */
export function getOperationSummary(operation: ViewOperation): string {
  return getSummaryFromPlugin(operation)
}
