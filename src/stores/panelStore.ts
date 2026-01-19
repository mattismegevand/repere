import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cleanupSessionRef } from '@/lib/sessions/recentSessions'
import { MAX_RECENT_SESSIONS, type RecentSessionEntry } from '@/lib/sessions/types'
import type { FilterOperator } from '@/types'

// Command palette page types
export type CommandPalettePage = { type: 'root' } | { type: 'filter'; column?: string; operator?: FilterOperator }

export interface ContextMenuState {
  x: number
  y: number
  nodeId: string
  nodeType: 'dataset' | 'view'
}

export interface EdgeContextMenuState {
  x: number
  y: number
  edgeId: string
  sourceId: string
  targetId: string
}

interface ScrollPreservation {
  row: number | null
  scrollLeft: number
  version: number
}

/**
 * Discriminated union for editing panels.
 * Only one editing panel can be open at a time.
 */
type ActiveEditingPanel =
  | { type: 'none' }
  | { type: 'pivot'; sourceNodeId: string; editingNodeId: string | null }
  | { type: 'filter' }
  | { type: 'sql'; editingNodeId: string | null }
  | {
      type: 'chart'
      sourceNodeId: string
      editingNodeId: string | null
      position: { x: number; y: number } | null
      defaultType: string | null
    }
  | { type: 'python'; editingNodeId: string | null }

interface PanelStoreState {
  // Sidebar and profile
  sidebarOpen: boolean
  profileOpen: boolean
  profilePanelWidth: number // Width in pixels (280-600)
  aiChatPanelWidth: number // Width in pixels (280-600)
  // Command palette
  commandPaletteOpen: boolean
  commandPaletteInitialPage: CommandPalettePage | null
  // Active editing panel (discriminated union - only one at a time)
  activeEditingPanel: ActiveEditingPanel
  // SQL panel height (persisted separately since it's a preference)
  sqlPanelHeight: number // Height in pixels (150-70vh)
  // View state
  isCanvasMode: boolean
  showHomepage: boolean
  view: 'grid' | 'profile'
  // Scroll preservation
  preservedScroll: ScrollPreservation | null
  lastRestoredScrollVersion: number
  // Other
  tourActive: boolean
  nodeContextMenu: ContextMenuState | null
  edgeContextMenu: EdgeContextMenuState | null
  // Recent sessions (unified across platforms)
  recentSessions: RecentSessionEntry[]
  // Current session ID (persisted to survive page refresh)
  currentSessionId: string | null
}

interface PanelStoreActions {
  // Sidebar and profile
  toggleSidebar: () => void
  toggleProfile: () => void
  setProfilePanelWidth: (width: number) => void
  setAiChatPanelWidth: (width: number) => void
  // Command palette
  setCommandPalette: (open: boolean) => void
  openCommandPalette: (initialPage?: CommandPalettePage) => void
  clearCommandPaletteInitialPage: () => void
  // Editing panel (unified state machine)
  setActiveEditingPanel: (panel: ActiveEditingPanel) => void
  closeEditingPanel: () => void
  // Pivot panel (convenience actions)
  openPivotPanel: (sourceNodeId: string, editingNodeId?: string) => void
  closePivotPanel: () => void
  // Filter editor (convenience actions)
  setFilterEditor: (open: boolean) => void
  // SQL panel (convenience actions)
  setSqlPanel: (open: boolean) => void
  toggleSqlPanel: () => void
  setSqlPanelHeight: (height: number) => void
  setEditingSqlNodeId: (nodeId: string | null) => void
  openSqlPanelForNode: (nodeId: string) => void
  // Chart panel (convenience actions)
  openChartPanel: (
    sourceNodeId: string,
    editingNodeId?: string,
    position?: { x: number; y: number },
    defaultChartType?: string
  ) => void
  closeChartPanel: () => void
  // Python panel (convenience actions)
  setPythonPanel: (open: boolean) => void
  togglePythonPanel: () => void
  openPythonPanelForNode: (nodeId: string) => void
  closePythonPanel: () => void
  // View state
  setCanvasMode: (enabled: boolean) => void
  toggleCanvasMode: () => void
  setShowHomepage: (show: boolean) => void
  setView: (view: 'grid' | 'profile') => void
  // Scroll preservation
  saveScrollPosition: (row: number | null, scrollLeft: number) => void
  markScrollRestored: (version: number) => void
  // Other
  setTourActive: (active: boolean) => void
  startTour: () => void
  setNodeContextMenu: (menu: ContextMenuState | null) => void
  setEdgeContextMenu: (menu: EdgeContextMenuState | null) => void
  // Recent sessions
  addRecentSession: (entry: Omit<RecentSessionEntry, 'id'>) => void
  updateRecentSessionTimestamp: (id: string) => void
  removeRecentSession: (id: string) => void
  clearRecentSessions: () => void
  // Session ID (for persistence across page refresh)
  setCurrentSessionId: (id: string | null) => void
}

const initialActiveEditingPanel: ActiveEditingPanel = { type: 'none' }

export const usePanelStore = create<PanelStoreState & PanelStoreActions>()(
  persist(
    (set) => ({
      // Initial state
      sidebarOpen: true,
      profileOpen: false,
      profilePanelWidth: 360,
      aiChatPanelWidth: 360,
      commandPaletteOpen: false,
      commandPaletteInitialPage: null,
      activeEditingPanel: initialActiveEditingPanel,
      sqlPanelHeight: 300,
      isCanvasMode: false,
      showHomepage: false,
      view: 'grid',
      preservedScroll: null,
      lastRestoredScrollVersion: 0,
      tourActive: false,
      nodeContextMenu: null,
      edgeContextMenu: null,
      recentSessions: [],
      currentSessionId: null,

      // Actions
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleProfile: () => set((s) => ({ profileOpen: !s.profileOpen })),
      setProfilePanelWidth: (width) => set({ profilePanelWidth: Math.max(280, Math.min(width, 600)) }),
      setAiChatPanelWidth: (width) => set({ aiChatPanelWidth: Math.max(280, Math.min(width, 600)) }),
      setCommandPalette: (open) => set({ commandPaletteOpen: open }),
      openCommandPalette: (initialPage) =>
        set({ commandPaletteOpen: true, commandPaletteInitialPage: initialPage ?? null }),
      clearCommandPaletteInitialPage: () => set({ commandPaletteInitialPage: null }),

      // Unified editing panel actions
      setActiveEditingPanel: (panel) => set({ activeEditingPanel: panel }),
      closeEditingPanel: () => set({ activeEditingPanel: { type: 'none' } }),

      // Convenience actions (use the unified state machine internally)
      openPivotPanel: (sourceNodeId, editingNodeId) => {
        set({ activeEditingPanel: { type: 'pivot', sourceNodeId, editingNodeId: editingNodeId ?? null } })
      },
      closePivotPanel: () => set({ activeEditingPanel: { type: 'none' } }),

      setFilterEditor: (open) => {
        set({ activeEditingPanel: open ? { type: 'filter' } : { type: 'none' } })
      },

      setSqlPanel: (open) =>
        set((s) => ({
          activeEditingPanel: open
            ? {
                type: 'sql',
                editingNodeId: s.activeEditingPanel.type === 'sql' ? s.activeEditingPanel.editingNodeId : null,
              }
            : { type: 'none' },
        })),
      toggleSqlPanel: () =>
        set((s) => ({
          activeEditingPanel:
            s.activeEditingPanel.type === 'sql' ? { type: 'none' } : { type: 'sql', editingNodeId: null },
        })),
      setSqlPanelHeight: (height) => set({ sqlPanelHeight: Math.max(150, Math.min(height, window.innerHeight * 0.7)) }),
      setEditingSqlNodeId: (nodeId) =>
        set((s) => {
          if (s.activeEditingPanel.type === 'sql') {
            return { activeEditingPanel: { type: 'sql', editingNodeId: nodeId } }
          }
          return {}
        }),
      openSqlPanelForNode: (nodeId) => {
        set({ activeEditingPanel: { type: 'sql', editingNodeId: nodeId } })
      },

      openChartPanel: (sourceNodeId, editingNodeId, position, defaultChartType) => {
        set({
          activeEditingPanel: {
            type: 'chart',
            sourceNodeId,
            editingNodeId: editingNodeId ?? null,
            position: position ?? null,
            defaultType: defaultChartType ?? null,
          },
        })
      },
      closeChartPanel: () => set({ activeEditingPanel: { type: 'none' } }),

      setPythonPanel: (open) =>
        set((s) => ({
          activeEditingPanel: open
            ? {
                type: 'python',
                editingNodeId: s.activeEditingPanel.type === 'python' ? s.activeEditingPanel.editingNodeId : null,
              }
            : { type: 'none' },
        })),
      togglePythonPanel: () =>
        set((s) => ({
          activeEditingPanel:
            s.activeEditingPanel.type === 'python' ? { type: 'none' } : { type: 'python', editingNodeId: null },
        })),
      openPythonPanelForNode: (nodeId) => {
        set({ activeEditingPanel: { type: 'python', editingNodeId: nodeId } })
      },
      closePythonPanel: () => set({ activeEditingPanel: { type: 'none' } }),

      setCanvasMode: (enabled) =>
        set((s) => {
          // Close chart panel when switching to table mode
          const shouldCloseChart = !enabled && s.activeEditingPanel.type === 'chart'
          return {
            isCanvasMode: enabled,
            activeEditingPanel: shouldCloseChart ? { type: 'none' } : s.activeEditingPanel,
          }
        }),
      toggleCanvasMode: () =>
        set((s) => {
          const willBeTableMode = s.isCanvasMode
          const shouldCloseChart = willBeTableMode && s.activeEditingPanel.type === 'chart'
          return {
            isCanvasMode: !s.isCanvasMode,
            activeEditingPanel: shouldCloseChart ? { type: 'none' } : s.activeEditingPanel,
          }
        }),
      setShowHomepage: (show) => set({ showHomepage: show }),
      setView: (view) => set({ view }),
      saveScrollPosition: (row, scrollLeft) => {
        set({ preservedScroll: { row, scrollLeft, version: Date.now() } })
      },
      markScrollRestored: (version) => set({ lastRestoredScrollVersion: version }),
      setTourActive: (active) => set({ tourActive: active }),
      startTour: () => set({ tourActive: true }),
      setNodeContextMenu: (menu) => set({ nodeContextMenu: menu }),
      setEdgeContextMenu: (menu) => set({ edgeContextMenu: menu }),
      addRecentSession: (entry) =>
        set((s) => {
          // Check if session with this sessionId already exists
          const existingIndex = s.recentSessions.findIndex((r) => r.ref.sessionId === entry.ref.sessionId)
          if (existingIndex !== -1) {
            // Update existing session entry
            const updated = [...s.recentSessions]
            updated[existingIndex] = {
              ...updated[existingIndex],
              name: entry.name,
              openedAt: entry.openedAt,
              size: entry.size,
              preview: entry.preview,
              ref: entry.ref, // Update ref in case path/handleId changed
            }
            // Move to front
            const [session] = updated.splice(existingIndex, 1)
            return { recentSessions: [session, ...updated] }
          }

          // Add new session
          const newSession: RecentSessionEntry = { ...entry, id: crypto.randomUUID() }
          return { recentSessions: [newSession, ...s.recentSessions].slice(0, MAX_RECENT_SESSIONS) }
        }),
      updateRecentSessionTimestamp: (id) =>
        set((s) => ({
          recentSessions: s.recentSessions.map((r) => (r.id === id ? { ...r, openedAt: Date.now() } : r)),
        })),
      removeRecentSession: (id) =>
        set((s) => {
          const session = s.recentSessions.find((r) => r.id === id)
          if (session) {
            // Fire and forget cleanup - don't block the UI
            cleanupSessionRef(session.ref)
          }
          return { recentSessions: s.recentSessions.filter((r) => r.id !== id) }
        }),
      clearRecentSessions: () =>
        set((s) => {
          // Fire and forget cleanup for all sessions
          for (const session of s.recentSessions) {
            cleanupSessionRef(session.ref)
          }
          return { recentSessions: [] }
        }),
      setCurrentSessionId: (id) => set({ currentSessionId: id }),
    }),
    {
      name: 'repere-panels',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        profileOpen: state.profileOpen,
        profilePanelWidth: state.profilePanelWidth,
        aiChatPanelWidth: state.aiChatPanelWidth,
        sqlPanelHeight: state.sqlPanelHeight,
        // Filter out sessions with invalid refs (must have sessionId)
        recentSessions: state.recentSessions.filter((s) => s.ref.sessionId),
        // Persist current session ID to survive page refresh
        currentSessionId: state.currentSessionId,
      }),
    }
  )
)
