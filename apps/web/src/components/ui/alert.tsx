import * as React from 'react'

import { cn } from '@/lib/utils'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info'
}

const variantStyles: Record<string, string> = {
  default: 'border-border bg-surface text-foreground',
  destructive: 'border-error/50 bg-error/10 text-error',
  success: 'border-success/50 bg-success/10 text-success',
  warning: 'border-warning/50 bg-warning/10 text-warning',
  info: 'border-info/50 bg-info/10 text-info',
}

export function Alert({ className, variant = 'default', ...props }: AlertProps): React.ReactElement {
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-lg border px-4 py-3 text-sm',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.ReactElement {
  return (
    <p
      className={cn('font-mono text-sm font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.ReactElement {
  return (
    <p
      className={cn('text-xs opacity-90', className)}
      {...props}
    />
  )
}
