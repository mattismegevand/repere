import type { Patch } from 'immer'
import type { PipelineEdge, PipelineNode } from '@/types'

// Snapshot-based undo/redo with optional Immer patches for efficiency
export interface PipelineSnapshot {
  nodes: Record<string, PipelineNode>
  edges: PipelineEdge[]
  activeNodeId: string | null
  selectedNodeId: string | null
  openNodeIds: string[]
  timestamp: number
  patches?: Patch[]
  inversePatches?: Patch[]
}
