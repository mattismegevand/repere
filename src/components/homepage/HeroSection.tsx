import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import Check from 'lucide-react/dist/esm/icons/check'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Database from 'lucide-react/dist/esm/icons/database'
import GitBranch from 'lucide-react/dist/esm/icons/git-branch'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Target from 'lucide-react/dist/esm/icons/target'
import Upload from 'lucide-react/dist/esm/icons/upload'
import X from 'lucide-react/dist/esm/icons/x'
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
    <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-24">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--color-text-primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-text-primary) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Logo */}
      <div className={`mb-10 ${animationClass}`}>
        <Logo size="lg" />
      </div>

      {/* Status badge */}
      <div className={`mb-8 ${animationClass}`} style={{ animationDelay: '50ms' }}>
        <span className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-success)]" />
          </span>
          100% client-side — Your data never leaves your browser
        </span>
      </div>

      {/* Headline */}
      <h1
        className={`text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold text-[var(--color-text-primary)] leading-[1.1] tracking-tight mb-6 ${animationClass}`}
        style={{ animationDelay: '100ms' }}
      >
        Explore datasets too large
        <br />
        for spreadsheets.
      </h1>

      {/* Subheadline */}
      <p
        className={`text-lg sm:text-xl text-[var(--color-text-secondary)] mb-10 max-w-2xl leading-relaxed ${animationClass}`}
        style={{ animationDelay: '150ms' }}
      >
        SQL-powered data exploration that runs entirely in your browser.
        <br className="hidden sm:block" />
        No uploads. No server. No signup.
      </p>

      {/* Drop zone */}
      <div
        onClick={dbLoading ? undefined : onOpenFile}
        className={`group mb-8 ${animationClass} transition-all duration-300 ${isDragOver ? 'scale-[1.01]' : ''} ${dbLoading ? 'cursor-wait' : 'cursor-pointer'}`}
        style={{ animationDelay: '200ms' }}
      >
        <div
          className={`relative flex items-center gap-5 p-5 rounded-xl border-2 transition-all duration-300 ${
            dbLoading
              ? 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] opacity-60'
              : isDragOver
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)] shadow-lg'
                : 'border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]/50 hover:shadow-md'
          }`}
        >
          <div
            className={`flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 ${
              dbLoading
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                : isDragOver
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] group-hover:bg-[var(--color-accent)] group-hover:text-white'
            }`}
          >
            {dbLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isDragOver ? (
              <Target className="w-6 h-6" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[var(--color-text-primary)] mb-0.5">
              {dbLoading ? 'Initializing database...' : isDragOver ? 'Drop to load file' : 'Drop a file to start'}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Supports CSV, JSON, JSONL, Parquet, and Excel files
            </p>
          </div>
          {!dbLoading && (
            <ArrowRight
              className={`w-5 h-5 transition-all duration-300 ${
                isDragOver
                  ? 'text-[var(--color-accent)] translate-x-1'
                  : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1'
              }`}
            />
          )}
        </div>
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className={`mb-10 ${animationClass}`} style={{ animationDelay: '250ms' }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
            Recent
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
                  className={`group relative flex flex-col p-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-accent)]/50 hover:shadow-sm transition-all duration-200 text-left ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start justify-between w-full gap-2 mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {session.name.replace(/\.repere$/, '')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeRecentSession(session.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-all shrink-0"
                      aria-label="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {session.preview && (
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mb-1.5">
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {session.preview.datasets.slice(0, 2).join(', ')}
                        {session.preview.datasets.length > 2 && ` +${session.preview.datasets.length - 2}`}
                      </span>
                      {session.preview.viewCount > 0 && (
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {session.preview.viewCount}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeTime(session.openedAt)}</span>
                    {session.size && (
                      <>
                        <span className="text-[var(--color-border)]">·</span>
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
      <div className={`flex flex-wrap items-center gap-3 mb-10 ${animationClass}`} style={{ animationDelay: '300ms' }}>
        {!isTauri() && (
          <button
            onClick={onLoadSampleData}
            disabled={dbLoading}
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--color-accent)] text-white font-medium shadow-sm hover:shadow-md active:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {dbLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>Try with sample data</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        )}
        {!isTauri() && (
          <button
            onClick={onStartTour}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)] transition-all duration-200"
          >
            Take a quick tour
          </button>
        )}
      </div>

      {/* Trust indicators */}
      {!isTauri() && (
        <div
          className={`flex flex-wrap items-center gap-2 text-sm ${animationClass}`}
          style={{ animationDelay: '350ms' }}
        >
          {['No signup required', 'No server uploads', 'Free & open source'].map((text) => (
            <span
              key={text}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-text-secondary)] border border-[var(--color-success)]/20"
            >
              <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />
              {text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
