export { formatCell } from '@/lib/formatters'

export function highlightMatch(text: string, search: string, caseSensitive: boolean): React.ReactNode {
  if (!search) return text
  const flags = caseSensitive ? 'g' : 'gi'
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, flags)
  const parts = text.split(regex)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    const isMatch = caseSensitive ? part === search : part.toLowerCase() === search.toLowerCase()
    return isMatch ? (
      <mark key={i} className="bg-[var(--color-accent)] text-white px-0.5 rounded-sm">
        {part}
      </mark>
    ) : (
      part
    )
  })
}
