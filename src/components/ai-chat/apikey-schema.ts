import { z } from 'zod'

export const apiKeyFormSchema = z.object({
  apiKey: z.string(), // Can be empty to clear
})

export type ApiKeyFormValues = z.infer<typeof apiKeyFormSchema>
