import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { ValidationResult, ValidationError, ValidationWarning } from '@logixzen/shared/content'

interface Props {
  result: ValidationResult
}

export function ValidationReport({ result }: Props): React.ReactElement {
  if (result.valid && !result.errors.length) {
    return (
      <div className="p-3 bg-success-dim border-l-2 border-success text-xs font-mono text-success flex items-center gap-2">
        <CheckCircle2 size={14} />
        Valid — no errors found
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {result.errors.map((err: ValidationError, idx: number) => (
        <div key={`e-${idx}`} className="p-2 bg-error-dim border-l-2 border-error text-xs font-mono text-error">
          <AlertCircle size={12} className="inline mr-1.5 -mt-0.5" />
          <span className="font-semibold">{err.type}:</span> {err.message}
          {err.suggestion && <span className="opacity-75 block mt-0.5">Suggestion: {err.suggestion}</span>}
        </div>
      ))}
      {(result as { warnings?: ValidationWarning[] }).warnings?.map((warn, idx) => (
        <div key={`w-${idx}`} className="p-2 bg-warning-dim border-l-2 border-warning text-xs font-mono text-warning">
          <AlertCircle size={12} className="inline mr-1.5 -mt-0.5" />
          {warn.message}
        </div>
      ))}
    </div>
  )
}
