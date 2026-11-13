import * as React from 'react'

import { cn } from '@/lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  href?: string
}

export function Card({ className, title, description, children, ...props }: CardProps): React.ReactElement {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface text-foreground shadow-sm',
        className
      )}
      {...props}
    >
      {(title || description) && (
        <div className="p-4 pb-0 space-y-1">
          {title && <h3 className="font-mono text-sm font-semibold leading-none tracking-tight">{title}</h3>}
          {description && (
            <p className="text-xs text-muted">{description}</p>
          )}
        </div>
      )}
      <div className="p-4 pt-3">{children}</div>
    </div>
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('flex flex-col space-y-2.5 p-6', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return (
    <h3
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('p-6 pt-0', className)}
      {...props}
    />
  )
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('flex items-center justify-between p-6 pt-0', className)}
      {...props}
    />
  )
}
