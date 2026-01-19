import type { LabelHTMLAttributes } from 'react'

type LabelSize = 'xs' | 'sm'

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  size?: LabelSize
}

const sizeStyles: Record<LabelSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
}

export function Label({ size = 'xs', className = '', children, ...props }: LabelProps) {
  return (
    <label className={`block text-[var(--color-text-muted)] mb-1 ${sizeStyles[size]} ${className}`} {...props}>
      {children}
    </label>
  )
}
