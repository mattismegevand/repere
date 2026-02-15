import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Play from 'lucide-react/dist/esm/icons/play'
import PlayCircle from 'lucide-react/dist/esm/icons/play-circle'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import { Button } from '@/components/ui/Button'
import type { AgentPlan, PlannedStep, StepStatus } from '@/types/ai'

interface PlanPreviewProps {
  plan: AgentPlan
  onApprove: () => void
  onCancel: () => void
  onRunStep: (stepId: string) => void
  onRemoveStep: (stepId: string) => void
  onReorderStep: (fromIndex: number, toIndex: number) => void
  isExecuting: boolean
  currentStepIndex: number
}

const statusIcons: Record<StepStatus, React.ReactNode> = {
  pending: <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--color-border)]" />,
  running: <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-accent)]" />,
  success: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-500" />,
  skipped: <div className="w-3.5 h-3.5 rounded-full bg-[var(--color-border)]" />,
}

function StepItem({
  step,
  index,
  totalSteps,
  onRemove,
  onMoveUp,
  onMoveDown,
  onRun,
  isExecuting,
  isCurrent,
}: {
  step: PlannedStep
  index: number
  totalSteps: number
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRun: () => void
  isExecuting: boolean
  isCurrent: boolean
}) {
  const canModify = step.status === 'pending' && !isExecuting

  return (
    <div
      className={`flex items-start gap-2 py-2 px-2 rounded-md transition-colors ${
        isCurrent ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30' : ''
      } ${step.status === 'failed' ? 'bg-red-500/5' : ''}`}
    >
      <div className="mt-0.5 shrink-0">{statusIcons[step.status]}</div>

      <div className="flex-1 min-w-0">
        <div className="text-xs text-[var(--color-text-primary)]">{step.description}</div>
        {step.result ? (
          <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{step.result.message}</div>
        ) : null}
      </div>

      {canModify && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] disabled:opacity-30"
            title="Move up"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalSteps - 1}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] disabled:opacity-30"
            title="Move down"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onRun}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]"
            title="Run this step"
          >
            <Play className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-red-500"
            title="Remove step"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}

export function PlanPreview({
  plan,
  onApprove,
  onCancel,
  onRunStep,
  onRemoveStep,
  onReorderStep,
  isExecuting,
  currentStepIndex,
}: PlanPreviewProps) {
  const pendingSteps = plan.steps.filter((s) => s.status === 'pending')
  const completedSteps = plan.steps.filter((s) => s.status === 'success')
  const failedSteps = plan.steps.filter((s) => s.status === 'failed')

  const canApprove = pendingSteps.length > 0 && !isExecuting

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            Plan Preview
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
            {completedSteps.length > 0 ? <span className="text-green-500">{completedSteps.length} done</span> : null}
            {failedSteps.length > 0 ? <span className="text-red-500">{failedSteps.length} failed</span> : null}
            <span>{pendingSteps.length} pending</span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
        {plan.steps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            index={index}
            totalSteps={plan.steps.length}
            onRemove={() => onRemoveStep(step.id)}
            onMoveUp={() => onReorderStep(index, index - 1)}
            onMoveDown={() => onReorderStep(index, index + 1)}
            onRun={() => onRunStep(step.id)}
            isExecuting={isExecuting}
            isCurrent={index === currentStepIndex}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t border-[var(--color-border)] flex items-center gap-2">
        <Button size="sm" onClick={onApprove} disabled={!canApprove} className="gap-1.5">
          <PlayCircle className="w-3.5 h-3.5" />
          {isExecuting ? 'Running...' : 'Run All'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={isExecuting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
