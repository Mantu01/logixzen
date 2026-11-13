import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Button, Chip, Dialog, Portal, Provider as PaperProvider, RadioButton } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { useImportStore } from '@/import-export/store';
import { pickJsonFile, validateImport, saveImportedContent } from '@/import-export/utils';
import type { ImportedDataset, ImportedTopic, ImportedQuestion, ImportValidationResult } from '@/import-export/schemas';

export default function ImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { importPreview, isImporting, importError, setImportPreview, setIsImporting, setImportError, customDatasets, customTopics, customQuestions } = useImportStore();

  const [mergeMode, setMergeMode] = React.useState<'merge' | 'replace'>('merge');
  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<ImportValidationResult | null>(null);

  async function handlePickFile() {
    setImportError(null);
    setValidationResult(null);
    const contents = await pickJsonFile();
    if (!contents) return;

    setIsImporting(true);
    try {
      const parsed = JSON.parse(contents);
      const result = validateImport(parsed);
      setValidationResult(result);

      if (!result.valid) {
        setImportError(result.errors.map(e => `${e.path}: ${e.message}`).join('\n'));
        Alert.alert('Invalid File', 'The selected file does not match the LogixZen import format.');
        return;
      }

      const datasets: ImportedDataset[] = parsed.datasets ?? [];
      const topics: ImportedTopic[] = parsed.topics ?? [];
      const questions: ImportedQuestion[] = parsed.questions ?? [];

      setImportPreview({ datasets, topics, questions, datasetCount: datasets.length, topicCount: topics.length, questionCount: questions.length });
      setShowPreviewDialog(true);
    } catch (err) {
      setImportError('Failed to parse JSON file.');
      Alert.alert('Parse Error', 'The selected file is not valid JSON.');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleImport() {
    if (!importPreview) return;
    setIsImporting(true);
    try {
      if (mergeMode === 'merge') {
        const mergedDatasets = [...customDatasets, ...importPreview.datasets.filter(d => !customDatasets.some(cd => cd.id === d.id))];
        const mergedTopics = [...customTopics, ...importPreview.topics.filter(t => !customTopics.some(ct => ct.id === t.id))];
        const mergedQuestions = [...customQuestions, ...importPreview.questions.filter(q => !customQuestions.some(cq => cq.id === q.id))];
        await saveImportedContent({ datasets: mergedDatasets, topics: mergedTopics, questions: mergedQuestions });
      } else {
        await saveImportedContent(importPreview);
      }
      setShowPreviewDialog(false);
      setImportPreview(null);
      setValidationResult(null);
      Alert.alert('Import Complete', `Successfully imported ${importPreview.questionCount} questions.`);
      router.back();
    } catch {
      setImportError('Failed to save imported content.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <PaperProvider>
      <Stack.Screen options={{ title: 'Import Content' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
      >
        <Text style={[styles.title, { color: theme.text }]}>Import Content</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Import custom question packs (JSON format)
        </Text>

        <View style={styles.divider} />

        <Button
          mode="contained"
          onPress={handlePickFile}
          disabled={isImporting}
          style={[styles.button, { backgroundColor: theme.primary }]}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          {isImporting ? <ActivityIndicator color="#0D1117" /> : 'Select JSON File'}
        </Button>

        {importError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{importError}</Text>
          </View>
        )}

        {customQuestions.length > 0 && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Existing Custom Content</Text>
            <View style={styles.chipRow}>
              <Chip style={[styles.chip, { backgroundColor: theme.surfaceVariant }]}>
                {customDatasets.length} datasets
              </Chip>
              <Chip style={[styles.chip, { backgroundColor: theme.surfaceVariant }]}>
                {customTopics.length} topics
              </Chip>
              <Chip style={[styles.chip, { backgroundColor: theme.primaryContainer }]}>
                {customQuestions.length} questions
              </Chip>
            </View>
          </View>
        )}

        <Portal>
          <Dialog
            visible={showPreviewDialog}
            onDismiss={() => setShowPreviewDialog(false)}
            style={styles.dialog}
          >
            <Dialog.Title style={[styles.dialogTitle, { color: theme.text }]}>Import Preview</Dialog.Title>
            <Dialog.Content>
              {importPreview && (
                <>
                  <Text style={[styles.previewText, { color: theme.onSurfaceVariant }]}>
                    {importPreview.questionCount} questions · {importPreview.topicCount} topics · {importPreview.datasetCount} datasets
                  </Text>
                  <View style={styles.mergeOption}>
                    <RadioButton
                      value="merge"
                      status={mergeMode === 'merge' ? 'checked' : 'unchecked'}
                      onPress={() => setMergeMode('merge')}
                      color={theme.primary}
                    />
                    <Text style={[styles.mergeLabel, { color: theme.onSurfaceVariant }]}>Merge with existing</Text>
                  </View>
                  <View style={styles.mergeOption}>
                    <RadioButton
                      value="replace"
                      status={mergeMode === 'replace' ? 'checked' : 'unchecked'}
                      onPress={() => setMergeMode('replace')}
                      color={theme.primary}
                    />
                    <Text style={[styles.mergeLabel, { color: theme.onSurfaceVariant }]}>Replace all custom content</Text>
                  </View>
                </>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowPreviewDialog(false)} style={styles.dialogButton}>
                Cancel
              </Button>
              <Button onPress={handleImport} disabled={isImporting} style={[styles.dialogButton, { backgroundColor: theme.primary }]}>
                {isImporting ? <ActivityIndicator size="small" color="#0D1117" /> : 'Import'}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScrollView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  title: { fontSize: 24, fontWeight: '700', marginBottom: Spacing.one },
  subtitle: { fontSize: 14, marginBottom: Spacing.four },
  divider: { height: 1, marginBottom: Spacing.four },
  button: { marginBottom: Spacing.three },
  buttonContent: { paddingVertical: Spacing.two },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  errorBox: {
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderWidth: 1,
    borderColor: '#F85149',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  errorText: { color: '#F85149', fontSize: 13 },
  infoBox: {
    backgroundColor: 'rgba(63, 185, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.3)',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  infoTitle: { color: '#3FB950', fontSize: 13, fontWeight: '600', marginBottom: Spacing.one },
  chipRow: { flexDirection: 'row', gap: Spacing.one },
  chip: { marginRight: Spacing.one },
  dialog: { borderRadius: Spacing.two },
  dialogTitle: { fontSize: 18, fontWeight: '600' },
  previewText: { fontSize: 14, marginBottom: Spacing.three },
  mergeOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  mergeLabel: { fontSize: 14 },
  dialogButton: { marginLeft: Spacing.one },
});
