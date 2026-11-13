export const spacing = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  xxl: 16,
  xxxl: 24,
} as const

export function getSpacing(value: keyof typeof spacing | number): number {
  return typeof value === 'number' ? value : spacing[value]
}
