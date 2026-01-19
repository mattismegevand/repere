import { buildOperationSql as buildSqlFromPlugin } from '@/lib/operations'
import type { ViewOperation } from '@/types'
import type { OperationContext } from './types'

/**
 * Main function: Build SELECT SQL for an operation
 * Delegates to the operation plugin system
 */
export function buildOperationSql(operation: ViewOperation, context: OperationContext): string {
  return buildSqlFromPlugin(operation, context)
}
