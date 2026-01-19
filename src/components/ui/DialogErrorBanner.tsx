interface Props {
  error: string | null
}

export function DialogErrorBanner({ error }: Props) {
  if (!error) return null

  return (
    <div className="mb-3 p-2 bg-[var(--color-error-bg)] text-[var(--color-error)] text-xs border border-[var(--color-error)]">
      {error}
    </div>
  )
}
