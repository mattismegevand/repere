import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import Building2 from 'lucide-react/dist/esm/icons/building-2'
import { useInView } from '@/hooks'

export function EnterpriseSection() {
  const { ref, isInView } = useInView<HTMLElement>({ threshold: 0.1 })

  return (
    <section
      ref={ref}
      className="py-8 transition-all duration-700 ease-out"
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">Building for your team?</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Team sharing, priority support, and custom solutions available.
            </p>
          </div>
        </div>
        <a
          href="mailto:contact@repere.ai"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-tertiary)] transition-colors whitespace-nowrap"
        >
          Contact us
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </section>
  )
}
