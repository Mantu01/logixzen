import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { useImportStore } from '@/import-export/store';

interface Props {
  questionId: string;
  score: number;
  maxScore: number;
}

export default function QuestionCompleteModal({ questionId, score, maxScore }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { markQuestionComplete, progress } = useImportStore();

  const [isSaving, setIsSaving] = React.useState(false);
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  async function handleContinue() {
    setIsSaving(true);
    try {
      await markQuestionComplete(questionId, score);
      router.back();
    } catch {
      router.back();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PaperProvider>
      <Stack.Screen options={{ title: 'Question Complete' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
      >
        <Text style={[styles.title, { color: theme.text }]}>Question Complete!</Text>

        <View style={styles.scoreCircle}>
          <Text style={[styles.scoreValue, { color: theme.primary }]}>{percentage}%</Text>
          <Text style={[styles.scoreSub, { color: theme.onSurfaceVariant }]}>
            {score}/{maxScore} points
          </Text>
        </View>

        {progress.totalPoints > 0 && (
          <View style={styles.streakBox}>
            <Text style={[styles.streakLabel, { color: theme.onSurfaceVariant }]}>Total Points</Text>
            <Text style={[styles.streakValue, { color: theme.primary }]}>{progress.totalPoints}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: theme.primary }]}
          onPress={handleContinue}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <Text style={styles.continueButtonText}>Saving...</Text>
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.six, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: Spacing.four, textAlign: 'center' },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(63, 185, 80, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  scoreValue: { fontSize: 32, fontWeight: '700' },
  scoreSub: { fontSize: 12, marginTop: Spacing.half },
  streakBox: {
    backgroundColor: 'rgba(63, 185, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.2)',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.four,
    width: '100%',
  },
  streakLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  streakValue: { fontSize: 18, fontWeight: '700' },
  continueButton: {
    width: '100%',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  continueButtonText: { color: '#0D1117', fontSize: 16, fontWeight: '600' },
});
