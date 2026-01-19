interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
}

// Proportions from lg: icon 40px > text ~30px, gap 12px (icon ~1.33x text, gap ~0.3x icon)
const sizes = {
  sm: { icon: 'w-3.5 h-3.5', text: 'text-xs', gap: 'gap-1' },
  md: { icon: 'w-6 h-6', text: 'text-lg', gap: 'gap-2' },
  lg: { icon: 'w-10 h-10', text: 'text-3xl', gap: 'gap-3' },
}

export function Logo({ size = 'md' }: LogoProps) {
  const { icon, text, gap } = sizes[size]

  return (
    <div className={`flex items-center ${gap}`}>
      <svg className={icon} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="currentColor" />
        <rect x="22" y="22" width="20" height="20" rx="4" fill="var(--color-bg-primary)" />
      </svg>
      <span className={`${text} font-semibold font-logo`}>repere</span>
    </div>
  )
}
