import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { OptionCard, PreviewSection, TableOptionWithPreview } from '@/components/operation-dialogs/shared'
import { Button, DialogErrorBanner } from '@/components/ui'
import { RadixDialog } from '@/components/ui/RadixDialog'
import { useDuckDB } from '@/lib/duckdb'
import { useOperationDialog } from '@/lib/hooks/useOperationDialog'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { useDialogStore, usePipelineStore } from '@/stores'
import { type DataView, isTerminalNode, type PipelineNode, type UnionOperation } from '@/types'
import { type UnionFormValues, unionFormSchema } from './schema'

const PREVIEW_LIMIT = 100

interface Props {
  onClose: () => void
}

function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function buildUnionPreviewSql(nodes: PipelineNode[], mode: 'all' | 'distinct'): string {
  const unionKeyword = mode === 'all' ? 'UNION ALL' : 'UNION'
  return nodes.map((node) => `SELECT * FROM ${escapeIdentifier(node.tableName)}`).join(` ${unionKeyword} `)
}

function checkColumnCompatibility(nodes: PipelineNode[]): { compatible: boolean; message: string; details?: string } {
  if (nodes.length < 2) {
    return { compatible: false, message: 'Select at least 2 tables' }
  }

  const firstColumns = nodes[0].columns
  const firstColCount = firstColumns.length

  for (let i = 1; i < nodes.length; i++) {
    const cols = nodes[i].columns
    if (cols.length !== firstColCount) {
      return {
        compatible: false,
        message: 'Column count mismatch',
        details: `"${nodes[i].name}" has ${cols.length} columns, expected ${firstColCount}`,
      }
    }

    for (let j = 0; j < firstColCount; j++) {
      if (cols[j].type !== firstColumns[j].type) {
        return {
          compatible: true,
          message: 'Type mismatch (will be coerced)',
          details: `Column ${j + 1}: ${firstColumns[j].type} vs ${cols[j].type}`,
        }
      }
    }
  }

  return { compatible: true, message: 'Tables are compatible' }
}

export function UnionDialog({ onClose }: Props) {
  const { nodes } = usePipelineStore()
  const { activeDialog } = useDialogStore()
  const { applyOperation, openTab, deleteNode } = usePipeline()
  const { client } = useDuckDB()

  const unionPreSelectedNodes = activeDialog?.type === 'union' ? (activeDialog.preSelectedNodes ?? []) : []
  const unionEditingNodeId = activeDialog?.type === 'union' ? activeDialog.editingNodeId : undefined

  const editingNode = unionEditingNodeId ? (nodes[unionEditingNodeId] as DataView | undefined) : null
  const isEditing = !!editingNode && editingNode.type === 'view' && editingNode.operation.type === 'union'

  const nodeList = useMemo(
    () => Object.values(nodes).filter((n) => n.id !== unionEditingNodeId && !isTerminalNode(n)),
    [nodes, unionEditingNodeId]
  )

  const initialSelectedIds = useMemo(() => {
    if (isEditing && editingNode) {
      const unionOp = editingNode.operation as UnionOperation
      return [editingNode.parentIds[0], ...unionOp.sourceIds].filter((id: string) => nodes[id])
    }
    return unionPreSelectedNodes.filter((id: string) => nodes[id])
  }, [isEditing, editingNode, unionPreSelectedNodes, nodes])

  const initialMode = useMemo(() => {
    if (isEditing && editingNode) {
      return (editingNode.operation as UnionOperation).mode
    }
    return 'all' as const
  }, [isEditing, editingNode])

  const { watch, setValue } = useForm<UnionFormValues>({
    resolver: zodResolver(unionFormSchema),
    defaultValues: {
      selectedIds: initialSelectedIds,
      mode: initialMode,
    },
  })

  const selectedIds = watch('selectedIds')
  const mode = watch('mode')

  const { loading, error, execute } = useOperationDialog()

  useEffect(() => {
    if (isEditing && editingNode) {
      const unionOp = editingNode.operation as UnionOperation
      const allSourceIds = [editingNode.parentIds[0], ...unionOp.sourceIds].filter((id) => nodes[id])
      setValue('selectedIds', allSourceIds)
      setValue('mode', unionOp.mode)
    }
  }, [isEditing, editingNode, nodes, setValue])

  const selectedNodes = useMemo(() => selectedIds.map((id) => nodes[id]).filter(Boolean), [selectedIds, nodes])

  const compatibility = useMemo(() => checkColumnCompatibility(selectedNodes), [selectedNodes])

  const previewSql = useMemo(() => {
    if (selectedNodes.length < 2 || !compatibility.compatible) return null
    return buildUnionPreviewSql(selectedNodes, mode)
  }, [selectedNodes, mode, compatibility.compatible])

  const [preview, setPreview] = useState<{
    columns: { name: string; type: string }[]
    rows: Record<string, unknown>[]
    totalCount: number
    loading: boolean
    error: string | null
  }>({ columns: [], rows: [], totalCount: 0, loading: false, error: null })

  useEffect(() => {
    if (!client || !previewSql) {
      setPreview({ columns: [], rows: [], totalCount: 0, loading: false, error: null })
      return
    }

    setPreview((p) => ({ ...p, loading: true, error: null }))

    const run = async () => {
      try {
        const query = `${previewSql} LIMIT ${PREVIEW_LIMIT}`
        const countQuery = `SELECT COUNT(*) as cnt FROM (${previewSql}) t`

        const [dataResult, countResult] = await Promise.all([
          client.query(query),
          client.query<{ cnt: bigint }>(countQuery),
        ])

        const rows = dataResult.rows
        const totalCount = Number(countResult.rows[0]?.cnt ?? 0)

        const cols = dataResult.columns.map((c) => ({
          name: c.name,
          type: c.duckdb_type,
        }))

        setPreview({ columns: cols, rows, totalCount, loading: false, error: null })
      } catch (err) {
        setPreview((p) => ({
          ...p,
          loading: false,
          error: err instanceof Error ? err.message : 'Query failed',
        }))
      }
    }

    run()
  }, [client, previewSql])

  const toggleNode = (nodeId: string) => {
    setValue(
      'selectedIds',
      selectedIds.includes(nodeId) ? selectedIds.filter((id) => id !== nodeId) : [...selectedIds, nodeId]
    )
  }

  const handleUnion = () => {
    if (selectedNodes.length < 2 || !compatibility.compatible) return

    execute(async () => {
      if (isEditing && unionEditingNodeId) {
        await deleteNode(unionEditingNodeId)
      }

      const operation: UnionOperation = {
        type: 'union',
        sourceIds: selectedIds.slice(1),
        mode,
      }

      const newView = await applyOperation(selectedIds[0], operation, selectedIds.slice(1))
      if (newView) {
        openTab(newView.id)
      }
      onClose()
    })
  }

  if (nodeList.length < 2) {
    return (
      <RadixDialog
        open={true}
        onOpenChange={(open) => !open && onClose()}
        title={isEditing ? 'Edit union' : 'Union tables'}
        footer={
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        }
      >
        <p className="text-xs text-[var(--color-text-secondary)]">Load at least two datasets to union them.</p>
      </RadixDialog>
    )
  }

  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title={isEditing ? 'Edit union' : 'Union tables'}
      width="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleUnion}
            disabled={selectedNodes.length < 2 || !compatibility.compatible || loading}
          >
            {loading ? 'Creating...' : isEditing ? 'Update' : 'Create Union'}
          </Button>
        </>
      }
    >
      <DialogErrorBanner error={error} />

      <div className="space-y-3">
        <div>
          <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
            Tables (select 2+)
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto overflow-x-visible border border-[var(--color-border)] rounded-lg p-2">
            {nodeList.map((node) => (
              <TableOptionWithPreview
                key={node.id}
                node={node}
                selected={selectedIds.includes(node.id)}
                onSelect={() => toggleNode(node.id)}
                inputType="checkbox"
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
            Mode
          </div>
          <div className="flex gap-3">
            <OptionCard
              selected={mode === 'all'}
              onClick={() => setValue('mode', 'all')}
              title="UNION ALL"
              description="Keep all rows (including duplicates)"
            />
            <OptionCard
              selected={mode === 'distinct'}
              onClick={() => setValue('mode', 'distinct')}
              title="UNION"
              description="Remove duplicate rows"
            />
          </div>
        </div>

        {selectedNodes.length >= 2 && (
          <div
            className={`p-2 text-[11px] rounded ${
              compatibility.compatible
                ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
            }`}
          >
            <div className="font-medium">{compatibility.message}</div>
            {compatibility.details && <div className="mt-1 opacity-80">{compatibility.details}</div>}
          </div>
        )}

        <PreviewSection
          columns={preview.columns}
          rows={preview.rows}
          totalCount={preview.totalCount}
          loading={preview.loading}
          error={preview.error}
          limit={PREVIEW_LIMIT}
        />
      </div>
    </RadixDialog>
  )
}
