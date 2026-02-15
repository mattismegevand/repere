import JSZip from 'jszip'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import { saveFileTauri } from '@/lib/file-system/tauri-file-ops'
import { isNativeRuntime } from '@/lib/runtime'
import type {
  ChartConfig,
  ChartNode,
  Column,
  DashboardConfig,
  DashboardNode,
  Dataset,
  DataView,
  ExportConfig,
  ExportNode,
  PipelineEdge,
  PipelineNode,
  PythonNode,
} from '@/types'

// ============================================
// TYPES
// ============================================

const SESSION_VERSION = 2
const EMBED_SIZE_THRESHOLD = 50 * 1024 * 1024 // 50MB

interface SerializedNode {
  id: string
  type: 'dataset' | 'view' | 'chart' | 'export' | 'dashboard' | 'python'
  name: string
  tableName: string
  columns: Column[]
  rowCount: number | null // null if still calculating
  createdAt: string // ISO date string
  position: { x: number; y: number }

  // Dataset-specific
  fileName?: string
  fileSize?: number
  fileHash?: string // SHA-256 hash for verification
  isPlaceholder?: boolean // True if dataset is awaiting data

  // View-specific
  parentIds?: string[]
  operation?: DataView['operation']
  viewSql?: string

  // Chart-specific
  chartParentId?: string
  chartConfig?: ChartConfig

  // Export-specific
  exportParentId?: string
  exportConfig?: ExportConfig

  // Dashboard-specific
  dashboardParentIds?: string[]
  dashboardChartRefs?: string[]
  dashboardConfig?: DashboardConfig

  // Python-specific
  pythonParentId?: string
  pythonCode?: string
  pythonOutputTableName?: string
  pythonMatplotlibOutput?: string
  pythonExecutionTimeMs?: number
  pythonLastExecutedAt?: string
}

export interface RequiredFile {
  nodeId: string
  fileName: string
  fileSize?: number // May not be available when loaded via path in Tauri mode
  fileHash?: string // SHA-256 hash for verification
  expectedColumns: Column[] // Expected schema for validation
}

// ============================================
// SCHEMA VALIDATION
// ============================================

export type SchemaValidationResult =
  | { valid: true }
  | {
      valid: false
      missingColumns: string[]
      typeMismatches: Array<{ column: string; expected: string; actual: string }>
    }

/**
 * Compare two column types for compatibility.
 * Allows implicit casts (e.g., INT → BIGINT, VARCHAR(50) → VARCHAR)
 */
function areTypesCompatible(expected: string, actual: string): boolean {
  // Normalize types to lowercase for comparison
  const e = expected.toLowerCase()
  const a = actual.toLowerCase()

  if (e === a) return true

  // All numeric types are compatible
  const numericTypes = ['number', 'int', 'integer', 'bigint', 'float', 'double', 'decimal', 'numeric']
  const isExpectedNumeric = numericTypes.some((t) => e.includes(t))
  const isActualNumeric = numericTypes.some((t) => a.includes(t))
  if (isExpectedNumeric && isActualNumeric) return true

  // All string types are compatible
  const stringTypes = ['string', 'varchar', 'text', 'char']
  const isExpectedString = stringTypes.some((t) => e.includes(t))
  const isActualString = stringTypes.some((t) => a.includes(t))
  if (isExpectedString && isActualString) return true

  // All date/time types are compatible with each other
  const dateTypes = ['date', 'time', 'timestamp']
  const isExpectedDate = dateTypes.some((t) => e.includes(t))
  const isActualDate = dateTypes.some((t) => a.includes(t))
  if (isExpectedDate && isActualDate) return true

  return false
}

/**
 * Validate that a file's columns match the expected schema.
 * Extra columns in the file are allowed (ignored).
 * Missing columns or type mismatches cause validation failure.
 */
export function validateSchema(fileColumns: Column[], expectedColumns: Column[]): SchemaValidationResult {
  const missingColumns: string[] = []
  const typeMismatches: Array<{ column: string; expected: string; actual: string }> = []

  // Build a map of actual columns by name (case-sensitive)
  const actualMap = new Map(fileColumns.map((c) => [c.name, c]))

  for (const expected of expectedColumns) {
    const actual = actualMap.get(expected.name)

    if (!actual) {
      missingColumns.push(expected.name)
    } else if (!areTypesCompatible(expected.type, actual.type)) {
      typeMismatches.push({
        column: expected.name,
        expected: expected.type,
        actual: actual.type,
      })
    }
  }

  if (missingColumns.length > 0 || typeMismatches.length > 0) {
    return { valid: false, missingColumns, typeMismatches }
  }

  return { valid: true }
}

// ============================================
// ZIP FORMAT TYPES
// ============================================

/** manifest.json inside the ZIP */
interface SessionManifest {
  version: number
  formatType: 'repere-zip'
  exportedAt: string
  embeddedDatasets: string[] // Node IDs of datasets with embedded Parquet data
  requiredFiles: RequiredFile[] // Datasets that need re-upload
}

/** pipeline.json inside the ZIP */
interface SessionPipeline {
  nodes: SerializedNode[]
  edges: PipelineEdge[]
  activeNodeId: string | null
  openNodeIds: string[]
}

/** Result of deserializing a ZIP session */
export interface SessionData {
  nodes: Record<string, PipelineNode>
  edges: PipelineEdge[]
  activeNodeId: string | null
  openNodeIds: string[]
  embeddedFiles: Map<string, File> // nodeId -> Parquet file
  requiredFiles: RequiredFile[]
}

// ============================================
// SERIALIZATION
// ============================================

function serializeNode(node: PipelineNode): SerializedNode {
  const base = {
    id: node.id,
    type: node.type,
    name: node.name,
    tableName: node.tableName,
    columns: node.columns,
    rowCount: node.rowCount,
    createdAt: node.createdAt.toISOString(),
    position: node.position,
  }

  if (node.type === 'dataset') {
    return {
      ...base,
      type: 'dataset',
      fileName: node.fileName,
      fileSize: node.fileSize,
      fileHash: node.fileHash,
      isPlaceholder: node.isPlaceholder,
    }
  } else if (node.type === 'chart') {
    return {
      ...base,
      type: 'chart',
      chartParentId: node.parentId,
      chartConfig: node.config,
    }
  } else if (node.type === 'export') {
    return {
      ...base,
      type: 'export',
      exportParentId: node.parentId,
      exportConfig: node.config,
    }
  } else if (node.type === 'dashboard') {
    return {
      ...base,
      type: 'dashboard',
      dashboardParentIds: node.parentIds,
      dashboardChartRefs: node.chartRefs,
      dashboardConfig: node.config,
    }
  } else if (node.type === 'python') {
    return {
      ...base,
      type: 'python',
      pythonParentId: node.parentId,
      pythonCode: node.code,
      pythonOutputTableName: node.outputTableName,
      pythonMatplotlibOutput: node.matplotlibOutput,
      pythonExecutionTimeMs: node.executionTimeMs,
      pythonLastExecutedAt: node.lastExecutedAt?.toISOString(),
    }
  } else {
    // DataView - must be the only remaining type
    const view = node as DataView
    return {
      ...base,
      type: 'view',
      parentIds: view.parentIds,
      operation: view.operation,
      viewSql: view.viewSql,
    }
  }
}

function deserializeNode(serialized: SerializedNode): PipelineNode {
  const base = {
    id: serialized.id,
    name: serialized.name,
    tableName: serialized.tableName,
    columns: serialized.columns,
    rowCount: serialized.rowCount,
    createdAt: new Date(serialized.createdAt),
    position: serialized.position,
  }

  if (serialized.type === 'dataset') {
    return {
      ...base,
      type: 'dataset',
      fileName: serialized.fileName!,
      fileSize: serialized.fileSize!,
      fileHash: serialized.fileHash,
      isPlaceholder: serialized.isPlaceholder,
    } as Dataset
  } else if (serialized.type === 'chart') {
    return {
      ...base,
      type: 'chart',
      parentId: serialized.chartParentId!,
      config: serialized.chartConfig!,
    } as ChartNode
  } else if (serialized.type === 'export') {
    return {
      ...base,
      type: 'export',
      parentId: serialized.exportParentId!,
      config: serialized.exportConfig!,
    } as ExportNode
  } else if (serialized.type === 'dashboard') {
    return {
      ...base,
      type: 'dashboard',
      parentIds: serialized.dashboardParentIds!,
      chartRefs: serialized.dashboardChartRefs!,
      config: serialized.dashboardConfig!,
    } as DashboardNode
  } else if (serialized.type === 'python') {
    return {
      ...base,
      type: 'python',
      parentId: serialized.pythonParentId!,
      code: serialized.pythonCode!,
      outputTableName: serialized.pythonOutputTableName!,
      matplotlibOutput: serialized.pythonMatplotlibOutput,
      executionTimeMs: serialized.pythonExecutionTimeMs,
      lastExecutedAt: serialized.pythonLastExecutedAt ? new Date(serialized.pythonLastExecutedAt) : undefined,
    } as PythonNode
  } else {
    return {
      ...base,
      type: 'view',
      parentIds: serialized.parentIds!,
      operation: serialized.operation!,
      viewSql: serialized.viewSql!,
    } as DataView
  }
}

// ============================================
// PARQUET EXPORT HELPER
// ============================================

async function exportTableToParquet(client: DuckDBClient, tableName: string): Promise<Uint8Array> {
  return client.exportToBytes(tableName)
}

// ============================================
// MAIN FUNCTIONS
// ============================================

type EmbeddingMode = 'none' | 'all' | 'custom'

export interface SerializeOptions {
  embeddingMode?: EmbeddingMode
  embedDatasetIds?: Set<string> // Only used when embeddingMode is 'custom'
}

/**
 * Serialize session to a ZIP blob containing:
 * - manifest.json: Version, metadata, file references
 * - pipeline.json: Nodes, edges, UI state
 * - data/{nodeId}.parquet: Embedded dataset data
 */
export async function serializeSession(
  client: DuckDBClient,
  nodes: Record<string, PipelineNode>,
  edges: PipelineEdge[],
  activeNodeId: string | null,
  openNodeIds: string[],
  options?: SerializeOptions
): Promise<Blob> {
  const zip = new JSZip()
  const serializedNodes: SerializedNode[] = []
  const embeddedDatasets: string[] = []
  const requiredFiles: RequiredFile[] = []

  const embeddingMode = options?.embeddingMode ?? 'all'
  const embedDatasetIds = options?.embedDatasetIds ?? new Set<string>()

  // Process each node
  for (const node of Object.values(nodes)) {
    serializedNodes.push(serializeNode(node))

    // For datasets, check if we should embed data
    if (node.type === 'dataset') {
      const dataset = node as Dataset

      // Determine if this dataset should be embedded
      let shouldEmbed = false
      const fileSize = dataset.fileSize ?? 0
      if (embeddingMode === 'all') {
        shouldEmbed = fileSize <= EMBED_SIZE_THRESHOLD
      } else if (embeddingMode === 'custom') {
        shouldEmbed = embedDatasetIds.has(dataset.id) && fileSize <= EMBED_SIZE_THRESHOLD
      }
      // embeddingMode === 'none' → shouldEmbed stays false

      if (shouldEmbed) {
        // Export to Parquet and add to ZIP
        const parquetData = await exportTableToParquet(client, dataset.tableName)
        zip.file(`data/${dataset.id}.parquet`, parquetData)
        embeddedDatasets.push(dataset.id)
      } else {
        // Require re-upload
        requiredFiles.push({
          nodeId: dataset.id,
          fileName: dataset.fileName,
          fileSize: dataset.fileSize,
          fileHash: dataset.fileHash,
          expectedColumns: dataset.columns,
        })
      }
    }
  }

  // Create manifest.json
  const manifest: SessionManifest = {
    version: SESSION_VERSION,
    formatType: 'repere-zip',
    exportedAt: new Date().toISOString(),
    embeddedDatasets,
    requiredFiles,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  // Create pipeline.json
  const pipeline: SessionPipeline = {
    nodes: serializedNodes,
    edges,
    activeNodeId,
    openNodeIds,
  }
  zip.file('pipeline.json', JSON.stringify(pipeline, null, 2))

  // Generate ZIP blob
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

/**
 * Deserialize a ZIP session file into session data.
 * Returns embedded Parquet files as File objects for restoration.
 */
export async function deserializeSession(blob: Blob): Promise<SessionData> {
  const zip = await JSZip.loadAsync(blob)

  // Read and validate manifest
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) {
    throw new Error('Invalid session file: missing manifest.json')
  }
  const manifestText = await manifestFile.async('string')
  const manifest: SessionManifest = JSON.parse(manifestText)

  if (manifest.version !== SESSION_VERSION) {
    throw new Error(`Unsupported session version: ${manifest.version}`)
  }
  if (manifest.formatType !== 'repere-zip') {
    throw new Error(`Unsupported format type: ${manifest.formatType}`)
  }

  // Read pipeline
  const pipelineFile = zip.file('pipeline.json')
  if (!pipelineFile) {
    throw new Error('Invalid session file: missing pipeline.json')
  }
  const pipelineText = await pipelineFile.async('string')
  const pipeline: SessionPipeline = JSON.parse(pipelineText)

  // Deserialize nodes
  const nodes: Record<string, PipelineNode> = {}
  for (const serialized of pipeline.nodes) {
    const node = deserializeNode(serialized)
    nodes[node.id] = node
  }

  // Extract embedded Parquet files
  const embeddedFiles = new Map<string, File>()
  for (const nodeId of manifest.embeddedDatasets) {
    const parquetFile = zip.file(`data/${nodeId}.parquet`)
    if (parquetFile) {
      const data = await parquetFile.async('arraybuffer')
      const file = new File([data], `${nodeId}.parquet`, { type: 'application/octet-stream' })
      embeddedFiles.set(nodeId, file)
    }
  }

  return {
    nodes,
    edges: pipeline.edges,
    activeNodeId: pipeline.activeNodeId,
    openNodeIds: pipeline.openNodeIds,
    embeddedFiles,
    requiredFiles: manifest.requiredFiles,
  }
}

// ============================================
// FILE OPERATIONS
// ============================================

export async function downloadSession(blob: Blob, filename?: string): Promise<string | null> {
  const name = filename ?? 'session.repere'

  // Use native save dialog in Tauri
  if (isNativeRuntime()) {
    const savedPath = await saveFileTauri(name, blob, [{ name: 'repere Session', extensions: ['repere'] }])
    if (savedPath) return savedPath
    // Fall through to browser download if user cancelled
  }

  // Browser download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return null
}

export async function pickSessionFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.repere'

    input.onchange = () => {
      const file = input.files?.[0] ?? null
      resolve(file)
    }

    input.oncancel = () => resolve(null)
    input.click()
  })
}

/**
 * Filter a session to exclude skipped nodes and their descendants.
 * Used for partial recovery when some files are unavailable.
 */
export function filterSessionBySkippedNodes(data: SessionData, skippedNodeIds: Set<string>): SessionData {
  if (skippedNodeIds.size === 0) return data

  // Build edge map for finding children
  const childrenMap = new Map<string, string[]>()

  for (const edge of data.edges) {
    const children = childrenMap.get(edge.sourceId) ?? []
    children.push(edge.targetId)
    childrenMap.set(edge.sourceId, children)
  }

  // Find all nodes to remove (skipped + descendants)
  const nodesToRemove = new Set<string>()

  const markForRemoval = (nodeId: string) => {
    if (nodesToRemove.has(nodeId)) return
    nodesToRemove.add(nodeId)
    // Recursively mark all children
    const children = childrenMap.get(nodeId) ?? []
    for (const childId of children) {
      markForRemoval(childId)
    }
  }

  for (const nodeId of skippedNodeIds) {
    markForRemoval(nodeId)
  }

  // Filter nodes
  const filteredNodes: Record<string, PipelineNode> = {}
  for (const [id, node] of Object.entries(data.nodes)) {
    if (!nodesToRemove.has(id)) {
      filteredNodes[id] = node
    }
  }

  // Filter edges
  const filteredEdges = data.edges.filter((e) => !nodesToRemove.has(e.sourceId) && !nodesToRemove.has(e.targetId))

  // Filter required files
  const filteredRequiredFiles = data.requiredFiles.filter((r) => !nodesToRemove.has(r.nodeId))

  // Filter embedded files
  const filteredEmbeddedFiles = new Map<string, File>()
  for (const [nodeId, file] of data.embeddedFiles) {
    if (!nodesToRemove.has(nodeId)) {
      filteredEmbeddedFiles.set(nodeId, file)
    }
  }

  // Update activeNodeId if it was removed
  const activeNodeId = data.activeNodeId && nodesToRemove.has(data.activeNodeId) ? null : data.activeNodeId

  // Filter openNodeIds
  const openNodeIds = data.openNodeIds.filter((id) => !nodesToRemove.has(id))

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    activeNodeId,
    openNodeIds,
    embeddedFiles: filteredEmbeddedFiles,
    requiredFiles: filteredRequiredFiles,
  }
}
