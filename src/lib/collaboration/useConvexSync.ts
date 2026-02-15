import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef } from 'react'
import { usePipelineLayoutStore } from '@/stores/pipelineLayoutStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { PipelineEdge, PipelineNode } from '@/types'

/**
 * Hook to sync pipeline state between Zustand and Convex.
 * Only active when sessionId is provided (connected mode).
 */
export function useConvexSync(sessionId: Id<'sessions'> | null) {
  const isInitialSync = useRef(true)
  const lastSyncedNodes = useRef<string | null>(null)
  const lastSyncedEdges = useRef<string | null>(null)

  // Convex queries (reactive)
  const remoteNodes = useQuery(api.nodes.list, sessionId ? { sessionId } : 'skip')
  const remoteEdges = useQuery(api.edges.list, sessionId ? { sessionId } : 'skip')

  // Convex mutations
  const upsertNode = useMutation(api.nodes.upsert)
  const removeNode = useMutation(api.nodes.remove)
  const updateNodePosition = useMutation(api.nodes.updatePosition)
  const upsertEdge = useMutation(api.edges.upsert)
  const removeEdge = useMutation(api.edges.remove)
  const bulkUpsertEdges = useMutation(api.edges.bulkUpsert)

  // Sync remote -> local (when remote data changes)
  useEffect(() => {
    if (!sessionId || !remoteNodes || !remoteEdges) return

    // Create fingerprints to detect actual changes
    const nodesFingerprint = JSON.stringify([...remoteNodes.map((n) => [n.nodeId, n.updatedAt])].sort())
    const edgesFingerprint = JSON.stringify([...remoteEdges.map((e) => e.edgeId)].sort())

    // Skip if nothing changed
    if (nodesFingerprint === lastSyncedNodes.current && edgesFingerprint === lastSyncedEdges.current) {
      return
    }

    lastSyncedNodes.current = nodesFingerprint
    lastSyncedEdges.current = edgesFingerprint

    // Convert remote format to local format
    const nodes: Record<string, PipelineNode> = {}
    const layoutUpdates: Record<string, { position: { x: number; y: number } }> = {}
    for (const node of remoteNodes) {
      nodes[node.nodeId] = node.data
      layoutUpdates[node.nodeId] = { position: node.position }
    }

    const edges: PipelineEdge[] = remoteEdges.map((e) => ({
      id: e.edgeId,
      sourceId: e.sourceId,
      targetId: e.targetId,
    }))

    // Update local store
    const store = usePipelineStore.getState()

    // Only do initial sync on first load
    if (isInitialSync.current) {
      isInitialSync.current = false
      store.setRemoteState?.({ nodes, edges })
    } else {
      // Merge remote changes (remote wins for conflicts)
      store.mergeRemoteState?.({ nodes, edges })
    }
    usePipelineLayoutStore.getState().setNodesLayout(layoutUpdates)
  }, [sessionId, remoteNodes, remoteEdges])

  // Sync local -> remote
  const syncNode = useCallback(
    async (node: PipelineNode) => {
      if (!sessionId) return

      await upsertNode({
        sessionId,
        nodeId: node.id,
        type: node.type as 'dataset' | 'view' | 'chart' | 'export',
        data: node,
        position: usePipelineLayoutStore.getState().nodes[node.id]?.position ?? { x: 0, y: 0 },
      })
    },
    [sessionId, upsertNode]
  )

  const syncNodePosition = useCallback(
    async (nodeId: string, position: { x: number; y: number }) => {
      if (!sessionId) return

      await updateNodePosition({
        sessionId,
        nodeId,
        position,
      })
    },
    [sessionId, updateNodePosition]
  )

  const syncRemoveNode = useCallback(
    async (nodeId: string) => {
      if (!sessionId) return

      await removeNode({
        sessionId,
        nodeId,
      })
    },
    [sessionId, removeNode]
  )

  const syncEdge = useCallback(
    async (edge: PipelineEdge) => {
      if (!sessionId) return

      await upsertEdge({
        sessionId,
        edgeId: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      })
    },
    [sessionId, upsertEdge]
  )

  const syncRemoveEdge = useCallback(
    async (edgeId: string) => {
      if (!sessionId) return

      await removeEdge({
        sessionId,
        edgeId,
      })
    },
    [sessionId, removeEdge]
  )

  const syncAllEdges = useCallback(
    async (edges: PipelineEdge[]) => {
      if (!sessionId) return

      await bulkUpsertEdges({
        sessionId,
        edges: edges.map((e) => ({
          edgeId: e.id,
          sourceId: e.sourceId,
          targetId: e.targetId,
        })),
      })
    },
    [sessionId, bulkUpsertEdges]
  )

  return {
    isLoaded: !!remoteNodes && !!remoteEdges,
    isConnected: !!sessionId,
    syncNode,
    syncNodePosition,
    syncRemoveNode,
    syncEdge,
    syncRemoveEdge,
    syncAllEdges,
  }
}
