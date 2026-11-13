export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  className?: string
}): React.ReactElement {
  const styles: Record<string, string> = {
    default: 'bg-surface-alt text-foreground border-border',
    success: 'bg-success/15 text-success border-success/30',
    warning: 'bg-warning/15 text-warning border-warning/30',
    error: 'bg-error/15 text-error border-error/30',
    info: 'bg-info/15 text-info border-info/30',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-mono rounded border ${styles[variant]} ${className ?? ''}`}>
      {children}
    </span>
  )
}
