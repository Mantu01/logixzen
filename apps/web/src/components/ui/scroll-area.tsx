import * as React from 'react'
import { cn } from '@/lib/utils'

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ScrollArea({ className, children, ...props }: ScrollAreaProps): React.ReactElement {
  return (
    <div className={cn('relative overflow-auto', className)} {...props}>
      <div className="scroll-fade absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-transparent bg-background z-10 pointer-events-none" />
      {children}
      <div className="scroll-fade absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-transparent bg-background z-10 pointer-events-none" />
    </div>
  )
}
