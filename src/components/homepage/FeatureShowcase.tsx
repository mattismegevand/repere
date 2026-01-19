import { Code, History, ShieldCheck, Workflow, Zap } from 'lucide-react'
import { useState } from 'react'
import { useInView } from '@/hooks'

const SUPPORTING_FEATURES = [
  {
    id: 'fast',
    Icon: Zap,
    title: 'Instant',
    desc: 'Powered by DuckDB WASM',
    tooltip: {
      detail: 'Query millions of rows in milliseconds',
      example: 'SELECT * FROM large_table WHERE status = "active"',
      stat: '~50ms for 1M rows',
    },
  },
  {
    id: 'sql',
    Icon: Code,
    title: 'Full SQL',
    desc: 'Write queries when needed',
    tooltip: {
      detail: 'Full DuckDB SQL dialect with window functions, CTEs, and more',
      example: 'WITH ranked AS (SELECT *, ROW_NUMBER() OVER ...',
      stat: '100+ SQL functions',
    },
  },
  {
    id: 'history',
    Icon: History,
    title: 'Undo/Redo',
    desc: 'Never lose your work',
    tooltip: {
      detail: 'Every operation is tracked. Go back and forth freely.',
      example: 'Ctrl+Z / Ctrl+Shift+Z',
      stat: 'Unlimited history',
    },
  },
  {
    id: 'pipeline',
    Icon: Workflow,
    title: 'Visual DAG',
    desc: 'See your transformations',
    tooltip: {
      detail: 'Your entire transformation history as an interactive graph',
      example: 'Dataset → Filter → Join → Pivot',
      stat: 'Branch & merge',
    },
  },
]

interface FeatureTooltip {
  detail: string
  example: string
  stat: string
}

function FeatureCard({
  id,
  Icon,
  title,
  desc,
  tooltip,
  index,
}: {
  id: string
  Icon: typeof Zap
  title: string
  desc: string
  tooltip: FeatureTooltip
  index: number
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      key={id}
      className="relative p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group"
      style={{ animationDelay: `${index * 100}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-accent-bg)] mb-3 group-hover:scale-110 transition-transform duration-200">
        <Icon className="w-4 h-4 text-[var(--color-accent)]" />
      </div>
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--color-text-muted)]">{desc}</p>

      {/* Hover tooltip */}
      <div
        className={`
          absolute left-0 right-0 top-full mt-2 p-3 rounded-lg z-20
          bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-lg
          transition-all duration-200 origin-top
          ${isHovered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}
        `}
      >
        <p className="text-sm text-[var(--color-text-secondary)] mb-2">{tooltip.detail}</p>
        <code className="block text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-1 rounded mb-2 truncate">
          {tooltip.example}
        </code>
        <span className="text-xs font-medium text-[var(--color-accent)]">{tooltip.stat}</span>
      </div>
    </div>
  )
}

export function FeatureShowcase() {
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
      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-8">Built for serious data work</h2>

      {/* Privacy hero card */}
      <div className="mb-6 p-8 rounded-xl bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] border border-[var(--color-border)] hover:border-[var(--color-success)]/30 transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-success-bg)] shadow-sm">
                <ShieldCheck className="w-5 h-5 text-[var(--color-success)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">100% Local Processing</h3>
            </div>
            <p className="text-[var(--color-text-secondary)] mb-4 max-w-lg">
              Your data never leaves your browser. Everything runs client-side using DuckDB WASM - no uploads, no
              tracking, complete privacy.
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="px-2.5 py-1 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                No server
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                No tracking
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                Works offline
              </span>
            </div>
          </div>

          {/* Browser visual */}
          <div className="flex-shrink-0 w-full md:w-64">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden shadow-sm">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-error)]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-warning)]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)]" />
                <span className="ml-2 text-xs text-[var(--color-text-muted)] truncate">repere.ai</span>
              </div>
              <div className="p-4 flex flex-col items-center justify-center h-32 bg-gradient-to-b from-transparent to-[var(--color-success-bg)]/30">
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-[var(--color-success-bg)] mb-2">
                  <ShieldCheck className="w-6 h-6 text-[var(--color-success)]" />
                </div>
                <span className="text-xs text-[var(--color-text-muted)] text-center">Data stays in your browser</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supporting feature grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SUPPORTING_FEATURES.map((feature, index) => (
          <FeatureCard key={feature.id} {...feature} index={index} />
        ))}
      </div>
    </section>
  )
}
