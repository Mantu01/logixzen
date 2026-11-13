import { DefaultTheme } from 'react-native-paper'

export const terminalTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#3FB950',
    secondary: '#8B949E',
    accent: '#58A6FF',
    background: '#0D1117',
    surface: '#161B22',
    surfaceVariant: '#1C2128',
    surfaceHover: '#21262D',
    error: '#F85149',
    onBackground: '#E6EDF3',
    onSurface: '#E6EDF3',
    onSurfaceVariant: '#8B949E',
    outline: '#30363D',
    disabled: '#6E7681',
    placeholder: '#6E7681',
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
  fonts: {
    ...DefaultTheme.fonts,
    regular: { fontFamily: 'Inter-Regular' },
    medium: { fontFamily: 'Inter-Medium' },
    bold: { fontFamily: 'Inter-Bold' },
    thin: { fontFamily: 'Inter-Light' },
    monospace: { fontFamily: 'JetBrainsMono-Regular' },
  },
  roundness: 2,
}
