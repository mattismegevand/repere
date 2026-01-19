import type { LucideIcon } from 'lucide-react'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { PipelineNode, ViewOperation } from '@/types/pipeline'

/**
 * Color codes for operation UI badges
 */
export type OperationColor = 'blue' | 'green' | 'amber' | 'purple' | 'orange' | 'cyan' | 'gray'

/**
 * UI metadata for displaying operations in nodes, chips, and menus
 */
export interface OperationUiMeta {
  /** Human-readable label (e.g., "Filter", "Add Column") */
  label: string
  /** Lucide icon component */
  icon: LucideIcon
  /** Color for badges and chips */
  color: OperationColor
  /** Whether this operation can be edited after creation */
  editable: boolean
}

/**
 * Context for building SQL for an operation
 */
export interface OperationContext {
  sourceTableName: string
  sourceColumns: Column[]
  additionalSources?: Record<string, { tableName: string; columns: Column[] }>
}

/**
 * Result of validating an operation from AI tool calls
 */
export interface ValidationResult {
  valid: boolean
  operation?: ViewOperation
  errors: string[]
  warnings: string[]
}

/**
 * Category of operation for grouping in UI/docs
 */
export type OperationCategory = 'query' | 'column' | 'cell' | 'aggregate' | 'combine' | 'custom'

/**
 * Plugin interface for operations.
 * Each operation type implements this to co-locate all its logic.
 */
export interface OperationPlugin<T extends ViewOperation = ViewOperation> {
  /** ViewOperation type identifier (matches T['type']) */
  type: T['type']

  /** Category for grouping */
  category: OperationCategory

  /** UI metadata for rendering operation in nodes/chips/menus */
  ui: OperationUiMeta

  /** Build SQL SELECT statement for this operation */
  buildSql(op: T, context: OperationContext): string

  /** Generate human-readable summary for display in nodes */
  getSummary(op: T): string

  /** Tool definition for AI/LLM integration */
  toolDefinition: ToolDefinition

  /** Validate AI tool call arguments and convert to operation */
  validate(args: Record<string, unknown>, columns: Column[], nodes?: Record<string, PipelineNode>): ValidationResult

  /** Optional: Check if two operations of same type can be merged */
  canMerge?(existing: T, incoming: T): boolean

  /** Optional: Merge two operations of same type */
  merge?(existing: T, incoming: T): T

  /** Optional: Generate description for AI context */
  getAIDescription?(op: T): string
}
