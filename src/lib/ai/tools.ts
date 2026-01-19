import { getOperationTools } from '@/lib/operations'
import type { ToolDefinition } from '@/types/ai'

/**
 * Common parameter added to all tools for node targeting
 */
const targetNodeIdParam = {
  targetNodeId: {
    type: 'string',
    description:
      'ID of the node to apply this operation to. If omitted, uses the current active node. Use this to chain operations or work with specific nodes.',
  },
}

/**
 * Non-operation tools (chart and export)
 */
const nonOperationTools: ToolDefinition[] = [
  {
    name: 'createChart',
    description: 'Create a chart visualization from the current data. The chart appears on the canvas.',
    parameters: {
      type: 'object',
      properties: {
        chartType: {
          type: 'string',
          enum: ['bar', 'line', 'pie', 'scatter', 'stackedBar', 'stackedArea', 'heatmap', 'treemap', 'boxplot'],
          description: 'Type of chart to create',
        },
        title: {
          type: 'string',
          description: 'Optional title for the chart',
        },
        xAxis: {
          type: 'object',
          description: 'X-axis configuration',
          properties: {
            column: { type: 'string', description: 'Column for X-axis values' },
            label: { type: 'string', description: 'Optional axis label' },
          },
          required: ['column'],
        },
        yAxis: {
          type: 'object',
          description: 'Y-axis configuration',
          properties: {
            column: { type: 'string', description: 'Column for Y-axis values' },
            label: { type: 'string', description: 'Optional axis label' },
          },
          required: ['column'],
        },
        colorBy: {
          type: 'string',
          description: 'Column to use for color encoding (for grouping/categories)',
        },
        aggregation: {
          type: 'string',
          enum: ['sum', 'avg', 'count', 'min', 'max'],
          description: 'Aggregation function to apply to Y-axis values',
        },
      },
      required: ['chartType'],
    },
  },
  {
    name: 'createExport',
    description: 'Create an export node to download the current data in a specific format.',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['csv', 'parquet', 'xlsx', 'json', 'jsonl'],
          description: 'Export file format',
        },
        filename: {
          type: 'string',
          description: 'Optional filename (without extension)',
        },
      },
      required: ['format'],
    },
  },
]

/**
 * Get all operation tools from the plugin registry, plus non-operation tools
 */
function getAllBaseTools(): ToolDefinition[] {
  return [...getOperationTools(), ...nonOperationTools]
}

/**
 * Add targetNodeId parameter to all tools
 */
export const operationTools: ToolDefinition[] = getAllBaseTools().map((tool) => ({
  ...tool,
  parameters: {
    ...tool.parameters,
    properties: {
      ...tool.parameters.properties,
      ...targetNodeIdParam,
    },
  },
}))
