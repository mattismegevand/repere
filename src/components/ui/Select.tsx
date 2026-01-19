import { forwardRef, type SelectHTMLAttributes } from 'react'

type SelectSize = 'xs' | 'sm' | 'md'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  selectSize?: SelectSize
}

const sizeStyles: Record<SelectSize, string> = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ selectSize = 'sm', className = '', children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] ${sizeStyles[selectSize]} focus:outline-none focus:border-[var(--color-accent)] ${className}`}
        {...props}
      >
        {children}
      </select>
    )
  }
)

Select.displayName = 'Select'
