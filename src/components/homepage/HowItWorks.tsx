import Download from 'lucide-react/dist/esm/icons/download'
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Wand2 from 'lucide-react/dist/esm/icons/wand-2'
import { useInView } from '@/hooks'

const STEPS = [
  {
    Icon: FileSpreadsheet,
    title: 'Drop a file',
    desc: 'CSV, JSON, Parquet, or Excel files',
  },
  {
    Icon: Wand2,
    title: 'Transform',
    desc: 'Filter, sort, pivot, join - all operations create new views',
  },
  {
    Icon: Download,
    title: 'Export',
    desc: 'Download as CSV or Parquet, share as URL, or save session',
  },
  {
    Icon: RefreshCw,
    title: 'Replay',
    desc: 'Load a new file with the same schema - your pipeline runs automatically',
  },
]

export function HowItWorks() {
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
      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-8">How it works</h2>

      <div className="relative">
        {/* Connection line - hidden on mobile */}
        <div className="hidden md:block absolute top-14 left-[calc(12.5%-12px)] right-[calc(12.5%-12px)] h-0.5 bg-gradient-to-r from-[var(--color-accent)]/20 via-[var(--color-accent)] to-[var(--color-accent)]/20" />

        <div className="grid md:grid-cols-4 gap-4">
          {STEPS.map(({ Icon, title, desc }, i) => (
            <div key={title} className="relative" style={{ animationDelay: `${i * 100}ms` }}>
              {/* Step card */}
              <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 hover:shadow-md transition-all duration-200 group">
                {/* Step number */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-accent)] text-white font-semibold mb-4 shadow-md shadow-[var(--color-accent)]/25 group-hover:scale-105 transition-transform duration-200">
                  {i + 1}
                </div>

                {/* Icon and content */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5 text-[var(--color-accent)] group-hover:scale-110 transition-transform duration-200" />
                  <h3 className="font-semibold text-[var(--color-text-primary)]">{title}</h3>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
