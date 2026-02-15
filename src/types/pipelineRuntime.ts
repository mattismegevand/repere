import type { Column } from './dataset'

export interface RuntimeColumn extends Column {
  duckdbType?: string
}

export interface NodeRuntime {
  tableName?: string
  viewSql?: string
  outputTableName?: string
  columns?: RuntimeColumn[]
  rowCount?: number | null
  matplotlibOutput?: string
  executionTimeMs?: number
  lastExecutedAt?: Date
}

export interface PipelineRuntimeState {
  nodes: Record<string, NodeRuntime>
}
