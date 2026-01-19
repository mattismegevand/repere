import { create } from 'zustand'
import type { DashboardFilter, DrillLevel, DrillState } from '@/types'

// ============================================
// STATE INTERFACE
// ============================================

interface DashboardState {
  // Active filters per dashboard (dashboardId -> filters)
  activeFilters: Record<string, DashboardFilter[]>

  // Drill state per chart (chartId -> drill state)
  drillStates: Record<string, DrillState>

  // Currently expanded dashboard (full-screen view)
  expandedDashboardId: string | null

  // Selected chart within expanded dashboard (for highlighting)
  selectedChartId: string | null
}

// ============================================
// ACTIONS INTERFACE
// ============================================

interface DashboardActions {
  // Filter management
  setFilter: (dashboardId: string, filter: DashboardFilter) => void
  removeFilter: (dashboardId: string, filterId: string) => void
  clearFilters: (dashboardId: string, source?: 'chart' | 'global' | 'drill') => void
  clearAllDashboardFilters: (dashboardId: string) => void

  // Drill navigation
  initDrill: (chartId: string, hierarchy: DrillLevel[]) => void
  drillDown: (chartId: string, value: unknown) => void
  drillUp: (chartId: string) => void
  drillToLevel: (chartId: string, level: number) => void
  resetDrill: (chartId: string) => void

  // Dashboard view management
  expandDashboard: (dashboardId: string) => void
  collapseDashboard: () => void
  selectChart: (chartId: string | null) => void

  // Cleanup
  removeDashboard: (dashboardId: string) => void
  removeChart: (chartId: string) => void
  reset: () => void
}

// ============================================
// INITIAL STATE
// ============================================

const initial: DashboardState = {
  activeFilters: {},
  drillStates: {},
  expandedDashboardId: null,
  selectedChartId: null,
}

// ============================================
// STORE
// ============================================

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
  ...initial,

  // ----------------------------------------
  // Filter Management
  // ----------------------------------------

  setFilter: (dashboardId, filter) =>
    set((state) => {
      const existing = state.activeFilters[dashboardId] || []
      // Replace existing filter with same ID, or add new
      const updated = [...existing.filter((f) => f.id !== filter.id), filter]
      return {
        activeFilters: {
          ...state.activeFilters,
          [dashboardId]: updated,
        },
      }
    }),

  removeFilter: (dashboardId, filterId) =>
    set((state) => {
      const existing = state.activeFilters[dashboardId] || []
      return {
        activeFilters: {
          ...state.activeFilters,
          [dashboardId]: existing.filter((f) => f.id !== filterId),
        },
      }
    }),

  clearFilters: (dashboardId, source) =>
    set((state) => {
      const existing = state.activeFilters[dashboardId] || []
      const filtered = source ? existing.filter((f) => f.source !== source) : []
      return {
        activeFilters: {
          ...state.activeFilters,
          [dashboardId]: filtered,
        },
      }
    }),

  clearAllDashboardFilters: (dashboardId) =>
    set((state) => {
      const { [dashboardId]: _, ...rest } = state.activeFilters
      return { activeFilters: rest }
    }),

  // ----------------------------------------
  // Drill Navigation
  // ----------------------------------------

  initDrill: (chartId, hierarchy) =>
    set((state) => ({
      drillStates: {
        ...state.drillStates,
        [chartId]: {
          hierarchy,
          currentLevel: 0,
          filters: [],
        },
      },
    })),

  drillDown: (chartId, value) =>
    set((state) => {
      const drillState = state.drillStates[chartId]
      if (!drillState) return state
      if (drillState.currentLevel >= drillState.hierarchy.length - 1) return state

      const currentColumn = drillState.hierarchy[drillState.currentLevel].column
      return {
        drillStates: {
          ...state.drillStates,
          [chartId]: {
            ...drillState,
            currentLevel: drillState.currentLevel + 1,
            filters: [...drillState.filters, { column: currentColumn, value }],
          },
        },
      }
    }),

  drillUp: (chartId) =>
    set((state) => {
      const drillState = state.drillStates[chartId]
      if (!drillState || drillState.currentLevel === 0) return state

      return {
        drillStates: {
          ...state.drillStates,
          [chartId]: {
            ...drillState,
            currentLevel: drillState.currentLevel - 1,
            filters: drillState.filters.slice(0, -1),
          },
        },
      }
    }),

  drillToLevel: (chartId, level) =>
    set((state) => {
      const drillState = state.drillStates[chartId]
      if (!drillState) return state
      if (level < 0 || level > drillState.currentLevel) return state

      return {
        drillStates: {
          ...state.drillStates,
          [chartId]: {
            ...drillState,
            currentLevel: level,
            filters: drillState.filters.slice(0, level),
          },
        },
      }
    }),

  resetDrill: (chartId) =>
    set((state) => {
      const drillState = state.drillStates[chartId]
      if (!drillState) return state

      return {
        drillStates: {
          ...state.drillStates,
          [chartId]: {
            ...drillState,
            currentLevel: 0,
            filters: [],
          },
        },
      }
    }),

  // ----------------------------------------
  // Dashboard View Management
  // ----------------------------------------

  expandDashboard: (dashboardId) =>
    set({
      expandedDashboardId: dashboardId,
      selectedChartId: null,
    }),

  collapseDashboard: () =>
    set({
      expandedDashboardId: null,
      selectedChartId: null,
    }),

  selectChart: (chartId) => set({ selectedChartId: chartId }),

  // ----------------------------------------
  // Cleanup
  // ----------------------------------------

  removeDashboard: (dashboardId) =>
    set((state) => {
      const { [dashboardId]: _, ...restFilters } = state.activeFilters
      return {
        activeFilters: restFilters,
        expandedDashboardId: state.expandedDashboardId === dashboardId ? null : state.expandedDashboardId,
      }
    }),

  removeChart: (chartId) =>
    set((state) => {
      const { [chartId]: _, ...restDrill } = state.drillStates
      return {
        drillStates: restDrill,
        selectedChartId: state.selectedChartId === chartId ? null : state.selectedChartId,
      }
    }),

  reset: () => set(initial),
}))
