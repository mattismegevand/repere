import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatStore } from '@/stores/chatStore'
import type { AgentPlan } from '@/types/ai'

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 11),
})

describe('chatStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useChatStore.setState({
      isOpen: false,
      isLoading: false,
      messages: [],
      activePlan: null,
      editingStepId: null,
      apiKey: null,
      model: 'anthropic/claude-sonnet-4',
      isExecuting: false,
      currentStepIndex: -1,
    })
  })

  describe('panel controls', () => {
    it('toggleChat toggles isOpen from false to true', () => {
      expect(useChatStore.getState().isOpen).toBe(false)
      useChatStore.getState().toggleChat()
      expect(useChatStore.getState().isOpen).toBe(true)
    })

    it('toggleChat toggles isOpen from true to false', () => {
      useChatStore.setState({ isOpen: true })
      useChatStore.getState().toggleChat()
      expect(useChatStore.getState().isOpen).toBe(false)
    })

    it('setOpen sets isOpen directly', () => {
      useChatStore.getState().setOpen(true)
      expect(useChatStore.getState().isOpen).toBe(true)
      useChatStore.getState().setOpen(false)
      expect(useChatStore.getState().isOpen).toBe(false)
    })
  })

  describe('message management', () => {
    it('addMessage adds a new message with id and timestamp', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Hello' })
      const messages = useChatStore.getState().messages
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('Hello')
      expect(messages[0].id).toBeDefined()
      expect(messages[0].timestamp).toBeDefined()
    })

    it('addMessage adds multiple messages in order', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Hello' })
      useChatStore.getState().addMessage({ role: 'assistant', content: 'Hi there!' })
      const messages = useChatStore.getState().messages
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('user')
      expect(messages[1].role).toBe('assistant')
    })

    it('clearMessages clears all messages and activePlan', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Hello' })
      useChatStore.setState({ activePlan: { id: 'plan1', status: 'pending', steps: [] } })
      useChatStore.getState().clearMessages()
      expect(useChatStore.getState().messages).toHaveLength(0)
      expect(useChatStore.getState().activePlan).toBeNull()
    })

    it('updateLastAssistantMessage updates the last assistant message', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Hello' })
      useChatStore.getState().addMessage({ role: 'assistant', content: 'Initial response' })
      useChatStore.getState().updateLastAssistantMessage('Updated response')
      const messages = useChatStore.getState().messages
      expect(messages[1].content).toBe('Updated response')
    })

    it('updateLastAssistantMessage finds last assistant message even if not at end', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Hello' })
      useChatStore.getState().addMessage({ role: 'assistant', content: 'Response 1' })
      useChatStore.getState().addMessage({ role: 'user', content: 'Follow up' })
      useChatStore.getState().updateLastAssistantMessage('Updated')
      const messages = useChatStore.getState().messages
      expect(messages[1].content).toBe('Updated')
    })

    it('updateLastAssistantMessage does nothing if no assistant messages', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Hello' })
      useChatStore.getState().updateLastAssistantMessage('Updated')
      const messages = useChatStore.getState().messages
      expect(messages[0].content).toBe('Hello')
    })
  })

  describe('plan management', () => {
    const mockPlan: AgentPlan = {
      id: 'plan-1',
      status: 'pending',
      steps: [
        {
          id: 'step-1',
          operation: { type: 'filter', column: 'price', operator: '>', value: '100' },
          status: 'pending',
        },
        { id: 'step-2', operation: { type: 'sort', column: 'name', direction: 'asc' }, status: 'pending' },
      ],
    }

    it('setPlan sets the active plan', () => {
      useChatStore.getState().setPlan(mockPlan)
      expect(useChatStore.getState().activePlan).toEqual(mockPlan)
    })

    it('setPlan attaches plan to last assistant message', () => {
      useChatStore.getState().addMessage({ role: 'assistant', content: 'Here is a plan' })
      useChatStore.getState().setPlan(mockPlan)
      const messages = useChatStore.getState().messages
      expect(messages[0].plan).toEqual(mockPlan)
    })

    it('setPlan clears plan when set to null', () => {
      useChatStore.getState().setPlan(mockPlan)
      useChatStore.getState().setPlan(null)
      expect(useChatStore.getState().activePlan).toBeNull()
    })

    it('updatePlanStatus updates the plan status', () => {
      useChatStore.getState().setPlan(mockPlan)
      useChatStore.getState().updatePlanStatus('executing')
      expect(useChatStore.getState().activePlan?.status).toBe('executing')
    })

    it('updatePlanStatus does nothing if no active plan', () => {
      useChatStore.getState().updatePlanStatus('executing')
      expect(useChatStore.getState().activePlan).toBeNull()
    })

    it('updateStepStatus updates a specific step status', () => {
      useChatStore.getState().setPlan(mockPlan)
      useChatStore.getState().updateStepStatus('step-1', 'completed', { success: true })
      const step = useChatStore.getState().activePlan?.steps.find((s) => s.id === 'step-1')
      expect(step?.status).toBe('completed')
      expect(step?.result).toEqual({ success: true })
    })

    it('updateStepStatus preserves existing result if not provided', () => {
      const planWithResult = {
        ...mockPlan,
        steps: [{ ...mockPlan.steps[0], result: { success: true } }, mockPlan.steps[1]],
      }
      useChatStore.getState().setPlan(planWithResult)
      useChatStore.getState().updateStepStatus('step-1', 'executing')
      const step = useChatStore.getState().activePlan?.steps.find((s) => s.id === 'step-1')
      expect(step?.status).toBe('executing')
      expect(step?.result).toEqual({ success: true })
    })

    it('updateStepStatus does nothing if no active plan', () => {
      useChatStore.getState().updateStepStatus('step-1', 'completed')
      expect(useChatStore.getState().activePlan).toBeNull()
    })

    it('setEditingStep sets the editing step id', () => {
      useChatStore.getState().setEditingStep('step-1')
      expect(useChatStore.getState().editingStepId).toBe('step-1')
    })

    it('setEditingStep clears with null', () => {
      useChatStore.getState().setEditingStep('step-1')
      useChatStore.getState().setEditingStep(null)
      expect(useChatStore.getState().editingStepId).toBeNull()
    })

    it('updateStep updates the operation for a step', () => {
      useChatStore.getState().setPlan(mockPlan)
      useChatStore.getState().updateStep('step-1', { type: 'limit', count: 50 })
      const step = useChatStore.getState().activePlan?.steps.find((s) => s.id === 'step-1')
      expect(step?.operation).toEqual({ type: 'limit', count: 50 })
    })

    it('updateStep does nothing if no active plan', () => {
      useChatStore.getState().updateStep('step-1', { type: 'limit', count: 50 })
      expect(useChatStore.getState().activePlan).toBeNull()
    })

    it('removeStep removes a step from the plan', () => {
      useChatStore.getState().setPlan(mockPlan)
      useChatStore.getState().removeStep('step-1')
      expect(useChatStore.getState().activePlan?.steps).toHaveLength(1)
      expect(useChatStore.getState().activePlan?.steps[0].id).toBe('step-2')
    })

    it('removeStep does nothing if no active plan', () => {
      useChatStore.getState().removeStep('step-1')
      expect(useChatStore.getState().activePlan).toBeNull()
    })

    it('reorderSteps moves a step to a new position', () => {
      useChatStore.getState().setPlan(mockPlan)
      useChatStore.getState().reorderSteps(0, 1)
      const steps = useChatStore.getState().activePlan?.steps
      expect(steps?.[0].id).toBe('step-2')
      expect(steps?.[1].id).toBe('step-1')
    })

    it('reorderSteps does nothing if no active plan', () => {
      useChatStore.getState().reorderSteps(0, 1)
      expect(useChatStore.getState().activePlan).toBeNull()
    })

    it('addStep adds a step at the end', () => {
      useChatStore.getState().setPlan(mockPlan)
      useChatStore.getState().addStep({ operation: { type: 'distinct' } })
      const steps = useChatStore.getState().activePlan?.steps
      expect(steps).toHaveLength(3)
      expect(steps?.[2].operation).toEqual({ type: 'distinct' })
      expect(steps?.[2].status).toBe('pending')
    })

    it('addStep adds a step after a specific step', () => {
      useChatStore.getState().setPlan(mockPlan)
      useChatStore.getState().addStep({ operation: { type: 'distinct' } }, 'step-1')
      const steps = useChatStore.getState().activePlan?.steps
      expect(steps).toHaveLength(3)
      expect(steps?.[0].id).toBe('step-1')
      expect(steps?.[1].operation).toEqual({ type: 'distinct' })
      expect(steps?.[2].id).toBe('step-2')
    })

    it('addStep does nothing if no active plan', () => {
      useChatStore.getState().addStep({ operation: { type: 'distinct' } })
      expect(useChatStore.getState().activePlan).toBeNull()
    })
  })

  describe('API configuration', () => {
    it('setApiKey sets the API key', () => {
      useChatStore.getState().setApiKey('sk-test-key')
      expect(useChatStore.getState().apiKey).toBe('sk-test-key')
    })

    it('setApiKey clears the key with null', () => {
      useChatStore.getState().setApiKey('sk-test-key')
      useChatStore.getState().setApiKey(null)
      expect(useChatStore.getState().apiKey).toBeNull()
    })

    it('setModel sets the model', () => {
      useChatStore.getState().setModel('openai/gpt-4')
      expect(useChatStore.getState().model).toBe('openai/gpt-4')
    })
  })

  describe('execution state', () => {
    it('setExecuting sets execution state', () => {
      useChatStore.getState().setExecuting(true)
      expect(useChatStore.getState().isExecuting).toBe(true)
      useChatStore.getState().setExecuting(false)
      expect(useChatStore.getState().isExecuting).toBe(false)
    })

    it('setCurrentStepIndex sets the current step index', () => {
      useChatStore.getState().setCurrentStepIndex(2)
      expect(useChatStore.getState().currentStepIndex).toBe(2)
    })

    it('setLoading sets loading state', () => {
      useChatStore.getState().setLoading(true)
      expect(useChatStore.getState().isLoading).toBe(true)
      useChatStore.getState().setLoading(false)
      expect(useChatStore.getState().isLoading).toBe(false)
    })
  })

  describe('reset', () => {
    it('reset clears state but preserves apiKey and model', () => {
      useChatStore.setState({
        isOpen: true,
        isLoading: true,
        messages: [{ id: '1', role: 'user', content: 'test', timestamp: 123 }],
        activePlan: { id: 'plan', status: 'pending', steps: [] },
        apiKey: 'my-api-key',
        model: 'custom-model',
        isExecuting: true,
        currentStepIndex: 5,
      })

      useChatStore.getState().reset()

      const state = useChatStore.getState()
      expect(state.isOpen).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.messages).toHaveLength(0)
      expect(state.activePlan).toBeNull()
      expect(state.apiKey).toBe('my-api-key')
      expect(state.model).toBe('custom-model')
      expect(state.isExecuting).toBe(false)
      expect(state.currentStepIndex).toBe(-1)
    })
  })
})
