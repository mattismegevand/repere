import { create } from 'zustand'

export interface ToolCallMetric {
  id: string
  name: string
  arguments: Record<string, unknown>
  success: boolean
  duration: number
  iteration: number
  timestamp: number
  error?: string
}

export interface IterationMetric {
  iteration: number
  llmCallDuration: number
  toolCallCount: number
  timestamp: number
}

export interface SessionSummary {
  goal: string
  totalIterations: number
  totalToolCalls: number
  successfulToolCalls: number
  failedToolCalls: number
  totalDuration: number
  status: 'running' | 'completed' | 'failed' | 'aborted'
  startTime: number
  endTime?: number
}

export interface TokenEstimate {
  component: string
  tokens: number
}

interface TelemetryState {
  // Current session data
  currentSession: SessionSummary | null
  toolCalls: ToolCallMetric[]
  iterations: IterationMetric[]
  tokenEstimates: TokenEstimate[]

  // System prompt and context (for debug panel)
  systemPrompt: string
  contextPayload: string
  messageHistory: Array<{ role: string; content: string; toolCalls?: unknown[] }>
}

interface TelemetryActions {
  // Session management
  startSession: (goal: string) => void
  endSession: (status: SessionSummary['status']) => void

  // Tool call tracking
  recordToolCall: (metric: Omit<ToolCallMetric, 'timestamp'>) => void

  // Iteration tracking
  recordIteration: (metric: Omit<IterationMetric, 'timestamp'>) => void

  // Token estimates
  setTokenEstimates: (estimates: TokenEstimate[]) => void

  // Debug data
  setSystemPrompt: (prompt: string) => void
  setContextPayload: (payload: string) => void
  setMessageHistory: (messages: TelemetryState['messageHistory']) => void

  // Reset
  reset: () => void
}

const initialState: TelemetryState = {
  currentSession: null,
  toolCalls: [],
  iterations: [],
  tokenEstimates: [],
  systemPrompt: '',
  contextPayload: '',
  messageHistory: [],
}

export const useAgentTelemetryStore = create<TelemetryState & TelemetryActions>()((set) => ({
  ...initialState,

  startSession: (goal) =>
    set({
      currentSession: {
        goal,
        totalIterations: 0,
        totalToolCalls: 0,
        successfulToolCalls: 0,
        failedToolCalls: 0,
        totalDuration: 0,
        status: 'running',
        startTime: Date.now(),
      },
      toolCalls: [],
      iterations: [],
      tokenEstimates: [],
    }),

  endSession: (status) =>
    set((state) => {
      if (!state.currentSession) return {}
      const endTime = Date.now()
      return {
        currentSession: {
          ...state.currentSession,
          status,
          endTime,
          totalDuration: endTime - state.currentSession.startTime,
        },
      }
    }),

  recordToolCall: (metric) =>
    set((state) => {
      const toolCall: ToolCallMetric = { ...metric, timestamp: Date.now() }
      const session = state.currentSession
      if (!session) return { toolCalls: [...state.toolCalls, toolCall] }

      return {
        toolCalls: [...state.toolCalls, toolCall],
        currentSession: {
          ...session,
          totalToolCalls: session.totalToolCalls + 1,
          successfulToolCalls: metric.success ? session.successfulToolCalls + 1 : session.successfulToolCalls,
          failedToolCalls: !metric.success ? session.failedToolCalls + 1 : session.failedToolCalls,
        },
      }
    }),

  recordIteration: (metric) =>
    set((state) => {
      const iteration: IterationMetric = { ...metric, timestamp: Date.now() }
      const session = state.currentSession
      if (!session) return { iterations: [...state.iterations, iteration] }

      return {
        iterations: [...state.iterations, iteration],
        currentSession: {
          ...session,
          totalIterations: session.totalIterations + 1,
        },
      }
    }),

  setTokenEstimates: (estimates) => set({ tokenEstimates: estimates }),

  setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),

  setContextPayload: (payload) => set({ contextPayload: payload }),

  setMessageHistory: (messages) => set({ messageHistory: messages }),

  reset: () => set(initialState),
}))
