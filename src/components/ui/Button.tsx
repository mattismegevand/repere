import { type ButtonHTMLAttributes, forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'xs' | 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] border border-[var(--color-accent)]',
  secondary:
    'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]',
  ghost:
    'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
  danger: 'bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/90 border border-[var(--color-error)]',
}

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2 py-0.5 text-[10px]',
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-1.5 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'sm', loading, disabled, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${variantStyles[variant]} ${sizeStyles[size]} rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
      >
        {loading ? 'Loading...' : children}
      </button>
    )
  }
)

Button.displayName = 'Button'
