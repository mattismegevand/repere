import type { PipelineService } from '@/lib/pipeline/PipelineService'
import type { PipelineEffect } from '../engine/types'

export interface EffectExecutionResult {
  success: boolean
  error?: Error
  data?: Record<string, unknown>
}

/**
 * Executes pipeline effects through PipelineService.
 * This is the adapter layer between the pure engine and the impure DuckDB runtime.
 */
export class EffectExecutor {
  private service: PipelineService
  private onPersistDirty?: () => void

  constructor(service: PipelineService, options?: { onPersistDirty?: () => void }) {
    this.service = service
    this.onPersistDirty = options?.onPersistDirty
  }

  /**
   * Execute a single effect and return the result.
   */
  async execute(effect: PipelineEffect): Promise<EffectExecutionResult> {
    try {
      switch (effect.type) {
        case 'duckdb.createView': {
          await this.service.client.execute(`CREATE OR REPLACE VIEW "${effect.viewName}" AS ${effect.sql}`)
          return { success: true }
        }

        case 'duckdb.updateView': {
          await this.service.client.execute(`CREATE OR REPLACE VIEW "${effect.viewName}" AS ${effect.sql}`)
          return { success: true }
        }

        case 'duckdb.dropView': {
          await this.service.dropView(effect.viewName)
          return { success: true }
        }

        case 'duckdb.dropViews': {
          await this.service.dropViews(effect.viewNames)
          return { success: true }
        }

        case 'duckdb.getSchema': {
          const columns = await this.service.getViewSchema(effect.viewName)
          return { success: true, data: { [effect.resultKey]: columns } }
        }

        case 'duckdb.getRowCount': {
          const rowCount = await this.service.getViewRowCount(effect.viewName)
          return { success: true, data: { [effect.resultKey]: rowCount } }
        }

        case 'persist.markDirty': {
          this.onPersistDirty?.()
          return { success: true }
        }

        case 'analytics.track': {
          // Analytics effects are fire-and-forget
          console.debug('Analytics:', effect.event, effect.properties)
          return { success: true }
        }

        default: {
          console.warn('Unknown effect type:', (effect as PipelineEffect).type)
          return { success: false, error: new Error(`Unknown effect type`) }
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
    }
  }

  /**
   * Execute multiple effects in sequence.
   * Stops on first error unless continueOnError is true.
   */
  async executeAll(
    effects: PipelineEffect[],
    options?: { continueOnError?: boolean }
  ): Promise<{ results: EffectExecutionResult[]; allSucceeded: boolean; data: Record<string, unknown> }> {
    const results: EffectExecutionResult[] = []
    const data: Record<string, unknown> = {}
    let allSucceeded = true

    for (const effect of effects) {
      const result = await this.execute(effect)
      results.push(result)

      if (result.data) {
        Object.assign(data, result.data)
      }

      if (!result.success) {
        allSucceeded = false
        if (!options?.continueOnError) {
          break
        }
      }
    }

    return { results, allSucceeded, data }
  }
}
