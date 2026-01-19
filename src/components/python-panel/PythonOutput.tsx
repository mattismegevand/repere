interface PythonOutputProps {
  stdout: string
  stderr: string
  error?: string
}

export function PythonOutput({ stdout, stderr, error }: PythonOutputProps) {
  const hasOutput = stdout || stderr || error

  if (!hasOutput) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-[var(--color-text-muted)]">
        Run code to see output
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-2 font-mono text-[11px]">
      {error && (
        <div className="mb-2 p-2 rounded bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
          <div className="font-semibold text-[var(--color-error)] mb-1">Error</div>
          <pre className="whitespace-pre-wrap text-[var(--color-error)]">{error}</pre>
        </div>
      )}

      {stderr && (
        <div className="mb-2">
          <div className="font-semibold text-[var(--color-warning)] mb-1">Stderr</div>
          <pre className="whitespace-pre-wrap text-[var(--color-text-secondary)]">{stderr}</pre>
        </div>
      )}

      {stdout && (
        <div>
          <div className="font-semibold text-[var(--color-text-muted)] mb-1">Output</div>
          <pre className="whitespace-pre-wrap text-[var(--color-text-primary)]">{stdout}</pre>
        </div>
      )}
    </div>
  )
}
