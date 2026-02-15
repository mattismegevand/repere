import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import { buildSelectQuery } from '@/lib/duckdb/query-builder'
import { saveFileTauri } from '@/lib/file-system/tauri-file-ops'
import { normalizeRowDates } from '@/lib/formatters'
import { isNativeRuntime } from '@/lib/runtime'
import type { ExportFormat, ExportNode, Filter, PipelineNode, Sort } from '@/types'

interface ExportOptions {
  client: DuckDBClient
  tableName: string
  filters?: Filter[]
  sort?: Sort | null
  search?: string
  searchColumns?: string[]
  format: ExportFormat
  filename: string
}

export async function exportData({
  client,
  tableName,
  filters = [],
  sort = null,
  search = '',
  searchColumns = [],
  format,
  filename,
}: ExportOptions): Promise<void> {
  // Build query for current view (with filters/sort applied)
  const selectSql = buildSelectQuery({
    tableName,
    filters,
    sort,
    search,
    searchColumns,
    limit: 0, // No limit for export
    offset: 0,
  }).replace('LIMIT 0', '') // Remove the limit clause

  // Create a temp view for the filtered data
  const viewName = `export_view_${Date.now()}`
  await client.execute(`CREATE OR REPLACE TEMP VIEW "${viewName}" AS ${selectSql}`)

  try {
    if (format === 'csv') {
      // Export to CSV using DuckDB's COPY
      const result = await client.query<Record<string, unknown>>(`SELECT * FROM "${viewName}"`)

      if (result.rows.length === 0) {
        throw new Error('No data to export')
      }

      // Get column types for date normalization
      const columnTypes = await getColumnTypes(client, viewName)

      // Get column names from first row
      const columns = Object.keys(result.rows[0])

      // Build CSV content
      const csvLines: string[] = []
      csvLines.push(columns.map(escapeCSV).join(','))

      for (const row of result.rows) {
        const rowData = normalizeRowDates(row, columnTypes)
        csvLines.push(columns.map((col) => escapeCSV(rowData[col])).join(','))
      }

      const csvContent = csvLines.join('\n')
      await downloadFile(csvContent, filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv')
    } else if (format === 'parquet') {
      // For Parquet, use DuckDB's COPY TO and read from virtual filesystem
      const parquetFilename = filename.endsWith('.parquet') ? filename : `${filename}.parquet`
      const parquetPath = `/${parquetFilename}`

      await client.execute(`COPY "${viewName}" TO '${parquetPath}' (FORMAT PARQUET)`)

      // Read the file from DuckDB's virtual filesystem
      if (!client.copyFileToBuffer) {
        throw new Error('Parquet export not supported in this mode')
      }
      const buffer = await client.copyFileToBuffer(parquetPath)

      await downloadFile(buffer, parquetFilename, 'application/octet-stream')

      // Clean up the temp file
      if (client.dropFile) {
        await client.dropFile(parquetPath)
      }
    } else if (format === 'xlsx') {
      // Export to Excel using xlsx library
      const result = await client.query<Record<string, unknown>>(`SELECT * FROM "${viewName}"`)
      if (result.rows.length === 0) {
        throw new Error('No data to export')
      }

      // Get column types for date normalization
      const columnTypes = await getColumnTypes(client, viewName)

      // Convert to array of objects for xlsx with normalized dates
      const data = result.rows.map((row) => normalizeRowDates(row, columnTypes))

      // Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')

      // Generate Excel file buffer
      const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      const xlsxFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`

      await downloadFile(
        new Uint8Array(xlsxBuffer),
        xlsxFilename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    } else if (format === 'json') {
      // Export to JSON array
      const result = await client.query<Record<string, unknown>>(`SELECT * FROM "${viewName}"`)
      if (result.rows.length === 0) {
        throw new Error('No data to export')
      }

      // Get column types for date normalization
      const columnTypes = await getColumnTypes(client, viewName)

      const data = result.rows.map((row) => normalizeRowDates(row, columnTypes))
      const jsonContent = JSON.stringify(data, bigIntReplacer, 2)
      const jsonFilename = filename.endsWith('.json') ? filename : `${filename}.json`

      await downloadFile(jsonContent, jsonFilename, 'application/json')
    } else if (format === 'jsonl') {
      // Export to JSON Lines (one JSON object per line)
      const result = await client.query<Record<string, unknown>>(`SELECT * FROM "${viewName}"`)
      if (result.rows.length === 0) {
        throw new Error('No data to export')
      }

      // Get column types for date normalization
      const columnTypes = await getColumnTypes(client, viewName)

      const lines = result.rows.map((row) => JSON.stringify(normalizeRowDates(row, columnTypes), bigIntReplacer))
      const jsonlContent = lines.join('\n')
      const jsonlFilename = filename.endsWith('.jsonl') ? filename : `${filename}.jsonl`

      await downloadFile(jsonlContent, jsonlFilename, 'application/x-ndjson')
    }
  } finally {
    // Clean up temp view
    await client.execute(`DROP VIEW IF EXISTS "${viewName}"`)
  }
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

async function getColumnTypes(client: DuckDBClient, tableName: string): Promise<Array<{ name: string; type: string }>> {
  const columns = await client.describe(tableName)
  return columns.map((col) => ({ name: col.name, type: col.type }))
}

// JSON replacer that handles BigInt values
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return Number(value)
  }
  return value
}

async function downloadFile(
  content: string | ArrayBuffer | Uint8Array,
  filename: string,
  mimeType: string
): Promise<void> {
  const blob =
    typeof content === 'string'
      ? new Blob([content], { type: mimeType })
      : new Blob([content as BlobPart], { type: mimeType })

  // Use native save dialog in Tauri
  if (isNativeRuntime()) {
    const ext = filename.split('.').pop() || ''
    const saved = await saveFileTauri(filename, blob, [{ name: `${ext.toUpperCase()} File`, extensions: [ext] }])
    if (saved) return
  }

  // Browser download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface ChartExportData {
  name: string
  dataUrl: string
}

interface DownloadAllOptions {
  client: DuckDBClient
  nodes: Record<string, PipelineNode>
  chartDataUrls: ChartExportData[]
}

export async function downloadAllAsZip({ client, nodes, chartDataUrls }: DownloadAllOptions): Promise<void> {
  const zip = new JSZip()
  const exportFolder = zip.folder('exports')
  const chartFolder = zip.folder('charts')

  if (!exportFolder || !chartFolder) {
    throw new Error('Failed to create ZIP folders')
  }

  // Process export nodes
  for (const node of Object.values(nodes)) {
    if (node.type !== 'export') continue

    const exportNode = node as ExportNode
    const parentNode = nodes[exportNode.parentId]
    if (!parentNode?.tableName) continue

    const filename = exportNode.config.filename || node.name
    const format = exportNode.config.format

    try {
      // Get column types for date normalization
      const columnTypes = await getColumnTypes(client, parentNode.tableName)

      if (format === 'csv') {
        const result = await client.query<Record<string, unknown>>(`SELECT * FROM "${parentNode.tableName}"`)
        if (result.rows.length === 0) continue

        const columns = Object.keys(result.rows[0])
        const csvLines: string[] = [columns.map(escapeCSV).join(',')]

        for (const row of result.rows) {
          const rowData = normalizeRowDates(row, columnTypes)
          csvLines.push(columns.map((col) => escapeCSV(rowData[col])).join(','))
        }

        exportFolder.file(`${filename}.csv`, csvLines.join('\n'))
      } else if (format === 'parquet') {
        const parquetPath = `/zip_export_${Date.now()}.parquet`
        await client.execute(`COPY "${parentNode.tableName}" TO '${parquetPath}' (FORMAT PARQUET)`)
        if (!client.copyFileToBuffer) {
          console.error('Parquet export not supported in this mode')
          continue
        }
        const buffer = await client.copyFileToBuffer(parquetPath)
        exportFolder.file(`${filename}.parquet`, buffer)
        if (client.dropFile) {
          await client.dropFile(parquetPath)
        }
      } else if (format === 'xlsx') {
        const result = await client.query<Record<string, unknown>>(`SELECT * FROM "${parentNode.tableName}"`)
        if (result.rows.length === 0) continue

        const data = result.rows.map((row) => normalizeRowDates(row, columnTypes))
        const worksheet = XLSX.utils.json_to_sheet(data)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
        const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
        exportFolder.file(`${filename}.xlsx`, new Uint8Array(xlsxBuffer))
      } else if (format === 'json') {
        const result = await client.query<Record<string, unknown>>(`SELECT * FROM "${parentNode.tableName}"`)
        if (result.rows.length === 0) continue

        const data = result.rows.map((row) => normalizeRowDates(row, columnTypes))
        exportFolder.file(`${filename}.json`, JSON.stringify(data, bigIntReplacer, 2))
      } else if (format === 'jsonl') {
        const result = await client.query<Record<string, unknown>>(`SELECT * FROM "${parentNode.tableName}"`)
        if (result.rows.length === 0) continue

        const lines = result.rows.map((row) => JSON.stringify(normalizeRowDates(row, columnTypes), bigIntReplacer))
        exportFolder.file(`${filename}.jsonl`, lines.join('\n'))
      }
    } catch (err) {
      console.error(`Failed to export ${node.name}:`, err)
    }
  }

  // Add chart PNGs
  for (const chart of chartDataUrls) {
    try {
      // Convert data URL to binary
      const base64Data = chart.dataUrl.split(',')[1]
      chartFolder.file(`${chart.name}.png`, base64Data, { base64: true })
    } catch (err) {
      console.error(`Failed to add chart ${chart.name}:`, err)
    }
  }

  // Generate and download ZIP
  const content = await zip.generateAsync({ type: 'blob' })
  const zipFilename = `repere_export_${new Date().toISOString().slice(0, 10)}.zip`

  // Use native save dialog in Tauri
  if (isNativeRuntime()) {
    const saved = await saveFileTauri(zipFilename, content, [{ name: 'ZIP Archive', extensions: ['zip'] }])
    if (saved) return
  }

  // Browser download
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = zipFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
