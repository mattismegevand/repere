import type { DuckDBClient } from '@/lib/duckdb/interface'
import type { ColumnStats } from '@/lib/profiling'
import type { ChatMessage, LLMMessage, LLMToolCall, StepOperation } from '@/types/ai'
import type { ChartConfig, ExportConfig, PipelineNode, ViewOperation } from '@/types/pipeline'
import { buildAgentContext, serializeContextForPrompt } from './context'
import { createAssistantMessage, createToolResultMessage, LLMClient } from './llm-client'
import { AGENT_SYSTEM_PROMPT } from './prompts'
import { operationTools } from './tools'

const MAX_ITERATIONS = 15

export interface AgentConfig {
  apiKey: string
  model: string
}

export interface ExecutionCallbacks {
  // Execute a view operation, returns success/error message
  executeViewOp: (
    op: ViewOperation,
    targetNodeId?: string
  ) => Promise<{ success: boolean; message: string; nodeId?: string }>
  // Create a chart node
  createChart: (
    config: ChartConfig,
    targetNodeId?: string
  ) => Promise<{ success: boolean; message: string; nodeId?: string }>
  // Create an export node
  createExport: (
    config: ExportConfig,
    targetNodeId?: string
  ) => Promise<{ success: boolean; message: string; nodeId?: string }>
  // Get current active node (may change after operations)
  getActiveNode: () => PipelineNode | null
  // Get all nodes
  getNodes: () => Record<string, PipelineNode>
  // Report status to UI
  onStatus: (message: string) => void
  // Report when a step completes (nodeId is the affected node for navigation)
  onStepComplete: (description: string, success: boolean, message: string, nodeId?: string) => void
  // Check if user requested abort
  isAborted: () => boolean
}

/**
 * Parse a tool call into a StepOperation (minimal validation, let execution handle errors)
 */
function parseToolCall(toolCall: LLMToolCall): StepOperation | null {
  const { name, arguments: args } = toolCall
  const targetNodeId = args.targetNodeId as string | undefined

  // View operations
  const viewOpTypes = [
    'filter',
    'sort',
    'limit',
    'select',
    'addColumn',
    'removeColumns',
    'renameColumns',
    'reorderColumns',
    'castColumn',
    'editCell',
    'editColumn',
    'fillNull',
    'replaceValue',
    'pivot',
    'unpivot',
    'window',
    'join',
    'union',
    'distinct',
  ]

  if (viewOpTypes.includes(name)) {
    // Build the operation object - just pass through the args
    const { targetNodeId: _, ...rest } = args
    const operation = { type: name, ...rest } as ViewOperation
    return { kind: 'view', operation, targetNodeId }
  }

  if (name === 'createChart') {
    const config: ChartConfig = {
      chartType: args.chartType as ChartConfig['chartType'],
      title: args.title as string | undefined,
      xAxis: args.xAxis as ChartConfig['xAxis'],
      yAxis: args.yAxis as ChartConfig['yAxis'],
      colorBy: args.colorBy as string | undefined,
      aggregation: args.aggregation as ChartConfig['aggregation'],
    }
    return { kind: 'chart', config, targetNodeId }
  }

  if (name === 'createExport') {
    const config: ExportConfig = {
      format: args.format as ExportConfig['format'],
      filename: args.filename as string | undefined,
    }
    return { kind: 'export', config, targetNodeId }
  }

  return null
}

/**
 * Describe a step operation for display
 */
function describeOperation(stepOp: StepOperation): string {
  if (stepOp.kind === 'chart') {
    return `Create ${stepOp.config.chartType} chart${stepOp.config.title ? `: ${stepOp.config.title}` : ''}`
  }
  if (stepOp.kind === 'export') {
    return `Export as ${stepOp.config.format.toUpperCase()}`
  }

  const op = stepOp.operation
  switch (op.type) {
    case 'filter':
      return 'Filter rows'
    case 'sort':
      return `Sort by ${op.sorts?.map((s: { column: string }) => s.column).join(', ') || 'columns'}`
    case 'limit':
      return `Limit to ${op.limit} rows`
    case 'select':
      return `Select ${op.columns?.length || 0} columns`
    case 'addColumn':
      return `Add column(s)`
    case 'removeColumns':
      return `Remove ${op.columns?.length || 0} columns`
    case 'renameColumns':
      return 'Rename columns'
    case 'pivot':
      return op.pivotColumn ? `Pivot on ${op.pivotColumn}` : `Group by ${op.rowColumns?.join(', ')}`
    case 'join':
      return `${op.joinType?.toUpperCase() || 'JOIN'} with another table`
    case 'union':
      return 'Union tables'
    case 'distinct':
      return 'Remove duplicates'
    default:
      return `${op.type} operation`
  }
}

export class Agent {
  private client: LLMClient

  constructor(config: AgentConfig) {
    this.client = new LLMClient({
      apiKey: config.apiKey,
      model: config.model,
    })
  }

  /**
   * Run the agent loop - execute until done or max iterations
   */
  async run(
    goal: string,
    client: DuckDBClient,
    columnStats: ColumnStats[],
    callbacks: ExecutionCallbacks,
    chatHistory: ChatMessage[] = []
  ): Promise<{ success: boolean; message: string }> {
    const { onStatus, onStepComplete, isAborted, getActiveNode, getNodes } = callbacks

    // Build initial context
    const activeNode = getActiveNode()
    if (!activeNode) {
      return { success: false, message: 'No active node selected' }
    }

    const context = await buildAgentContext(client, activeNode, getNodes(), columnStats)
    const contextString = serializeContextForPrompt(context)

    // Build chat history summary (exclude the current message which is already in goal)
    const historyMessages = chatHistory.slice(0, -1) // Exclude the message we just added
    const historySummary =
      historyMessages.length > 0
        ? `## Recent Conversation\n${historyMessages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`).join('\n')}\n\n`
        : ''

    // Initialize conversation
    const messages: LLMMessage[] = [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${historySummary}## Context\n${contextString}\n\n## User Request\n${goal}\n\nExecute the necessary operations to accomplish this goal. Call tools one at a time and I'll give you the results.`,
      },
    ]

    onStatus('Thinking...')

    // Track completed steps for context
    const completedSteps: string[] = []

    let iteration = 0
    while (iteration < MAX_ITERATIONS) {
      if (isAborted()) {
        return { success: false, message: 'Execution aborted by user' }
      }

      iteration++

      try {
        // Call LLM
        const response = await this.client.chat(messages, { tools: operationTools })

        // If no tool calls, we're done
        if (!response.toolCalls || response.toolCalls.length === 0) {
          onStatus('Done')
          return { success: true, message: response.content || 'Completed successfully' }
        }

        // Add assistant message to history
        messages.push(createAssistantMessage(response.content, response.toolCalls))

        // Execute each tool call
        for (const toolCall of response.toolCalls) {
          if (isAborted()) {
            return { success: false, message: 'Execution aborted by user' }
          }

          const stepOp = parseToolCall(toolCall)
          if (!stepOp) {
            const errorResult = `Unknown tool: ${toolCall.name}`
            messages.push(createToolResultMessage(toolCall.id, errorResult))
            onStepComplete(toolCall.name, false, errorResult)
            continue
          }

          const description = describeOperation(stepOp)
          onStatus(`Executing: ${description}`)

          // Execute the operation
          let result: { success: boolean; message: string; nodeId?: string }

          try {
            if (stepOp.kind === 'view') {
              result = await callbacks.executeViewOp(stepOp.operation, stepOp.targetNodeId)
            } else if (stepOp.kind === 'chart') {
              result = await callbacks.createChart(stepOp.config, stepOp.targetNodeId)
            } else {
              result = await callbacks.createExport(stepOp.config, stepOp.targetNodeId)
            }
          } catch (err) {
            result = { success: false, message: err instanceof Error ? err.message : 'Unknown error' }
          }

          // Send result back to LLM
          const resultMessage = result.success ? `Success: ${result.message}` : `Error: ${result.message}`
          messages.push(createToolResultMessage(toolCall.id, resultMessage))

          onStepComplete(description, result.success, result.message, result.nodeId)

          // Track completed steps for context
          if (result.success) {
            completedSteps.push(`✓ ${description}: ${result.message}`)
          } else {
            completedSteps.push(`✗ ${description}: ${result.message}`)
            onStatus('Operation failed, asking AI how to proceed...')
          }
        }

        // Update context for next iteration (schema may have changed)
        const newActiveNode = getActiveNode()
        if (newActiveNode) {
          // Build context update with progress summary
          const progressSummary =
            completedSteps.length > 0 ? `## Progress So Far\n${completedSteps.join('\n')}\n\n` : ''

          messages.push({
            role: 'user',
            content: `${progressSummary}## Current State\nNode: ${newActiveNode.name}\nColumns: ${newActiveNode.columns.map((c) => c.name).join(', ')}\nRows: ${newActiveNode.rowCount ?? 'unknown'}\n\n## Original Goal\n${goal}\n\nWhat's the next step? If the goal is fully achieved, respond with a summary (no tool calls).`,
          })
        }

        onStatus('Thinking...')
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        onStatus(`Error: ${errorMessage}`)
        return { success: false, message: errorMessage }
      }
    }

    return { success: false, message: 'Max iterations reached' }
  }
}
