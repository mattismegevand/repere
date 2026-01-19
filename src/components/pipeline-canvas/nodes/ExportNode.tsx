import { Braces, Download, FileSpreadsheet, FileText, type LucideIcon, Package } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { useDuckDB } from '@/lib/duckdb'
import { exportData } from '@/lib/export/exporter'
import { usePipelineStore } from '@/stores'
import type { ExportConfig, ExportFormat, ExportNode as ExportNodeType } from '@/types'
import { NodeContent, NodeHeader, NodeShell } from './shared'

interface ExportNodeData {
  export: ExportNodeType
  isActive: boolean
  isSelected: boolean
  isPending?: boolean
  [key: string]: unknown
}

interface FormatConfig {
  icon: LucideIcon
  label: string
  color: string
  description: string
}

const FORMAT_CONFIG: Record<ExportFormat, FormatConfig> = {
  csv: {
    icon: FileText,
    label: 'CSV',
    color: 'text-green-600 dark:text-green-400 bg-green-500/10',
    description: 'Comma-separated values',
  },
  json: {
    icon: Braces,
    label: 'JSON',
    color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    description: 'Array of objects',
  },
  jsonl: {
    icon: Braces,
    label: 'JSONL',
    color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10',
    description: 'Newline-delimited JSON',
  },
  parquet: {
    icon: Package,
    label: 'Parquet',
    color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
    description: 'Columnar format',
  },
  xlsx: {
    icon: FileSpreadsheet,
    label: 'Excel',
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    description: 'Excel spreadsheet',
  },
}

const FORMATS: ExportFormat[] = ['csv', 'json', 'jsonl', 'parquet', 'xlsx']

export const ExportNode = memo(function ExportNode({ data }: { data: ExportNodeData }) {
  const { export: exportNode, isActive, isSelected } = data
  const { client } = useDuckDB()
  const { nodes, updateExportNode } = usePipelineStore()

  const exportConfig = exportNode.config
  const format = exportConfig.format
  const formatConfig = FORMAT_CONFIG[format]
  const Icon = formatConfig.icon

  const parentId = exportNode.parentId
  const parentNode = parentId ? nodes[parentId] : null
  const parentName = parentNode?.name ?? 'Unknown'

  const defaultFilename = exportConfig.filename ?? parentName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const [filename, setFilename] = useState(defaultFilename)
  const [isEditingFilename, setIsEditingFilename] = useState(false)

  const handleFormatChange = useCallback(
    (newFormat: ExportFormat) => {
      if (newFormat === format) return
      const newConfig: ExportConfig = { ...exportConfig, format: newFormat }
      updateExportNode(exportNode.id, { config: newConfig })
    },
    [format, exportConfig, updateExportNode, exportNode.id]
  )

  const handleFilenameChange = useCallback((newFilename: string) => {
    setFilename(newFilename)
  }, [])

  const handleFilenameBlur = useCallback(() => {
    setIsEditingFilename(false)
    if (filename !== exportConfig.filename) {
      const newConfig: ExportConfig = { ...exportConfig, filename }
      updateExportNode(exportNode.id, { config: newConfig })
    }
  }, [filename, exportConfig, updateExportNode, exportNode.id])

  const handleFilenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFilenameBlur()
      } else if (e.key === 'Escape') {
        setFilename(defaultFilename)
        setIsEditingFilename(false)
      }
    },
    [handleFilenameBlur, defaultFilename]
  )

  const handleDownload = useCallback(async () => {
    if (!client || !parentNode) return

    try {
      await exportData({
        client,
        tableName: parentNode.tableName,
        format,
        filename: filename || defaultFilename,
      })
    } catch (error) {
      console.error('Export failed:', error)
    }
  }, [client, parentNode, format, filename, defaultFilename])

  const formatCount = (n: number | null) => (n === null ? '...' : n.toLocaleString())

  return (
    <NodeShell isActive={isActive} isSelected={isSelected} hasSourceHandle={false} hasTargetHandle={true}>
      <NodeHeader
        icon={Icon}
        badge="Export"
        badgeColor="green"
        name={`${filename}.${format === 'xlsx' ? 'xlsx' : format}`}
        subtitle={`${formatCount(exportNode.rowCount)} rows from ${parentName}`}
      />

      <NodeContent>
        {/* Compact filename with format dropdown */}
        <div className="flex items-center gap-1.5 nopan nodrag">
          {isEditingFilename ? (
            <input
              type="text"
              value={filename}
              onChange={(e) => handleFilenameChange(e.target.value)}
              onBlur={handleFilenameBlur}
              onKeyDown={handleFilenameKeyDown}
              className="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-transparent border-b border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingFilename(true)}
              className="flex-1 min-w-0 text-xs text-left truncate hover:text-[var(--color-accent)] transition-colors"
              title="Click to edit filename"
            >
              {filename}
            </button>
          )}
          <select
            value={format}
            onChange={(e) => handleFormatChange(e.target.value as ExportFormat)}
            className={`px-1.5 py-0.5 text-xs font-medium rounded ${formatConfig.color} border-0 outline-none cursor-pointer nopan nodrag`}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                .{f}
              </option>
            ))}
          </select>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </NodeContent>
    </NodeShell>
  )
})
