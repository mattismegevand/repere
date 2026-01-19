import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { Button, Label } from '@/components/ui'
import { FormInput, FormTextarea } from '@/components/ui/form'
import { RadixDialog } from '@/components/ui/RadixDialog'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import type { AddColumnOperation } from '@/types'
import { type AddColumnFormValues, addColumnFormSchema } from './schema'

interface Props {
  onClose: () => void
}

const EXAMPLE_EXPRESSIONS = [
  { label: 'Constant', example: "'value'" },
  { label: 'Number', example: '42' },
  { label: 'Math', example: 'column1 + column2' },
  { label: 'String concat', example: "first_name || ' ' || last_name" },
  { label: 'Conditional', example: "CASE WHEN age >= 18 THEN 'Adult' ELSE 'Minor' END" },
  { label: 'Date extract', example: 'YEAR(date_column)' },
  { label: 'Uppercase', example: 'UPPER(name)' },
  { label: 'Round', example: 'ROUND(price, 2)' },
  { label: 'Coalesce', example: "COALESCE(nullable_col, 'default')" },
]

export function AddColumnDialog({ onClose }: Props) {
  const { activeNode, applyOrReplaceOperation } = usePipeline()
  const columns = activeNode?.columns ?? []

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<AddColumnFormValues>({
    resolver: zodResolver(addColumnFormSchema),
    defaultValues: {
      name: '',
      expression: '',
      columns: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'columns',
  })

  const name = watch('name')
  const expression = watch('expression')

  const existingColumnNames = new Set([...columns.map((c) => c.name), ...fields.map((c) => c.name)])

  const addColumn = () => {
    clearErrors('root')

    if (!name.trim()) {
      setError('root', { message: 'Column name is required' })
      return
    }

    if (existingColumnNames.has(name.trim())) {
      setError('root', { message: 'Column name already exists' })
      return
    }

    if (!expression.trim()) {
      setError('root', { message: 'Expression is required' })
      return
    }

    append({ name: name.trim(), expression: expression.trim() })
    setValue('name', '')
    setValue('expression', '')
  }

  const onSubmit = async (data: AddColumnFormValues) => {
    if (data.columns.length === 0) return

    await applyOrReplaceOperation({
      type: 'addColumn',
      columns: data.columns,
    } as AddColumnOperation)

    onClose()
  }

  const insertColumnRef = (colName: string) => {
    setValue('expression', expression + `"${colName}"`)
  }

  const isValid = fields.length > 0

  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Add computed column"
      width="xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit(onSubmit)} disabled={!isValid}>
            Apply
          </Button>
        </>
      }
    >
      {/* Pending columns */}
      {fields.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[10px] font-medium mb-1 text-[var(--color-text-muted)]">Columns to add</h3>
          <div className="space-y-1">
            {fields.map((col, i) => (
              <div
                key={col.id}
                className="flex items-center justify-between bg-[var(--color-bg-secondary)] px-2 py-1 text-xs border border-[var(--color-border)]"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{col.name}</span>
                  <span className="text-[var(--color-text-muted)] mx-1">=</span>
                  <span className="text-[var(--color-text-secondary)] truncate">{col.expression}</span>
                </div>
                <button
                  onClick={() => remove(i)}
                  className="ml-2 text-[var(--color-text-muted)] hover:text-[var(--color-error)] px-1"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New column form */}
      <div className="space-y-3">
        <div>
          <Label size="sm">Column name</Label>
          <FormInput name="name" control={control} placeholder="new_column" inputSize="sm" />
        </div>

        <div>
          <Label size="sm">SQL expression</Label>
          <FormTextarea
            name="expression"
            control={control}
            placeholder="e.g., column1 + column2"
            rows={3}
            textareaSize="xs"
            className="resize-none"
          />
        </div>

        {/* Column references */}
        <div>
          <Label size="sm">Insert column:</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {columns.slice(0, 10).map((col) => (
              <button
                key={col.name}
                type="button"
                onClick={() => insertColumnRef(col.name)}
                className="px-1 py-0.5 text-[10px] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
              >
                {col.name}
              </button>
            ))}
            {columns.length > 10 && (
              <span className="px-1 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                +{columns.length - 10} more
              </span>
            )}
          </div>
        </div>

        {/* Example expressions */}
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
            Examples
          </summary>
          <div className="mt-1 space-y-0.5 pl-2 border-l border-[var(--color-border)]">
            {EXAMPLE_EXPRESSIONS.map((ex) => (
              <div key={ex.label} className="flex gap-1 text-[10px]">
                <span className="text-[var(--color-text-muted)]">{ex.label}:</span>
                <code
                  className="text-[var(--color-accent)] cursor-pointer hover:underline"
                  onClick={() => setValue('expression', ex.example)}
                >
                  {ex.example}
                </code>
              </div>
            ))}
          </div>
        </details>

        {errors.root && (
          <p className="text-xs text-[var(--color-error)] border border-[var(--color-error)] p-1">
            {errors.root.message}
          </p>
        )}

        <Button variant="secondary" size="sm" onClick={addColumn} className="w-full">
          Add column
        </Button>
      </div>
    </RadixDialog>
  )
}
