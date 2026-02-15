import SquareCode from 'lucide-react/dist/esm/icons/square-code'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { OperationType, PipelineNode, ViewOperation } from '@/types/pipeline'
import {
  addColumnPlugin,
  castColumnPlugin,
  distinctPlugin,
  editCellPlugin,
  editColumnPlugin,
  fillNullPlugin,
  filterPlugin,
  joinPlugin,
  limitPlugin,
  pivotPlugin,
  removeColumnsPlugin,
  renameColumnsPlugin,
  reorderColumnsPlugin,
  replaceValuePlugin,
  selectPlugin,
  sortPlugin,
  sqlPlugin,
  unionPlugin,
  unpivotPlugin,
  windowPlugin,
} from './plugins'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from './types'

const defaultUiMeta: OperationUiMeta = {
  label: 'Unknown',
  icon: SquareCode,
  color: 'gray',
  editable: false,
}

const pluginRegistry = new Map<string, OperationPlugin>([
  // Query operations
  ['filter', filterPlugin],
  ['sort', sortPlugin],
  ['limit', limitPlugin],
  ['select', selectPlugin],
  ['distinct', distinctPlugin],

  // Column operations
  ['addColumn', addColumnPlugin],
  ['removeColumns', removeColumnsPlugin],
  ['renameColumns', renameColumnsPlugin],
  ['reorderColumns', reorderColumnsPlugin],
  ['castColumn', castColumnPlugin],

  // Cell/value operations
  ['editCell', editCellPlugin],
  ['editColumn', editColumnPlugin],
  ['fillNull', fillNullPlugin],
  ['replaceValue', replaceValuePlugin],

  // Aggregation operations
  ['pivot', pivotPlugin],
  ['unpivot', unpivotPlugin],

  // Window operations
  ['window', windowPlugin],

  // Combine operations
  ['join', joinPlugin],
  ['union', unionPlugin],

  // Custom SQL operations
  ['sql', sqlPlugin],
])

function getPlugin(operationType: string): OperationPlugin | undefined {
  return pluginRegistry.get(operationType)
}

export function buildOperationSql(operation: ViewOperation, context: OperationContext): string {
  const plugin = getPlugin(operation.type)
  if (plugin) {
    return plugin.buildSql(operation, context)
  }
  // Fallback for unknown operation types
  const source = context.sourceTableName.replace(/"/g, '""')
  return `SELECT * FROM "${source}"`
}

export function getOperationSummary(operation: ViewOperation): string {
  const plugin = getPlugin(operation.type)
  if (plugin) {
    return plugin.getSummary(operation)
  }
  return ''
}

export function mergeOperations(existing: ViewOperation, incoming: ViewOperation): ViewOperation {
  if (existing.type !== incoming.type) {
    return incoming
  }

  const plugin = getPlugin(incoming.type)
  if (plugin?.canMerge && plugin.merge) {
    if (plugin.canMerge(existing, incoming)) {
      return plugin.merge(existing, incoming)
    }
  }

  // Default: replace with incoming
  return incoming
}

export function getOperationTools(): ToolDefinition[] {
  const tools: ToolDefinition[] = []
  for (const plugin of pluginRegistry.values()) {
    // Skip sql operation from AI tools (power user only)
    if (plugin.type !== 'sql') {
      tools.push(plugin.toolDefinition)
    }
  }
  return tools
}

export function getOperationUiMeta(operationType: OperationType): OperationUiMeta {
  const plugin = getPlugin(operationType)
  return plugin?.ui ?? defaultUiMeta
}

/**
 * Validate a tool call from the AI agent before execution.
 * Returns validation result with errors/warnings.
 */
export function validateToolCall(
  toolName: string,
  args: Record<string, unknown>,
  columns: Column[],
  nodes?: Record<string, PipelineNode>
): ValidationResult {
  const plugin = pluginRegistry.get(toolName)
  if (!plugin) {
    return {
      valid: false,
      errors: [`Unknown operation: "${toolName}". Available: ${Array.from(pluginRegistry.keys()).join(', ')}`],
      warnings: [],
    }
  }
  return plugin.validate(args, columns, nodes)
}

// Re-export types
export type { OperationUiMeta, ValidationResult }
