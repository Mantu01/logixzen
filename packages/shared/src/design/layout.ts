export const radius = {
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
  full: 9999,
} as const

export const shadows = {
  none: 'none',
  elevated: '0 1px 3px rgba(0, 0, 0, 0.3)',
} as const

export const motion = {
  duration: {
    instant: 0,
    fast: 80,
    normal: 150,
    slow: 250,
  } as const,
  easing: {
    linear: 'linear',
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  } as const,
} as const
