import { useTheme as usePaperTheme } from 'react-native-paper';

export function useAppTheme() {
  const paper = usePaperTheme();
  return {
    background: paper.colors.background,
    surface: paper.colors.surface,
    surfaceVariant: paper.colors.surfaceVariant,
    text: paper.colors.onBackground,
    onSurfaceVariant: paper.colors.onSurfaceVariant,
    primary: paper.colors.primary,
    primaryContainer: paper.colors.primaryContainer,
    error: paper.colors.error,
    textSecondary: paper.colors.onSurfaceVariant,
    textTertiary: paper.colors.outline,
  };
}
