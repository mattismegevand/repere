import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import Bot from 'lucide-react/dist/esm/icons/bot'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Square from 'lucide-react/dist/esm/icons/square'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import X from 'lucide-react/dist/esm/icons/x'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Tooltip } from '@/components/ui/Tooltip'
import { useAgent } from '@/lib/ai/useAgent'
import { useChatStore } from '@/stores/chatStore'
import { usePanelStore } from '@/stores/panelStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import { useThemeStore } from '@/stores/themeStore'
import { ApiKeySetup } from './ApiKeySetup'
import { ChatMessage } from './ChatMessage'

export function AIChat() {
  const isOpen = useChatStore((s) => s.isOpen)
  const setOpen = useChatStore((s) => s.setOpen)
  const messages = useChatStore((s) => s.messages)
  const isLoading = useChatStore((s) => s.isLoading)
  const apiKey = useChatStore((s) => s.apiKey)
  const clearMessages = useChatStore((s) => s.clearMessages)
  const { sendMessage, abort, isRunning, status, steps } = useAgent()
  const setActiveNode = usePipelineStore((s) => s.setActiveNode)
  const nodes = usePipelineStore((s) => s.nodes)
  const structureStyle = useThemeStore((s) => s.structureStyle)
  const isClassic = structureStyle === 'classic'
  const aiChatPanelWidth = usePanelStore((s) => s.aiChatPanelWidth)
  const setAiChatPanelWidth = usePanelStore((s) => s.setAiChatPanelWidth)

  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when messages or steps change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, steps])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`
  }, [input])

  const handleSubmit = async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading || isRunning) return

    if (!apiKey) {
      setShowSettings(true)
      return
    }

    setInput('')
    await sendMessage(trimmedInput)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      const startX = e.clientX
      const startWidth = aiChatPanelWidth

      const handleMouseMove = (e: MouseEvent) => {
        // Moving left increases width (panel is on right side)
        const delta = startX - e.clientX
        setAiChatPanelWidth(startWidth + delta)
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [aiChatPanelWidth, setAiChatPanelWidth]
  )

  if (!isOpen) return null

  return (
    <div
      className={`bg-[var(--color-bg-primary)] flex flex-col h-full shrink-0 border border-[var(--color-border)] overflow-hidden relative ${isClassic ? '' : 'ml-2 rounded-lg'}`}
      style={{ width: aiChatPanelWidth }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[var(--color-accent)]/20 transition-colors z-10 flex items-center"
        onMouseDown={handleResizeStart}
        style={{ userSelect: isResizing ? 'none' : undefined }}
      >
        <div className="w-0.5 h-8 rounded-full bg-[var(--color-border)] ml-0.5 opacity-0 hover:opacity-100 transition-opacity" />
      </div>

      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            AI Assistant
          </span>
          <div className="flex items-center gap-0.5">
            {messages.length > 0 && (
              <Tooltip content="Clear chat" side="bottom">
                <button
                  type="button"
                  onClick={clearMessages}
                  className="p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            )}
            <Tooltip content="Settings" side="bottom">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1 rounded hover:bg-[var(--color-bg-secondary)] ${
                  showSettings ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <Tooltip content="Close" side="bottom">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Inline Settings Panel */}
        {showSettings && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <ApiKeySetup onClose={() => setShowSettings(false)} />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto space-y-3 ${isClassic ? '' : 'p-3'}`}>
        {messages.length === 0 && !showSettings && (
          <div className="text-center text-[var(--color-text-muted)] py-8">
            <Bot className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-xs mb-3">Describe what you want to do with your data</p>
            <div className="space-y-1.5 text-[10px]">
              <p className="px-2 py-1 bg-[var(--color-bg-secondary)] rounded inline-block">"Clean this dataset"</p>
              <br />
              <p className="px-2 py-1 bg-[var(--color-bg-secondary)] rounded inline-block">"Filter to active users"</p>
              <br />
              <p className="px-2 py-1 bg-[var(--color-bg-secondary)] rounded inline-block">
                "Show sales by region with a chart"
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Live execution progress (only while running) */}
        {isRunning && (
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-3 border border-[var(--color-border)]">
            {/* Status */}
            <div className="flex items-center gap-2 text-xs mb-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-accent)]" />
              <span className="text-[var(--color-text-secondary)]">{status || 'Working...'}</span>
            </div>

            {/* Steps */}
            {steps.length > 0 && (
              <div className="space-y-1.5 mt-2 pt-2 border-t border-[var(--color-border)]">
                {steps.map((step, i) => {
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

            {/* Abort button */}
            <button
              type="button"
              onClick={abort}
              className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] hover:text-red-500"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
          </div>
        )}

        {/* Loading indicator (for initial thinking) */}
        {isLoading && !isRunning && (
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`border-t border-[var(--color-border)] shrink-0 ${isClassic ? '' : 'p-2'}`}>
        <div className="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus-within:border-[var(--color-accent)] transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={!apiKey ? 'Set up API key first...' : isRunning ? 'Working...' : 'Ask anything...'}
            disabled={!apiKey || isLoading || isRunning}
            className="w-full bg-transparent text-xs resize-none focus:outline-none disabled:opacity-50 px-3 py-2 pr-9 overflow-y-auto"
            style={{ minHeight: '36px', maxHeight: '300px' }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || !apiKey || isLoading || isRunning}
            className="absolute right-2 bottom-1.5 p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 disabled:hover:text-[var(--color-text-muted)] disabled:hover:bg-transparent transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
        {!apiKey && (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 text-center">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="text-[var(--color-accent)] hover:underline"
            >
              Configure API key
            </button>{' '}
            to get started
          </p>
        )}
      </div>
    </div>
  )
}
