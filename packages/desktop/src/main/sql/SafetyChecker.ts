const FORBIDDEN_PATTERNS: Array<{ regex: RegExp; risk: 'high' | 'medium' }> = [
  { regex: /\bATTACH\s+/i, risk: 'high' },
  { regex: /\bDETACH\s+/i, risk: 'high' },
  { regex: /\bLOAD_EXTENSION\s+/i, risk: 'high' },
  { regex: /\bPRAGMA\s+VIRTUAL/i, risk: 'medium' },
  { regex: /\bCREATE\s+VIRTUAL\s+TABLE/i, risk: 'medium' },
]

export function checkSafety(sql: string): SafetyCheck {
  const violations: SafetyViolation[] = []

  for (const { regex, risk } of FORBIDDEN_PATTERNS) {
    if (regex.test(sql)) {
      violations.push({ pattern: regex.source, risk })
    }
  }

  return { safe: violations.length === 0, violations }
}

export interface SafetyCheck {
  safe: boolean
  violations: SafetyViolation[]
}

export interface SafetyViolation {
  pattern: string
  risk: 'high' | 'medium'
}
