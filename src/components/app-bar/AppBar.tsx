import { Bot, Loader2 } from 'lucide-react'
import { formatShortcut } from '@/lib/platform'
import { usePanelStore } from '@/stores'
import { useChatStore } from '@/stores/chatStore'
import { MenuBar } from './MenuBar'
import { SignInButton } from './SignInButton'

interface AppBarProps {
  loading?: boolean
  onOpenFile: () => void
  onLoadSession: () => void
  onOpenCommandPalette: () => void
}

export function AppBar({ loading, onOpenFile, onLoadSession, onOpenCommandPalette }: AppBarProps) {
  const showHomepage = usePanelStore((s) => s.showHomepage)
  const { isOpen: isChatOpen, toggleChat } = useChatStore()

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] px-2 py-1">
      <MenuBar onOpenFile={onOpenFile} onLoadSession={onLoadSession} />
      <div className="flex items-center gap-2">
        <SignInButton />
        <button
          onClick={toggleChat}
          aria-label="Toggle AI assistant"
          title="AI Assistant"
          className={`px-2 py-1 rounded-md border transition-colors ${
            isChatOpen
              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
              : 'text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border-[var(--color-border)]'
          }`}
        >
          <Bot className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          className="px-2 py-1 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-md border border-[var(--color-border)]"
        >
          {formatShortcut('⌘K')}
        </button>
        {loading && (
          <div className="flex items-center gap-2 px-2 text-xs text-[var(--color-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        <button
          onClick={onOpenFile}
          className="px-3 py-1 text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded-md"
        >
          {showHomepage ? 'Open file' : 'Add file'}
        </button>
      </div>
    </header>
  )
}
