import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Button, Provider as PaperProvider } from 'react-native-paper';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { useImportStore } from '@/import-export/store';
import { exportProgress } from '@/import-export/utils';

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { progress, customQuestions, resetProgress } = useImportStore();

  const [isExporting, setIsExporting] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      await exportProgress();
    } catch {
      Alert.alert('Export Failed', 'Could not export progress. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  function handleReset() {
    Alert.alert(
      'Reset Progress',
      'This will clear all progress, badges, and stats. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await resetProgress();
              Alert.alert('Progress Reset', 'All progress has been cleared.');
            } catch {
              Alert.alert('Reset Failed', 'Could not reset progress.');
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <PaperProvider>
      <Stack.Screen options={{ title: 'Export Progress' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
      >
        <Text style={[styles.title, { color: theme.text }]}>Export Progress</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Download your progress as JSON or reset all data
        </Text>

        <View style={styles.divider} />

        <View style={styles.statsCard}>
          <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>Total Points</Text>
          <Text style={[styles.statValue, { color: theme.primary }]}>{progress.totalPoints}</Text>
          <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>Streak</Text>
          <Text style={[styles.statValue, { color: theme.primary }]}>{progress.streak} days</Text>
          <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>Badges</Text>
          <Text style={[styles.statValue, { color: theme.primary }]}>{progress.badgeIds.length}</Text>
          <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>Questions Completed</Text>
          <Text style={[styles.statValue, { color: theme.primary }]}>
            {Object.values(progress.questionProgress).filter(r => r.completed).length}
          </Text>
          {customQuestions.length > 0 && (
            <Text style={[styles.customLabel, { color: theme.onSurfaceVariant }]}>
              Custom Questions: {customQuestions.length}
            </Text>
          )}
        </View>

        <Button
          mode="contained"
          onPress={handleExport}
          disabled={isExporting}
          style={[styles.button, { backgroundColor: theme.primary }]}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          {isExporting ? <ActivityIndicator color="#0D1117" /> : 'Export Progress (JSON)'}
        </Button>

        <View style={styles.divider} />

        <Button
          mode="outlined"
          onPress={handleReset}
          disabled={isResetting}
          style={[styles.resetButton, { borderColor: '#F85149' }]}
          labelStyle={[styles.buttonLabel, { color: '#F85149' }]}
        >
          {isResetting ? <ActivityIndicator size="small" color="#F85149" /> : 'Reset All Progress'}
        </Button>
      </ScrollView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  title: { fontSize: 24, fontWeight: '700', marginBottom: Spacing.one },
  subtitle: { fontSize: 14, marginBottom: Spacing.four },
  divider: { height: 1, marginVertical: Spacing.three },
  statsCard: {
    backgroundColor: 'rgba(63, 185, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.2)',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  statLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 20, fontWeight: '700' },
  customLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.one },
  button: { marginBottom: Spacing.three },
  buttonContent: { paddingVertical: Spacing.two },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  resetButton: { marginTop: Spacing.two },
});
