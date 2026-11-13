export const typography = {
  fontFamily: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", monospace',
  },
  size: {
    caption: 10,
    bodySm: 11,
    body: 12,
    bodyLg: 13,
    headingSm: 14,
    heading: 16,
    headingLg: 18,
    headingXl: 22,
  } as const,
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  } as const,
  lineHeight: {
    tight: 1.3,
    normal: 1.5,
  } as const,
} as const
