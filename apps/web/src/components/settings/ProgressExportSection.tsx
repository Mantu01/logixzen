import { useProgressStore } from '@/stores/useProgressStore'
import { downloadFile } from '@/lib/fileDownloader'
import { Download } from 'lucide-react'

export function ProgressExportSection(): React.ReactElement {
  const { exportProgress } = useProgressStore()

  const handleExport = (): void => {
    const data = exportProgress()
    downloadFile({
      filename: `logixzen-progress-${new Date().toISOString().split('T')[0]}.json`,
      contentType: 'application/json',
      content: data,
    })
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono bg-primary text-background rounded hover:bg-primary/90 transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
      Export Progress
    </button>
  )
}
