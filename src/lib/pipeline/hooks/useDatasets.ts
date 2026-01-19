import { useCallback, useRef } from 'react'
import { computeFileHash, type PickedFile } from '@/lib/file-system'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { Dataset, DataView } from '@/types'
import { usePipelineServiceOptional } from '../PipelineProvider'
import type { CreateDatasetResult } from '../PipelineService'
import { validateSchema } from '../persistence'

/**
 * Spawn background computation of hash and row count for a dataset.
 * Updates the store as each value becomes available.
 */
function spawnBackgroundMetadata(
  service: {
    computeRowCount: (tableName: string) => Promise<number>
    computeFileHash: (file: File) => Promise<string>
  },
  datasetId: string,
  tableName: string,
  file: File | undefined,
  mountedRef: { current: boolean }
) {
  // Compute row count in background
  service.computeRowCount(tableName).then((rowCount) => {
    if (mountedRef.current) {
      usePipelineStore.getState().updateNode(datasetId, { rowCount })
    }
  })

  // Compute file hash in background (only for File objects)
  if (file) {
    service.computeFileHash(file).then((fileHash) => {
      if (mountedRef.current) {
        usePipelineStore.getState().updateNode(datasetId, { fileHash })
      }
    })
  }
}

export function useDatasets() {
  const service = usePipelineServiceOptional()
  const { addDataset, getNode, getNodeDescendants, bumpDataVersion } = usePipelineStore()
  const mountedRef = useRef(true)

  /**
   * Load a dataset from a File object. Used in browser mode.
   */
  const loadDataset = useCallback(
    async (file: File): Promise<Dataset | null> => {
      if (!service) return null

      try {
        const result = await service.createDatasetFromFile(file)

        // Get fresh nodes state to handle sequential loads correctly
        const currentNodes = Object.values(usePipelineStore.getState().nodes)
        const position =
          currentNodes.length === 0
            ? { x: 100, y: 100 }
            : { x: 100, y: Math.max(...currentNodes.map((n) => n.position.y)) + 200 }

        const dataset: Dataset = {
          id: result.id,
          type: 'dataset',
          name: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          fileSize: file.size,
          fileHash: result.fileHash,
          rowCount: result.rowCount,
          columns: result.columns,
          tableName: result.tableName,
          createdAt: new Date(),
          position,
        }

        addDataset(dataset)

        // Spawn background tasks for row count and file hash
        spawnBackgroundMetadata(service, dataset.id, dataset.tableName, file, mountedRef)

        return dataset
      } catch (err) {
        console.error('Failed to load dataset:', err)
        return null
      }
    },
    [service, addDataset]
  )

  /**
   * Load a dataset from a picked file (unified handler for both File and path).
   * Use this when loading from file picker which returns PickedFile.
   */
  const loadDatasetFromPicked = useCallback(
    async (picked: PickedFile): Promise<Dataset | null> => {
      if (!service) return null

      try {
        let result: CreateDatasetResult
        let fileName: string
        let fileSize: number | undefined
        let file: File | undefined

        if (picked.type === 'file') {
          result = await service.createDatasetFromFile(picked.file)
          fileName = picked.file.name
          fileSize = picked.file.size
          file = picked.file
        } else {
          result = await service.createDatasetFromPath(picked.path, picked.name)
          fileName = picked.name
          fileSize = undefined // Size not available for path-based loading
          file = undefined // No File object for path-based loading
        }

        // Get fresh nodes state to handle sequential loads correctly
        const currentNodes = Object.values(usePipelineStore.getState().nodes)
        const position =
          currentNodes.length === 0
            ? { x: 100, y: 100 }
            : { x: 100, y: Math.max(...currentNodes.map((n) => n.position.y)) + 200 }

        const dataset: Dataset = {
          id: result.id,
          type: 'dataset',
          name: fileName.replace(/\.[^.]+$/, ''),
          fileName,
          fileSize,
          fileHash: result.fileHash,
          rowCount: result.rowCount,
          columns: result.columns,
          tableName: result.tableName,
          createdAt: new Date(),
          position,
        }

        addDataset(dataset)

        // Spawn background tasks for row count and file hash (file is only available for File-based loading)
        spawnBackgroundMetadata(service, dataset.id, dataset.tableName, file, mountedRef)

        return dataset
      } catch (err) {
        console.error('Failed to load dataset:', err)
        return null
      }
    },
    [service, addDataset]
  )

  const fillPlaceholder = useCallback(
    async (datasetId: string, file: File): Promise<{ success: boolean; isExactMatch?: boolean; error?: string }> => {
      if (!service) return { success: false, error: 'Service not ready' }

      const dataset = getNode(datasetId)
      if (!dataset || dataset.type !== 'dataset' || !dataset.isPlaceholder) {
        return { success: false, error: 'Invalid placeholder dataset' }
      }

      try {
        // Validate schema first
        const fileColumns = await service.extractFileSchema(file)
        const validationResult = validateSchema(fileColumns, dataset.columns)

        if (!validationResult.valid) {
          const missingMsg =
            validationResult.missingColumns.length > 0
              ? `Missing columns: ${validationResult.missingColumns.join(', ')}`
              : ''
          const mismatchMsg =
            validationResult.typeMismatches.length > 0
              ? `Type mismatches: ${validationResult.typeMismatches.map((m) => `${m.column} (expected ${m.expected}, got ${m.actual})`).join(', ')}`
              : ''
          const errorMsg = [missingMsg, mismatchMsg].filter(Boolean).join('. ')
          return { success: false, error: `Schema mismatch: ${errorMsg}` }
        }

        // For placeholder filling, we still compute hash synchronously to check exact match
        // This is acceptable since schema validation already requires waiting
        const fileHash = await computeFileHash(file)
        const isExactMatch = dataset.fileHash ? fileHash === dataset.fileHash : false

        await service.fillPlaceholderTable(dataset.tableName, file)

        // Update node with file info, mark as not placeholder, set rowCount to null (computing)
        usePipelineStore.getState().updateNode(datasetId, {
          rowCount: null,
          fileHash,
          fileName: file.name,
          fileSize: file.size,
          isPlaceholder: false,
        } as Partial<Dataset>)

        // Spawn background row count computation for the dataset
        service.computeRowCount(dataset.tableName).then((rowCount) => {
          if (mountedRef.current) {
            usePipelineStore.getState().updateNode(datasetId, { rowCount })
          }
        })

        // Update descendant view row counts in background
        const descendants = getNodeDescendants(datasetId)
        const viewDescendants = descendants
          .map((id) => ({ id, node: usePipelineStore.getState().nodes[id] }))
          .filter((item): item is { id: string; node: DataView } => item.node?.type === 'view')

        // Set all descendants to null (computing) immediately
        for (const { id } of viewDescendants) {
          usePipelineStore.getState().updateNode(id, { rowCount: null })
        }

        // Compute row counts in background
        for (const { id, node } of viewDescendants) {
          service.getViewRowCount(node.tableName).then((viewRowCount) => {
            if (mountedRef.current) {
              usePipelineStore.getState().updateNode(id, { rowCount: viewRowCount })
            }
          })
        }

        return { success: true, isExactMatch }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to fill placeholder' }
      }
    },
    [service, getNode, getNodeDescendants]
  )

  const replaceDataset = useCallback(
    async (datasetId: string, file: File): Promise<{ success: boolean; isExactMatch?: boolean; error?: string }> => {
      if (!service) return { success: false, error: 'Service not ready' }

      const dataset = getNode(datasetId)
      if (!dataset || dataset.type !== 'dataset') {
        return { success: false, error: 'Invalid dataset' }
      }

      try {
        // Validate schema first
        const fileColumns = await service.extractFileSchema(file)
        const validationResult = validateSchema(fileColumns, dataset.columns)

        if (!validationResult.valid) {
          const missingMsg =
            validationResult.missingColumns.length > 0
              ? `Missing columns: ${validationResult.missingColumns.join(', ')}`
              : ''
          const mismatchMsg =
            validationResult.typeMismatches.length > 0
              ? `Type mismatches: ${validationResult.typeMismatches.map((m) => `${m.column} (expected ${m.expected}, got ${m.actual})`).join(', ')}`
              : ''
          const errorMsg = [missingMsg, mismatchMsg].filter(Boolean).join('. ')
          return { success: false, error: `Schema mismatch: ${errorMsg}` }
        }

        // For dataset replacement, we still compute hash synchronously to check exact match
        // This is acceptable since schema validation already requires waiting
        const fileHash = await computeFileHash(file)
        const isExactMatch = dataset.fileHash ? fileHash === dataset.fileHash : false

        // Replace the table data
        await service.fillPlaceholderTable(dataset.tableName, file)

        // Update node with file info, set rowCount to null (computing)
        usePipelineStore.getState().updateNode(datasetId, {
          rowCount: null,
          fileHash,
          fileName: file.name,
          fileSize: file.size,
        } as Partial<Dataset>)

        // Spawn background row count computation for the dataset
        service.computeRowCount(dataset.tableName).then((rowCount) => {
          if (mountedRef.current) {
            usePipelineStore.getState().updateNode(datasetId, { rowCount })
          }
        })

        // Update descendant view row counts in background
        const descendants = getNodeDescendants(datasetId)
        const viewDescendants = descendants
          .map((id) => ({ id, node: usePipelineStore.getState().nodes[id] }))
          .filter((item): item is { id: string; node: DataView } => item.node?.type === 'view')

        // Set all descendants to null (computing) immediately
        for (const { id } of viewDescendants) {
          usePipelineStore.getState().updateNode(id, { rowCount: null })
        }

        // Compute row counts in background
        for (const { id, node } of viewDescendants) {
          service.getViewRowCount(node.tableName).then((viewRowCount) => {
            if (mountedRef.current) {
              usePipelineStore.getState().updateNode(id, { rowCount: viewRowCount })
            }
          })
        }

        // Bump data version to trigger refresh of cached data
        bumpDataVersion()
        return { success: true, isExactMatch }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to replace dataset' }
      }
    },
    [service, getNode, getNodeDescendants, bumpDataVersion]
  )

  return {
    loadDataset,
    loadDatasetFromPicked,
    fillPlaceholder,
    replaceDataset,
  }
}
