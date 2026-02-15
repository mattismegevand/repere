import { Handle, NodeResizer, Position, type ResizeParams } from '@xyflow/react'
import type { ReactNode } from 'react'

export interface NodeShellProps {
  children: ReactNode
  isActive?: boolean
  isSelected?: boolean
  isDisabled?: boolean
  isPending?: boolean
  hasError?: boolean
  className?: string
  /** Show source handle on right (default: true for data nodes, false for terminal nodes) */
  hasSourceHandle?: boolean
  /** Show target handle on left (default: true except for root nodes) */
  hasTargetHandle?: boolean
  /** Enable expanded mode with wider min-width */
  isExpanded?: boolean
  /** Enable resizing with NodeResizer */
  isResizable?: boolean
  /** Min/max dimensions for resizable nodes */
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  /** Callback during resize (for real-time updates) */
  onResize?: (params: ResizeParams) => void
  /** Callback when resize ends (for persisting dimensions) */
  onResizeEnd?: (params: ResizeParams) => void
  /** Drag/drop handlers for restoration/placeholder modes */
  onDragOver?: (e: React.DragEvent) => void
  onDragEnter?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  /** Additional border style override (for restoration states) */
  borderStyle?: string
  /** Fixed corner action (e.g., expand/collapse button) */
  cornerAction?: ReactNode
}

export function NodeShell({
  children,
  isActive = false,
  isSelected = false,
  isDisabled = false,
  isPending = false,
  hasError = false,
  className = '',
  hasSourceHandle = true,
  hasTargetHandle = true,
  isExpanded = false,
  isResizable = false,
  minWidth = 220,
  minHeight = 100,
  maxWidth = 800,
  maxHeight = 600,
  onResize,
  onResizeEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  borderStyle,
  cornerAction,
}: NodeShellProps) {
  const baseClasses = `
    group relative rounded-lg shadow-sm
    bg-[var(--color-bg-primary)]
    ${isResizable ? 'flex flex-col' : 'transition-all duration-200'}
  `

  const stateClasses = borderStyle
    ? borderStyle
    : [
        'border',
        isPending && 'opacity-50 border-dashed border-[var(--color-border)]',
        isDisabled && 'opacity-40 grayscale border-[var(--color-border)]',
        hasError && 'border-red-500 bg-red-500/5',
        !isPending &&
          !isDisabled &&
          !hasError &&
          (isActive ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)]' : 'border-[var(--color-border)]'),
        !isPending && !isDisabled && isSelected && 'ring-2 ring-[var(--color-accent)]',
      ]
        .filter(Boolean)
        .join(' ')

  // For non-resizable nodes, use Tailwind min-width classes
  const sizeClasses = isResizable ? '' : isExpanded ? 'min-w-[280px]' : 'min-w-[220px]'

  // For resizable nodes, use explicit min dimensions so React Flow can measure the node
  const resizableStyle = isResizable ? { minWidth: minWidth, minHeight: minHeight } : undefined

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${sizeClasses} ${className}`}
      style={resizableStyle}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Resizer - only for resizable nodes, visible when selected */}
      {isResizable && (
        <NodeResizer
          minWidth={minWidth}
          minHeight={minHeight}
          maxWidth={maxWidth}
          maxHeight={maxHeight}
          isVisible={isSelected}
          lineClassName="!border-[var(--color-accent)]"
          handleClassName="!w-2 !h-2 !bg-[var(--color-accent)] !border-none !rounded-sm"
          onResize={onResize ? (_, params) => onResize(params) : undefined}
          onResizeEnd={onResizeEnd ? (_, params) => onResizeEnd(params) : undefined}
        />
      )}

      {hasTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-[var(--color-text-muted)] !border-[var(--color-bg-primary)] !border-2"
        />
      )}

      {hasSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-[var(--color-accent)] !border-[var(--color-bg-primary)] !border-2"
        />
      )}

      {children}

      {/* Corner action - fixed top-right, always visible when expanded */}
      {cornerAction ? <div className="absolute top-2.5 right-2.5 z-10">{cornerAction}</div> : null}
    </div>
  )
}
