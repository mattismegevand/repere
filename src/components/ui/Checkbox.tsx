import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import Check from 'lucide-react/dist/esm/icons/check'

interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  id?: string
}

export function Checkbox({ checked, onCheckedChange, disabled, className, id }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={`w-3.5 h-3.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] flex items-center justify-center transition-colors data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed ${className ?? ''}`}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="w-2.5 h-2.5 text-black" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
