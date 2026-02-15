import type { TokenEstimate } from '@/stores/agentTelemetryStore'

/**
 * Approximate token count for a string
 * Uses a simple heuristic: ~4 characters per token on average
 * This is a rough estimate - actual tokenization varies by model
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  // More accurate: split on whitespace and punctuation
  // Average English word is ~5 chars, average token is ~4 chars
  // So roughly 1.25 tokens per word, or ~3.5-4 chars per token
  return Math.ceil(text.length / 4)
}

/**
 * Estimate token counts for different context components
 */
export function estimateContextTokens(
  systemPrompt: string,
  contextPayload: string,
  messageHistory: Array<{ role: string; content: string }>
): TokenEstimate[] {
  const estimates: TokenEstimate[] = []

  estimates.push({
    component: 'System Prompt',
    tokens: estimateTokens(systemPrompt),
  })

  estimates.push({
    component: 'Context',
    tokens: estimateTokens(contextPayload),
  })

  const historyTokens = messageHistory.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)
  estimates.push({
    component: 'Message History',
    tokens: historyTokens,
  })

  const total = estimates.reduce((sum, e) => sum + e.tokens, 0)
  estimates.push({
    component: 'Total',
    tokens: total,
  })

  return estimates
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString()
  return `${(tokens / 1000).toFixed(1)}k`
}

/**
 * Get token warning level based on typical context limits
 */
export function getTokenWarningLevel(tokens: number): 'normal' | 'warning' | 'danger' {
  // Typical context windows: 8k, 16k, 32k, 128k
  // Warn at ~75% of smallest common context (8k)
  if (tokens > 6000) return 'danger'
  if (tokens > 4000) return 'warning'
  return 'normal'
}

/**
 * Estimate tool definition tokens
 */
export function estimateToolDefinitionsTokens(
  tools: Array<{ name: string; description: string; parameters: unknown }>
): number {
  let total = 0
  for (const tool of tools) {
    total += estimateTokens(tool.name)
    total += estimateTokens(tool.description)
    total += estimateTokens(JSON.stringify(tool.parameters))
  }
  return total
}
