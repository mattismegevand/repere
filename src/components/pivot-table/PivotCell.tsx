import type { ValueFormat } from '@/stores/pivotStore'

interface PivotCellProps {
  value: unknown
  format?: ValueFormat
  isRowHeader?: boolean
  isSubtotal?: boolean
  isGrandTotal?: boolean
  onClick?: () => void
}

export function PivotCell({ value, format, isRowHeader, isSubtotal, isGrandTotal, onClick }: PivotCellProps) {
  const formattedValue = formatValue(value, format)

  const baseClasses = 'px-2 py-1.5 text-[11px] border-b border-r border-[var(--color-border)]'

  const styleClasses = isGrandTotal
    ? 'bg-[var(--color-bg-tertiary)] font-bold'
    : isSubtotal
      ? 'bg-[var(--color-bg-secondary)] font-semibold'
      : 'bg-[var(--color-bg-primary)]'

  const alignClasses = isRowHeader ? 'text-left' : 'text-right'

  const interactiveClasses = onClick
    ? 'cursor-pointer hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]'
    : ''

  return (
    <td className={`${baseClasses} ${styleClasses} ${alignClasses} ${interactiveClasses}`} onClick={onClick}>
      {formattedValue}
    </td>
  )
}

function formatValue(value: unknown, format?: ValueFormat): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value !== 'number') {
    return String(value)
  }

  if (!format) {
    return value.toLocaleString()
  }

  const { type, decimals, prefix = '', suffix = '' } = format

  let formatted: string

  switch (type) {
    case 'currency':
      formatted = value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
      break
    case 'percent':
      formatted = (value * 100).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
      break
    case 'decimal':
      formatted = value.toFixed(decimals)
      break
    default:
      formatted = value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
  }

  return `${prefix}${formatted}${suffix}`
}
