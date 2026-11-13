import { useState, useCallback } from 'react'
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native'
import { Text } from 'react-native-paper'
import { useRouter } from 'expo-router'
import { loadQuestions } from '@logixzen/shared/content'
import type { Question } from '@logixzen/shared/content'

interface TopicScreenProps {
  params: { topicId: string }
}

export default function TopicScreen({ params }: TopicScreenProps) {
  const router = useRouter()
  const { topicId } = params
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setError] = useState<string | null>(null)

  const loadQuestionsFn = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const loaded = await loadQuestions(topicId)
      setQuestions(loaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [topicId])

  useState(() => {
    void loadQuestionsFn()
  })

  const handleQuestionPress = useCallback(
    (qid: string) => {
      router.push(`/practice/${topicId}/${qid}`)
    },
    [router, topicId]
  )

  const difficultyColor = (diff: string): string => {
    switch (diff) {
      case 'easy': return '#3FB950'
      case 'medium': return '#D29922'
      case 'hard': return '#F85149'
      default: return '#8B949E'
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    )
  }

  if (loadError !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadQuestionsFn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{topicId}</Text>
        <Text style={styles.count}>{questions.length} questions</Text>
      </View>

      <ScrollView style={styles.list}>
        {questions.map((q) => (
          <TouchableOpacity
            key={q.id}
            style={styles.questionCard}
            onPress={() => handleQuestionPress(q.id)}
            activeOpacity={0.8}
          >
            <View style={styles.questionHeader}>
              <Text style={styles.questionTitle}>{q.title}</Text>
              <View
                style={[
                  styles.difficultyBadge,
                  { borderColor: difficultyColor(q.difficulty) },
                ]}
              >
                <Text style={[styles.difficultyText, { color: difficultyColor(q.difficulty) }]}>
                  {q.difficulty}
                </Text>
              </View>
            </View>
            <Text style={styles.questionDesc} numberOfLines={2}>
              {q.description}
            </Text>
            <View style={styles.questionMeta}>
              <Text style={styles.points}>{q.points} pts</Text>
              <Text style={styles.tags}>{q.tags.slice(0, 2).join(', ')}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  title: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 16,
    fontWeight: '600',
    color: '#E6EDF3',
  },
  count: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 12,
    color: '#8B949E',
  },
  list: {
    flex: 1,
    padding: 12,
  },
  questionCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    padding: 14,
    marginBottom: 8,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  questionTitle: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 14,
    color: '#E6EDF3',
    fontWeight: '600',
    flex: 1,
  },
  difficultyBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  difficultyText: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 10,
    fontWeight: '600',
  },
  questionDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8B949E',
    marginBottom: 8,
    lineHeight: 18,
  },
  questionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  points: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 11,
    color: '#3FB950',
  },
  tags: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 10,
    color: '#6E7681',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#8B949E' },
  errorText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#F85149', marginBottom: 12 },
  retryBtn: {
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#3FB950' },
})
