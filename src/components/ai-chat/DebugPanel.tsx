import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Hash from 'lucide-react/dist/esm/icons/hash'
import { useState } from 'react'
import { formatTokenCount, getTokenWarningLevel } from '@/lib/ai/token-utils'
import { useAgentTelemetryStore } from '@/stores/agentTelemetryStore'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: string
}

function CollapsibleSection({ title, defaultOpen = false, children, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {title}
        </span>
        {badge ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)]">{badge}</span>
        ) : null}
      </button>
      {isOpen ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  )
}

export function DebugPanel() {
  const currentSession = useAgentTelemetryStore((s) => s.currentSession)
  const toolCalls = useAgentTelemetryStore((s) => s.toolCalls)
  const tokenEstimates = useAgentTelemetryStore((s) => s.tokenEstimates)
  const systemPrompt = useAgentTelemetryStore((s) => s.systemPrompt)
  const contextPayload = useAgentTelemetryStore((s) => s.contextPayload)
  const messageHistory = useAgentTelemetryStore((s) => s.messageHistory)

  const totalTokens = tokenEstimates.find((e) => e.component === 'Total')?.tokens ?? 0
  const warningLevel = getTokenWarningLevel(totalTokens)

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] overflow-hidden text-xs">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            Debug Info
          </span>
          {currentSession && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                currentSession.status === 'running'
                  ? 'bg-blue-500/20 text-blue-500'
                  : currentSession.status === 'completed'
                    ? 'bg-green-500/20 text-green-500'
                    : currentSession.status === 'failed'
                      ? 'bg-red-500/20 text-red-500'
                      : 'bg-yellow-500/20 text-yellow-500'
              }`}
            >
              {currentSession.status}
            </span>
          )}
        </div>
      </div>

      {/* Token Estimates */}
      <CollapsibleSection title="Token Estimates" defaultOpen badge={formatTokenCount(totalTokens)}>
        <div className="space-y-1">
          {tokenEstimates.map((estimate) => (
            <div
              key={estimate.component}
              className={`flex items-center justify-between ${
                estimate.component === 'Total' ? 'font-medium pt-1 border-t border-[var(--color-border)]' : ''
              }`}
            >
              <span className="text-[var(--color-text-muted)]">{estimate.component}</span>
              <span
                className={
                  estimate.component === 'Total' && warningLevel !== 'normal'
                    ? warningLevel === 'danger'
                      ? 'text-red-500'
                      : 'text-yellow-500'
                    : 'text-[var(--color-text-primary)]'
                }
              >
                {formatTokenCount(estimate.tokens)}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Session Summary */}
      {currentSession && (
        <CollapsibleSection title="Session Summary">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Hash className="w-3 h-3" />
              <span>Iterations: {currentSession.totalIterations}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Hash className="w-3 h-3" />
              <span>
                Tool calls: {currentSession.successfulToolCalls} ok / {currentSession.failedToolCalls} failed
              </span>
            </div>
            {currentSession.totalDuration > 0 && (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <Clock className="w-3 h-3" />
                <span>Duration: {(currentSession.totalDuration / 1000).toFixed(1)}s</span>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Tool Calls */}
      {toolCalls.length > 0 && (
        <CollapsibleSection title="Tool Calls" badge={toolCalls.length.toString()}>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {toolCalls.map((call) => (
              <div
                key={call.id}
                className={`p-2 rounded text-[10px] ${call.success ? 'bg-green-500/5' : 'bg-red-500/5'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{call.name}</span>
                  <span className="text-[var(--color-text-muted)]">{call.duration}ms</span>
                </div>
                <pre className="overflow-x-auto text-[var(--color-text-muted)] whitespace-pre-wrap">
                  {JSON.stringify(call.arguments, null, 2)}
                </pre>
                {call.error ? <div className="mt-1 text-red-500">{call.error}</div> : null}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* System Prompt */}
      {systemPrompt && (
        <CollapsibleSection title="System Prompt">
          <pre className="p-2 bg-[var(--color-bg-tertiary)] rounded text-[10px] overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
            {systemPrompt}
          </pre>
        </CollapsibleSection>
      )}

      {/* Context Payload */}
      {contextPayload && (
        <CollapsibleSection title="Context Payload">
          <pre className="p-2 bg-[var(--color-bg-tertiary)] rounded text-[10px] overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
            {contextPayload}
          </pre>
        </CollapsibleSection>
      )}

      {/* Message History */}
      {messageHistory.length > 0 && (
        <CollapsibleSection title="Message History" badge={messageHistory.length.toString()}>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {messageHistory.map((msg, i) => (
              <div key={i} className="p-2 bg-[var(--color-bg-tertiary)] rounded">
                <div className="text-[10px] font-medium mb-1 text-[var(--color-text-muted)]">{msg.role}</div>
                <pre className="text-[10px] overflow-x-auto whitespace-pre-wrap">
                  {typeof msg.content === 'string' ? msg.content.slice(0, 500) : JSON.stringify(msg.content)}
                  {typeof msg.content === 'string' && msg.content.length > 500 ? '...' : ''}
                </pre>
                {msg.toolCalls && (
                  <div className="mt-1 text-[10px] text-[var(--color-accent)]">
                    {(msg.toolCalls as unknown[]).length} tool call(s)
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
