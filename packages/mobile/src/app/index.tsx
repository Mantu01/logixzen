import { useState } from 'react'
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useProgressStore } from '@/stores/useProgressStore'

const BADGE_CONFIG: Record<string, { icon: string; name: string }> = {
  'first-query': { icon: 'Q', name: 'First Query' },
  'streak-3-day': { icon: '3', name: '3-Day Streak' },
  'topic-complete': { icon: 'T', name: 'Topic Complete' },
}

export default function HomeScreen() {
  const router = useRouter()
  const { totalPoints, streak, badges, solvedQuestions, actions } = useProgressStore()
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>LogixZen</Text>
        <Text style={styles.subtitle}>Offline SQL Practice</Text>
      </View>

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

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/playground')}
        activeOpacity={0.8}
      >
        <Text style={styles.cardTitle}>Playground</Text>
        <Text style={styles.cardDescription}>Execute free-form SQL queries</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/practice')}
        activeOpacity={0.8}
      >
        <Text style={styles.cardTitle}>Practice</Text>
        <Text style={styles.cardDescription}>Structured exercises by topic</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/progress')}
        activeOpacity={0.8}
      >
        <Text style={styles.cardTitle}>Progress</Text>
        <Text style={styles.cardDescription}>Track your learning journey</Text>
      </TouchableOpacity>

      {badges.length > 0 && (
        <View style={styles.badgesSection}>
          <Text style={styles.sectionTitle}>Badges Earned</Text>
          <View style={styles.badgesList}>
            {badges.map((badge) => (
              <View key={badge.id} style={styles.badge}>
                <Text style={styles.badgeIcon}>{BADGE_CONFIG[badge.id]?.icon ?? '?'}</Text>
                <Text style={styles.badgeName}>{BADGE_CONFIG[badge.id]?.name ?? badge.id}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => setShowResetConfirm(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.settingsText}>Reset Progress</Text>
      </TouchableOpacity>

      {showResetConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>Are you sure? This will delete all progress.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowResetConfirm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => {
                  actions.resetProgress()
                  setShowResetConfirm(false)
                }}
              >
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  content: { padding: 16 },
  header: { marginBottom: 24 },
  title: { fontFamily: 'JetBrainsMono-Regular', fontSize: 28, fontWeight: 'bold', color: '#3FB950' },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#8B949E', marginTop: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D', borderRadius: 4, paddingVertical: 16, marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontFamily: 'JetBrainsMono-Regular', fontSize: 24, fontWeight: 'bold', color: '#3FB950' },
  statLabel: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#8B949E', marginTop: 4 },
  card: { backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D', borderRadius: 4, padding: 16, marginBottom: 12 },
  cardTitle: { fontFamily: 'JetBrainsMono-Regular', fontSize: 16, color: '#E6EDF3', marginBottom: 4 },
  cardDescription: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#8B949E' },
  badgesSection: { marginBottom: 16 },
  sectionTitle: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#E6EDF3', marginBottom: 8 },
  badgesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D', borderRadius: 4, padding: 8, alignItems: 'center', width: 80 },
  badgeIcon: { fontSize: 20, marginBottom: 2 },
  badgeName: { fontFamily: 'JetBrainsMono-Regular', fontSize: 9, color: '#8B949E', textAlign: 'center' },
  settingsButton: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  settingsText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#6E7681' },
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { backgroundColor: '#161B22', borderWidth: 1, borderColor: '#F85149', borderRadius: 4, padding: 16, width: '80%' },
  confirmText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#E6EDF3', marginBottom: 16, textAlign: 'center' },
  confirmActions: { flexDirection: 'row', gap: 8 },
  cancelButton: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#30363D', borderRadius: 4, alignItems: 'center' },
  cancelText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#E6EDF3' },
  resetButton: { flex: 1, paddingVertical: 12, backgroundColor: '#F85149', borderRadius: 4, alignItems: 'center' },
  resetText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#0D1117' },
})
