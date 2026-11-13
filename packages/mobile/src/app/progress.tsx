import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useProgressStore } from '@/stores/useProgressStore'
import { loadTopics, TOTAL_QUESTIONS_PER_TOPIC } from '@logixzen/shared/content'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'

interface TopicProgress {
  id: string
  title: string
  solved: number
  total: number
  percentage: number
}

const BADGE_CONFIG: Record<string, { icon: string; name: string; description: string }> = {
  'first-question': { icon: '🎯', name: 'First Question', description: 'Complete your first question' },
  'streak-3-day': { icon: '🔥', name: '3-Day Streak', description: 'Practice for 3 consecutive days' },
  'topic-complete': { icon: '👑', name: 'Topic Master', description: 'Complete all questions in a topic' },
  'hint-saver': { icon: '🧠', name: 'Hint Saver', description: 'Solve without hints' },
  'sql-ninja': { icon: '🥷', name: 'SQL Ninja', description: 'Complete 50 questions' },
}

export default function ProgressScreen() {
  const router = useRouter()
  const { totalPoints, streak, badges, solvedQuestions, questionSolutions, actions } = useProgressStore()
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const topics = await loadTopics()
        const progress: TopicProgress[] = []

        for (const topic of topics) {
          const total = TOTAL_QUESTIONS_PER_TOPIC[topic.id] ?? 0
          // Count solved questions in this topic from questionSolutions
          let solved = 0
          for (const qId of Object.keys(questionSolutions)) {
            if (qId.startsWith(topic.id + '-')) {
              solved++
            }
          }
          progress.push({
            id: topic.id,
            title: topic.title,
            solved,
            total,
            percentage: total > 0 ? Math.round((solved / total) * 100) : 0,
          })
        }

        setTopicProgress(progress)
      } catch (e) {
        // Silently fail — show what we have
      } finally {
        setIsLoading(false)
      }
    }

    loadProgress()
  }, [questionSolutions])

  const totalQuestions = Object.values(TOTAL_QUESTIONS_PER_TOPIC).reduce((a, b) => a + b, 0)
  const overallPercentage = totalQuestions > 0 ? Math.round((solvedQuestions.length / totalQuestions) * 100) : 0

  const handleReset = () => {
    actions.resetProgress()
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} accessibilityLabel="Reset progress">
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{solvedQuestions.length}</Text>
          <Text style={styles.statLabel}>Solved</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalPoints}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak.currentStreak}d</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
      </View>

      {/* Overall Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Overall Progress</Text>
          <Text style={styles.progressValue}>{overallPercentage}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${overallPercentage}%` },
            ]}
          />
        </View>
        <Text style={styles.progressSubtext}>
          {solvedQuestions.length} of {totalQuestions} questions completed
        </Text>
      </View>

      {/* Topic Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Topic Progress</Text>
        {isLoading ? (
          <Text style={styles.loading}>Loading...</Text>
        ) : (
          topicProgress.map((topic) => (
            <TouchableOpacity
              key={topic.id}
              style={styles.topicRow}
              onPress={() => router.push(`/practice/${topic.id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.topicName}>{topic.title}</Text>
              <View style={styles.topicProgress}>
                <View style={styles.topicBar}>
                  <View
                    style={[
                      styles.topicFill,
                      { width: `${topic.total > 0 ? (topic.solved / topic.total) * 100 : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.topicCount}>
                  {topic.solved}/{topic.total}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges ({badges.length})</Text>
        <View style={styles.badgesGrid}>
          {Object.entries(BADGE_CONFIG).map(([badgeId, config]) => {
            const earned = badges.some((b) => b.id === badgeId)
            return (
              <View key={badgeId} style={styles.badgeItem}>
                <Text style={[styles.badgeIcon, !earned && styles.badgeLocked]}>{config.icon}</Text>
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>{config.name}</Text>
                {!earned && <Text style={styles.badgeDesc}>Lock to unlock</Text>}
                {earned && <Text style={styles.badgeEarned}>{config.description}</Text>}
              </View>
            )
          })}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  content: { padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    marginBottom: 16,
  },
  title: { fontFamily: 'JetBrainsMono-Regular', fontSize: 18, color: '#E6EDF3' },
  resetBtn: {
    borderWidth: 1,
    borderColor: '#F85149',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resetText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#F85149' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontFamily: 'JetBrainsMono-Regular', fontSize: 24, fontWeight: 'bold', color: '#3FB950' },
  statLabel: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#8B949E', marginTop: 4 },
  progressSection: { marginBottom: 16 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#8B949E' },
  progressValue: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, fontWeight: '600', color: '#3FB950' },
  progressSubtext: { fontFamily: 'Inter-Regular', fontSize: 11, color: '#6E7681', marginTop: 4 },
  progressBar: { height: 8, backgroundColor: '#30363D', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3FB950', borderRadius: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#E6EDF3', marginBottom: 12 },
  loading: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#8B949E' },
  topicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  topicName: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#E6EDF3', flex: 1 },
  topicProgress: { alignItems: 'flex-end', gap: 4 },
  topicBar: { width: 100, height: 4, backgroundColor: '#30363D', borderRadius: 2, overflow: 'hidden' },
  topicFill: { height: '100%', backgroundColor: '#3FB950', borderRadius: 2 },
  topicCount: { fontFamily: 'JetBrainsMono-Regular', fontSize: 10, color: '#8B949E' },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 4,
    backgroundColor: '#161B22',
  },
  badgeIcon: { fontSize: 28, marginBottom: 6 },
  badgeName: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#E6EDF3', marginBottom: 2 },
  badgeDesc: { fontFamily: 'Inter-Regular', fontSize: 10, color: '#6E7681', textAlign: 'center' },
  badgeEarned: { fontFamily: 'Inter-Regular', fontSize: 10, color: '#3FB950', textAlign: 'center' },
  badgeLocked: { opacity: 0.3 },
  badgeNameLocked: { color: '#6E7681' },
})
