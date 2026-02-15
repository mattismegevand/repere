import { create } from 'zustand'
import type { NodeLayout, PipelineLayoutState } from '@/types/pipelineLayout'

interface PipelineLayoutActions {
  setNodeLayout: (nodeId: string, layout: NodeLayout) => void
  setNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  setNodesLayout: (updates: Record<string, NodeLayout>) => void
  toggleNodeExpanded: (nodeId: string) => void
  setNodeExpanded: (nodeId: string, isExpanded: boolean) => void
  setNodeDimensions: (nodeId: string, dimensions: { width: number; height: number }) => void
  removeNodesLayout: (nodeIds: string[]) => void
  reset: () => void
}

const initialState: PipelineLayoutState = {
  nodes: {},
}

export const usePipelineLayoutStore = create<PipelineLayoutState & PipelineLayoutActions>((set) => ({
  ...initialState,

  setNodeLayout: (nodeId, layout) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], ...layout },
      },
    })),

  setNodePosition: (nodeId, position) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], position },
      },
    })),

  setNodesLayout: (updates) =>
    set((state) => {
      const nextNodes = { ...state.nodes }
      for (const [nodeId, layout] of Object.entries(updates)) {
        nextNodes[nodeId] = { ...nextNodes[nodeId], ...layout }
      }
      return { nodes: nextNodes }
    }),

  toggleNodeExpanded: (nodeId) =>
    set((state) => {
      const current = state.nodes[nodeId]
      const isExpanded = current?.isExpanded ?? false
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: { ...current, isExpanded: !isExpanded },
        },
      }
    }),

  setNodeExpanded: (nodeId, isExpanded) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], isExpanded },
      },
    })),

  setNodeDimensions: (nodeId, dimensions) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], dimensions },
      },
    })),

  removeNodesLayout: (nodeIds) =>
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
