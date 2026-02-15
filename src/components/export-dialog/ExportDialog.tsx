import { zodResolver } from '@hookform/resolvers/zod'
import Braces from 'lucide-react/dist/esm/icons/braces'
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Package from 'lucide-react/dist/esm/icons/package'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { FormInput } from '@/components/ui/form'
import { Label } from '@/components/ui/Label'
import { RadixDialog } from '@/components/ui/RadixDialog'
import { useHydratedNodes } from '@/lib/pipeline/hooks/useHydratedNodes'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { useDialogStore } from '@/stores/dialogStore'
import type { ExportConfig, ExportFormat } from '@/types'
import { type ExportFormValues, exportFormSchema } from './schema'

interface FormatOption {
  format: ExportFormat
  label: string
  description: string
  icon: typeof FileSpreadsheet
  extension: string
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    format: 'xlsx',
    label: 'Excel (.xlsx)',
    description: 'Best for spreadsheet applications',
    icon: FileSpreadsheet,
    extension: '.xlsx',
  },
  {
    format: 'csv',
    label: 'CSV (.csv)',
    description: 'Universal text format',
    icon: FileText,
    extension: '.csv',
  },
  {
    format: 'json',
    label: 'JSON (.json)',
    description: 'Structured data as array of objects',
    icon: Braces,
    extension: '.json',
  },
  {
    format: 'jsonl',
    label: 'JSON Lines (.jsonl)',
    description: 'Newline-delimited JSON objects',
    icon: Braces,
    extension: '.jsonl',
  },
  {
    format: 'parquet',
    label: 'Parquet (.parquet)',
    description: 'Efficient columnar format',
    icon: Package,
    extension: '.parquet',
  },
]

export function ExportDialog() {
  const activeDialog = useDialogStore((s) => s.activeDialog)
  const closeDialog = useDialogStore((s) => s.closeDialog)
  const nodes = useHydratedNodes()
  const { createExport } = usePipeline()

  const exportDialogOpen = activeDialog?.type === 'export'
  const exportDialogSourceId = exportDialogOpen ? activeDialog.sourceNodeId : undefined
  const sourceNode = exportDialogSourceId ? nodes[exportDialogSourceId] : null

  const defaultFilename = sourceNode?.name.replace(/[^a-zA-Z0-9]/g, '_') ?? ''

  const { control, handleSubmit, watch, setValue, reset } = useForm<ExportFormValues>({
    resolver: zodResolver(exportFormSchema),
    defaultValues: {
      format: 'xlsx',
      filename: '',
    },
  })

  const format = watch('format')
  const filename = watch('filename')
  const effectiveFilename = filename || defaultFilename

  const onSubmit = async (data: ExportFormValues) => {
    if (!sourceNode) return
    const config: ExportConfig = {
      format: data.format,
      filename: data.filename || defaultFilename,
    }

    await createExport(exportDialogSourceId!, config)
    closeDialog()
    reset()
  }

  const handleClose = () => {
    closeDialog()
    reset()
  }

  return (
    <RadixDialog
      open={exportDialogOpen && !!sourceNode}
      onOpenChange={(open) => !open && handleClose()}
      title="Create Export Node"
      width="sm"
      showCloseButton
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>Create Export</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Source</Label>
          <div className="mt-1 px-3 py-2 bg-[var(--color-bg-secondary)] rounded text-sm">
            {sourceNode?.name}
            <span className="text-[var(--color-text-muted)] ml-2">
              ({typeof sourceNode?.rowCount === 'number' ? sourceNode.rowCount.toLocaleString() : '...'} rows)
            </span>
          </div>
        </div>

        <div>
          <Label>Format</Label>
          <div className="mt-1 space-y-1">
            {FORMAT_OPTIONS.map((option) => {
              const Icon = option.icon
              const isSelected = format === option.format
              return (
                <button
                  key={option.format}
                  type="button"
                  onClick={() => setValue('format', option.format)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded border transition-colors ${
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                  }`}
                >
                  <Icon className="w-5 h-5 text-[var(--color-text-muted)]" />
                  <div className="text-left">
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{option.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <Label htmlFor="export-filename">Filename (optional)</Label>
          <FormInput
            name="filename"
            control={control}
            id="export-filename"
            placeholder={defaultFilename}
            className="mt-1"
          />
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Will be saved as: {effectiveFilename}
            {FORMAT_OPTIONS.find((o) => o.format === format)?.extension}
          </div>
        </div>
      </div>
    </RadixDialog>
  )
}
