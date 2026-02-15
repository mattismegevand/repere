import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Upload from 'lucide-react/dist/esm/icons/upload'
import { siGithub } from 'simple-icons'
import { useInView } from '@/hooks'

interface CTASectionProps {
  onOpenFile: () => void
  onLoadSampleData: () => void
  dbLoading?: boolean
}

export function CTASection({ onOpenFile, onLoadSampleData, dbLoading = false }: CTASectionProps) {
  const { ref, isInView } = useInView<HTMLElement>({ threshold: 0.1 })

  return (
    <section
      ref={ref}
      className="py-16 transition-all duration-700 ease-out"
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      <div className="grid md:grid-cols-2 gap-6">
        {/* Primary CTA */}
        <div className="p-8 rounded-xl bg-gradient-to-br from-[var(--color-accent-bg)] to-[var(--color-bg-secondary)] border border-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/40 transition-colors duration-300">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Ready to explore?</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Drop a file to get started, or try the sample dataset.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onOpenFile}
              disabled={dbLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] hover:scale-[1.02] hover:shadow-md hover:shadow-[var(--color-accent)]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              <Upload className="w-4 h-4" />
              Open a file
            </button>
            <button
              onClick={onLoadSampleData}
              disabled={dbLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-text-muted)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Try sample data
            </button>
          </div>
        </div>

        {/* Secondary CTA */}
        <div className="p-8 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)]/50 transition-colors duration-300">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Want to learn more?</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">Check out the source code or report an issue.</p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/mattismegevand/repere"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-text-muted)] active:scale-[0.98] transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" role="img" aria-label="GitHub">
                <title>GitHub</title>
                <path d={siGithub.path} />
              </svg>
              GitHub
            </a>
            <a
              href="https://github.com/mattismegevand/repere/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-text-muted)] active:scale-[0.98] transition-all duration-200"
            >
              <ExternalLink className="w-4 h-4" />
              Report Issue
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
