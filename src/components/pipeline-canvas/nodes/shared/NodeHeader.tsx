import type { ComponentType, ReactNode, SVGProps } from 'react'

export type TypeBadgeColor = 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'amber' | 'gray'

/** Icon component type - supports Lucide icons and custom SVG components */
type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>

export interface NodeHeaderProps {
  /** Type badge label (e.g., "Dataset", "Filter", "Join") */
  badge: string
  /** Badge color */
  badgeColor?: TypeBadgeColor
  /** Node name */
  name: string
  /** Optional icon before badge */
  icon?: IconComponent
  /** Actions slot (buttons shown on hover) */
  actions?: ReactNode
  /** Optional subtitle/summary line (string or ReactNode) */
  subtitle?: ReactNode
  /** Max width for name truncation */
  nameMaxWidth?: string
}

const BADGE_COLORS: Record<TypeBadgeColor, string> = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  green: 'bg-green-500/10 text-green-600 dark:text-green-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  gray: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
}

export function NodeHeader({
  badge,
  badgeColor = 'gray',
  name,
  icon: Icon,
  actions,
  subtitle,
  nameMaxWidth = 'max-w-[140px]',
}: NodeHeaderProps) {
  return (
    <div className="px-3 pt-3 pb-2 border-b border-[var(--color-border)]">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${BADGE_COLORS[badgeColor]}`}
        >
          {badge}
        </span>
        <span className={`text-sm font-medium truncate flex-1 ${nameMaxWidth}`} title={name}>
          {name}
        </span>

        {/* Actions - individual buttons control their own visibility */}
        {actions && <div className="flex items-center gap-0.5">{actions}</div>}
      </div>

      {subtitle && (
        <div
          className="mt-1 text-xs text-[var(--color-text-secondary)] font-mono truncate"
          title={typeof subtitle === 'string' ? subtitle : undefined}
        >
          {subtitle}
        </div>
      )}
    </div>
  )
}
