import type { FilterOperator } from './dataset'
import type { ChartConfig } from './pipeline'

// ============================================
// DASHBOARD FILTER TYPES
// ============================================

/**
 * A filter applied within a dashboard context.
 * Tracks source (which chart or global filter created it).
 */
export interface DashboardFilter {
  id: string
  column: string
  operator: FilterOperator
  value: unknown
  source: 'chart' | 'global' | 'drill'
  sourceChartId?: string // Which chart created this filter (for chart source)
  sourceId?: string // Data source ID this filter applies to
}

// ============================================
// DRILL-DOWN TYPES
// ============================================

/**
 * A level in a drill hierarchy.
 * Example: { column: 'country', label: 'Country' }
 */
export interface DrillLevel {
  column: string
  label: string
}

/**
 * Current drill state for a chart.
 * Tracks position in hierarchy and accumulated filters.
 */
export interface DrillState {
  hierarchy: DrillLevel[]
  currentLevel: number
  filters: Array<{ column: string; value: unknown }>
}

// ============================================
// DASHBOARD CHART CONFIG
// ============================================

/**
 * Configuration for a chart within a dashboard.
 * Extends base ChartConfig with dashboard-specific settings.
 */
export interface DashboardChartConfig {
  id: string
  chartConfig: ChartConfig
  sourceId: string // Which data source this chart queries
  gridPosition: {
    row: number
    col: number
    rowSpan: number
    colSpan: number
  }
  drillHierarchy?: DrillLevel[]
  linkedFilters: string[] // Column names this chart CAN filter on (click to filter)
  respondToFilters: string[] // Column names this chart RESPONDS to (filtered by others)
  crossFilterEnabled: boolean // Whether this chart participates in cross-filtering
}

// ============================================
// GLOBAL FILTER TYPES
// ============================================

export type GlobalFilterType = 'dropdown' | 'range' | 'date-range' | 'text' | 'multi-select'

/**
 * A global filter control in the dashboard filter bar.
 */
export interface DashboardGlobalFilter {
  id: string
  column: string
  sourceId: string // Which data source this filter queries
  type: GlobalFilterType
  label: string
  defaultValue?: unknown
}

// ============================================
// COLUMN MAPPING FOR CROSS-SOURCE FILTERING
// ============================================

/**
 * Maps columns between different data sources.
 * Enables cross-filtering across sources with matching columns.
 */
export interface ColumnMapping {
  id: string
  sourceA: string // Data source ID
  columnA: string
  sourceB: string // Data source ID
  columnB: string
}

// ============================================
// DASHBOARD LAYOUT
// ============================================

type LayoutPreset = '2x2' | '3x1' | '1+2' | '2+1' | 'freeform'

/**
 * Dashboard layout configuration.
 */
export interface DashboardLayout {
  preset: LayoutPreset
  gridColumns: number
  gridRows: number
  gap: number // Gap between cells in pixels
}

// ============================================
// DASHBOARD CONFIG
// ============================================

/**
 * Complete dashboard configuration.
 * Stored in DashboardNode.config
 */
export interface DashboardConfig {
  title?: string
  description?: string
  layout: DashboardLayout
  embeddedCharts: DashboardChartConfig[]
  globalFilters: DashboardGlobalFilter[]
  columnMappings: ColumnMapping[]
}
