import { forwardRef, type InputHTMLAttributes } from 'react'
import { type Control, type FieldPath, type FieldValues, useController } from 'react-hook-form'
import { Label } from '../Label'

type InputSize = 'xs' | 'sm' | 'md'

const sizeStyles: Record<InputSize, string> = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

interface FormInputProps<T extends FieldValues, TName extends FieldPath<T>>
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'size'> {
  name: TName
  control: Control<T>
  label?: string
  description?: string
  inputSize?: InputSize
}

export function FormInput<T extends FieldValues, TName extends FieldPath<T>>({
  name,
  control,
  label,
  description,
  inputSize = 'sm',
  className = '',
  ...props
}: FormInputProps<T, TName>) {
  const {
    field,
    fieldState: { error },
  } = useController({ name, control })

  return (
    <div className="space-y-1">
      {label && <Label>{label}</Label>}
      <input
        {...field}
        {...props}
        className={`w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-md)] ${sizeStyles[inputSize]} focus:outline-none focus:border-[var(--color-accent)] ${error ? 'border-[var(--color-error)]' : ''} ${className}`}
      />
      {description && !error && <p className="text-[10px] text-[var(--color-text-muted)]">{description}</p>}
      {error && <p className="text-[10px] text-[var(--color-error)]">{error.message}</p>}
    </div>
  )
}

// Uncontrolled version for use outside RHF
const Input = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { inputSize?: InputSize }
>(({ inputSize = 'sm', className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-md)] ${sizeStyles[inputSize]} focus:outline-none focus:border-[var(--color-accent)] ${className}`}
    {...props}
  />
))
Input.displayName = 'Input'
