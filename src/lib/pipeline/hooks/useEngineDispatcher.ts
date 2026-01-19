import { useCallback, useMemo } from 'react'
import type { PipelineCommand, PipelineState } from '@/lib/core'
import { EffectExecutor, PipelineEngine } from '@/lib/core'
import { usePipelineStore } from '@/stores/pipelineStore'
import { usePipelineServiceOptional } from '../PipelineProvider'

/**
 * Hook that provides a dispatcher for routing commands through the PipelineEngine.
 *
 * This is the bridge between:
 * - Zustand store (holds state)
 * - PipelineEngine (pure state transitions)
 * - EffectExecutor (impure side effects via PipelineService)
 *
 * Usage:
 *   const { dispatch } = useEngineDispatcher()
 *   await dispatch({ type: 'setActiveNode', nodeId: 'abc' })
 */
export function useEngineDispatcher() {
  const service = usePipelineServiceOptional()

  // Create effect executor when service is available
  const effectExecutor = useMemo(() => {
    if (!service) return null
    return new EffectExecutor(service, {
      onPersistDirty: () => {
        // Auto-save handles persistence - no explicit dirty flag needed
      },
    })
  }, [service])

  /**
   * Convert store state to engine state format.
   * The engine uses a subset of the store's state.
   */
  const getEngineState = useCallback((): PipelineState => {
    const store = usePipelineStore.getState()
    return {
      nodes: store.nodes,
      edges: store.edges,
      activeNodeId: store.activeNodeId,
      selectedNodeId: store.selectedNodeId,
      openNodeIds: store.openNodeIds,
      undoStack: store.undoStack,
      redoStack: store.redoStack,
    }
  }, [])

  /**
   * Apply engine state back to the store.
   */
  const applyEngineState = useCallback((newState: PipelineState) => {
    usePipelineStore.setState({
      nodes: newState.nodes,
      edges: newState.edges,
      activeNodeId: newState.activeNodeId,
      selectedNodeId: newState.selectedNodeId,
      openNodeIds: newState.openNodeIds,
      undoStack: newState.undoStack,
      redoStack: newState.redoStack,
    })
  }, [])

  /**
   * Dispatch a command through the engine.
   *
   * Flow:
   * 1. Get current state from store
   * 2. Execute command through engine → get new state + effects
   * 3. Apply new state to store
   * 4. Execute effects through adapter
   *
   * Returns effect execution results if there were effects to execute.
   */
  const dispatch = useCallback(
    async (command: PipelineCommand): Promise<{ success: boolean; error?: Error }> => {
      try {
        // Get current state
        const currentState = getEngineState()

        // Execute command through engine
        const { state: newState, effects } = PipelineEngine.execute(currentState, command)

        // Apply new state to store
        applyEngineState(newState)

        // Execute effects if we have an executor
        if (effects.length > 0 && effectExecutor) {
          const { allSucceeded, results } = await effectExecutor.executeAll(effects)
          if (!allSucceeded) {
            const failedResult = results.find((r) => !r.success)
            return { success: false, error: failedResult?.error }
          }
        }

        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
      }
    },
    [getEngineState, applyEngineState, effectExecutor]
  )

  /**
   * Dispatch multiple commands in sequence.
   */
  const dispatchBatch = useCallback(
    async (commands: PipelineCommand[]): Promise<{ success: boolean; error?: Error }> => {
      for (const command of commands) {
        const result = await dispatch(command)
        if (!result.success) {
          return result
        }
      }
      return { success: true }
    },
    [dispatch]
  )

  return {
    dispatch,
    dispatchBatch,
    ready: !!effectExecutor,
  }
}
