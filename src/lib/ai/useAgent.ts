import { useCallback, useRef, useState } from 'react'
import { useDuckDB } from '@/lib/duckdb'
import { usePipeline } from '@/lib/pipeline'
import { profileDataset } from '@/lib/profiling'
import { useChatStore } from '@/stores/chatStore'
import { selectActiveNode, usePipelineStore } from '@/stores/pipelineStore'
import type { ChartConfig, ExportConfig, ViewOperation } from '@/types/pipeline'
import { Agent, type ExecutionCallbacks } from './agent'

export interface AgentStep {
  description: string
  success: boolean
  message: string
  nodeId?: string
}

/**
 * Hook that provides agent functionality with iterative execution
 */
export function useAgent() {
  const { client } = useDuckDB()
  const activeNode = usePipelineStore(selectActiveNode)

  // Stable getters that read from store directly
  const getNodes = useCallback(() => usePipelineStore.getState().nodes, [])
  const getActiveNode = useCallback(() => {
    const state = usePipelineStore.getState()
    return state.activeNodeId ? state.nodes[state.activeNodeId] : null
  }, [])

  const { apiKey, model, addMessage, setLoading, messages: chatHistory } = useChatStore()
  const { applyOrReplaceOperation, createChart, createExport } = usePipeline()

  // Execution state
  const [status, setStatus] = useState<string>('')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const abortRef = useRef(false)
  const stepsRef = useRef<AgentStep[]>([])

  /**
   * Execute a view operation
   */
  const executeViewOp = useCallback(
    async (
      op: ViewOperation,
      targetNodeId?: string
    ): Promise<{ success: boolean; message: string; nodeId?: string }> => {
      try {
        const result = await applyOrReplaceOperation(op, targetNodeId)
        if (result) {
          return {
            success: true,
            message: `Created "${result.name}" with ${result.rowCount ?? 0} rows`,
            nodeId: result.id,
          }
        }
        return { success: false, message: 'Operation returned no result' }
      } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : 'Unknown error' }
      }
    },
    [applyOrReplaceOperation]
  )

  /**
   * Create a chart
   */
  const handleCreateChart = useCallback(
    async (
      config: ChartConfig,
      targetNodeId?: string
    ): Promise<{ success: boolean; message: string; nodeId?: string }> => {
      try {
        const nodeId = targetNodeId ?? usePipelineStore.getState().activeNodeId
        if (!nodeId) {
          return { success: false, message: 'No node selected for chart' }
        }
        const result = createChart(nodeId, config)
        if (result) {
          return { success: true, message: `Created ${config.chartType} chart`, nodeId: result.id }
        }
        return { success: false, message: 'Failed to create chart' }
      } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : 'Unknown error' }
      }
    },
    [createChart]
  )

  /**
   * Create an export
   */
  const handleCreateExport = useCallback(
    async (
      config: ExportConfig,
      targetNodeId?: string
    ): Promise<{ success: boolean; message: string; nodeId?: string }> => {
      try {
        const nodeId = targetNodeId ?? usePipelineStore.getState().activeNodeId
        if (!nodeId) {
          return { success: false, message: 'No node selected for export' }
        }
        const result = createExport(nodeId, config)
        if (result) {
          return { success: true, message: `Created ${config.format.toUpperCase()} export`, nodeId: result.id }
        }
        return { success: false, message: 'Failed to create export' }
      } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : 'Unknown error' }
      }
    },
    [createExport]
  )

  /**
   * Send a message and run the agent
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!client || !apiKey) {
        addMessage({
          role: 'assistant',
          content: 'Please configure your API key in settings.',
        })
        return
      }

      // Get a valid node to work with (active node, or first dataset/view)
      const nodes = getNodes()
      const nodeList = Object.values(nodes)
      const workingNode = activeNode ?? nodeList.find((n) => n.type === 'dataset' || n.type === 'view')

      if (!workingNode) {
        addMessage({
          role: 'assistant',
          content: 'No data loaded yet. Please load a dataset first.',
        })
        return
      }

      // Reset state
      abortRef.current = false
      stepsRef.current = []
      setIsRunning(true)
      setLoading(true)
      setSteps([])
      setStatus('Starting...')

      // Add user message
      addMessage({ role: 'user', content })

      try {
        // Get column stats for initial context
        const columnStats = await profileDataset(client, workingNode.tableName, workingNode.columns)

        // Create callbacks (use workingNode as fallback if no active node)
        const callbacks: ExecutionCallbacks = {
          executeViewOp,
          createChart: handleCreateChart,
          createExport: handleCreateExport,
          getActiveNode: () => getActiveNode() ?? workingNode,
          getNodes,
          onStatus: setStatus,
          onStepComplete: (description, success, message, nodeId) => {
            const step = { description, success, message, nodeId }
            stepsRef.current = [...stepsRef.current, step]
            setSteps(stepsRef.current)
          },
          isAborted: () => abortRef.current,
        }

        // Run the agent (pass recent chat history for context)
        const agent = new Agent({ apiKey, model })
        const recentHistory = chatHistory.slice(-10) // Last 10 messages for context
        const result = await agent.run(content, client, columnStats, callbacks, recentHistory)

        // Add final message with executed steps
        const isAborted = result.message.includes('aborted')
        const completedCount = stepsRef.current.filter((s) => s.success).length

        let finalMessage: string
        if (result.success) {
          finalMessage = result.message
        } else if (isAborted) {
          finalMessage =
            completedCount > 0
              ? `Stopped. ${completedCount} step${completedCount !== 1 ? 's were' : ' was'} completed before stopping.`
              : 'Stopped before any operations were completed.'
        } else {
          finalMessage = result.message
        }

        addMessage({
          role: 'assistant',
          content: finalMessage,
          executedSteps: stepsRef.current.length > 0 ? [...stepsRef.current] : undefined,
        })
      } catch (err) {
        addMessage({
          role: 'assistant',
          content: err instanceof Error ? err.message : 'An unexpected error occurred.',
        })
      } finally {
        setIsRunning(false)
        setLoading(false)
        setStatus('')
      }
    },
    [
      client,
      activeNode,
      apiKey,
      model,
      addMessage,
      setLoading,
      executeViewOp,
      handleCreateChart,
      handleCreateExport,
      getActiveNode,
      getNodes,
    ]
  )

  /**
   * Abort the current execution
   */
  const abort = useCallback(() => {
    abortRef.current = true
  }, [])

  return {
    sendMessage,
    abort,
    hasApiKey: !!apiKey,
    isRunning,
    status,
    steps,
  }
}
