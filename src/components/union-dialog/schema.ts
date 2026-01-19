import { z } from 'zod'

export const unionFormSchema = z.object({
  selectedIds: z.array(z.string()).min(2, 'Select at least 2 tables to union'),
  mode: z.enum(['all', 'distinct']),
})

export type UnionFormValues = z.infer<typeof unionFormSchema>
