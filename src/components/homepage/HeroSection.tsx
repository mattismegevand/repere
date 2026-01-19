import { ArrowRight, Check, Clock, Database, GitBranch, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Logo } from '@/components/ui'
import { usePipeline } from '@/lib/pipeline'
import { isTauri } from '@/lib/platform'
import type { RecentSessionEntry } from '@/lib/sessions/types'
import { usePanelStore } from '@/stores/panelStore'

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface HeroSectionProps {
  onOpenFile: () => void
  onLoadSampleData: () => void
  onStartTour: () => void
  animationClass: string
  isDragOver?: boolean
  dbLoading?: boolean
}

export function HeroSection({
  onOpenFile,
  onLoadSampleData,
  onStartTour,
  animationClass,
  isDragOver = false,
  dbLoading = false,
}: HeroSectionProps) {
  const recentSessions = usePanelStore((s) => s.recentSessions)
  const removeRecentSession = usePanelStore((s) => s.removeRecentSession)
  const setShowHomepage = usePanelStore((s) => s.setShowHomepage)
  const setCanvasMode = usePanelStore((s) => s.setCanvasMode)
  const { openRecentSession } = usePipeline()

  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleOpenSession = useCallback(
    async (session: RecentSessionEntry) => {
      setLoadingId(session.id)
      try {
        const result = await openRecentSession(session)
        if (result.success || result.error === 'needs-files') {
          setShowHomepage(false)
          setCanvasMode(true)
        }
      } finally {
        setLoadingId(null)
      }
    },
    [openRecentSession, setShowHomepage, setCanvasMode]
  )

  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-20">
      {/* Logo */}
      <div className={`mb-8 ${animationClass}`}>
        <Logo size="lg" />
      </div>

      {/* Privacy badge */}
      <div className={`mb-6 ${animationClass}`}>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--color-accent-bg)] text-[var(--color-accent)] border border-[var(--color-accent)]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
          100% client-side - Your data never leaves your browser
        </span>
      </div>

      {/* Headline */}
      <h1
        className={`text-4xl sm:text-5xl lg:text-6xl font-semibold text-[var(--color-text-primary)] leading-[1.1] mb-5 ${animationClass}`}
        style={{ animationDelay: '100ms' }}
      >
        Explore datasets too large
        <br />
        for spreadsheets.
      </h1>

      {/* Subheadline */}
      <p
        className={`text-lg sm:text-xl text-[var(--color-text-secondary)] mb-8 max-w-2xl ${animationClass}`}
        style={{ animationDelay: '200ms' }}
      >
        SQL-powered data exploration that runs entirely in your browser. No uploads. No server. No signup.
      </p>

      {/* Drop zone */}
      <div
        onClick={dbLoading ? undefined : onOpenFile}
        className={`group mb-6 ${animationClass} transition-transform duration-200 ${isDragOver ? 'scale-[1.02]' : ''} ${dbLoading ? 'cursor-wait' : 'cursor-pointer'}`}
        style={{ animationDelay: '300ms' }}
      >
        <div
          className={`relative flex items-center gap-4 p-4 rounded-xl border-2 border-dashed transition-all duration-200 ${
            dbLoading
              ? 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 opacity-75'
              : isDragOver
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)] shadow-lg shadow-[var(--color-accent)]/25'
                : 'border-[var(--color-border)] hover:border-[var(--color-accent)] bg-[var(--color-bg-secondary)]/50 hover:bg-gradient-to-r hover:from-[var(--color-accent-bg)]/50 hover:to-transparent group-hover:shadow-lg group-hover:shadow-[var(--color-accent)]/10'
          }`}
        >
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-lg transition-all duration-200 ${
              dbLoading
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                : isDragOver
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent-bg)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:bg-[var(--color-accent-bg)]'
            }`}
          >
            {dbLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Upload className={`w-6 h-6 ${isDragOver ? 'animate-bounce' : ''}`} />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-[var(--color-text-primary)]">
              {dbLoading
                ? 'Initializing database...'
                : isDragOver
                  ? 'Drop to load file'
                  : 'Drop a file to start exploring'}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">CSV, JSON, JSONL, Parquet, or XLSX</p>
          </div>
          {!dbLoading && (
            <ArrowRight
              className={`w-5 h-5 transition-all duration-200 ${
                isDragOver
                  ? 'text-[var(--color-accent)] translate-x-1'
                  : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1'
              }`}
            />
          )}
        </div>
      </div>

      {/* Recent */}
      {recentSessions.length > 0 && (
        <div className={`mb-6 ${animationClass}`} style={{ animationDelay: '350ms' }}>
          <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Recent</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentSessions.slice(0, 6).map((session) => {
              const isDisabled = loadingId === session.id || dbLoading
              return (
                // biome-ignore lint/a11y/useSemanticElements: Using div because this contains a nested button (remove), and <button> cannot contain <button>
                <div
                  key={session.id}
                  role="button"
                  tabIndex={isDisabled ? -1 : 0}
                  onClick={isDisabled ? undefined : () => handleOpenSession(session)}
                  onKeyDown={
                    isDisabled
                      ? undefined
                      : (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleOpenSession(session)
                          }
                        }
                  }
                  aria-disabled={isDisabled}
                  className={`group relative flex flex-col items-start p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]/30 transition-all duration-200 text-left ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start justify-between w-full gap-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {session.name.replace(/\.repere$/, '')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeRecentSession(session.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-opacity shrink-0"
                      aria-label="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Preview info */}
                  {session.preview && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-secondary)]">
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {session.preview.datasets.slice(0, 2).join(', ')}
                        {session.preview.datasets.length > 2 && ` +${session.preview.datasets.length - 2}`}
                      </span>
                      {session.preview.viewCount > 0 && (
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {session.preview.viewCount} {session.preview.viewCount === 1 ? 'view' : 'views'}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(session.openedAt)}
                    </span>
                    {session.size && (
                      <>
                        <span>·</span>
                        <span>{formatSize(session.size)}</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className={`flex flex-wrap items-center gap-4 mb-8 ${animationClass}`} style={{ animationDelay: '400ms' }}>
        {!isTauri() && (
          <button
            onClick={onLoadSampleData}
            disabled={dbLoading}
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] hover:scale-[1.02] hover:shadow-md hover:shadow-[var(--color-accent)]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            {dbLoading ? 'Loading...' : 'Try with sample data'}
            {!dbLoading && (
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            )}
          </button>
        )}
        {!isTauri() && (
          <button
            onClick={onStartTour}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)] active:scale-[0.98] transition-all duration-200"
          >
            Take a quick tour
          </button>
        )}
      </div>

      {/* Trust badges (web only) */}
      {!isTauri() && (
        <div
          className={`flex flex-wrap items-center gap-3 text-sm ${animationClass}`}
          style={{ animationDelay: '500ms' }}
        >
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-text-secondary)]">
            <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />
            No signup required
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-text-secondary)]">
            <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />
            No server uploads
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-text-secondary)]">
            <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />
            Free & open source
          </span>
        </div>
      )}
    </div>
  )
}
