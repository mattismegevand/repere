import Bot from 'lucide-react/dist/esm/icons/bot'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import User from 'lucide-react/dist/esm/icons/user'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import { useState } from 'react'
import Markdown from 'react-markdown'
import { Tooltip } from '@/components/ui/Tooltip'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { ChatMessage as ChatMessageType } from '@/types/ai'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const setActiveNode = usePipelineStore((s) => s.setActiveNode)
  const nodes = usePipelineStore((s) => s.nodes)
  const [stepsExpanded, setStepsExpanded] = useState(false)

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
        }`}
      >
        {isUser ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
      </div>

      {/* Message content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        <div
          className={`inline-block px-2.5 py-1.5 rounded text-xs leading-relaxed ${
            isUser
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)]'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:bg-[var(--color-bg-tertiary)] [&_code]:px-1 [&_code]:rounded [&_pre]:bg-[var(--color-bg-tertiary)] [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto">
              <Markdown>{message.content}</Markdown>
            </div>
          )}
        </div>

        {/* Executed steps (collapsible) */}
        {message.executedSteps && message.executedSteps.length > 0 && (
          <div className="mt-2 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] text-left">
            {/* Collapsed summary header */}
            <button
              type="button"
              onClick={() => setStepsExpanded(!stepsExpanded)}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {stepsExpanded ? (
                <ChevronDown className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0" />
              )}
              <span>
                {message.executedSteps.filter((s) => s.success).length} step
                {message.executedSteps.filter((s) => s.success).length !== 1 ? 's' : ''} completed
                {message.executedSteps.some((s) => !s.success) &&
                  `, ${message.executedSteps.filter((s) => !s.success).length} failed`}
              </span>
            </button>

            {/* Expanded steps */}
            {stepsExpanded && (
              <div className="space-y-1.5 px-2.5 pb-2.5 pt-0 border-t border-[var(--color-border)]">
                {message.executedSteps.map((step, i) => {
                  const nodeExists = step.nodeId ? !!nodes[step.nodeId] : false
                  const isDeleted = step.nodeId && !nodeExists
                  const isClickable = step.nodeId && nodeExists
                  const tooltipContent = isDeleted ? 'Node was deleted' : isClickable ? 'Click to view node' : null

                  const stepContent = (
                    <div
                      key={i}
                      className={`flex items-start gap-2 text-[11px] ${isClickable ? 'cursor-pointer hover:bg-[var(--color-bg-tertiary)]' : ''} ${isDeleted ? 'opacity-50' : ''} -mx-1 px-1 py-0.5 rounded`}
                      onClick={isClickable ? () => setActiveNode(step.nodeId!) : undefined}
                    >
                      {isDeleted ? (
                        <Trash2 className="w-3.5 h-3.5 text-[var(--color-text-muted)] mt-0.5 shrink-0" />
                      ) : step.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span
                          className={
                            isDeleted
                              ? 'line-through text-[var(--color-text-muted)]'
                              : 'text-[var(--color-text-primary)]'
                          }
                        >
                          {step.description}
                        </span>
                        <span className="text-[var(--color-text-muted)] ml-1.5">{step.message}</span>
                      </div>
                    </div>
                  )

                  return tooltipContent ? (
                    <Tooltip key={i} content={tooltipContent} side="left">
                      {stepContent}
                    </Tooltip>
                  ) : (
                    stepContent
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5 px-0.5">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  )
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
