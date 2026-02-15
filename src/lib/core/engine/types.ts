import type {
  ChartNode,
  DashboardNode,
  Dataset,
  DataView,
  ExportNode,
  PipelineEdge,
  PipelineNode,
  PythonNode,
} from '@/types/pipeline'

/**
 * Snapshot for undo/redo
 */
export interface PipelineSnapshot {
  nodes: Record<string, PipelineNode>
  edges: PipelineEdge[]
  activeNodeId: string | null
  selectedNodeId: string | null
  openNodeIds: string[]
  timestamp: number
}

/**
 * Core pipeline state managed by the engine
 */
export interface PipelineState {
  nodes: Record<string, PipelineNode>
  edges: PipelineEdge[]
  activeNodeId: string | null
  selectedNodeId: string | null
  openNodeIds: string[]
  undoStack: PipelineSnapshot[]
  redoStack: PipelineSnapshot[]
}

/**
 * Effects that the engine declares for adapters to execute
 */
export type PipelineEffect =
  | { type: 'duckdb.createView'; viewName: string; sql: string; parentTableName: string }
  | { type: 'duckdb.updateView'; viewName: string; sql: string }
  | { type: 'duckdb.dropView'; viewName: string }
  | { type: 'duckdb.dropViews'; viewNames: string[] }
  | { type: 'duckdb.getSchema'; viewName: string; resultKey: string }
  | { type: 'duckdb.getRowCount'; viewName: string; resultKey: string }
  | { type: 'persist.markDirty' }
  | { type: 'analytics.track'; event: string; properties: Record<string, unknown> }

/**
 * Result of executing a command
 */
export interface CommandResult {
  state: PipelineState
  effects: PipelineEffect[]
}

/**
 * Command types for the pipeline engine
 */
export type PipelineCommand =
  | { type: 'addDataset'; dataset: Dataset; suppressEffects?: boolean }
  | { type: 'addView'; view: DataView; parentIds: string[]; suppressEffects?: boolean }
  | { type: 'addChartNode'; chart: ChartNode; parentId: string }
  | { type: 'addExportNode'; exportNode: ExportNode; parentId: string }
  | { type: 'addDashboardNode'; dashboard: DashboardNode; parentIds: string[]; suppressEffects?: boolean }
  | { type: 'addPythonNode'; pythonNode: PythonNode; parentId: string }
  | { type: 'removeNode'; nodeId: string; cascade?: boolean; suppressEffects?: boolean }
  | { type: 'updateNode'; nodeId: string; updates: Partial<PipelineNode>; suppressEffects?: boolean }
  | { type: 'updateNodes'; updates: Record<string, Partial<PipelineNode>>; suppressEffects?: boolean }
  | { type: 'setNodeParents'; nodeId: string; parentIds: string[]; suppressEffects?: boolean }
  | { type: 'setActiveNode'; nodeId: string | null }
  | { type: 'selectNode'; nodeId: string | null }
  | { type: 'openTab'; nodeId: string }
  | { type: 'closeTab'; nodeId: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'captureSnapshot' }
