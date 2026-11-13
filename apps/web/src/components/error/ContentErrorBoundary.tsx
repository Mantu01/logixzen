'use client'

import { type ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

export function ContentErrorBoundary({ children }: Props): ReactNode {
  return children
}

export function ContentErrorBoundaryFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }): ReactNode {
  return (
    <Alert variant="destructive" className="m-4">
      <AlertCircle className="w-4 h-4" />
      <AlertTitle>Content Loading Error</AlertTitle>
      <AlertDescription className="font-mono text-xs">
        {error?.message ?? 'Unknown error'}
      </AlertDescription>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-3 h-7 text-xs font-mono gap-1.5"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </Button>
    </Alert>
  )
}
