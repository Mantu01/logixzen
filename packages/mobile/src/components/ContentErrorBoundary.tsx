import { StyleSheet } from 'react-native'
import { Surface, Text, Button } from 'react-native-paper'

interface ContentErrorBoundaryProps {
  error: Error | null
  onRetry: () => void
}

export function ContentErrorBoundary({ error, onRetry }: ContentErrorBoundaryProps) {
  if (error === null) return null

  return (
    <Surface style={styles.container} elevation={0}>
      <Text style={styles.title}>Content Error</Text>
      <Text style={styles.message}>{error.message}</Text>
      <Button mode="outlined" size="small" onPress={onRetry} style={styles.button}>
        Retry
      </Button>
    </Surface>
  )
}

export const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#F85149',
    backgroundColor: 'rgba(248, 81, 73, 0.12)',
    borderRadius: 4,
    padding: 12,
    margin: 8,
  },
  title: {
    color: '#F85149',
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    color: '#E6EDF3',
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 12,
    marginBottom: 8,
  },
  button: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#30363D',
  },
})
