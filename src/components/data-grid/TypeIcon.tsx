import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down'
import Binary from 'lucide-react/dist/esm/icons/binary'
import Braces from 'lucide-react/dist/esm/icons/braces'
import Calendar from 'lucide-react/dist/esm/icons/calendar'
import CalendarClock from 'lucide-react/dist/esm/icons/calendar-clock'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Filter from 'lucide-react/dist/esm/icons/filter'
import Fingerprint from 'lucide-react/dist/esm/icons/fingerprint-pattern'
import Hash from 'lucide-react/dist/esm/icons/hash'
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle'
import List from 'lucide-react/dist/esm/icons/list'
import Timer from 'lucide-react/dist/esm/icons/timer'
import ToggleRight from 'lucide-react/dist/esm/icons/toggle-right'
import Type from 'lucide-react/dist/esm/icons/type'
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
