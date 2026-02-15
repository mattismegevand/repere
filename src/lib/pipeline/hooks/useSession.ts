import { useCallback, useEffect, useRef } from 'react'
import { computeFileHash } from '@/lib/file-system'
import { isNativeRuntime } from '@/lib/runtime'
import { canUseFileHandles, resolveSession } from '@/lib/sessions/recentSessions'
import type { RecentSessionEntry, SessionPreview } from '@/lib/sessions/types'
import {
  clearDraft,
  clearPendingSession,
  hasDraft,
  hasPendingSession,
  loadDraft,
  loadPendingSession,
  saveFileHandle,
  savePendingSession,
  saveSessionBlob,
} from '@/lib/storage/idb'
import { generateShareableUrl, type UrlShareResult } from '@/lib/url-sharing'
import { usePanelStore } from '@/stores/panelStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import { type DatasetRestorationInfo, type RestorationState, usePipelineUiStore } from '@/stores/pipelineUiStore'
import { usePipelineServiceOptional } from '../PipelineProvider'
import {
  deserializeSession,
  downloadSession,
  filterSessionBySkippedNodes,
  pickSessionFile,
  type SchemaValidationResult,
  type SessionData,
  serializeSession,
  validateSchema,
} from '../persistence'

export function useSession() {
  const service = usePipelineServiceOptional()
  const updateDatasetRestoration = usePipelineUiStore((s) => s.updateDatasetRestoration)
  const nodes = usePipelineStore((s) => s.nodes)
  const edges = usePipelineStore((s) => s.edges)
  const activeNodeId = usePipelineStore((s) => s.activeNodeId)
  const openNodeIds = usePipelineStore((s) => s.openNodeIds)

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ============================================
  // EXPORT / LOAD
  // ============================================

  const exportSession = useCallback(async () => {
    if (!service) return

    const state = usePipelineStore.getState()
    try {
      const blob = await serializeSession(
        service.client,
        state.nodes,
        state.edges,
        state.activeNodeId,
        state.openNodeIds
      )
      const currentNode = state.activeNodeId ? state.nodes[state.activeNodeId] : null
      const filename = currentNode?.name ? `${currentNode.name}.repere` : 'session.repere'

      // Get or generate session ID for this export
      let sessionId = usePipelineUiStore.getState().currentSessionId
      if (!sessionId) {
        sessionId = usePipelineUiStore.getState().generateNewSessionId()
        usePanelStore.getState().setCurrentSessionId(sessionId)
      }

      // Extract preview info from pipeline
      const nodes = Object.values(state.nodes)
      const preview: SessionPreview = {
        datasets: nodes.filter((n) => n.type === 'dataset').map((n) => n.name),
        viewCount: nodes.filter((n) => n.type === 'view').length,
      }

      // Save blob to IDB for recent session access
      await saveSessionBlob(sessionId, blob)

      if (isNativeRuntime()) {
        // Desktop: save to file system
        const savedPath = await downloadSession(blob, filename)
        if (savedPath) {
          usePanelStore.getState().addRecentSession({
            ref: { sessionId, path: savedPath },
            name: filename.replace(/\.repere$/, ''),
            openedAt: Date.now(),
            size: blob.size,
            preview,
          })
        }
      } else if (canUseFileHandles()) {
        // Web with File System Access API
        try {
          const handle = await window.showSaveFilePicker!({
            suggestedName: filename,
            types: [{ description: 'repere Session', accept: { 'application/octet-stream': ['.repere'] } }],
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()

          const handleId = crypto.randomUUID()
          try {
            await saveFileHandle(handleId, handle)
            usePanelStore.getState().addRecentSession({
              ref: { sessionId, handleId },
              name: handle.name.replace(/\.repere$/, ''),
              openedAt: Date.now(),
              size: blob.size,
              preview,
            })
          } catch (idbErr) {
            console.warn('Failed to save file handle to IDB:', idbErr)
            // Fall back to just sessionId ref
            usePanelStore.getState().addRecentSession({
              ref: { sessionId },
              name: filename.replace(/\.repere$/, ''),
              openedAt: Date.now(),
              size: blob.size,
              preview,
            })
          }
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            console.warn('File System Access API failed, falling back to download:', err)
            downloadSession(blob, filename)
          }
          // Update recent session without file handle
          usePanelStore.getState().addRecentSession({
            ref: { sessionId },
            name: filename.replace(/\.repere$/, ''),
            openedAt: Date.now(),
            size: blob.size,
            preview,
          })
        }
      } else {
        // Fallback: download file
        downloadSession(blob, filename)
        usePanelStore.getState().addRecentSession({
          ref: { sessionId },
          name: filename.replace(/\.repere$/, ''),
          openedAt: Date.now(),
          size: blob.size,
          preview,
        })
      }
    } catch (err) {
      console.error('Failed to export session:', err)
    }
  }, [service])

  const generateShareUrl = useCallback(
    async (embedDatasetIds: Set<string>): Promise<UrlShareResult> => {
      if (!service) {
        return { success: false, error: 'Service not ready' }
      }

      const state = usePipelineStore.getState()
      try {
        const blob = await serializeSession(
          service.client,
          state.nodes,
          state.edges,
          state.activeNodeId,
          state.openNodeIds,
          {
            embeddingMode: 'custom',
            embedDatasetIds,
          }
        )
        return generateShareableUrl(blob)
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to generate URL',
        }
      }
    },
    [service]
  )

  const loadSession = useCallback(
    async (
      file?: File
    ): Promise<{ success: boolean; needsFiles?: boolean; requiredFiles?: SessionData['requiredFiles'] }> => {
      if (!service) return { success: false }

      try {
        const sessionFile = file ?? (await pickSessionFile())
        if (!sessionFile) return { success: false }

        // Deserialize the ZIP file
        const sessionData = await deserializeSession(sessionFile)

        if (sessionData.requiredFiles.length > 0) {
          // Store the blob for later restoration
          usePipelineUiStore.getState().enterLoadingMode(sessionData, new Map())
          await savePendingSession(sessionFile)
          return { success: false, needsFiles: true, requiredFiles: sessionData.requiredFiles }
        }

        await clearAllAndRestore(sessionData)
        await clearDraft()
        return { success: true }
      } catch (err) {
        console.error('Failed to load session:', err)
        return { success: false }
      }
    },
    [service]
  )

  const openRecentSession = useCallback(
    async (
      entry: RecentSessionEntry
    ): Promise<{
      success: boolean
      error?: 'not-found' | 'permission-denied' | 'corrupted' | 'needs-files'
    }> => {
      const result = await resolveSession(entry.ref)

      if ('error' in result) {
        usePanelStore.getState().removeRecentSession(entry.id)
        return { success: false, error: result.error }
      }

      const file = new File([result.blob], entry.name, { type: 'application/octet-stream' })
      const loadResult = await loadSession(file)

      if (loadResult.needsFiles) {
        return { success: false, error: 'needs-files' }
      }

      if (!loadResult.success) {
        return { success: false, error: 'corrupted' }
      }

      // Set the current session ID to continue updating the same session
      if (entry.ref.sessionId) {
        usePipelineUiStore.getState().setCurrentSessionId(entry.ref.sessionId)
        usePanelStore.getState().setCurrentSessionId(entry.ref.sessionId)
      }

      // Update timestamp
      usePanelStore.getState().updateRecentSessionTimestamp(entry.id)
      return { success: true }
    },
    [loadSession]
  )

  // ============================================
  // RESTORATION MODE
  // ============================================

  const startRestorationMode = useCallback((session: SessionData) => {
    const datasets = new Map<string, DatasetRestorationInfo>()

    for (const node of Object.values(session.nodes)) {
      if (node.type === 'dataset') {
        const isEmbedded = session.embeddedFiles.has(node.id)
        const requiredFile = session.requiredFiles.find((r) => r.nodeId === node.id)

        datasets.set(node.id, {
          nodeId: node.id,
          fileName: node.fileName,
          status: isEmbedded ? 'embedded' : 'required',
          expectedColumns: requiredFile?.expectedColumns ?? node.columns,
          expectedHash: requiredFile?.fileHash ?? node.fileHash,
        })
      }
    }

    const restorationState: RestorationState = {
      session,
      datasets,
      skippedDatasets: new Set(),
    }

    usePipelineUiStore.getState().enterRestorationMode(restorationState)
  }, [])

  const provideFileForRestoration = useCallback(
    async (nodeId: string, file: File): Promise<SchemaValidationResult> => {
      if (!service) {
        return { valid: false, missingColumns: [], typeMismatches: [] }
      }

      const restorationState = usePipelineUiStore.getState().restorationState
      if (!restorationState) {
        return { valid: false, missingColumns: [], typeMismatches: [] }
      }

      const datasetInfo = restorationState.datasets.get(nodeId)
      if (!datasetInfo || datasetInfo.status === 'embedded') {
        return { valid: false, missingColumns: [], typeMismatches: [] }
      }

      updateDatasetRestoration(nodeId, { status: 'validating', file })

      try {
        const fileColumns = await service.extractFileSchema(file)
        const result = validateSchema(fileColumns, datasetInfo.expectedColumns)

        if (result.valid) {
          let isExactMatch = false
          if (datasetInfo.expectedHash) {
            const providedHash = await computeFileHash(file)
            isExactMatch = providedHash === datasetInfo.expectedHash
          }

          updateDatasetRestoration(nodeId, {
            status: 'provided',
            file,
            validationResult: result,
            isExactMatch,
          })
        } else {
          updateDatasetRestoration(nodeId, {
            status: 'error',
            file,
            validationResult: result,
          })
        }

        return result
      } catch {
        const errorResult: SchemaValidationResult = {
          valid: false,
          missingColumns: [],
          typeMismatches: [],
        }
        updateDatasetRestoration(nodeId, {
          status: 'error',
          file,
          validationResult: errorResult,
        })
        return errorResult
      }
    },
    [service, updateDatasetRestoration]
  )

  const completeRestoration = useCallback(async (): Promise<boolean> => {
    if (!service) return false

    const currentRestorationState = usePipelineUiStore.getState().restorationState
    if (!currentRestorationState) return false

    const providedFiles = new Map<string, File>()
    const placeholderIds = new Set(currentRestorationState.skippedDatasets)

    for (const [nodeId, info] of currentRestorationState.datasets) {
      if (info.status === 'provided' && info.file) {
        providedFiles.set(nodeId, info.file)
      } else if (info.status === 'required' && !placeholderIds.has(nodeId)) {
        console.error(`Missing file for dataset: ${info.fileName}`)
        return false
      }
    }

    try {
      await clearAllAndRestore(currentRestorationState.session, providedFiles, placeholderIds)
      usePipelineUiStore.getState().exitRestorationMode()
      await clearDraft()
      await clearPendingSession()
      return true
    } catch (err) {
      console.error('Failed to restore session:', err)
      return false
    }
  }, [service])

  const cancelRestoration = useCallback(async () => {
    usePipelineUiStore.getState().exitRestorationMode()
    await clearPendingSession()
  }, [])

  const isRestorationReady = useCallback((): boolean => {
    const restorationState = usePipelineUiStore.getState().restorationState
    if (!restorationState) return false

    for (const [nodeId, info] of restorationState.datasets) {
      if (info.status === 'embedded') continue
      if (restorationState.skippedDatasets.has(nodeId)) continue
      if (info.status === 'required' || info.status === 'validating' || info.status === 'error') {
        return false
      }
    }

    return true
  }, [])

  const getRestorationProgress = useCallback((): { provided: number; required: number } => {
    const restorationState = usePipelineUiStore.getState().restorationState
    if (!restorationState) return { provided: 0, required: 0 }

    let provided = 0
    let required = 0

    for (const [nodeId, info] of restorationState.datasets) {
      if (info.status === 'embedded') continue
      if (restorationState.skippedDatasets.has(nodeId)) continue

      required++
      if (info.status === 'provided') {
        provided++
      }
    }

    return { provided, required }
  }, [])

  // ============================================
  // DRAFT RECOVERY
  // ============================================

  const checkForDraft = useCallback(async (): Promise<boolean> => {
    return hasDraft()
  }, [])

  const getDraftInfo = useCallback(async (): Promise<SessionData | null> => {
    const draftBlob = await loadDraft()
    if (!draftBlob) return null
    return deserializeSession(draftBlob)
  }, [])

  const recoverDraft = useCallback(
    async (providedFiles?: Map<string, File>, skippedIds?: Set<string>): Promise<boolean> => {
      if (!service) return false

      const draftBlob = await loadDraft()
      if (!draftBlob) return false

      try {
        let draft = await deserializeSession(draftBlob)

        if (skippedIds && skippedIds.size > 0) {
          draft = filterSessionBySkippedNodes(draft, skippedIds)
        }

        if (Object.keys(draft.nodes).length === 0) {
          await clearDraft()
          return true
        }

        await clearAllAndRestore(draft, providedFiles ?? new Map())
        await clearDraft()
        return true
      } catch (err) {
        console.error('Failed to recover draft:', err)
        await clearDraft()
        return false
      }
    },
    [service]
  )

  const discardDraft = useCallback(async (): Promise<void> => {
    await clearDraft()
  }, [])

  // ============================================
  // PENDING SESSION
  // ============================================

  const checkForPendingSession = useCallback(async (): Promise<boolean> => {
    return hasPendingSession()
  }, [])

  const getPendingSessionInfo = useCallback(async (): Promise<SessionData | null> => {
    const pendingBlob = await loadPendingSession()
    if (!pendingBlob) return null
    return deserializeSession(pendingBlob)
  }, [])

  const restorePendingSession = useCallback(async (blob: Blob): Promise<void> => {
    const data = await deserializeSession(blob)
    usePipelineUiStore.getState().enterLoadingMode(data, new Map())
  }, [])

  const continuePendingSession = useCallback(
    async (providedFiles: Map<string, File>, skippedIds: Set<string>): Promise<boolean> => {
      if (!service) return false

      const pendingSession = usePipelineUiStore.getState().pendingSession
      if (!pendingSession) return false

      let data = pendingSession.data

      if (skippedIds.size > 0) {
        data = filterSessionBySkippedNodes(data, skippedIds)
      }

      if (Object.keys(data.nodes).length === 0) {
        usePipelineUiStore.getState().exitLoadingMode()
        await clearPendingSession()
        return true
      }

      for (const req of data.requiredFiles) {
        if (!providedFiles.has(req.nodeId)) {
          console.error(`Missing file: ${req.fileName}`)
          return false
        }
      }

      try {
        await clearAllAndRestore(data, providedFiles)
        await clearDraft()
        await clearPendingSession()
        usePipelineUiStore.getState().exitLoadingMode()
        return true
      } catch (err) {
        console.error('Failed to restore session:', err)
        return false
      }
    },
    [service]
  )

  const cancelPendingSession = useCallback(async () => {
    usePipelineUiStore.getState().exitLoadingMode()
    await clearPendingSession()
  }, [])

  // ============================================
  // AUTO-SAVE
  // ============================================

  const performSave = useCallback(async () => {
    if (!service) return

    const state = usePipelineStore.getState()
    if (Object.keys(state.nodes).length === 0) return

    try {
      const blob = await serializeSession(
        service.client,
        state.nodes,
        state.edges,
        state.activeNodeId,
        state.openNodeIds
      )

      // Get or generate session ID
      // First check pipelineStore (in-memory), then panelStore (persisted)
      let sessionId = usePipelineUiStore.getState().currentSessionId
      if (!sessionId) {
        sessionId = usePanelStore.getState().currentSessionId
        if (sessionId) {
          // Restore the persisted session ID to pipelineStore
          usePipelineUiStore.getState().setCurrentSessionId(sessionId)
        }
      }
      if (!sessionId) {
        sessionId = usePipelineUiStore.getState().generateNewSessionId()
        // Also persist to panelStore
        usePanelStore.getState().setCurrentSessionId(sessionId)
      }

      // Save to IDB using sessionId as key
      await saveSessionBlob(sessionId, blob)

      // Update recent session entry
      const nodes = Object.values(state.nodes)
      const currentNode = state.activeNodeId ? state.nodes[state.activeNodeId] : null
      const preview: SessionPreview = {
        datasets: nodes.filter((n) => n.type === 'dataset').map((n) => n.name),
        viewCount: nodes.filter((n) => n.type === 'view').length,
      }
      usePanelStore.getState().addRecentSession({
        ref: { sessionId },
        name: currentNode?.name ?? preview.datasets[0] ?? 'Session',
        openedAt: Date.now(),
        size: blob.size,
        preview,
      })
    } catch (err) {
      console.warn('Auto-save failed:', err)
    }
  }, [service])

  const forceSave = useCallback(async () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }
    await performSave()
  }, [performSave])

  // Auto-save effect
  useEffect(() => {
    const state = usePipelineStore.getState()
    if (!service || Object.keys(state.nodes).length === 0) return

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(performSave, 5000)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [service, nodes, edges, activeNodeId, openNodeIds, performSave])

  // ============================================
  // INTERNAL HELPERS
  // ============================================

  const clearAllAndRestore = useCallback(
    async (data: SessionData, providedFiles?: Map<string, File>, placeholderIds?: Set<string>) => {
      if (!service) throw new Error('Service not ready')

      const state = usePipelineStore.getState()
      await service.clearAll(state.nodes)

      const restoredNodes = await service.restoreSession(data, providedFiles ?? new Map(), placeholderIds ?? new Set())

      usePipelineStore.setState({
        nodes: restoredNodes,
        edges: data.edges,
        activeNodeId: data.activeNodeId,
        selectedNodeId: data.activeNodeId,
        openNodeIds: data.openNodeIds,
        loading: false,
        error: null,
      })
    },
    [service]
  )

  return {
    // Export/Load
    exportSession,
    loadSession,
    openRecentSession,
    generateShareUrl,

    // Restoration mode
    startRestorationMode,
    provideFileForRestoration,
    completeRestoration,
    cancelRestoration,
    isRestorationReady,
    getRestorationProgress,

    // Draft recovery
    checkForDraft,
    getDraftInfo,
    recoverDraft,
    discardDraft,

    // Pending session
    checkForPendingSession,
    getPendingSessionInfo,
    restorePendingSession,
    continuePendingSession,
    cancelPendingSession,

    // Auto-save
    forceSave,
  }
}
