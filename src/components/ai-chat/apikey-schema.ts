import { z } from 'zod'

export const apiKeyFormSchema = z.object({
  model: z.string().min(1, 'Select a model'),
  apiKey: z.string(), // Can be empty to clear
})

export type ApiKeyFormValues = z.infer<typeof apiKeyFormSchema>
