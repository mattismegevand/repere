import { useState } from 'react'
import { useInView } from '@/hooks'
import { FakeCanvas } from './FakeCanvas'
import { FakeDataGrid } from './FakeDataGrid'

type ViewMode = 'table' | 'canvas'

export function ProductShowcase() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const { ref, isInView } = useInView<HTMLElement>({ threshold: 0.1 })

  return (
    <section
      ref={ref}
      className="py-16 transition-all duration-700 ease-out"
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(30px)',
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">See it in action</h2>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'table'
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setViewMode('canvas')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'canvas'
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            Pipeline View
          </button>
        </div>
      </div>

      {/* Content with crossfade */}
      <div className="relative">
        <div
          className={`transition-all duration-300 ${
            viewMode === 'table' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'
          }`}
        >
          <div className="overflow-x-auto">
            <FakeDataGrid />
          </div>
          <p className="mt-4 text-sm text-[var(--color-text-muted)] text-center">
            Spreadsheet-like interface with sorting, filtering, and inline editing
          </p>
        </div>

        <div
          className={`transition-all duration-300 ${
            viewMode === 'canvas' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'
          }`}
        >
          <div className="overflow-x-auto">
            <FakeCanvas />
          </div>
          <p className="mt-4 text-sm text-[var(--color-text-muted)] text-center">
            Visual DAG showing your entire transformation pipeline
          </p>
        </div>
      </div>
    </section>
  )
}
