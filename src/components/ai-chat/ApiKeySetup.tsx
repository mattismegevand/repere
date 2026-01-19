import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronDown, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { FormInput } from '@/components/ui/form'
import { AVAILABLE_MODELS } from '@/lib/ai/llm-client'
import { useChatStore } from '@/stores/chatStore'
import { type ApiKeyFormValues, apiKeyFormSchema } from './apikey-schema'

interface ApiKeySetupProps {
  onClose?: () => void
}

export function ApiKeySetup({ onClose }: ApiKeySetupProps) {
  const { apiKey, model, setApiKey, setModel } = useChatStore()
  const [showKey, setShowKey] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const { control, handleSubmit, watch } = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: {
      model,
      apiKey: apiKey ?? '',
    },
  })

  // Sync model changes immediately to store
  const watchedModel = watch('model')
  if (watchedModel !== model) {
    setModel(watchedModel)
  }

  const onSubmit = (data: ApiKeyFormValues) => {
    setApiKey(data.apiKey.trim() || null)
    setIsSaved(true)
    setTimeout(() => {
      setIsSaved(false)
      onClose?.()
    }, 1000)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-3 space-y-3">
      {/* Model Selection */}
      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Model</label>
        <div className="relative">
          <select
            value={watchedModel}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border appearance-none cursor-pointer
              bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]
              hover:border-[var(--color-accent)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* API Key Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-[var(--color-text-muted)]">OpenRouter API Key</label>
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1"
          >
            Get key
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="relative">
          <FormInput
            name="apiKey"
            control={control}
            type={showKey ? 'text' : 'password'}
            placeholder="sk-or-..."
            className="pr-10 rounded-lg"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Save Button */}
      <Button type="submit" variant={isSaved ? 'secondary' : 'primary'} size="sm" className="w-full" disabled={isSaved}>
        {isSaved ? (
          <>
            <Check className="w-4 h-4 mr-1" />
            Saved
          </>
        ) : (
          'Save'
        )}
      </Button>

      {/* Security Note */}
      <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">
        Your API key is stored locally in your browser and sent directly to OpenRouter. We never see or store your key.
      </p>
    </form>
  )
}
