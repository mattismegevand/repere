import { useState } from 'react'

interface DropZoneProps {
  label: string
  fields: string[]
  onDrop: (field: string) => void
  onRemove: (field: string) => void
  onReorder?: (fromIndex: number, toIndex: number) => void
  accepts: 'single' | 'multiple'
  emptyText?: string
}

export function DropZone({
  label,
  fields,
  onDrop,
  onRemove,
  onReorder,
  accepts,
  emptyText = 'Drag fields here',
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setDropTargetIndex(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setDropTargetIndex(null)

    const field = e.dataTransfer.getData('text/plain')
    const sourceZone = e.dataTransfer.getData('source-zone')

    if (sourceZone === label && draggedIndex !== null && dropTargetIndex !== null && onReorder) {
      onReorder(draggedIndex, dropTargetIndex)
    } else if (field && !fields.includes(field)) {
      if (accepts === 'single' && fields.length > 0) {
        onRemove(fields[0])
      }
      onDrop(field)
    }

    setDraggedIndex(null)
  }

  const handleFieldDragStart = (e: React.DragEvent, field: string, index: number) => {
    e.dataTransfer.setData('text/plain', field)
    e.dataTransfer.setData('source-zone', label)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedIndex(index)
  }

  const handleFieldDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      setDropTargetIndex(index)
    }
  }

  const handleFieldDragEnd = () => {
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }

  return (
    <div className="mb-3">
      <div className="text-[10px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">{label}</div>
      <div
        className={`min-h-[60px] border-2 border-dashed p-2 transition-colors ${
          isDragOver
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
            : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {fields.length === 0 ? (
          <div className="text-[10px] text-[var(--color-text-muted)] text-center py-2">{emptyText}</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {fields.map((field, index) => (
              <div
                key={field}
                draggable
                onDragStart={(e) => handleFieldDragStart(e, field, index)}
                onDragOver={(e) => handleFieldDragOver(e, index)}
                onDragEnd={handleFieldDragEnd}
                className={`group flex items-center gap-1 px-2 py-1 text-[10px] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] cursor-grab active:cursor-grabbing ${
                  draggedIndex === index ? 'opacity-50' : ''
                } ${dropTargetIndex === index ? 'border-l-2 border-l-[var(--color-accent)]' : ''}`}
              >
                <span>{field}</span>
                <button
                  onClick={() => onRemove(field)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-opacity"
                  title="Remove"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
