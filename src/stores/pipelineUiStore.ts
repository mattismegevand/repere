import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { generateId } from '@/lib/id'
import type { RequiredFile, SchemaValidationResult, SessionData } from '@/lib/pipeline/persistence'
import type { ViewOperation } from '@/types'
import type { PipelineSnapshot } from './pipelineTypes'

// ============================================
// RESTORATION STATE
// ============================================

export type DatasetRestorationStatus =
  | 'embedded' // Data is embedded in session, no file needed
  | 'required' // Needs file, not yet provided
  | 'validating' // File provided, checking schema
  | 'provided' // File provided, schema valid
  | 'error' // Schema mismatch

export interface DatasetRestorationInfo {
  nodeId: string
  fileName: string
  status: DatasetRestorationStatus
  file?: File // The provided file (if any)
  validationResult?: SchemaValidationResult // Schema validation result (if validated)
  expectedColumns: RequiredFile['expectedColumns'] // Expected schema
  expectedHash?: string // Original file hash (if available)
  isExactMatch?: boolean // True if provided file hash matches original
}

export interface RestorationState {
  session: SessionData
  datasets: Map<string, DatasetRestorationInfo> // nodeId -> restoration info
  skippedDatasets: Set<string> // Datasets user chose to skip
}

// ============================================
// PIPELINE MODE (explicit state machine)
// ============================================

/**
 * Pipeline mode - only one mode can be active at a time.
 */
type PipelineMode =
  | { type: 'normal' }
  | { type: 'restoring'; state: RestorationState }
  | { type: 'branching'; viewId: string; snapshotBefore: PipelineSnapshot; pendingOperation?: ViewOperation }
  | { type: 'loading'; data: SessionData; providedFiles: Map<string, File> }

// Track edits made to views with children (for deferred branching)
interface PendingBranchEdit {
  viewId: string
  snapshotBefore: PipelineSnapshot
  pendingOperation?: ViewOperation // ViewOperation that was blocked and should be applied after branch decision
}

// Pending session state for when files need to be re-uploaded
interface PendingSession {
  data: SessionData
  providedFiles: Map<string, File>
}

interface DerivedModeState {
  restorationState: RestorationState | null
  pendingBranchEdit: PendingBranchEdit | null
  pendingSession: PendingSession | null
}

// ============================================
// STATE INTERFACE
// ============================================

interface PipelineUiState {
  loading: boolean
  error: string | null
  successMessage: string | null
  mode: PipelineMode
  dataVersion: number
  nodeViewTimes: Record<string, number>
  currentSessionId: string | null
}

// ============================================
// ACTIONS INTERFACE
// ============================================

interface PipelineUiActions {
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSuccessMessage: (message: string | null) => void
  reset: () => void

  // Mode management (state machine)
  setMode: (mode: PipelineMode) => void
  enterRestorationMode: (state: RestorationState) => void
  exitRestorationMode: () => void
  enterBranchingMode: (viewId: string, snapshotBefore: PipelineSnapshot, pendingOperation?: ViewOperation) => void
  exitBranchingMode: () => void
  enterLoadingMode: (data: SessionData, providedFiles: Map<string, File>) => void
  exitLoadingMode: () => void
  updateDatasetRestoration: (nodeId: string, update: Partial<DatasetRestorationInfo>) => void
  skipDataset: (nodeId: string) => void
  unskipDataset: (nodeId: string) => void

  // Data version (for cache invalidation)
  bumpDataVersion: () => void

  // Node view times (command palette sorting)
  markNodeViewed: (nodeId: string | null) => void

  // Session ID management
  setCurrentSessionId: (id: string | null) => void
  generateNewSessionId: () => string
}

// ============================================
// INITIAL STATE
// ============================================

function deriveFromMode(mode: PipelineMode): DerivedModeState {
  if (mode.type === 'restoring') {
    return { restorationState: mode.state, pendingBranchEdit: null, pendingSession: null }
  }
  if (mode.type === 'branching') {
    return {
      restorationState: null,
      pendingBranchEdit: {
        viewId: mode.viewId,
        snapshotBefore: mode.snapshotBefore,
        pendingOperation: mode.pendingOperation,
      },
      pendingSession: null,
    }
  }
  if (mode.type === 'loading') {
    return {
      restorationState: null,
      pendingBranchEdit: null,
      pendingSession: { data: mode.data, providedFiles: mode.providedFiles },
    }
  }
  return { restorationState: null, pendingBranchEdit: null, pendingSession: null }
}

const initialMode: PipelineMode = { type: 'normal' }
const initialDerived = deriveFromMode(initialMode)

const initialState: PipelineUiState & DerivedModeState = {
  loading: false,
  error: null,
  successMessage: null,
  mode: initialMode,
  dataVersion: 0,
  nodeViewTimes: {},
  currentSessionId: null,
  ...initialDerived,
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const usePipelineUiStore = create<PipelineUiState & PipelineUiActions & DerivedModeState>()(
  subscribeWithSelector((set, _get) => ({
    ...initialState,

    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setSuccessMessage: (successMessage) => set({ successMessage }),
    reset: () => set(initialState),

    setMode: (mode) => set({ mode, ...deriveFromMode(mode) }),

    enterRestorationMode: (state) => {
      const mode: PipelineMode = { type: 'restoring', state }
      set({ mode, ...deriveFromMode(mode) })
    },

    exitRestorationMode: () => {
      const mode: PipelineMode = { type: 'normal' }
      set({ mode, ...deriveFromMode(mode) })
    },

    enterBranchingMode: (viewId, snapshotBefore, pendingOperation) => {
      const mode: PipelineMode = { type: 'branching', viewId, snapshotBefore, pendingOperation }
      set({ mode, ...deriveFromMode(mode) })
    },

    exitBranchingMode: () => {
      const mode: PipelineMode = { type: 'normal' }
      set({ mode, ...deriveFromMode(mode) })
    },

    enterLoadingMode: (data, providedFiles) => {
      const mode: PipelineMode = { type: 'loading', data, providedFiles }
      set({ mode, ...deriveFromMode(mode) })
    },

    exitLoadingMode: () => {
      const mode: PipelineMode = { type: 'normal' }
      set({ mode, ...deriveFromMode(mode) })
    },

    updateDatasetRestoration: (nodeId, update) =>
      set((state) => {
        if (state.mode.type !== 'restoring') return state
        const datasets = new Map(state.mode.state.datasets)
        const existing = datasets.get(nodeId)
        if (!existing) return state
        datasets.set(nodeId, { ...existing, ...update })
        const newMode: PipelineMode = {
          type: 'restoring',
          state: {
            ...state.mode.state,
            datasets,
          },
        }
        return { mode: newMode, ...deriveFromMode(newMode) }
      }),

    skipDataset: (nodeId) =>
      set((state) => {
        if (state.mode.type !== 'restoring') return state
        const skippedDatasets = new Set(state.mode.state.skippedDatasets)
        skippedDatasets.add(nodeId)
        const newMode: PipelineMode = {
          type: 'restoring',
          state: {
            ...state.mode.state,
            skippedDatasets,
          },
        }
        return { mode: newMode, ...deriveFromMode(newMode) }
      }),

    unskipDataset: (nodeId) =>
      set((state) => {
        if (state.mode.type !== 'restoring') return state
        const skippedDatasets = new Set(state.mode.state.skippedDatasets)
        skippedDatasets.delete(nodeId)
        const newMode: PipelineMode = {
          type: 'restoring',
          state: {
            ...state.mode.state,
            skippedDatasets,
          },
        }
        return { mode: newMode, ...deriveFromMode(newMode) }
      }),

    bumpDataVersion: () => set((state) => ({ dataVersion: state.dataVersion + 1 })),

    markNodeViewed: (nodeId) =>
      set((state) => ({
        nodeViewTimes: nodeId ? { ...state.nodeViewTimes, [nodeId]: Date.now() } : state.nodeViewTimes,
      })),

    setCurrentSessionId: (id) => set({ currentSessionId: id }),
    generateNewSessionId: () => {
      const id = generateId('session', 6)
      set({ currentSessionId: id })
      return id
    },
  }))
)
