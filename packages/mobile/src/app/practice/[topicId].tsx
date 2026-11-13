import { StyleSheet, ScrollView, View, TouchableOpacity, Text } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useProgressStore } from '@/stores/useProgressStore'

const QUESTIONS: Record<string, Array<{ id: string; questionId: string; difficulty: 'easy' | 'medium' | 'hard'; title: string; solved: boolean }>> = {
  'select-basics': [
    { id: 'q1', questionId: 'select-001', difficulty: 'easy', title: 'Select All Students', solved: false },
    { id: 'q2', questionId: 'select-002', difficulty: 'easy', title: 'Select Specific Columns', solved: false },
    { id: 'q3', questionId: 'select-003', difficulty: 'easy', title: 'DISTINCT Values', solved: false },
    { id: 'q4', questionId: 'select-004', difficulty: 'medium', title: 'LIMIT Results', solved: false },
    { id: 'q5', questionId: 'select-005', difficulty: 'medium', title: 'ORDER BY', solved: false },
    { id: 'q6', questionId: 'select-006', difficulty: 'medium', title: 'Column Aliases', solved: false },
    { id: 'q7', questionId: 'select-007', difficulty: 'hard', title: 'Complex SELECT', solved: false },
    { id: 'q8', questionId: 'select-008', difficulty: 'hard', title: 'SELECT Mastery', solved: false },
  ],
  'where-clauses': [
    { id: 'q1', questionId: 'where-001', difficulty: 'easy', title: 'Filter by Age', solved: false },
    { id: 'q2', questionId: 'where-002', difficulty: 'easy', title: 'Multiple Conditions', solved: false },
    { id: 'q3', questionId: 'where-003', difficulty: 'medium', title: 'LIKE Pattern', solved: false },
    { id: 'q4', questionId: 'where-004', difficulty: 'medium', title: 'IN Operator', solved: false },
    { id: 'q5', questionId: 'where-005', difficulty: 'medium', title: 'BETWEEN Range', solved: false },
    { id: 'q6', questionId: 'where-006', difficulty: 'hard', title: 'NULL Handling', solved: false },
    { id: 'q7', questionId: 'where-007', difficulty: 'hard', title: 'Advanced Filters', solved: false },
    { id: 'q8', questionId: 'where-008', difficulty: 'hard', title: 'Where Mastery', solved: false },
    { id: 'q9', questionId: 'where-009', difficulty: 'hard', title: 'Complex WHERE', solved: false },
    { id: 'q10', questionId: 'where-010', difficulty: 'hard', title: 'WHERE Expert', solved: false },
  ],
}

const QUESTION_GENERATOR: Record<string, Array<{ questionId: string; difficulty: 'easy' | 'medium' | 'hard'; title: string }>> = {
  'join-operations': Array.from({ length: 12 }, (_, i) => ({ questionId: `join-00${i + 1}`, difficulty: (i < 4 ? 'easy' : i < 8 ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard', title: `Join ${i + 1}` })),
  'aggregate-functions': Array.from({ length: 10 }, (_, i) => ({ questionId: `agg-00${i + 1}`, difficulty: (i < 3 ? 'easy' : i < 7 ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard', title: `Aggregate ${i + 1}` })),
  'group-by': Array.from({ length: 8 }, (_, i) => ({ questionId: `group-00${i + 1}`, difficulty: (i < 3 ? 'easy' : i < 5 ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard', title: `Group By ${i + 1}` })),
  'subqueries': Array.from({ length: 10 }, (_, i) => ({ questionId: `sub-00${i + 1}`, difficulty: (i < 3 ? 'easy' : i < 7 ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard', title: `Subquery ${i + 1}` })),
}

export default function TopicDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ topicId: string }>()
  const { solvedQuestions } = useProgressStore()

  const rawQuestions = QUESTIONS[params.topicId] ?? QUESTION_GENERATOR[params.topicId] ?? []
  const questions = rawQuestions.map((q) => ({ ...q, id: `q-${q.questionId}`, solved: false }))

  const DIFFICULTY_COLOR = { easy: '#3FB950', medium: '#D29922', hard: '#F85149' }

  const filteredByDifficulty = (difficulty: string) =>
    questions.filter((q) => q.difficulty === difficulty)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{params.topicId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
      <Text style={styles.subtitle}>{questions.length} questions</Text>

      {(['easy', 'medium', 'hard'] as const).map((diff) => {
        const qs = filteredByDifficulty(diff)
        if (qs.length === 0) return null
        const solved = qs.filter((q) => solvedQuestions.includes(q.questionId)).length

        return (
          <View key={diff} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: DIFFICULTY_COLOR[diff] }]}>{diff.toUpperCase()}</Text>
              <Text style={styles.solvedCount}>{solved}/{qs.length} solved</Text>
            </View>
            {qs.map((q) => {
              const isSolved = solvedQuestions.includes(q.questionId)
              return (
                <TouchableOpacity
                  key={q.questionId}
                  style={[styles.questionCard, isSolved && styles.questionSolved]}
                  onPress={() => router.push(`/practice/${params.topicId}/${q.questionId}`)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.questionTitle}>{q.title}</Text>
                  <Text style={styles.questionId}>{q.questionId}</Text>
                  {isSolved && <Text style={styles.checkmark}> Done</Text>}
                </TouchableOpacity>
              )
            })}
          </View>
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
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, fontWeight: '600' },
  solvedCount: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#8B949E' },
  questionCard: { borderWidth: 1, borderColor: '#30363D', borderRadius: 4, padding: 12, marginBottom: 8, backgroundColor: '#161B22' },
  questionSolved: { borderColor: '#3FB950' },
  questionTitle: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#E6EDF3' },
  questionId: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#6E7681', marginTop: 2 },
  checkmark: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#3FB950', marginTop: 2 },
})
