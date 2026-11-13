import { useState, useEffect, useCallback } from 'react'
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native'
import { Text } from 'react-native-paper'
import { useRouter } from 'expo-router'
import { useContentStore } from '@/stores/useContentStore'
import { loadQuestions } from '@logixzen/shared/content'

export default function PracticeScreen() {
  const router = useRouter()
  const { topics, loaded, loadContent, error: contentError, isLoading } = useContentStore()
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    void loadContent()
  }, [loadContent])

  useEffect(() => {
    if (!loaded) return
    const counts: Record<string, number> = {}
    topics.forEach(async (topic) => {
      try {
        const qs = await loadQuestions(topic.id)
        counts[topic.id] = qs.length
      } catch {
        counts[topic.id] = 0
      }
    })
    setQuestionCounts(counts)
  }, [loaded, topics])

  const handleTopicPress = useCallback(
    (topicId: string) => {
      router.push(`/practice/${topicId}`)
    },
    [router]
  )

  if (isLoading && !loaded) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading topics...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Practice</Text>
      <Text style={styles.subtitle}>Choose a topic to start learning</Text>

      {contentError !== null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{contentError}</Text>
        </View>
      )}

      {topics.map((topic) => {
        const total = questionCounts[topic.id] ?? 0

        return (
          <TouchableOpacity
            key={topic.id}
            style={styles.card}
            onPress={() => handleTopicPress(topic.id)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{topic.title}</Text>
              <Text style={styles.badge}>{total} questions</Text>
            </View>
            {topic.description !== undefined && (
              <Text style={styles.cardDescription}>{topic.description}</Text>
            )}
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: total > 0 ? '0%' : '0%' },
                ]}
              />
            </View>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  content: { padding: 16 },
  title: { fontFamily: 'JetBrainsMono-Regular', fontSize: 20, fontWeight: 'bold', color: '#3FB950', marginBottom: 4 },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#8B949E', marginBottom: 16 },
  errorBox: { borderWidth: 1, borderColor: '#F85149', backgroundColor: 'rgba(248, 81, 73, 0.12)', borderRadius: 4, padding: 12, marginBottom: 12 },
  errorText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#F85149' },
  card: { borderWidth: 1, borderColor: '#30363D', borderRadius: 4, padding: 16, marginBottom: 12, backgroundColor: '#161B22' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontFamily: 'JetBrainsMono-Regular', fontSize: 16, color: '#E6EDF3' },
  badge: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#3FB950' },
  cardDescription: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#8B949E', marginBottom: 8 },
  progressBar: { height: 4, backgroundColor: '#30363D', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3FB950' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#8B949E' },
})
