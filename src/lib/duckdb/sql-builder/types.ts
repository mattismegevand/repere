import type { Column } from '@/types'

/**
 * Context for building operation SQL
 */
export interface OperationContext {
  sourceTableName: string
  sourceColumns: Column[]
  additionalSources?: Record<string, { tableName: string; columns: Column[] }>
}
