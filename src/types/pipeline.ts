import type { DashboardConfig } from './dashboard'
import type { Filter, FilterExpression, Sort } from './dataset'

// ============================================
// NODE TYPES
// ============================================

type NodeType = 'dataset' | 'view' | 'chart' | 'export' | 'dashboard' | 'python'

/**
 * Base interface for all nodes in the DAG.
 * Both datasets and views share common properties.
 */
interface DataNode {
  id: string
  type: NodeType
  name: string
  createdAt: Date
  isDisabled?: boolean // Skip without deleting (grayed out, descendants show error)
  hasError?: boolean // Upstream node is disabled or errored
  errorMessage?: string // Error description
}

/**
 * Dataset represents source data loaded from a file.
 * This is a root node in the DAG - has no parents.
 */
export interface Dataset extends DataNode {
  type: 'dataset'
  fileName: string
  fileSize?: number // Optional - may not be available when loaded via path in Tauri mode
  fileHash?: string // SHA-256 hash (first 16 hex chars) for verification on re-upload
  isPlaceholder?: boolean // True if awaiting data - no DuckDB table exists yet
}

/**
 * DataView represents a derived view from operations.
 * Always has at least one parent (the source node).
 */
export interface DataView extends DataNode {
  type: 'view'
  operation: ViewOperation
}

/**
 * ChartNode represents a visualization terminal node.
 * Does not create a DuckDB view - queries parent directly.
 */
export interface ChartNode extends DataNode {
  type: 'chart'
  config: ChartConfig
}

/**
 * ExportNode represents a download terminal node.
 * Does not create a DuckDB view - exports parent data directly.
 */
export interface ExportNode extends DataNode {
  type: 'export'
  config: ExportConfig
}

/**
 * DashboardNode represents a multi-chart dashboard container.
 * Can connect to multiple data sources and import existing charts.
 * Does not create a DuckDB view - a container for visualization.
 */
export interface DashboardNode extends DataNode {
  type: 'dashboard'
  chartRefs: string[] // References to existing ChartNode IDs (imported charts)
  config: DashboardConfig
}

/**
 * PythonNode represents a Python transformation node.
 * Executes Python code on a DataFrame and stores the result as a DuckDB TABLE.
 * Unlike views, Python results are materialized since Python cannot be expressed as SQL.
 */
export interface PythonNode extends DataNode {
  type: 'python'
  code: string // Python source code
}

// Union type for any node
export type PipelineNode = Dataset | DataView | ChartNode | ExportNode | DashboardNode | PythonNode

// ============================================
// OPERATION TYPES
// ============================================

export type OperationType =
  // Query operations
  | 'filter'
  | 'sort'
  | 'limit'
  // Column operations
  | 'select'
  | 'addColumn'
  | 'removeColumns'
  | 'renameColumns'
  | 'reorderColumns'
  | 'castColumn'
  // Cell/value operations
  | 'editCell'
  | 'editColumn'
  | 'fillNull'
  | 'replaceValue'
  // Aggregation operations
  | 'pivot'
  | 'unpivot'
  // Window operations
  | 'window'
  // Combine operations
  | 'join'
  | 'union'
  | 'distinct'
  // Custom SQL
  | 'sql'

/**
 * Base operation interface
 */
interface BaseOperation {
  type: OperationType
}

// ----------------------------------------
// Query Operations
// ----------------------------------------

/**
 * Filter operation - applies WHERE conditions using nested expressions
 */
export interface FilterOperation extends BaseOperation {
  type: 'filter'
  expression: FilterExpression
}

/**
 * Sort operation - applies ORDER BY
 */
export interface SortOperation extends BaseOperation {
  type: 'sort'
  sorts: Array<Sort & { nulls?: 'first' | 'last' }>
}

/**
 * Limit operation - row limit with optional offset
 */
export interface LimitOperation extends BaseOperation {
  type: 'limit'
  limit: number
  offset?: number
}

// ----------------------------------------
// Column Operations
// ----------------------------------------

/**
 * Select operation - column projection
 */
export interface SelectOperation extends BaseOperation {
  type: 'select'
  columns: string[]
}

/**
 * Add column operation - add computed or constant column
 */
export interface AddColumnOperation extends BaseOperation {
  type: 'addColumn'
  columns: ComputedColumn[]
}

export interface ComputedColumn {
  name: string
  expression: string // SQL expression
}

/**
 * Remove columns operation
 */
export interface RemoveColumnsOperation extends BaseOperation {
  type: 'removeColumns'
  columns: string[]
}

/**
 * Rename columns operation
 */
export interface RenameColumnsOperation extends BaseOperation {
  type: 'renameColumns'
  renames: Array<{ from: string; to: string }>
}

/**
 * Reorder columns operation
 */
export interface ReorderColumnsOperation extends BaseOperation {
  type: 'reorderColumns'
  order: string[] // New column order
}

/**
 * Cast column type operation
 */
export interface CastColumnOperation extends BaseOperation {
  type: 'castColumn'
  column: string
  toType: string // DuckDB type (VARCHAR, INTEGER, etc.)
}

// ----------------------------------------
// Cell/Value Operations
// ----------------------------------------

/**
 * Edit cell(s) operation - supports multiple cell edits in one view
 */
export interface CellEdit {
  rowId: number // ROW_NUMBER() based ID (1-indexed)
  column: string
  value: unknown
}

export interface EditCellOperation extends BaseOperation {
  type: 'editCell'
  edits: CellEdit[]
}

/**
 * Edit column operation - bulk transform
 */
export interface EditColumnOperation extends BaseOperation {
  type: 'editColumn'
  column: string
  expression: string // SQL expression using the column
}

/**
 * Fill null values operation
 */
export interface FillNullOperation extends BaseOperation {
  type: 'fillNull'
  column: string
  strategy: 'value' | 'forward' | 'backward' | 'mean' | 'median' | 'mode'
  value?: unknown // Used when strategy is 'value'
}

/**
 * Replace value operation - find and replace
 */
export interface ReplaceValueOperation extends BaseOperation {
  type: 'replaceValue'
  column: string
  find: unknown
  replace: unknown
  caseSensitive?: boolean
}

// ----------------------------------------
// Aggregation Operations
// ----------------------------------------

export type AggregateFunction =
  | 'count'
  | 'countDistinct'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'first'
  | 'last'
  | 'stddev'
  | 'variance'
  | 'list'

/**
 * Pivot aggregation - column + function + optional alias
 */
export interface PivotAggregation {
  column: string
  function: AggregateFunction
  alias?: string
  showValuesAs?: 'normal' | 'percentOfGrandTotal' | 'percentOfParentTotal' | 'percentOfColumnTotal'
}

/**
 * Pivot operation - unified pivot/groupby with Excel-like features
 * When pivotColumn is set: full pivot (columns become headers)
 * When pivotColumn is null/undefined: simple group by (rows only)
 */
export interface PivotOperation extends BaseOperation {
  type: 'pivot'
  rowColumns: string[] // GROUP BY columns (row dimensions)
  pivotColumn?: string | null // Column whose values become headers (null = group by mode)
  pivotValues?: string[] // Values to pivot (columns in result)
  aggregations: PivotAggregation[] // Multiple aggregations
  filters?: Filter[] // Optional filters to apply before pivoting
  showSubtotals?: boolean // Show subtotal row after each group
  showGrandTotal?: boolean // Show grand total row at end
  isTerminal?: boolean // If true, no child operations allowed (Excel-like pivot view)
}

/**
 * Unpivot operation - columns to rows
 */
export interface UnpivotOperation extends BaseOperation {
  type: 'unpivot'
  valueColumns: string[]
  nameColumn: string
  valueColumn: string
}

// ----------------------------------------
// Window Operations
// ----------------------------------------

export type WindowFunction =
  // Ranking functions
  | 'row_number'
  | 'rank'
  | 'dense_rank'
  | 'ntile'
  // Offset functions
  | 'lag'
  | 'lead'
  | 'first_value'
  | 'last_value'
  // Running aggregates
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'

/**
 * Window operation - compute values over a window of rows
 */
export interface WindowOperation extends BaseOperation {
  type: 'window'
  function: WindowFunction
  column?: string // Source column (required for lag/lead/aggregates)
  outputColumn: string // Name of new column
  partitionBy: string[] // PARTITION BY columns
  orderBy: Array<{ column: string; direction: 'ASC' | 'DESC' }>
  offset?: number // For LAG/LEAD (default 1)
  defaultValue?: unknown // For LAG/LEAD when no row exists
  ntileBuckets?: number // For NTILE (default 4)
}

// ----------------------------------------
// Combine Operations
// ----------------------------------------

/**
 * Join operation - combines two sources
 */
export interface JoinOperation extends BaseOperation {
  type: 'join'
  joinType: 'inner' | 'left' | 'right' | 'full' | 'cross'
  rightSourceId: string
  conditions: JoinCondition[]
  conditionCombineMode?: 'and' | 'or' // defaults to 'and'
}

export interface JoinCondition {
  leftColumn: string
  rightColumn: string
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'BETWEEN'
  secondaryValue?: string // For BETWEEN: upper bound column name
}

/**
 * Union operation - vertical concatenation
 */
export interface UnionOperation extends BaseOperation {
  type: 'union'
  sourceIds: string[]
  mode: 'all' | 'distinct'
}

/**
 * Distinct operation - remove duplicates
 */
export interface DistinctOperation extends BaseOperation {
  type: 'distinct'
  columns?: string[] // null = all columns
}

// ----------------------------------------
// Custom SQL Operations
// ----------------------------------------

/**
 * Custom SQL query operation - user-defined SQL
 * Parent nodes are auto-detected from referenced tables
 */
export interface SqlQueryOperation extends BaseOperation {
  type: 'sql'
  sql: string // The custom SQL query (SELECT statement)
  referencedTables: string[] // Table names found in the query (for edge detection)
}

// ----------------------------------------
// Chart & Export Config Types
// ----------------------------------------

export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'scatter'
  | 'stackedBar'
  | 'stackedArea'
  | 'heatmap'
  | 'treemap'
  | 'boxplot'
  | 'correlationMatrix'
  | 'kpi'
  | 'gauge'
  | 'funnel'
  | 'combo'

export type ChartAggregation = 'sum' | 'avg' | 'count' | 'min' | 'max'

export interface ChartAxisConfig {
  column: string
  label?: string
}

/**
 * ChartConfig - configuration for a ChartNode
 * Used by ECharts for rendering on the canvas
 */
export interface ChartConfig {
  chartType: ChartType
  title?: string
  xAxis?: ChartAxisConfig
  yAxis?: ChartAxisConfig | ChartAxisConfig[] // Array for stacked charts
  colorBy?: string // Column to use for color encoding
  sizeBy?: string // Column for size encoding (scatter, treemap)
  groupBy?: string[] // Columns to group by for aggregations
  aggregation?: ChartAggregation
  limit?: number // Max data points to render
}

export type ExportFormat = 'csv' | 'parquet' | 'xlsx' | 'json' | 'jsonl'

/**
 * ExportConfig - configuration for an ExportNode
 */
export interface ExportConfig {
  format: ExportFormat
  filename?: string
}

// Union of all view operations (excludes chart/export which are now separate node types)
export type ViewOperation =
  | FilterOperation
  | SortOperation
  | LimitOperation
  | SelectOperation
  | AddColumnOperation
  | RemoveColumnsOperation
  | RenameColumnsOperation
  | ReorderColumnsOperation
  | CastColumnOperation
  | EditCellOperation
  | EditColumnOperation
  | FillNullOperation
  | ReplaceValueOperation
  | PivotOperation
  | UnpivotOperation
  | WindowOperation
  | JoinOperation
  | UnionOperation
  | DistinctOperation
  | SqlQueryOperation

// Alias for convenience - Operation and ViewOperation are identical
export type Operation = ViewOperation

// ============================================
// DAG/EDGE TYPES
// ============================================

/**
 * Edge in the DAG - represents parent-child relationship
 */
export interface PipelineEdge {
  id: string
  sourceId: string // Parent node
  targetId: string // Child node (the view that depends on source)
}

// ============================================
// HELPERS
// ============================================

/**
 * Check if a node is terminal (no child operations allowed)
 * Terminal nodes: chart, export, dashboard, or pivot with isTerminal flag
 */
export function isTerminalNode(node: PipelineNode): boolean {
  if (node.type === 'chart' || node.type === 'export' || node.type === 'dashboard') return true
  if (node.type === 'view' && node.operation.type === 'pivot' && node.operation.isTerminal === true) return true
  return false
}
