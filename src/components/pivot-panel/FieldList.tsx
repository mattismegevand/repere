import type { Column } from '@/types/dataset'

interface FieldListProps {
  columns: Column[]
  usedFields: Set<string>
}

export function FieldList({ columns, usedFields }: FieldListProps) {
  const handleDragStart = (e: React.DragEvent, columnName: string) => {
    e.dataTransfer.setData('text/plain', columnName)
    e.dataTransfer.setData('source-zone', 'field-list')
    e.dataTransfer.effectAllowed = 'move'
  }

  const numericColumns = columns.filter((c) => ['integer', 'float', 'decimal'].includes(c.type))
  const otherColumns = columns.filter((c) => !['integer', 'float', 'decimal'].includes(c.type))

  return (
    <div className="mb-4">
      <div className="text-[10px] text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Fields</div>
      <div className="max-h-[200px] overflow-y-auto border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {columns.length === 0 ? (
          <div className="text-[10px] text-[var(--color-text-muted)] text-center py-4">No columns available</div>
        ) : (
          <>
            {numericColumns.length > 0 && (
              <div className="border-b border-[var(--color-border)]">
                <div className="text-[9px] text-[var(--color-text-muted)] px-2 py-1 bg-[var(--color-bg-tertiary)] uppercase">
                  Numeric
                </div>
                {numericColumns.map((col) => (
                  <FieldItem
                    key={col.name}
                    column={col}
                    isUsed={usedFields.has(col.name)}
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>
            )}
            {otherColumns.length > 0 && (
              <div>
                <div className="text-[9px] text-[var(--color-text-muted)] px-2 py-1 bg-[var(--color-bg-tertiary)] uppercase">
                  Other
                </div>
                {otherColumns.map((col) => (
                  <FieldItem
                    key={col.name}
                    column={col}
                    isUsed={usedFields.has(col.name)}
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface FieldItemProps {
  column: Column
  isUsed: boolean
  onDragStart: (e: React.DragEvent, columnName: string) => void
}

function FieldItem({ column, isUsed, onDragStart }: FieldItemProps) {
  const typeIcon = getTypeIcon(column.type)

  return (
    <div
      draggable={!isUsed}
      onDragStart={(e) => onDragStart(e, column.name)}
      className={`flex items-center gap-2 px-2 py-1.5 text-[11px] border-b border-[var(--color-border)] last:border-b-0 ${
        isUsed
          ? 'opacity-40 cursor-not-allowed'
          : 'cursor-grab active:cursor-grabbing hover:bg-[var(--color-bg-tertiary)]'
      }`}
    >
      <span className="text-[var(--color-text-muted)] w-4 text-center">{typeIcon}</span>
      <span className={isUsed ? 'line-through' : ''}>{column.name}</span>
    </div>
  )
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'integer':
    case 'float':
    case 'decimal':
      return '#'
    case 'string':
    case 'varchar':
      return 'T'
    case 'boolean':
      return '?'
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'D'
    default:
      return '*'
  }
}
