import { z } from 'zod'

const windowFunctions = [
  // Ranking
  'row_number',
  'rank',
  'dense_rank',
  'ntile',
  // Offset
  'lag',
  'lead',
  'first_value',
  'last_value',
  // Aggregates
  'sum',
  'avg',
  'count',
  'min',
  'max',
] as const

const orderByItemSchema = z.object({
  column: z.string().min(1, 'Select a column'),
  direction: z.enum(['ASC', 'DESC']),
})

export const windowFormSchema = z
  .object({
    windowFn: z.enum(windowFunctions),
    sourceColumn: z.string(),
    outputColumn: z.string().min(1, 'Output column name is required'),
    partitionBy: z.array(z.string()),
    orderBy: z.array(orderByItemSchema),
    offset: z.number().int().min(1),
    ntileBuckets: z.number().int().min(1),
  })
  .refine(
    (data) => {
      // Functions that require a source column
      const needsColumn = ['lag', 'lead', 'first_value', 'last_value', 'sum', 'avg', 'count', 'min', 'max']
      if (needsColumn.includes(data.windowFn)) {
        return data.sourceColumn.length > 0
      }
      return true
    },
    { message: 'Source column is required for this function', path: ['sourceColumn'] }
  )

export type WindowFormValues = z.infer<typeof windowFormSchema>
