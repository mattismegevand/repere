import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import Minus from 'lucide-react/dist/esm/icons/minus'
import { useMemo } from 'react'
import { useChartTheme } from '@/lib/charts'

export interface KPICardProps {
  /** Main value to display */
  value: number | string
  /** Label/title for the KPI */
  label?: string
  /** Previous value for comparison (shows trend) */
  previousValue?: number
  /** Target value to compare against */
  target?: number
  /** Format type for the value */
  format?: 'number' | 'currency' | 'percent' | 'compact'
  /** Currency symbol for currency format */
  currencySymbol?: string
  /** Number of decimal places */
  decimals?: number
  /** Prefix to show before value */
  prefix?: string
  /** Suffix to show after value */
  suffix?: string
  width?: number
  height?: number
}

export function KPICard({
  value,
  label,
  previousValue,
  target,
  format = 'number',
  currencySymbol = '$',
  decimals = 0,
  prefix,
  suffix,
  width = 200,
  height = 120,
}: KPICardProps) {
  const theme = useChartTheme()

  const formattedValue = useMemo(() => {
    if (typeof value === 'string') return value

    const num = Number(value)
    if (Number.isNaN(num)) return String(value)

    switch (format) {
      case 'currency':
        return `${currencySymbol}${num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
      case 'percent':
        return `${(num * 100).toFixed(decimals)}%`
      case 'compact':
        if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
        if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
        if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`
        return num.toFixed(decimals)
      default:
        return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    }
  }, [value, format, currencySymbol, decimals])

  const trend = useMemo(() => {
    if (previousValue === undefined || typeof value !== 'number') return null

    const current = Number(value)
    const prev = Number(previousValue)
    if (Number.isNaN(current) || Number.isNaN(prev) || prev === 0) return null

    const change = ((current - prev) / Math.abs(prev)) * 100
    const direction = change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'neutral'

    return { change, direction }
  }, [value, previousValue])

  const targetStatus = useMemo(() => {
    if (target === undefined || typeof value !== 'number') return null

    const current = Number(value)
    if (Number.isNaN(current)) return null

    const percentage = (current / target) * 100
    const status = percentage >= 100 ? 'achieved' : percentage >= 80 ? 'close' : 'behind'

    return { percentage, status }
  }, [value, target])

  return (
    <div
      className="flex flex-col justify-center items-center p-4 rounded-lg"
      style={{
        width,
        height,
        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      }}
    >
      {/* Label */}
      {label && (
        <div
          className="text-xs font-medium uppercase tracking-wide mb-2 text-center"
          style={{ color: theme.text.secondary }}
        >
          {label}
        </div>
      )}

      {/* Main Value */}
      <div className="text-3xl font-bold text-center" style={{ color: theme.text.primary }}>
        {prefix}
        {formattedValue}
        {suffix}
      </div>

      {/* Trend indicator */}
      {trend && (
        <div
          className="flex items-center gap-1 mt-2 text-sm"
          style={{
            color: trend.direction === 'up' ? '#22c55e' : trend.direction === 'down' ? '#ef4444' : theme.text.secondary,
          }}
        >
          {trend.direction === 'up' ? <ArrowUp className="w-4 h-4" /> : null}
          {trend.direction === 'down' ? <ArrowDown className="w-4 h-4" /> : null}
          {trend.direction === 'neutral' ? <Minus className="w-4 h-4" /> : null}
          <span>{Math.abs(trend.change).toFixed(1)}%</span>
          <span style={{ color: theme.text.secondary }}>vs prev</span>
        </div>
      )}

      {/* Target progress */}
      {targetStatus && (
        <div className="mt-2 w-full max-w-[160px]">
          <div className="flex justify-between text-[10px] mb-1" style={{ color: theme.text.secondary }}>
            <span>Target: {target?.toLocaleString()}</span>
            <span>{targetStatus.percentage.toFixed(0)}%</span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(targetStatus.percentage, 100)}%`,
                backgroundColor:
                  targetStatus.status === 'achieved'
                    ? '#22c55e'
                    : targetStatus.status === 'close'
                      ? '#f59e0b'
                      : '#ef4444',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
