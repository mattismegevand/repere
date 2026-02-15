import Bot from 'lucide-react/dist/esm/icons/bot'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { formatShortcut } from '@/lib/platform'
import { useChatStore } from '@/stores/chatStore'
import { usePanelStore } from '@/stores/panelStore'
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
  const isChatOpen = useChatStore((s) => s.isOpen)
  const toggleChat = useChatStore((s) => s.toggleChat)

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1.5 bg-[var(--color-bg-primary)]">
      <MenuBar onOpenFile={onOpenFile} onLoadSession={onLoadSession} />
      <div className="flex items-center gap-2">
        <SignInButton />
        <button
          onClick={toggleChat}
          aria-label="Toggle AI assistant"
          title="AI Assistant"
          className={`px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
            isChatOpen
              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-sm'
              : 'text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
          }`}
        >
          <Bot className="h-4 w-4" />
        </button>
        <button
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          className="px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)] hover:border-[var(--color-text-muted)] transition-all duration-200"
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
          className="px-4 py-1.5 text-xs font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
        >
          {showHomepage ? 'Open file' : 'Add file'}
        </button>
      </div>
    </header>
  )
}
