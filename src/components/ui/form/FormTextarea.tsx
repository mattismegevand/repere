import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { type Control, type FieldPath, type FieldValues, useController } from 'react-hook-form'
import { Label } from '../Label'

type TextareaSize = 'xs' | 'sm' | 'md'

const sizeStyles: Record<TextareaSize, string> = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

interface FormTextareaProps<T extends FieldValues, TName extends FieldPath<T>>
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> {
  name: TName
  control: Control<T>
  label?: string
  description?: string
  textareaSize?: TextareaSize
}

export function FormTextarea<T extends FieldValues, TName extends FieldPath<T>>({
  name,
  control,
  label,
  description,
  textareaSize = 'sm',
  className = '',
  ...props
}: FormTextareaProps<T, TName>) {
  const {
    field,
    fieldState: { error },
  } = useController({ name, control })

  return (
    <div className="space-y-1">
      {label && <Label>{label}</Label>}
      <textarea
        {...field}
        {...props}
        className={`w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-md)] ${sizeStyles[textareaSize]} focus:outline-none focus:border-[var(--color-accent)] resize-y min-h-[60px] ${error ? 'border-[var(--color-error)]' : ''} ${className}`}
      />
      {description && !error && <p className="text-[10px] text-[var(--color-text-muted)]">{description}</p>}
      {error && <p className="text-[10px] text-[var(--color-error)]">{error.message}</p>}
    </div>
  )
}

// Uncontrolled version for use outside RHF
const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { textareaSize?: TextareaSize }
>(({ textareaSize = 'sm', className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    className={`w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-md)] ${sizeStyles[textareaSize]} focus:outline-none focus:border-[var(--color-accent)] resize-y min-h-[60px] ${className}`}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
