import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { sql } from '@codemirror/lang-sql'
import { Prec } from '@codemirror/state'
import { type KeyBinding, keymap } from '@codemirror/view'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import AlignLeft from 'lucide-react/dist/esm/icons/align-left'
import Clipboard from 'lucide-react/dist/esm/icons/clipboard'
import History from 'lucide-react/dist/esm/icons/history'
import Play from 'lucide-react/dist/esm/icons/play'
import Plus from 'lucide-react/dist/esm/icons/plus'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Save from 'lucide-react/dist/esm/icons/save'
import X from 'lucide-react/dist/esm/icons/x'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'sql-formatter'
import { useDuckDB } from '@/lib/duckdb'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder'
import { createSqlQueryView, dropView, getViewRowCount, getViewSchema } from '@/lib/duckdb/view-manager'
import { usePanelStore } from '@/stores/panelStore'
import { usePipelineLayoutStore } from '@/stores/pipelineLayoutStore'
import { usePipelineRuntimeStore } from '@/stores/pipelineRuntimeStore'
import { getDescendants, usePipelineStore } from '@/stores/pipelineStore'
import { useSqlStore } from '@/stores/sqlStore'
import { useThemeStore } from '@/stores/themeStore'
import { getEffectiveColorScheme } from '@/themes'
import type { DataView, SqlQueryOperation } from '@/types'
import { ResultGrid } from './ResultGrid'

export function SqlPanel() {
  const { client } = useDuckDB()
  const activeEditingPanel = usePanelStore((s) => s.activeEditingPanel)
  const sqlPanelHeight = usePanelStore((s) => s.sqlPanelHeight)
  const setSqlPanel = usePanelStore((s) => s.setSqlPanel)
  const setSqlPanelHeight = usePanelStore((s) => s.setSqlPanelHeight)
  const setEditingSqlNodeId = usePanelStore((s) => s.setEditingSqlNodeId)

  // Derive SQL panel state from discriminated union
  const sqlPanelOpen = activeEditingPanel.type === 'sql'
  const editingSqlNodeId = activeEditingPanel.type === 'sql' ? activeEditingPanel.editingNodeId : null
  const theme = useThemeStore((s) => s.theme)
  const structureStyle = useThemeStore((s) => s.structureStyle)
  const isClassic = structureStyle === 'classic'
  const nodes = usePipelineStore((s) => s.nodes)
  const runtimeById = usePipelineRuntimeStore((s) => s.nodes)
  const layoutById = usePipelineLayoutStore((s) => s.nodes)
  const edges = usePipelineStore((s) => s.edges)
  const activeNodeId = usePipelineStore((s) => s.activeNodeId)
  const addView = usePipelineStore((s) => s.addView)
  const updateView = usePipelineStore((s) => s.updateView)
  const addToHistory = useSqlStore((s) => s.addToHistory)
  const history = useSqlStore((s) => s.history)
  const [query, setQuery] = useState('')
  const [executing, setExecuting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    columns: { name: string; type: string }[]
    rows: Record<string, unknown>[]
    time: number
  } | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const executeRef = useRef<() => void>(() => {})
  const nodesRef = useRef(nodes)

  // Keep nodesRef updated for completion
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  const activeNode = activeNodeId ? nodes[activeNodeId] : null
  const editingNode = editingSqlNodeId ? nodes[editingSqlNodeId] : null
  const isEditing = editingNode?.type === 'view' && (editingNode as DataView).operation.type === 'sql'

  // Generate SQL for active node
  const getNodeSql = useCallback(() => {
    // If editing a SQL node, use its SQL
    if (isEditing && editingNode) {
      const op = (editingNode as DataView).operation as SqlQueryOperation
      return op.sql
    }
    if (!activeNode) return ''
    const activeRuntime = runtimeById[activeNode.id]
    if (activeNode.type === 'dataset') {
      if (!activeRuntime?.tableName) return ''
      return `SELECT * FROM ${escapeIdentifier(activeRuntime.tableName)}`
    }
    // For views, extract just the SELECT part from CREATE VIEW
    const viewSql = activeRuntime?.viewSql
    if (!viewSql) return ''
    const selectMatch = viewSql.match(/AS\s+(SELECT[\s\S]+)$/i)
    return selectMatch ? selectMatch[1] : viewSql
  }, [activeNode, editingNode, isEditing, runtimeById])

  // Reset query when panel opens or editing node changes
  useEffect(() => {
    if (sqlPanelOpen) {
      setQuery(getNodeSql())
      setResult(null)
      setError(null)
    }
  }, [sqlPanelOpen, editingSqlNodeId, getNodeSql])

  // Clear editing state when panel closes
  useEffect(() => {
    if (!sqlPanelOpen && editingSqlNodeId) {
      setEditingSqlNodeId(null)
    }
  }, [sqlPanelOpen, editingSqlNodeId, setEditingSqlNodeId])

  // Handle resize drag
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      const startY = e.clientY
      const startHeight = sqlPanelHeight

      const handleMouseMove = (e: MouseEvent) => {
        const delta = startY - e.clientY
        setSqlPanelHeight(startHeight + delta)
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [sqlPanelHeight, setSqlPanelHeight]
  )

  // Execute query
  const handleExecute = useCallback(async () => {
    if (!client || !query.trim()) return

    setExecuting(true)
    setError(null)
    setResult(null)

    const startTime = performance.now()

    try {
      const trimmedQuery = query.trim().replace(/;$/, '')
      const res = await client.query(trimmedQuery)
      const time = performance.now() - startTime

      // Extract column info from result
      const columns = res.columns.map((col) => ({
        name: col.name,
        type: col.duckdb_type,
      }))

      // Convert BigInt values
      const safeRows = JSON.parse(JSON.stringify(res.rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v)))
      setResult({ columns, rows: safeRows, time })
      addToHistory(query)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed')
    } finally {
      setExecuting(false)
    }
  }, [client, query])

  // Keep executeRef updated
  useEffect(() => {
    executeRef.current = handleExecute
  }, [handleExecute])

  // Create node from query
  const handleCreateNode = useCallback(async () => {
    if (!client || !query.trim()) return

    setCreating(true)
    setError(null)

    try {
      const result = await createSqlQueryView(client, query, nodes, runtimeById)
      const defaultPosition = activeNode
        ? (layoutById[activeNode.id]?.position ?? { x: 100, y: 100 })
        : { x: 100, y: 100 }
      addView(result.view, result.parentIds, result.runtime, {
        position: { x: defaultPosition.x + 300, y: defaultPosition.y },
      })
      setSqlPanel(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create node')
    } finally {
      setCreating(false)
    }
  }, [client, query, nodes, runtimeById, activeNode, layoutById, addView, setSqlPanel])

  // Update existing SQL node
  const handleUpdateNode = useCallback(async () => {
    if (!client || !query.trim() || !editingNode || !isEditing) return

    setCreating(true)
    setError(null)

    try {
      const view = editingNode as DataView
      const viewRuntime = runtimeById[view.id]
      const viewTableName = viewRuntime?.tableName
      if (!viewTableName) {
        throw new Error('Missing runtime table name for SQL node')
      }

      // Drop the old view and create new one with same name
      await dropView(client, viewTableName)

      // Create the new view with same ID
      const createSql = `CREATE VIEW ${escapeIdentifier(viewTableName)} AS ${query}`
      await client.execute(createSql)

      // Get updated schema and row count
      const columns = await getViewSchema(client, viewTableName)
      const rowCount = await getViewRowCount(client, viewTableName)

      // Extract table names for parent detection
      const referencedTables: string[] = []
      const pattern = /(?:FROM|JOIN)\s+(?:"([^"]+)"|(\w+))/gi
      for (const match of query.matchAll(pattern)) {
        const tableName = match[1] || match[2]
        if (tableName && !referencedTables.includes(tableName)) {
          referencedTables.push(tableName)
        }
      }

      // Find parent nodes
      const parentIds: string[] = []
      for (const node of Object.values(nodes)) {
        const tableName = runtimeById[node.id]?.tableName
        if (tableName && referencedTables.includes(tableName)) {
          parentIds.push(node.id)
        }
      }

      const operation: SqlQueryOperation = {
        type: 'sql',
        sql: query,
        referencedTables,
      }

      // Update the view in store
      usePipelineStore.getState().updateNode(view.id, { operation, parentIds, columns, rowCount, viewSql: createSql })

      // Refresh row counts for all descendant views in parallel
      const descendantIds = getDescendants(view.id, edges)
      const viewDescendants = descendantIds
        .map((id) => ({ id, node: nodes[id] }))
        .filter((item): item is { id: string; node: DataView } => item.node?.type === 'view')

      await Promise.all(
        viewDescendants.map(async ({ id, node }) => {
          const descTableName = runtimeById[node.id]?.tableName
          if (!descTableName) return
          const descRowCount = await getViewRowCount(client, descTableName)
          updateView(id, { rowCount: descRowCount })
        })
      )

      setSqlPanel(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update node')
    } finally {
      setCreating(false)
    }
  }, [client, query, editingNode, isEditing, nodes, runtimeById, edges, updateView, setSqlPanel])

  // Format SQL
  const handleFormat = useCallback(() => {
    try {
      const formatted = format(query, { language: 'sql' })
      setQuery(formatted)
    } catch {
      // Formatting failed, keep original
    }
  }, [query])

  // Copy SQL
  const handleCopy = useCallback(() => {
    if (query) {
      navigator.clipboard.writeText(query)
    }
  }, [query])

  // Reset to node SQL
  const handleClear = useCallback(() => {
    setQuery(getNodeSql())
    setResult(null)
    setError(null)
  }, [getNodeSql])

  // Load a query from history
  const handleLoadQuery = useCallback((sql: string) => {
    setQuery(sql)
    setShowHistory(false)
  }, [])

  // Table and column name completion source
  const sqlCompletion = useCallback(
    (context: CompletionContext): CompletionResult | null => {
      const nodeList = Object.values(nodesRef.current)

      // Check if we're completing after a table name (e.g., "tablename.")
      const dotMatch = context.matchBefore(/["']?(\w+)["']?\.\w*$/)
      if (dotMatch) {
        // Extract table name and find matching node
        const tableNameMatch = dotMatch.text.match(/["']?(\w+)["']?\./)
        const tableName = tableNameMatch?.[1]
        const node = nodeList.find((n) => {
          const runtime = runtimeById[n.id]
          return runtime?.tableName === tableName || runtime?.tableName?.toLowerCase() === tableName?.toLowerCase()
        })

        if (node) {
          const nodeRuntime = runtimeById[node.id]
          if (!nodeRuntime?.columns) return null
          // Complete with columns from this specific table
          const word = context.matchBefore(/\.\w*$/)
          if (!word) return null

          const options = nodeRuntime.columns.map((col) => ({
            label: col.name,
            type: 'property',
            detail: col.type,
            apply: escapeIdentifier(col.name),
          }))

          return {
            from: word.from + 1, // +1 to skip the dot
            options,
            validFor: /^\w*$/,
          }
        }
      }

      // Regular completion: tables and all columns
      const word = context.matchBefore(/\w*/)
      if (!word || (word.from === word.to && !context.explicit)) return null

      // Table options
      const tableOptions = nodeList.flatMap((node) => {
        const tableName = runtimeById[node.id]?.tableName
        if (!tableName) return []
        return [
          {
            label: tableName,
            type: node.type === 'dataset' ? 'class' : 'variable',
            detail: node.type === 'dataset' ? 'dataset' : 'view',
            apply: escapeIdentifier(tableName),
            boost: 1, // Prioritize tables
          },
        ]
      })

      // Column options from all tables
      const columnOptions = nodeList.flatMap((node) => {
        const nodeRuntime = runtimeById[node.id]
        if (!nodeRuntime?.columns || !nodeRuntime.tableName) return []
        return nodeRuntime.columns.map((col) => ({
          label: col.name,
          type: 'property',
          detail: `${col.type} (${nodeRuntime.tableName})`,
          apply: escapeIdentifier(col.name),
          boost: 0,
        }))
      })

      // Deduplicate columns by name (keep first occurrence)
      const seenColumns = new Set<string>()
      const uniqueColumnOptions = columnOptions.filter((opt) => {
        if (seenColumns.has(opt.label)) return false
        seenColumns.add(opt.label)
        return true
      })

      return {
        from: word.from,
        options: [...tableOptions, ...uniqueColumnOptions],
        validFor: /^\w*$/,
      }
    },
    [runtimeById]
  )

  // Handle drop of table/column names onto editor
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const data = e.dataTransfer.getData('text/plain')
    if (!data) return

    const editor = editorRef.current?.view
    if (editor) {
      // Insert at current cursor position
      const pos = editor.state.selection.main.head
      const insert = escapeIdentifier(data)
      editor.dispatch({
        changes: { from: pos, insert },
        selection: { anchor: pos + insert.length },
      })
      editor.focus()
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // CodeMirror extensions with stable execute reference
  const extensions = useMemo(() => {
    const runKeyBinding: KeyBinding = {
      key: 'Mod-Enter',
      run: () => {
        executeRef.current()
        return true
      },
    }

    return [
      sql(),
      Prec.highest(keymap.of([runKeyBinding])),
      autocompletion({
        override: [sqlCompletion],
        activateOnTyping: true,
      }),
    ]
  }, [sqlCompletion])

  if (!sqlPanelOpen) return null

  return (
    <div
      ref={panelRef}
      data-tour="sql-panel"
      className={`shrink-0 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] flex flex-col ${isClassic ? '' : 'mx-2 mb-2 rounded-lg border-x'}`}
      style={{ height: sqlPanelHeight }}
    >
      {/* Resize handle */}
      <div
        className="h-1.5 cursor-ns-resize hover:bg-[var(--color-accent)]/20 transition-colors flex items-center justify-center group"
        onMouseDown={handleResizeStart}
        style={{ userSelect: isResizing ? 'none' : undefined }}
      >
        <div className="w-8 h-0.5 rounded-full bg-[var(--color-border)] group-hover:bg-[var(--color-accent)]" />
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor pane */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--color-border)]">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--color-border)] shrink-0">
            <div className="flex items-center gap-1.5">
              {isEditing ? (
                <span className="text-[10px] text-[var(--color-accent)] font-medium">Editing {editingNode?.name}</span>
              ) : activeNode ? (
                <span className="text-[10px] text-[var(--color-text-muted)]">{activeNode.name}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleFormat}
                disabled={!query.trim()}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Format SQL"
              >
                <AlignLeft className="w-3 h-3" />
                <span>Format</span>
              </button>
              <button
                onClick={handleCopy}
                disabled={!query.trim()}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Copy SQL"
              >
                <Clipboard className="w-3 h-3" />
                <span>Copy</span>
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                title="Reset to original"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
              <div className="w-px h-3.5 bg-[var(--color-border)] mx-0.5" />
              <div className="relative">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  disabled={history.length === 0}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Query history"
                >
                  <History className="w-3 h-3" />
                  <span>History</span>
                </button>
                {showHistory && history.length > 0 && (
                  <div className="absolute top-full right-0 mt-1 w-72 max-h-48 overflow-auto bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
                    {history.map((histSql, i) => (
                      <button
                        key={i}
                        onClick={() => handleLoadQuery(histSql)}
                        className="w-full px-2 py-1.5 text-left text-[11px] font-mono hover:bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] last:border-b-0 truncate text-[var(--color-text-secondary)]"
                      >
                        {histSql}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-auto" onDropCapture={handleDrop} onDragOverCapture={handleDragOver}>
            <CodeMirror
              ref={editorRef}
              value={query}
              onChange={setQuery}
              extensions={extensions}
              theme={getEffectiveColorScheme(theme)}
              className="h-full text-[12px]"
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: true,
              }}
            />
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-end gap-1.5 px-2 py-1.5 border-t border-[var(--color-border)] shrink-0">
            <button
              onClick={handleExecute}
              disabled={!query.trim() || executing}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-secondary)]"
            >
              <Play className="w-3 h-3" />
              {executing ? 'Running...' : 'Run'}
            </button>
            <button
              onClick={isEditing ? handleUpdateNode : handleCreateNode}
              disabled={!query.trim() || creating}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? (
                <>
                  <Save className="w-3 h-3" />
                  {creating ? 'Saving...' : 'Save'}
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" />
                  {creating ? 'Creating...' : 'Create view'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results pane */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Results header */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--color-border)] shrink-0">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {result
                ? `${result.rows.length} row${result.rows.length !== 1 ? 's' : ''} · ${result.time.toFixed(0)}ms`
                : 'Results'}
            </span>
            <button
              onClick={() => setSqlPanel(false)}
              className="p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
              aria-label="Close SQL panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Results content */}
          <div className="flex-1 overflow-hidden">
            {error && (
              <div className="m-2 p-2 text-[11px] text-[var(--color-error)] bg-[var(--color-error)]/5 border border-[var(--color-error)]/20 rounded">
                {error}
              </div>
            )}

            {result && (
              <div className="h-full p-2">
                <ResultGrid columns={result.columns} rows={result.rows} maxHeight={sqlPanelHeight - 80} />
              </div>
            )}

            {!error && !result && (
              <div className="flex items-center justify-center h-full text-[11px] text-[var(--color-text-muted)]">
                <div className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  <span>Run query to see results</span>
                  <kbd className="px-1 py-0.5 text-[9px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded">
                    ⌘↵
                  </kbd>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
