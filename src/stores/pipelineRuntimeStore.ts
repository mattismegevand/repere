import { create } from 'zustand'
import type { NodeRuntime, PipelineRuntimeState } from '@/types/pipelineRuntime'

interface PipelineRuntimeActions {
  setNodeRuntime: (nodeId: string, runtime: Partial<NodeRuntime>) => void
  setNodesRuntime: (updates: Record<string, Partial<NodeRuntime>>) => void
  removeNodesRuntime: (nodeIds: string[]) => void
  reset: () => void
}

const initialState: PipelineRuntimeState = {
  nodes: {},
}

export const usePipelineRuntimeStore = create<PipelineRuntimeState & PipelineRuntimeActions>((set) => ({
  ...initialState,

  setNodeRuntime: (nodeId, runtime) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], ...runtime },
      },
    })),

  setNodesRuntime: (updates) =>
    set((state) => {
      const nextNodes = { ...state.nodes }
      for (const [nodeId, runtime] of Object.entries(updates)) {
        nextNodes[nodeId] = { ...nextNodes[nodeId], ...runtime }
      }
      return { nodes: nextNodes }
    }),

  removeNodesRuntime: (nodeIds) =>
    set((state) => {
      if (nodeIds.length === 0) return state
      const nextNodes = { ...state.nodes }
      for (const nodeId of nodeIds) {
        delete nextNodes[nodeId]
      }
      return { nodes: nextNodes }
    }),

  reset: () => set(initialState),
}))
