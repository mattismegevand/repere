import { z } from 'zod'

const computedColumnSchema = z.object({
  name: z.string().min(1, 'Column name is required'),
  expression: z.string().min(1, 'Expression is required'),
})

export const addColumnFormSchema = z.object({
  // Current input fields
  name: z.string(),
  expression: z.string(),
  // Staged columns
  columns: z.array(computedColumnSchema),
})

export type AddColumnFormValues = z.infer<typeof addColumnFormSchema>
