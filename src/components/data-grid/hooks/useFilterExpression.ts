import { useMemo } from 'react'
import { countConditions, flattenExpression, getRootCombineMode, isComplexExpression } from '@/lib/filter-utils'
import type { DataView, Filter, FilterExpression, FilterOperation } from '@/types'
import type { PipelineNode } from '@/types/pipeline'

interface UseFilterExpressionOptions {
  activeNode: PipelineNode | null
}

interface FilterState {
  currentFilters: Filter[]
  filterExpression: FilterExpression | undefined
  filterCombineMode: 'and' | 'or'
  filterIsComplex: boolean
  filterCount: number
  activeFilterColumns: string[]
}

export function useFilterExpression({ activeNode }: UseFilterExpressionOptions): FilterState {
  return useMemo(() => {
    const defaultState: FilterState = {
      currentFilters: [],
      filterExpression: undefined,
      filterCombineMode: 'and',
      filterIsComplex: false,
      filterCount: 0,
      activeFilterColumns: [],
    }

    if (!activeNode || activeNode.type !== 'view') {
      return defaultState
    }

    const view = activeNode as DataView
    if (view.operation.type !== 'filter') {
      return defaultState
    }

    const op = view.operation as FilterOperation
    const filters = flattenExpression(op.expression)

    return {
      currentFilters: filters,
      filterExpression: op.expression,
      filterCombineMode: getRootCombineMode(op.expression),
      filterIsComplex: isComplexExpression(op.expression),
      filterCount: countConditions(op.expression),
      activeFilterColumns: filters.map((f) => f.column),
    }
  }, [activeNode])
}
