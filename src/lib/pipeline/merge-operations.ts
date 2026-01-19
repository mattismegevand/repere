import { mergeOperations as mergeFromPlugin } from '@/lib/operations'
import type { ViewOperation } from '@/types'

/**
 * Merges operations of the same type when replacing a view.
 * This allows stacking multiple operations into a single node.
 *
 * Delegates to the operation plugin system.
 */
export function mergeOperations(existingOp: ViewOperation, newOp: ViewOperation): ViewOperation {
  return mergeFromPlugin(existingOp, newOp)
}
