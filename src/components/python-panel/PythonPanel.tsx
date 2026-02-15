import Clipboard from 'lucide-react/dist/esm/icons/clipboard'
import Play from 'lucide-react/dist/esm/icons/play'
import Plus from 'lucide-react/dist/esm/icons/plus'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Save from 'lucide-react/dist/esm/icons/save'
import X from 'lucide-react/dist/esm/icons/x'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDuckDB } from '@/lib/duckdb'
import { useHydratedNodes } from '@/lib/pipeline/hooks/useHydratedNodes'
import { getPythonService, type PythonExecutionResult, type PythonServiceStatus } from '@/lib/python'
import { usePanelStore } from '@/stores/panelStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import { useThemeStore } from '@/stores/themeStore'
import type { PythonNode } from '@/types'
import { MatplotlibPreview } from './MatplotlibPreview'
import { PythonEditor, type PythonEditorRef } from './PythonEditor'
import { PythonOutput } from './PythonOutput'

const DEFAULT_CODE = `# Your DataFrame is available as 'df'
# Set 'result' to a DataFrame to create a new node

# Example: filter rows
result = df[df['column_name'] > 0]

# Example: add computed column
# df['new_col'] = df['col1'] + df['col2']
# result = df

# Example: matplotlib visualization
# import matplotlib.pyplot as plt
# df['column'].hist()
# plt.title('Histogram')
# plt.show()
`

export function PythonPanel() {
  const { client } = useDuckDB()
  const activeEditingPanel = usePanelStore((s) => s.activeEditingPanel)
  const sqlPanelHeight = usePanelStore((s) => s.sqlPanelHeight)
  const setSqlPanelHeight = usePanelStore((s) => s.setSqlPanelHeight)
  const setPythonPanel = usePanelStore((s) => s.setPythonPanel)
  const structureStyle = useThemeStore((s) => s.structureStyle)
  const isClassic = structureStyle === 'classic'

  const nodes = useHydratedNodes()
  const activeNodeId = usePipelineStore((s) => s.activeNodeId)
  const addPythonNode = usePipelineStore((s) => s.addPythonNode)
  const updatePythonNode = usePipelineStore((s) => s.updatePythonNode)

  // Derive Python panel state from discriminated union
  const pythonPanelOpen = activeEditingPanel.type === 'python'
  const editingNodeId = activeEditingPanel.type === 'python' ? activeEditingPanel.editingNodeId : null

  // Use active node as source (like SQL panel)
  const activeNode = activeNodeId ? nodes[activeNodeId] : null
  const editingNode = editingNodeId ? nodes[editingNodeId] : null
  const isEditing = editingNode?.type === 'python'

  // For editing Python nodes, use the parent as source; otherwise use active node
  const sourceNode = isEditing && editingNode?.parentId ? nodes[editingNode.parentId] : activeNode

  const [code, setCode] = useState(DEFAULT_CODE)
  const [executing, setExecuting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pythonStatus, setPythonStatus] = useState<PythonServiceStatus>('unavailable')
  const [statusMessage, setStatusMessage] = useState<string>()
  const [result, setResult] = useState<PythonExecutionResult | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<PythonEditorRef>(null)

  // Subscribe to Python service status
  useEffect(() => {
    const pythonService = getPythonService()
    return pythonService.onStatusChange((status, message) => {
      setPythonStatus(status)
      setStatusMessage(message)
    })
  }, [])

  // Initialize Python when panel opens
  useEffect(() => {
    if (pythonPanelOpen) {
      const pythonService = getPythonService()
      if (pythonService.getStatus() === 'unavailable') {
        pythonService.initialize().catch(console.error)
      }
    }
  }, [pythonPanelOpen])

  // Set DuckDB client when available
  useEffect(() => {
    if (client) {
      getPythonService().setDuckDBClient(client)
    }
  }, [client])

  // Load code when panel opens or editing node changes
  useEffect(() => {
    if (pythonPanelOpen) {
      if (isEditing && editingNode) {
        setCode(editingNode.code)
      } else {
        setCode(DEFAULT_CODE)
      }
      setResult(null)
    }
  }, [pythonPanelOpen, editingNodeId, editingNode, isEditing])

  // Handle resize
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

  // Execute Python code
  const handleExecute = useCallback(async () => {
    if (!sourceNode || !sourceNode.tableName || !code.trim()) return

    setExecuting(true)
    setResult(null)

    try {
      const pythonService = getPythonService()
      const execResult = await pythonService.execute(code, sourceNode.tableName)
      setResult(execResult)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        stdout: '',
        stderr: '',
        executionTimeMs: 0,
      })
    } finally {
      setExecuting(false)
    }
  }, [sourceNode, code])

  // Create new Python node
  const handleCreateNode = useCallback(async () => {
    if (
      !client ||
      !sourceNode ||
      !sourceNode.tableName ||
      !result?.success ||
      (!result.outputJson && !result.outputData)
    ) {
      return
    }

    setCreating(true)

    try {
      const pythonService = getPythonService()

      // Generate table name
      const timestamp = Date.now().toString(36).slice(-4)
      const tableName = `python_${sourceNode.tableName}_${timestamp}`
      const nodeId = tableName

      // Import result into DuckDB
      await pythonService.importResultAsTable(result, tableName)

      // Get schema from DuckDB
      const columns = await client.describe(tableName)

      // Calculate position based on parent
      const sourcePosition = sourceNode.position ?? { x: 100, y: 100 }
      const position = {
        x: sourcePosition.x + 350,
        y: sourcePosition.y + 50,
      }

      // Create the Python node
      const pythonNode: PythonNode = {
        id: nodeId,
        type: 'python',
        name: `Python: ${sourceNode.name}`,
        createdAt: new Date(),
        code,
      }

      addPythonNode(
        pythonNode,
        sourceNode.id,
        {
          tableName,
          outputTableName: tableName,
          columns,
          rowCount: result.rowCount ?? null,
          matplotlibOutput: result.matplotlibOutput,
          executionTimeMs: result.executionTimeMs,
          lastExecutedAt: new Date(),
        },
        { position }
      )
      setPythonPanel(false)
    } catch (error) {
      setResult((prev) =>
        prev
          ? {
              ...prev,
              error: `Failed to create node: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }
          : null
      )
    } finally {
      setCreating(false)
    }
  }, [client, sourceNode, result, code, addPythonNode, setPythonPanel])

  // Update existing Python node
  const handleUpdateNode = useCallback(async () => {
    if (!client || !editingNode || editingNode.type !== 'python' || !editingNode.tableName) return
    if (!result?.success || (!result.outputJson && !result.outputData)) return

    setCreating(true)

    try {
      const pythonService = getPythonService()

      // Drop old table and re-import
      await client.execute(`DROP TABLE IF EXISTS "${editingNode.tableName}"`)
      await pythonService.importResultAsTable(result, editingNode.tableName)

      // Get updated schema
      const columns = await client.describe(editingNode.tableName)

      // Update the node
      updatePythonNode(editingNode.id, {
        columns,
        rowCount: result.rowCount ?? null,
        code,
        matplotlibOutput: result.matplotlibOutput,
        executionTimeMs: result.executionTimeMs,
        lastExecutedAt: new Date(),
      })

      setPythonPanel(false)
    } catch (error) {
      setResult((prev) =>
        prev
          ? {
              ...prev,
              error: `Failed to update node: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }
          : null
      )
    } finally {
      setCreating(false)
    }
  }, [client, editingNode, result, code, updatePythonNode, setPythonPanel])

  // Copy code
  const handleCopy = useCallback(() => {
    if (code) {
      navigator.clipboard.writeText(code)
    }
  }, [code])

  // Reset code
  const handleReset = useCallback(() => {
    if (isEditing && editingNode) {
      setCode(editingNode.code)
    } else {
      setCode(DEFAULT_CODE)
    }
    setResult(null)
  }, [editingNode, isEditing])

  if (!pythonPanelOpen) return null

  const canExecute = pythonStatus === 'ready' && code.trim() && sourceNode
  const canCreate = result?.success && (result.outputJson || result.outputData)

  return (
    <div
      ref={panelRef}
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
              {/* Status indicator */}
              <span className="text-[10px] text-[var(--color-text-muted)] mr-2">
                {pythonStatus === 'loading' && (statusMessage || 'Loading...')}
                {pythonStatus === 'unavailable' && 'Python unavailable'}
                {pythonStatus === 'ready' && 'Ready'}
                {pythonStatus === 'busy' && 'Executing...'}
              </span>
              <button
                onClick={handleCopy}
                disabled={!code.trim()}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Copy code"
              >
                <Clipboard className="w-3 h-3" />
                <span>Copy</span>
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                title="Reset to original"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-auto">
            <PythonEditor ref={editorRef} value={code} onChange={setCode} onExecute={handleExecute} />
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-end gap-1.5 px-2 py-1.5 border-t border-[var(--color-border)] shrink-0">
            <button
              onClick={handleExecute}
              disabled={!canExecute || executing}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-secondary)]"
            >
              <Play className="w-3 h-3" />
              {executing ? 'Running...' : 'Run'}
            </button>
            <button
              onClick={isEditing ? handleUpdateNode : handleCreateNode}
              disabled={!canCreate || creating}
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
                  {creating ? 'Creating...' : 'Create node'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output pane */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Output header */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--color-border)] shrink-0">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {result
                ? result.success
                  ? `${result.rowCount ?? 0} rows · ${result.executionTimeMs.toFixed(0)}ms`
                  : 'Error'
                : 'Output'}
            </span>
            <button
              onClick={() => setPythonPanel(false)}
              className="p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
              aria-label="Close Python panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Output content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Matplotlib preview */}
            {result?.matplotlibOutput && (
              <div className="p-2 border-b border-[var(--color-border)]">
                <MatplotlibPreview
                  base64Image={result.matplotlibOutput}
                  onClose={() => setResult((prev) => (prev ? { ...prev, matplotlibOutput: undefined } : null))}
                />
              </div>
            )}

            {/* Stdout/stderr */}
            <div className="flex-1 overflow-auto">
              <PythonOutput stdout={result?.stdout ?? ''} stderr={result?.stderr ?? ''} error={result?.error} />
            </div>

            {/* Result preview info */}
            {result?.success && result.columns && (
              <div className="px-2 py-1 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
                Columns: {result.columns.map((c) => `${c.name} (${c.dtype})`).join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
