import type { LLMConfig, LLMMessage, LLMResponse, LLMToolCall, ToolDefinition } from '@/types/ai'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5'

// Popular models available on OpenRouter
export const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-haiku-4', name: 'Claude Haiku 4' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
  { id: 'z-ai/glm-4.7', name: 'GLM-4.7' },
] as const

// OpenRouter API message types
type OpenRouterMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenRouterToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

interface OpenRouterTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: ToolDefinition['parameters']
  }
}

interface OpenRouterToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string | null
      tool_calls?: OpenRouterToolCall[]
    }
    finish_reason: string
  }>
}

/**
 * Convert our LLMMessage format to OpenRouter API format
 */
function toOpenRouterMessages(messages: LLMMessage[]): OpenRouterMessage[] {
  return messages.map((msg) => {
    if (msg.role === 'system' || msg.role === 'user') {
      return { role: msg.role, content: msg.content }
    }
    if (msg.role === 'tool') {
      return { role: 'tool', tool_call_id: msg.toolCallId, content: msg.content }
    }
    // Assistant message (msg.role === 'assistant')
    const assistantMsg: OpenRouterMessage = {
      role: 'assistant',
      content: msg.content || null,
    }
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      assistantMsg.tool_calls = msg.toolCalls.map((tc: LLMToolCall) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }))
    }
    return assistantMsg
  })
}

export class LLMClient {
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  async chat(
    messages: LLMMessage[],
    options?: {
      tools?: ToolDefinition[]
    }
  ): Promise<LLMResponse> {
    const openRouterMessages = toOpenRouterMessages(messages)

    const tools: OpenRouterTool[] | undefined = options?.tools?.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: openRouterMessages,
    }

    if (tools && tools.length > 0) {
      body.tools = tools
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Repere',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
    }

    const data = (await response.json()) as OpenRouterResponse
    const choice = data.choices[0]

    const result: LLMResponse = {
      content: choice.message.content ?? '',
      finishReason: choice.finish_reason as LLMResponse['finishReason'],
    }

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      result.toolCalls = choice.message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }))
    }

    return result
  }
}

/**
 * Helper to create an assistant message with tool calls (for conversation history)
 */
export function createAssistantMessage(content: string, toolCalls?: LLMToolCall[]): LLMMessage {
  return { role: 'assistant', content, toolCalls }
}

/**
 * Helper to create a tool result message
 */
export function createToolResultMessage(toolCallId: string, result: string): LLMMessage {
  return { role: 'tool', toolCallId, content: result }
}
