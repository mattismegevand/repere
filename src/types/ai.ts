import type { Column } from './dataset'
import type { ChartConfig, ExportConfig, PipelineNode, ViewOperation } from './pipeline'

// ============================================
// LLM CONFIG (OpenRouter)
// ============================================

export interface LLMConfig {
  apiKey: string
  model: string
}

// ============================================
// CHAT MESSAGE TYPES
// ============================================

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ExecutedStep {
  description: string
  success: boolean
  message: string
  nodeId?: string // The affected node, for navigation
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  // For assistant messages with executed steps
  executedSteps?: ExecutedStep[]
  // Legacy: for assistant messages with plans
  plan?: AgentPlan
}

// ============================================
// AGENT PLAN TYPES
// ============================================

export type PlanStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'aborted'
export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

// Step operation can be a view operation, chart, or export
export type StepOperation =
  | { kind: 'view'; operation: ViewOperation; targetNodeId?: string }
  | { kind: 'chart'; config: ChartConfig; targetNodeId?: string }
  | { kind: 'export'; config: ExportConfig; targetNodeId?: string }

export interface PlannedStep {
  id: string
  description: string
  operation: StepOperation
  status: StepStatus
  result?: StepResult
}

export interface StepResult {
  rowCount: number
  message: string
  viewId?: string
}

export interface AgentPlan {
  id: string
  goal: string
  steps: PlannedStep[]
  status: PlanStatus
}

// ============================================
// AGENT CONTEXT TYPES
// ============================================

export interface ColumnStat {
  column: string
  type: Column['type']
  nullCount: number
  nullPercent: number
  uniqueCount: number
  min?: number | string
  max?: number | string
  mean?: number
  outlierCount?: number
}

export interface NodeContext {
  id: string
  name: string
  tableName: string
  rowCount: number | null
  columns: Column[]
}

export interface AgentContext {
  // Current/active node (the one user is viewing)
  currentNode: NodeContext
  // Column statistics for current node
  columnStats: ColumnStat[]
  // Sample data for pattern recognition (first N rows of current node)
  dataSample: Record<string, unknown>[]
  // All nodes in the pipeline (for targeting operations)
  allNodes: Array<{
    id: string
    name: string
    type: PipelineNode['type']
    columns: Column[]
    rowCount: number | null
  }>
  // How we got to the current view (operation descriptions)
  operationHistory: string[]
}

// ============================================
// LLM REQUEST/RESPONSE TYPES
// ============================================

export interface LLMToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

// Message types for multi-turn conversations with tool use
export type LLMMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: LLMToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string }

export interface LLMResponse {
  content: string
  toolCalls?: LLMToolCall[]
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter'
}

// ============================================
// TOOL DEFINITION TYPES
// ============================================

export interface ToolParameter {
  type?: string | string[]
  description?: string
  enum?: string[]
  items?: ToolParameter
  properties?: Record<string, ToolParameter>
  required?: string[]
  default?: unknown
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
}
