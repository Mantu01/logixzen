import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SemanticVariant = "default" | "success" | "warning" | "error" | "info";

const SEMANTIC_STYLES: Record<SemanticVariant, string> = {
  default: "border-border text-foreground",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: SemanticVariant;
  className?: string;
}): React.ReactElement {
  return (
    <ShadcnBadge
      variant="outline"
      className={cn("font-mono", SEMANTIC_STYLES[variant], className)}
    >
      {children}
    </ShadcnBadge>
  );
}
