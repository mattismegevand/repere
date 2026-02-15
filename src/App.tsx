import { useCallback, useEffect, useRef, useState } from 'react'
import { AddColumnDialog } from '@/components/add-column-dialog'
import { AIChat } from '@/components/ai-chat'
import { AppBar } from '@/components/app-bar'
import { BranchDecisionDialog } from '@/components/branch-decision'
import { ChartModal } from '@/components/chart-modal'
import { ChartConfigPopover } from '@/components/chart-popover'
import { CommandPalette } from '@/components/command-palette'
import { DeleteNodeDialog } from '@/components/confirm-dialog'
import { DashboardView } from '@/components/dashboard'
import { DataGrid } from '@/components/data-grid'
import { ExportDialog } from '@/components/export-dialog'
import { FilterEditorDialog } from '@/components/filter-editor'
import { Homepage } from '@/components/homepage'
import { JoinDialog } from '@/components/join-dialog'
import { LoadSessionDialog } from '@/components/load-session-dialog'
import { MobileBlocker } from '@/components/mobile-blocker'
import { OnboardingTour } from '@/components/onboarding-tour'
import { OperationTrail } from '@/components/operation-trail'
import { PipelineCanvas } from '@/components/pipeline-canvas'
import { PivotPanel, PivotPreview } from '@/components/pivot-panel'
import { PivotNodeView } from '@/components/pivot-table'
import { ProfilePanel } from '@/components/profiling'
import { PythonPanel } from '@/components/python-panel'
import { RestorationDialog } from '@/components/restoration-dialog'
import { ShareUrlDialog } from '@/components/share-url-dialog'
import { ShortcutCheatsheet } from '@/components/shortcut-cheatsheet'
import { SqlPanel } from '@/components/sql-panel'
import { StatusBar } from '@/components/status-bar'
import { TabBar } from '@/components/tab-bar'
import { UnionDialog } from '@/components/union-dialog'
import { WindowDialog } from '@/components/window-dialog'
import { isSessionFile, pickedFileToFile, pickFiles } from '@/lib/file-system'
import { useCanvasToggle } from '@/lib/hooks/useCanvasToggle'
import { usePipeline } from '@/lib/pipeline'
import { deserializeSession } from '@/lib/pipeline/persistence'
import { isModKey, isTauri } from '@/lib/platform'
import { clearUrlHash, hasUrlSession, parseUrlSession } from '@/lib/url-sharing'
import { useDialogStore } from '@/stores/dialogStore'
import { usePanelStore } from '@/stores/panelStore'
import { useTheme } from '@/themes'

export default function App() {
  const {
    serviceReady,
    activeNode,
    activeNodeId,
    openNodeIds,
    setActiveNode,
    loading,
    error,
    successMessage,
    loadDataset,
    loadDatasetFromPicked,
    loadSession,
    exportSession,
    undo,
    redo,
    canUndo,
    canRedo,
    checkForDraft,
    getDraftInfo,
    recoverDraft,
    discardDraft,
    checkForPendingSession,
    getPendingSessionInfo,
    pendingSession,
    forceSave,
    getDatasets,
    generateShareUrl,
    // Visual restoration mode
    restorationState,
    startRestorationMode,
    completeRestoration,
    cancelRestoration,
    deleteNode,
  } = usePipeline()
  const activeDialog = useDialogStore((s) => s.activeDialog)
  const openDialog = useDialogStore((s) => s.openDialog)
  const closeDialog = useDialogStore((s) => s.closeDialog)
  const setCommandPalette = usePanelStore((s) => s.setCommandPalette)
  const activeEditingPanel = usePanelStore((s) => s.activeEditingPanel)
  const setFilterEditor = usePanelStore((s) => s.setFilterEditor)
  const toggleSqlPanel = usePanelStore((s) => s.toggleSqlPanel)
  const showHomepage = usePanelStore((s) => s.showHomepage)
  const setShowHomepage = usePanelStore((s) => s.setShowHomepage)
  const toggleProfile = usePanelStore((s) => s.toggleProfile)
  const setCanvasMode = usePanelStore((s) => s.setCanvasMode)

  // Derive panel states from discriminated union
  const pivotPanelOpen = activeEditingPanel.type === 'pivot'
  const filterEditorOpen = activeEditingPanel.type === 'filter'
  const chartPanelOpen = activeEditingPanel.type === 'chart'
  const {
    isCanvasMode,
    toggleCanvasMode,
    showBranchDialog: showCanvasBranchDialog,
    handleBranchDecisionComplete: handleCanvasBranchDecisionComplete,
  } = useCanvasToggle()
  const { structureStyle } = useTheme() // Apply theme to document
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  // Track recovery state to prevent UI flashing during startup
  const [isRecovering, setIsRecovering] = useState(true)
  const hasCheckedSavedState = useRef(false)

  useEffect(() => {
    if (!serviceReady) return
    if (hasCheckedSavedState.current) return
    hasCheckedSavedState.current = true

    const checkSavedState = async () => {
      try {
        // Skip auto-restoration - user picks sessions from recent sessions list
        // Only exception: URL sessions (shared links) should auto-restore on web

        // Check for URL session (web only - shared link)
        if (!isTauri() && hasUrlSession()) {
          const urlBlob = parseUrlSession()
          if (urlBlob) {
            clearUrlHash()
            try {
              const sessionData = await deserializeSession(urlBlob)
              startRestorationMode(sessionData)
              return // Keep isRecovering true - restoration dialog handles it
            } catch (err) {
              console.error('Failed to parse URL session:', err)
            }
          }
          clearUrlHash()
        }

        // No auto-restore - user picks from recent sessions
      } catch (err) {
        console.error('Failed to check saved state:', err)
      } finally {
        setIsRecovering(false)
      }
    }
    checkSavedState()
  }, [
    serviceReady,
    checkForDraft,
    getDraftInfo,
    checkForPendingSession,
    getPendingSessionInfo,
    startRestorationMode,
    recoverDraft,
    forceSave,
    discardDraft,
    setCanvasMode,
  ])

  // Restoration dialog handlers
  const handleRestorationComplete = useCallback(async () => {
    await completeRestoration()
    await forceSave()
    setCanvasMode(true)
    setIsRecovering(false)
  }, [completeRestoration, forceSave, setCanvasMode])

  const handleRestorationCancel = useCallback(async () => {
    await cancelRestoration()
    setIsRecovering(false)
  }, [cancelRestoration])

  const handleRestorationDiscard = useCallback(async () => {
    await discardDraft()
    await cancelRestoration()
    setIsRecovering(false)
  }, [discardDraft, cancelRestoration])

  const handleSkipMissing = useCallback(async () => {
    await completeRestoration()
    await forceSave()
    setCanvasMode(true)
    setIsRecovering(false)
  }, [completeRestoration, forceSave, setCanvasMode])

  // Delete confirmation handlers
  const handleConfirmDelete = useCallback(async () => {
    if (activeDialog?.type !== 'deleteConfirm' || activeDialog.nodeIds.length === 0) return
    // Delete nodes in sequence (each delete may cascade)
    for (const nodeId of activeDialog.nodeIds) {
      await deleteNode(nodeId)
    }
    closeDialog()
  }, [activeDialog, deleteNode, closeDialog])

  const handleCancelDelete = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  const handleOpenFile = useCallback(async () => {
    const pickedFiles = await pickFiles()
    if (!pickedFiles.length) return
    const picked = pickedFiles[0]

    if (isSessionFile(picked)) {
      // Session files need to be read as File objects for JSON parsing
      const file = await pickedFileToFile(picked)
      const result = await loadSession(file)
      if (result.needsFiles) {
        const text = await file.text()
        const data = JSON.parse(text)
        startRestorationMode(data)
      }
    } else {
      // Data files can be loaded efficiently via path in Tauri mode
      const dataset = await loadDatasetFromPicked(picked)
      if (dataset) {
        await forceSave()
      }
    }
  }, [loadDatasetFromPicked, loadSession, startRestorationMode, forceSave])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      // Separate session files from data files
      const sessionFiles = files.filter((f) => f.name.toLowerCase().endsWith('.repere'))
      const dataFiles = files.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase()
        return ['csv', 'json', 'jsonl', 'parquet', 'xlsx'].includes(ext ?? '')
      })

      // Handle session file (only one allowed)
      if (sessionFiles.length > 0) {
        const file = sessionFiles[0]
        const result = await loadSession(file)
        if (result.needsFiles) {
          const text = await file.text()
          const data = JSON.parse(text)
          startRestorationMode(data)
        }
        return // Don't load data files when loading a session
      }

      // Handle data files (multiple allowed)
      let firstDataset = null
      for (const file of dataFiles) {
        const dataset = await loadDataset(file)
        if (dataset && !firstDataset) {
          firstDataset = dataset
        }
      }

      if (firstDataset) {
        setActiveNode(firstDataset.id)
        setShowHomepage(false)
        setCanvasMode(true)
        await forceSave()
      }
    },
    [loadDataset, loadSession, startRestorationMode, forceSave, setActiveNode, setShowHomepage, setCanvasMode]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Only prevent default for file drags (not internal column reordering)
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
    }
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    // Only show drop overlay for file drags (not internal column reordering)
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only handle file drags (not internal column reordering)
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip global shortcuts when a Radix dialog is open (focus is trapped there)
      const isDialogOpen = document.querySelector('[data-radix-dialog-content]')
      if (isDialogOpen) return

      if (isModKey(e) && e.key === 'o') {
        e.preventDefault()
        handleOpenFile()
      }
      // Auto-save: Cmd+S (immediate save to workspace)
      if (isModKey(e) && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        forceSave()
      }
      // Export session file: Cmd+Shift+S
      if (isModKey(e) && e.key === 's' && e.shiftKey) {
        e.preventDefault()
        exportSession()
      }
      // Undo: Cmd+Z
      if (isModKey(e) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) undo()
      }
      // Redo: Cmd+Shift+Z
      if (isModKey(e) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        if (canRedo) redo()
      }
      // Shortcut cheatsheet: Cmd+? or just ?
      if ((isModKey(e) && e.key === '/') || e.key === '?') {
        const target = e.target as HTMLElement
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        if (!isInput) {
          e.preventDefault()
          openDialog({ type: 'shortcutCheatsheet' })
        }
      }
      // SQL panel: Cmd+`
      if (isModKey(e) && e.key === '`') {
        e.preventDefault()
        toggleSqlPanel()
      }
      // Profile panel: Cmd+Shift+P
      if (isModKey(e) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        toggleProfile()
      }
      // Tab: Toggle canvas/table view (only when data is loaded and not in input)
      if (e.key === 'Tab' && activeNodeId && !showHomepage) {
        const target = e.target as HTMLElement
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        if (!isInput) {
          e.preventDefault()
          toggleCanvasMode()
        }
      }
      // Tab navigation: Cmd+[ for previous tab, Cmd+] for next tab
      if (isModKey(e) && (e.key === '[' || e.key === ']') && openNodeIds.length > 1) {
        e.preventDefault()
        const currentIndex = activeNodeId ? openNodeIds.indexOf(activeNodeId) : -1
        if (currentIndex !== -1) {
          const newIndex =
            e.key === '['
              ? (currentIndex - 1 + openNodeIds.length) % openNodeIds.length
              : (currentIndex + 1) % openNodeIds.length
          setActiveNode(openNodeIds[newIndex])
        }
      }
      // Jump to tab by number: 1-9 (without Cmd)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key >= '1' && e.key <= '9' && openNodeIds.length > 0) {
        const target = e.target as HTMLElement
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        if (!isInput) {
          const tabIndex = parseInt(e.key, 10) - 1
          if (tabIndex < openNodeIds.length) {
            e.preventDefault()
            setActiveNode(openNodeIds[tabIndex])
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    handleOpenFile,
    forceSave,
    exportSession,
    undo,
    redo,
    canUndo,
    canRedo,
    openDialog,
    toggleSqlPanel,
    toggleProfile,
    activeNodeId,
    showHomepage,
    toggleCanvasMode,
    openNodeIds,
    setActiveNode,
  ])

  function renderMainContent(): React.ReactNode {
    const showData = activeNodeId && !showHomepage

    // Show homepage/recent sessions immediately (they handle their own loading states)
    // Only block on isRecovering when we have data to show
    if (!showData) {
      // Unified homepage with recent sessions integrated
      return (
        <div key="homepage" className="h-full animate-view-enter">
          <Homepage isDragOver={isDragOver} />
        </div>
      )
    }

    // Show nothing during initial recovery to prevent flashing (only when we have data)
    if (isRecovering || restorationState) {
      return <div className="h-full" />
    }

    if (isCanvasMode) {
      return (
        <div
          key="canvas"
          className="h-full border border-[var(--color-border)] rounded-lg overflow-hidden animate-view-enter"
        >
          <PipelineCanvas />
        </div>
      )
    }

    // Show pivot preview when pivot panel is open
    if (pivotPanelOpen) {
      return (
        <div key="pivot-preview" className="h-full animate-view-enter">
          <PivotPreview />
        </div>
      )
    }

    // Check if active node is a pivot node (includes group-by mode)
    const isPivot = activeNode?.type === 'view' && activeNode.operation.type === 'pivot'

    if (isPivot) {
      return (
        <div
          key="pivot"
          className="h-full border border-[var(--color-border)] rounded-lg overflow-hidden flex flex-col animate-view-enter"
        >
          <TabBar />
          <OperationTrail />
          <div className="flex-1 overflow-hidden">
            <PivotNodeView />
          </div>
        </div>
      )
    }

    return (
      <div
        key="grid"
        className="h-full border border-[var(--color-border)] rounded-lg overflow-hidden flex flex-col animate-view-enter"
      >
        <TabBar />
        <OperationTrail />
        <div className="flex-1 overflow-hidden">
          <DataGrid />
        </div>
      </div>
    )
  }

  // Show mobile blocker only when user has entered the app (data loaded, not on homepage)
  const inApp = !!activeNodeId && !showHomepage

  return (
    <MobileBlocker active={inApp}>
      <div
        className="h-full flex flex-col bg-[var(--color-bg-primary)] relative overflow-hidden"
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drop overlay - only show when in app (homepage has its own drop zone visual) */}
        {isDragOver && inApp && (
          <div className="absolute inset-0 z-50 bg-[var(--color-accent)]/10 border-2 border-dashed border-[var(--color-accent)] flex items-center justify-center pointer-events-none rounded-lg m-2">
            <div className="bg-[var(--color-bg-primary)] px-6 py-4 rounded-xl shadow-lg border border-[var(--color-border)]">
              <span className="text-lg font-medium text-[var(--color-accent)]">Drop files to load</span>
            </div>
          </div>
        )}
        {/* Header */}
        <AppBar
          loading={loading}
          onOpenFile={handleOpenFile}
          onLoadSession={() => openDialog({ type: 'loadSession' })}
          onOpenCommandPalette={() => setCommandPalette(true)}
        />

        {/* Error bar */}
        {error && (
          <div className="px-4 py-2 bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm border-b border-[var(--color-error)]/20">
            {error}
          </div>
        )}

        {/* Success message bar */}
        {successMessage && (
          <div className="px-4 py-2 bg-[var(--color-success-bg)] text-[var(--color-success)] text-sm border-b border-[var(--color-success)]/20">
            {successMessage}
          </div>
        )}

        {/* Main content */}
        <main className={`flex-1 overflow-hidden flex relative ${structureStyle === 'classic' ? '' : 'p-2'}`}>
          <div
            className={`flex-1 transition-opacity duration-300 ease-out ${inApp ? 'overflow-hidden' : 'overflow-auto'} ${loading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {renderMainContent()}
          </div>
          {pivotPanelOpen ? <PivotPanel /> : null}
          <ProfilePanel />
          <AIChat />
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30 animate-fade-in">
              <div className="flex items-center gap-3 px-5 py-3 bg-[var(--color-bg-secondary)] rounded-xl shadow-lg border border-[var(--color-border)]">
                <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[var(--color-text-primary)]">Loading...</span>
              </div>
            </div>
          )}
        </main>

        {/* SQL Panel - in flow, not overlapping */}
        <SqlPanel />
        <PythonPanel />

        {/* Status bar */}
        {activeNodeId && !showHomepage ? <StatusBar /> : null}
      </div>
      <CommandPalette />
      {activeDialog?.type === 'join' ? <JoinDialog onClose={closeDialog} /> : null}
      {activeDialog?.type === 'union' ? <UnionDialog onClose={closeDialog} /> : null}
      {activeDialog?.type === 'addColumn' ? <AddColumnDialog onClose={closeDialog} /> : null}
      {activeDialog?.type === 'window' ? <WindowDialog /> : null}
      {filterEditorOpen ? <FilterEditorDialog onClose={() => setFilterEditor(false)} /> : null}
      {showCanvasBranchDialog ? <BranchDecisionDialog onComplete={handleCanvasBranchDecisionComplete} /> : null}
      {activeDialog?.type === 'loadSession' || pendingSession ? <LoadSessionDialog onClose={closeDialog} /> : null}
      {activeDialog?.type === 'shortcutCheatsheet' ? <ShortcutCheatsheet onClose={closeDialog} /> : null}
      {restorationState && (
        <RestorationDialog
          mode="partial"
          restorationState={restorationState}
          onCancel={handleRestorationCancel}
          onDiscard={handleRestorationDiscard}
          onComplete={handleRestorationComplete}
          onSkipMissing={handleSkipMissing}
        />
      )}
      {activeDialog?.type === 'shareUrl' && (
        <ShareUrlDialog datasets={getDatasets()} onGenerate={generateShareUrl} onClose={closeDialog} />
      )}
      {activeDialog?.type === 'deleteConfirm' && (
        <DeleteNodeDialog nodeIds={activeDialog.nodeIds} onDelete={handleConfirmDelete} onCancel={handleCancelDelete} />
      )}
      <OnboardingTour />
      {chartPanelOpen ? <ChartConfigPopover /> : null}
      {activeDialog?.type === 'chartModal' ? <ChartModal /> : null}
      {activeDialog?.type === 'export' ? <ExportDialog /> : null}
      <DashboardView />
    </MobileBlocker>
  )
}
