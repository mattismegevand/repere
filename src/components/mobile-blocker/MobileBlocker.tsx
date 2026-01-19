import { ArrowRight, Monitor, Tablet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/ui'
import { isSmallScreen } from '@/lib/device'

interface MobileBlockerProps {
  children: React.ReactNode
  /** Only show the blocker when this is true (e.g., when data is loaded) */
  active?: boolean
}

export function MobileBlocker({ children, active = false }: MobileBlockerProps) {
  const [isSmall, setIsSmall] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmall(isSmallScreen())
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Show blocker only when active (in app) AND screen is small AND not dismissed
  const showBlocker = active && isSmall && !dismissed

  if (!showBlocker) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 bg-[var(--color-bg-primary)] z-[100] flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        {/* Device badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--color-accent-bg)] text-[var(--color-accent)] border border-[var(--color-accent)]/20">
            <Monitor className="w-4 h-4" />
            <Tablet className="w-3.5 h-3.5" />
            <span>Desktop or tablet recommended</span>
          </span>
        </div>

        {/* Message */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Designed for larger screens</h1>
          <p className="text-[var(--color-text-secondary)] leading-relaxed">
            repere is a data exploration tool with tables, charts, and visual pipelines that need more screen space to
            work effectively.
          </p>
        </div>

        {/* Continue button */}
        <button
          onClick={() => setDismissed(true)}
          className="group w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:scale-[0.98] transition-all duration-200"
        >
          Continue anyway
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
        </button>
      </div>
    </div>
  )
}
