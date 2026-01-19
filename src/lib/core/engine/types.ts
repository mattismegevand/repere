import type { Dataset, DataView, PipelineEdge, PipelineNode } from '@/types/pipeline'

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
  | { type: 'addDataset'; dataset: Dataset }
  | { type: 'addView'; view: DataView; parentId: string }
  | { type: 'removeNode'; nodeId: string; cascade?: boolean }
  | { type: 'updateNode'; nodeId: string; updates: Partial<PipelineNode> }
  | { type: 'setActiveNode'; nodeId: string | null }
  | { type: 'selectNode'; nodeId: string | null }
  | { type: 'openTab'; nodeId: string }
  | { type: 'closeTab'; nodeId: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'captureSnapshot' }
