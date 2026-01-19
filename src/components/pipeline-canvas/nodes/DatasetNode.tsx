import { Database, Eye, EyeOff } from 'lucide-react'
import { memo, useCallback, useRef, useState } from 'react'
import { useNodePreview } from '@/lib/duckdb/useNodePreview'
import { usePipelineStore } from '@/stores'
import type { DatasetRestorationStatus } from '@/stores/pipelineStore'
import type { Dataset } from '@/types'
import { ExpandablePreview, NodeActionButton, NodeContent, NodeHeader, NodeShell } from './shared'

interface DatasetNodeData {
  dataset: Dataset
  isActive: boolean
  isSelected: boolean
  restorationStatus?: DatasetRestorationStatus
  isExactMatch?: boolean
  onFileDrop?: (file: File) => void
  onFileSelect?: (file: File) => void
  onSkip?: () => void
  onFillPlaceholder?: (file: File) => void
  [key: string]: unknown
}

export const DatasetNode = memo(function DatasetNode({
  data,
  selected,
}: {
  data: DatasetNodeData
  selected?: boolean
}) {
  const {
    dataset,
    isActive,
    isSelected,
    restorationStatus,
    isExactMatch,
    onFileDrop,
    onFileSelect,
    onSkip,
    onFillPlaceholder,
  } = data
  const isNodeSelected = isSelected || selected
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toggleNodeExpanded } = usePipelineStore()

  const isRestorationMode = restorationStatus !== undefined
  const canAcceptFile = isRestorationMode && restorationStatus !== 'embedded'
  const isPlaceholder = !isRestorationMode && dataset.isPlaceholder && onFillPlaceholder
  const isExpanded = !!dataset.isExpanded && !isPlaceholder && !isRestorationMode
  const canExpand = !isPlaceholder && !isRestorationMode && dataset.rowCount !== 0

  const preview = useNodePreview(dataset.tableName, isExpanded)

  const handleTableNameDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', dataset.tableName)
      e.dataTransfer.effectAllowed = 'copy'
    },
    [dataset.tableName]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (isPlaceholder && onFillPlaceholder) {
        onFillPlaceholder(file)
      } else if (onFileSelect || onFileDrop) {
        const handler = onFileSelect || onFileDrop
        handler?.(file)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [onFileDrop, onFileSelect, onFillPlaceholder, isPlaceholder]
  )

  const handleSelectFile = useCallback(() => {
    if (!canAcceptFile && !isPlaceholder) return
    fileInputRef.current?.click()
  }, [canAcceptFile, isPlaceholder])

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleNodeExpanded(dataset.id)
    },
    [dataset.id, toggleNodeExpanded]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!canAcceptFile) return
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer.types.includes('Files')) {
        e.dataTransfer.dropEffect = 'copy'
        setIsDragOver(true)
      }
    },
    [canAcceptFile]
  )

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!canAcceptFile) return
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer.types.includes('Files')) {
        setIsDragOver(true)
      }
    },
    [canAcceptFile]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      if (!canAcceptFile || !onFileDrop) return

      const file = e.dataTransfer.files[0]
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase()
        if (ext && ['csv', 'parquet', 'xlsx'].includes(ext)) {
          onFileDrop(file)
        }
      }
    },
    [canAcceptFile, onFileDrop]
  )

  const getRestorationBorderStyle = () => {
    if (!isRestorationMode) return undefined

    if (isDragOver) {
      return 'border border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/10'
    }

    switch (restorationStatus) {
      case 'embedded':
        return 'border border-[var(--color-border)] opacity-70'
      case 'required':
        return 'border border-dashed border-[var(--color-warning)] bg-[var(--color-warning)]/5'
      case 'validating':
        return 'border border-[var(--color-accent)] animate-pulse'
      case 'provided':
        return 'border border-[var(--color-success)] bg-[var(--color-success)]/5'
      case 'error':
        return 'border border-[var(--color-error)] bg-[var(--color-error)]/5'
      default:
        return undefined
    }
  }

  const getStatusIndicator = () => {
    if (!isRestorationMode) return null

    switch (restorationStatus) {
      case 'embedded':
        return <span className="text-[var(--color-text-muted)]">Embedded</span>
      case 'required':
        return <span className="text-[var(--color-warning)]">Click or drop file</span>
      case 'validating':
        return <span className="text-[var(--color-accent)]">Validating...</span>
      case 'provided':
        return isExactMatch ? (
          <span className="text-[var(--color-success)]">Exact match</span>
        ) : (
          <span className="text-[var(--color-accent)]">Schema match</span>
        )
      case 'error':
        return <span className="text-[var(--color-error)]">Schema mismatch</span>
      default:
        return null
    }
  }

  const placeholderBorderStyle = isPlaceholder ? 'border border-dashed border-[var(--color-warning)]' : undefined

  const formatCount = (n: number | null) => (n === null ? '...' : n.toLocaleString())

  return (
    <NodeShell
      isActive={isActive}
      isSelected={isNodeSelected}
      isDisabled={dataset.isDisabled}
      hasError={dataset.hasError}
      hasTargetHandle={false}
      hasSourceHandle={true}
      isExpanded={isExpanded}
      borderStyle={getRestorationBorderStyle() || placeholderBorderStyle}
      className={canAcceptFile || isPlaceholder ? 'cursor-pointer' : ''}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      cornerAction={
        canExpand && (
          <NodeActionButton
            icon={isExpanded ? EyeOff : Eye}
            onClick={handleToggleExpand}
            title={isExpanded ? 'Hide preview' : 'Show preview'}
            ariaExpanded={isExpanded}
          />
        )
      }
    >
      {(canAcceptFile || isPlaceholder) && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.parquet,.xlsx"
          onChange={handleFileInputChange}
          className="hidden"
        />
      )}

      <NodeHeader icon={Database} badge="Dataset" badgeColor="blue" name={dataset.name} />

      <NodeContent>
        {isRestorationMode ? (
          <>
            <div>{dataset.columns.length} columns</div>
            <div className="truncate text-[var(--color-text-secondary)]" title={dataset.fileName}>
              {dataset.fileName}
            </div>
            <div className="mt-1">{getStatusIndicator()}</div>
            {canAcceptFile && (
              <div className="flex gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={handleSelectFile}
                  className="nopan nodrag flex-1 px-2 py-1.5 text-xs font-medium bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] cursor-pointer"
                  style={{ pointerEvents: 'all' }}
                >
                  Select file
                </button>
                {onSkip && restorationStatus === 'required' && (
                  <button
                    type="button"
                    onClick={onSkip}
                    className="nopan nodrag px-2 py-1.5 text-xs font-medium bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer"
                    style={{ pointerEvents: 'all' }}
                    title="Skip this dataset (create as placeholder)"
                  >
                    Skip
                  </button>
                )}
              </div>
            )}
          </>
        ) : isPlaceholder ? (
          <>
            <div className="text-[var(--color-warning)]">No data loaded</div>
            <div>{dataset.columns.length} columns expected</div>
            <button
              type="button"
              onClick={handleSelectFile}
              className="nopan nodrag mt-2 w-full px-2 py-1.5 text-xs font-medium bg-[var(--color-warning)] hover:opacity-80 rounded text-black cursor-pointer"
              style={{ pointerEvents: 'all' }}
            >
              Load data
            </button>
          </>
        ) : (
          <>
            <div className="text-[var(--color-text-secondary)]">
              {formatCount(dataset.rowCount)} rows · {dataset.columns.length} cols
            </div>
            <div
              draggable
              onDragStart={handleTableNameDragStart}
              className="nodrag font-mono text-[10px] truncate text-[var(--color-text-muted)] cursor-grab hover:text-[var(--color-accent)] active:cursor-grabbing"
              title={`${dataset.tableName} (drag to SQL editor)`}
            >
              {dataset.tableName}
            </div>
          </>
        )}
      </NodeContent>

      <ExpandablePreview
        nodeId={dataset.id}
        isExpanded={isExpanded}
        rows={preview.rows}
        columns={preview.columns}
        loading={preview.loading}
        error={preview.error}
      />
    </NodeShell>
  )
})
