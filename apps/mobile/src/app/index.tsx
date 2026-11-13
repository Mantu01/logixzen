import React from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Provider as PaperProvider } from 'react-native-paper'
import { Spacing } from '@/constants/theme'
import { useImportStore } from '@/import-export/store'
import { useProgressStore } from '@/stores/useProgressStore'

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { progress, customQuestions, loadProgress, loadCustomContent } = useImportStore()
  const { totalPoints, streak, badges, solvedQuestions } = useProgressStore()

  React.useEffect(() => {
    loadProgress()
    loadCustomContent()
  }, [])

  const completedCount = Object.values(progress.questionProgress).filter(r => r.completed).length
  const isDark = true // terminal theme is always dark

  return (
    <PaperProvider>
      <Stack.Screen options={{ title: 'LogixZen' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: '#0D1117' }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>LogixZen</Text>
          <Text style={styles.subtitle}>Master SQL on-device</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: '#161B22', borderColor: '#30363D' }]}>
            <Text style={[styles.statValue, { color: '#3FB950' }]}>{totalPoints}</Text>
            <Text style={[styles.statLabel, { color: '#8B949E' }]}>Points</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#161B22', borderColor: '#30363D' }]}>
            <Text style={[styles.statValue, { color: '#3FB950' }]}>{streak.currentStreak}</Text>
            <Text style={[styles.statLabel, { color: '#8B949E' }]}>Streak</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#161B22', borderColor: '#30363D' }]}>
            <Text style={[styles.statValue, { color: '#3FB950' }]}>{solvedQuestions.length}</Text>
            <Text style={[styles.statLabel, { color: '#8B949E' }]}>Done</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: '#30363D' }]} />

        <Text style={[styles.sectionTitle, { color: '#E6EDF3' }]}>Quick Actions</Text>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#161B22', borderColor: '#30363D' }]}
          onPress={() => router.push('/playground')}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionText, { color: '#E6EDF3' }]}>Playground</Text>
          <Text style={[styles.actionSub, { color: '#8B949E' }]}>Execute free-form SQL queries</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#161B22', borderColor: '#30363D' }]}
          onPress={() => router.push('/practice')}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionText, { color: '#E6EDF3' }]}>Practice</Text>
          <Text style={[styles.actionSub, { color: '#8B949E' }]}>Structured exercises by topic</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#161B22', borderColor: '#30363D' }]}
          onPress={() => router.push('/schema')}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionText, { color: '#E6EDF3' }]}>Schema Browser</Text>
          <Text style={[styles.actionSub, { color: '#8B949E' }]}>Explore database structure</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#161B22', borderColor: '#30363D' }]}
          onPress={() => router.push('/progress')}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionText, { color: '#E6EDF3' }]}>Progress</Text>
          <Text style={[styles.actionSub, { color: '#8B949E' }]}>Track your learning journey</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#161B22', borderColor: '#30363D' }]}
          onPress={() => router.push('/import')}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionText, { color: '#E6EDF3' }]}>Import Content</Text>
          <Text style={[styles.actionSub, { color: '#8B949E' }]}>Load custom JSON packs</Text>
          {customQuestions.length > 0 && (
            <Text style={[styles.badge, { backgroundColor: 'rgba(63,185,80,0.2)', color: '#3FB950' }]}>
              {customQuestions.length} custom
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#161B22', borderColor: '#30363D' }]}
          onPress={() => router.push('/export')}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionText, { color: '#E6EDF3' }]}>Export Progress</Text>
          <Text style={[styles.actionSub, { color: '#8B949E' }]}>Download your stats</Text>
        </TouchableOpacity>

        {badges.length > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: '#30363D' }]} />
            <Text style={[styles.sectionTitle, { color: '#E6EDF3' }]}>Badges Earned</Text>
            <View style={styles.badgesRow}>
              {badges.map((badge) => (
                <View key={badge.id} style={[styles.badgeItem, { backgroundColor: '#161B22', borderColor: '#30363D' }]}>
                  <Text style={styles.badgeIcon}>🏆</Text>
                  <Text style={[styles.badgeName, { color: '#8B949E' }]}>{badge.id}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: '#6E7681' }]}>
            v1.1.0 · On-device SQLite · AI Ready
          </Text>
        </View>
      </ScrollView>
    </PaperProvider>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  header: { marginBottom: Spacing.four },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, color: '#3FB950' },
  subtitle: { fontSize: 14, marginTop: Spacing.half, color: '#8B949E' },
  statsRow: { flexDirection: 'row', gap: Spacing.two },
  statBox: { flex: 1, padding: Spacing.three, borderRadius: Spacing.two, alignItems: 'center', borderWidth: 1 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.half },
  divider: { height: 1, marginVertical: Spacing.three },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: Spacing.two },
  actionButton: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    borderWidth: 1,
  },
  actionText: { fontSize: 16, fontWeight: '600' },
  actionSub: { fontSize: 12, marginTop: Spacing.half },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.three },
  badgeItem: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    width: 70,
  },
  badgeIcon: { fontSize: 20, marginBottom: 2 },
  badgeName: { fontSize: 9, textAlign: 'center' },
  footer: { marginTop: Spacing.five, alignItems: 'center' },
  footerText: { fontSize: 11 },
})
