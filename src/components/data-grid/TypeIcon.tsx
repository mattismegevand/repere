import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Binary,
  Braces,
  Calendar,
  CalendarClock,
  Clock,
  Filter,
  Fingerprint,
  Hash,
  HelpCircle,
  List,
  Timer,
  ToggleRight,
  Type,
} from 'lucide-react'
import type { ColumnType } from '@/types'

interface TypeIconProps {
  type: ColumnType
  className?: string
  size?: number
}

const iconMap: Record<ColumnType, React.ComponentType<{ className?: string; size?: number }>> = {
  string: Type,
  number: Hash,
  boolean: ToggleRight,
  date: Calendar,
  time: Clock,
  timestamp: CalendarClock,
  interval: Timer,
  uuid: Fingerprint,
  json: Braces,
  blob: Binary,
  array: List,
  unknown: HelpCircle,
}

export function TypeIcon({ type, className = '', size = 14 }: TypeIconProps) {
  const Icon = iconMap[type] ?? HelpCircle
  return <Icon className={className} size={size} />
}

interface IconProps {
  className?: string
  size?: number
}

export function FilterIcon({ className = '', size = 12 }: IconProps) {
  return <Filter className={className} size={size} />
}

export function SortAscIcon({ className = '', size = 12 }: IconProps) {
  return <ArrowUp className={className} size={size} />
}

export function SortDescIcon({ className = '', size = 12 }: IconProps) {
  return <ArrowDown className={className} size={size} />
}

export function SortNeutralIcon({ className = '', size = 12 }: IconProps) {
  return <ArrowUpDown className={className} size={size} />
}
