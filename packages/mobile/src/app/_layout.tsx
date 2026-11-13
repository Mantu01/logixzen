import { Stack } from 'expo-router'
import { PaperProvider } from 'react-native-paper'
import { terminalTheme } from '../theme/terminalTheme'
import { useAiStore } from '../ai/store'
import { useEffect } from 'react'

export default function RootLayout() {
  // Pre-load AI config on app start
  useEffect(() => {
    useAiStore.getState().loadConfig()
  }, [])

  return (
    <PaperProvider theme={terminalTheme}>
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#161B22' }, headerTitleStyle: { color: '#E6EDF3', fontFamily: 'JetBrainsMono-Regular' }, headerTintColor: '#E6EDF3' }}>
        <Stack.Screen name="index" options={{ title: 'LogixZen' }} />
        <Stack.Screen name="playground" options={{ title: 'Playground' }} />
        <Stack.Screen name="practice" options={{ title: 'Practice' }} />
        <Stack.Screen name="progress" options={{ title: 'Progress' }} />
        <Stack.Screen name="schema" options={{ title: 'Schema' }} />
        <Stack.Screen name="practice/[topicId]" options={{ title: 'Topic' }} />
        <Stack.Screen name="practice/[topicId]/[questionId]" options={{ title: 'Question' }} />
        <Stack.Screen name="ai-settings" options={{ title: 'AI Settings', presentation: 'modal' }} />
      </Stack>
    </PaperProvider>
  )
}
