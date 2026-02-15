export interface NodeLayout {
  position: { x: number; y: number }
  isExpanded?: boolean
  dimensions?: { width: number; height: number }
}

export interface PipelineLayoutState {
  nodes: Record<string, NodeLayout>
}
