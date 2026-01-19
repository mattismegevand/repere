import { FileProviderDialog, type FileProviderResult } from '@/components/file-provider-dialog'
import { usePipeline } from '@/lib/pipeline/usePipeline'

interface Props {
  onClose: () => void
}

export function LoadSessionDialog({ onClose }: Props) {
  const { pendingSession, continuePendingSession, cancelPendingSession, loading } = usePipeline()

  const requiredFiles = pendingSession?.data.requiredFiles ?? []

  const handleConfirm = async (result: FileProviderResult) => {
    const success = await continuePendingSession(result.providedFiles, result.skippedIds)
    if (success) {
      onClose()
    }
  }

  const handleCancel = () => {
    cancelPendingSession()
    onClose()
  }

  if (!pendingSession) {
    return null
  }

  return (
    <FileProviderDialog
      title="Load session"
      description="This session contains large datasets that need to be re-uploaded. You can skip files to load the session without them."
      requiredFiles={requiredFiles.map((r) => ({
        id: r.nodeId,
        fileName: r.fileName,
        fileSize: r.fileSize,
        fileHash: r.fileHash,
      }))}
      allowSkip={true}
      allowPartialRestore={true}
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      confirmLabel="Load session"
      cancelLabel="Cancel"
    />
  )
}
