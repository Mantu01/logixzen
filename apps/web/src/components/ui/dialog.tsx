import * as React from 'react'
import { cn } from '@/lib/utils'

const DialogContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
} | null>(null)

function useDialog(): { open: boolean; onOpenChange: (open: boolean) => void } {
  const ctx = React.useContext(DialogContext)
  if (!ctx) throw new Error('Dialog components must be used within a Dialog')
  return ctx
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Dialog({ open, onOpenChange, children }: DialogProps): React.ReactElement {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

export function DialogTrigger({ children, asChild = false }: { children: React.ReactNode; asChild?: boolean }): React.ReactElement {
  const { onOpenChange } = useDialog()

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onOpenChange(true)
  }

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
    const originalOnClick = child.props.onClick
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        handleClick(e)
        originalOnClick?.(e)
      },
    })
  }

  return <button onClick={handleClick}>{children}</button>
}

export function DialogContent({ className, children, ...props }: DialogContentProps): React.ReactElement {
  const { onOpenChange } = useDialog()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          'rounded-lg border border-border bg-surface p-6 shadow-lg',
          className
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('flex flex-col space-y-1.5', className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return <h2 className={cn('font-mono text-sm font-semibold', className)} {...props} />
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.ReactElement {
  return <p className={cn('text-xs text-muted', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2', className)} {...props} />
}
