import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_MODEL } from '@/lib/ai/llm-client'
import type { AgentPlan, ChatMessage, PlannedStep, StepStatus } from '@/types/ai'

export type ExecutionMode = 'plan-first' | 'auto-run'

interface ChatState {
  // Panel state
  isOpen: boolean
  isLoading: boolean

  // Messages
  messages: ChatMessage[]

  // Active plan state
  activePlan: AgentPlan | null
  editingStepId: string | null

  // API configuration (persisted)
  apiKey: string | null
  model: string

  // Execution mode (persisted)
  executionMode: ExecutionMode

  // Debug mode (persisted)
  debugMode: boolean

  // Execution state
  isExecuting: boolean
  currentStepIndex: number
}

interface ChatActions {
  // Panel controls
  toggleChat: () => void
  setOpen: (open: boolean) => void

  // Message management
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  updateLastAssistantMessage: (content: string) => void

  // Plan management
  setPlan: (plan: AgentPlan | null) => void
  updatePlanStatus: (status: AgentPlan['status']) => void
  updateStepStatus: (stepId: string, status: StepStatus, result?: PlannedStep['result']) => void
  setEditingStep: (stepId: string | null) => void
  updateStep: (stepId: string, operation: PlannedStep['operation']) => void
  removeStep: (stepId: string) => void
  reorderSteps: (fromIndex: number, toIndex: number) => void
  addStep: (step: Omit<PlannedStep, 'id' | 'status'>, afterStepId?: string) => void

  // API configuration
  setApiKey: (key: string | null) => void
  setModel: (model: string) => void

  // Execution mode
  setExecutionMode: (mode: ExecutionMode) => void
  setDebugMode: (enabled: boolean) => void

  // Execution
  setExecuting: (executing: boolean) => void
  setCurrentStepIndex: (index: number) => void
  setLoading: (loading: boolean) => void

  // Reset
  reset: () => void
}

const generateId = () => crypto.randomUUID()

/**
 * Get API key from environment variables (dev mode)
 * Set VITE_OPENROUTER_API_KEY in .env.local
 */
function getDevApiKey(): string | null {
  return (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined) ?? null
}

const devApiKey = getDevApiKey()

const initialState: ChatState = {
  isOpen: false,
  isLoading: false,
  messages: [],
  activePlan: null,
  editingStepId: null,
  apiKey: devApiKey,
  model: DEFAULT_MODEL,
  executionMode: 'auto-run',
  debugMode: false,
  isExecuting: false,
  currentStepIndex: -1,
}

export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (open) => set({ isOpen: open }),

      addMessage: (message) =>
        set((s) => ({
          messages: [
            ...s.messages,
            {
              ...message,
              id: generateId(),
              timestamp: Date.now(),
            },
          ],
        })),

      clearMessages: () => set({ messages: [], activePlan: null }),

      updateLastAssistantMessage: (content) =>
        set((s) => {
          const messages = [...s.messages]
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
              messages[i] = { ...messages[i], content }
              break
            }
          }
          return { messages }
        }),

      setPlan: (plan) =>
        set((s) => {
          // Also update the last assistant message to include the plan
          if (plan) {
            const messages = [...s.messages]
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].role === 'assistant') {
                messages[i] = { ...messages[i], plan }
                break
              }
            }
            return { activePlan: plan, messages }
          }
          return { activePlan: plan }
        }),

      updatePlanStatus: (status) =>
        set((s) => {
          if (!s.activePlan) return {}
          return { activePlan: { ...s.activePlan, status } }
        }),

      updateStepStatus: (stepId, status, result) =>
        set((s) => {
          if (!s.activePlan) return {}
          const steps = s.activePlan.steps.map((step) =>
            step.id === stepId ? { ...step, status, result: result ?? step.result } : step
          )
          return { activePlan: { ...s.activePlan, steps } }
        }),

      setEditingStep: (stepId) => set({ editingStepId: stepId }),

      updateStep: (stepId, operation) =>
        set((s) => {
          if (!s.activePlan) return {}
          const steps = s.activePlan.steps.map((step) => (step.id === stepId ? { ...step, operation } : step))
          return { activePlan: { ...s.activePlan, steps } }
        }),

      removeStep: (stepId) =>
        set((s) => {
          if (!s.activePlan) return {}
          const steps = s.activePlan.steps.filter((step) => step.id !== stepId)
          return { activePlan: { ...s.activePlan, steps } }
        }),

      reorderSteps: (fromIndex, toIndex) =>
        set((s) => {
          if (!s.activePlan) return {}
          const steps = [...s.activePlan.steps]
          const [removed] = steps.splice(fromIndex, 1)
          steps.splice(toIndex, 0, removed)
          return { activePlan: { ...s.activePlan, steps } }
        }),

      addStep: (step, afterStepId) =>
        set((s) => {
          if (!s.activePlan) return {}
          const newStep: PlannedStep = {
            ...step,
            id: generateId(),
            status: 'pending',
          }
          const steps = [...s.activePlan.steps]
          if (afterStepId) {
            const index = steps.findIndex((s) => s.id === afterStepId)
            steps.splice(index + 1, 0, newStep)
          } else {
            steps.push(newStep)
          }
          return { activePlan: { ...s.activePlan, steps } }
        }),

      setApiKey: (key) => set({ apiKey: key }),
      setModel: (model) => set({ model }),

      setExecutionMode: (mode) => set({ executionMode: mode }),
      setDebugMode: (enabled) => set({ debugMode: enabled }),

      setExecuting: (executing) => set({ isExecuting: executing }),
      setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
      setLoading: (loading) => set({ isLoading: loading }),

      reset: () => {
        const { apiKey, model } = get()
        set({ ...initialState, apiKey, model })
      },
    }),
    {
      name: 'repere-chat',
      partialize: (state) => ({
        apiKey: state.apiKey,
        model: state.model,
        executionMode: state.executionMode,
        debugMode: state.debugMode,
        // Don't persist messages or plan state
      }),
      // In dev mode, prefer env vars over persisted state
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<ChatState>) }
        // If env var has a key, use it (overrides persisted)
        if (devApiKey) {
          merged.apiKey = devApiKey
        }
        return merged
      },
    }
  )
)
