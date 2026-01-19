import { useEffect, useState } from 'react'

function DataParticle({ delay, path }: { delay: number; path: string }) {
  return (
    <circle r="3" fill="var(--color-accent)" opacity="0.9">
      <animateMotion dur="3s" repeatCount="indefinite" path={path} begin={`${delay}s`} />
    </circle>
  )
}

export function DataFlowAnimation() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300)
    return () => clearTimeout(timer)
  }, [])

  const flowPath = 'M 20 40 Q 80 40 100 40 T 180 40 T 260 40 T 340 40'

  return (
    <div className={`transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <p className="text-center text-sm text-[var(--color-text-muted)] mb-2">
        Every transformation recomputes on the fly. Your data flows through the pipeline in real-time.
      </p>
      <svg
        width="100%"
        height="80"
        viewBox="0 0 360 80"
        className="overflow-visible"
        aria-label="Data transformation flow"
      >
        <title>Data transformation pipeline</title>
        {/* Flow line */}
        <path d={flowPath} fill="none" stroke="var(--color-border)" strokeWidth="2" strokeDasharray="4 4" />

        {/* Stage boxes */}
        <g transform="translate(10, 25)">
          <rect width="30" height="30" rx="4" fill="var(--color-bg-secondary)" stroke="var(--color-border)" />
          <text
            x="15"
            y="15"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fill="var(--color-text-muted)"
          >
            CSV
          </text>
        </g>

        <g transform="translate(85, 25)">
          <rect width="30" height="30" rx="4" fill="var(--color-accent-bg)" stroke="var(--color-accent)" />
          <text x="15" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="var(--color-accent)">
            Filter
          </text>
        </g>

        <g transform="translate(165, 25)">
          <rect width="30" height="30" rx="4" fill="var(--color-accent-bg)" stroke="var(--color-accent)" />
          <text x="15" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="var(--color-accent)">
            Join
          </text>
        </g>

        <g transform="translate(245, 25)">
          <rect width="30" height="30" rx="4" fill="var(--color-accent-bg)" stroke="var(--color-accent)" />
          <text x="15" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="var(--color-accent)">
            Pivot
          </text>
        </g>

        <g transform="translate(320, 25)">
          <rect width="30" height="30" rx="4" fill="var(--color-success-bg)" stroke="var(--color-success)" />
          <text x="15" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="var(--color-success)">
            Out
          </text>
        </g>

        {/* Animated particles */}
        <DataParticle delay={0} path={flowPath} />
        <DataParticle delay={0.6} path={flowPath} />
        <DataParticle delay={1.2} path={flowPath} />
        <DataParticle delay={1.8} path={flowPath} />
        <DataParticle delay={2.4} path={flowPath} />
      </svg>
    </div>
  )
}
