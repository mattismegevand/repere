import { z } from 'zod'

export const exportFormSchema = z.object({
  format: z.enum(['xlsx', 'csv', 'json', 'jsonl', 'parquet']),
  filename: z.string().optional(),
})

export type ExportFormValues = z.infer<typeof exportFormSchema>
