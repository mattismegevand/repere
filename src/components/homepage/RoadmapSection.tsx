import { ArrowRight, Circle, Clock, Sparkles } from 'lucide-react'
import { useInView } from '@/hooks'

const ROADMAP_ITEMS = [
  {
    title: 'Improved AI Agents',
    desc: 'Smarter natural language data exploration',
    status: 'in-progress' as const,
  },
  {
    title: 'More File Formats',
    desc: 'SQLite, Arrow, and more',
    status: 'planned' as const,
  },
  {
    title: 'Connectors',
    desc: 'Database and API integrations',
    status: 'planned' as const,
  },
  {
    title: 'Live Collaboration',
    desc: 'Real-time multi-user sessions',
    status: 'coming-soon' as const,
  },
]

const STATUS_CONFIG = {
  'in-progress': {
    label: 'In Progress',
    Icon: Clock,
    className: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)]',
  },
  planned: {
    label: 'Planned',
    Icon: Circle,
    className: 'text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)]',
  },
  'coming-soon': {
    label: 'Coming Soon',
    Icon: Sparkles,
    className: 'text-[var(--color-accent)] bg-[var(--color-accent-bg)]',
  },
}

export function RoadmapSection() {
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
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">What's next</h2>
        <a
          href="https://github.com/mattismegevand/repere/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
        >
          View full roadmap
          <ArrowRight className="w-3 h-3" />
        </a>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {ROADMAP_ITEMS.map(({ title, desc, status }) => {
          const config = STATUS_CONFIG[status]
          return (
            <div
              key={title}
              className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-medium text-[var(--color-text-primary)]">{title}</h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
                >
                  <config.Icon className="w-3 h-3" />
                  {config.label}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">{desc}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
