import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Provider as PaperProvider, useTheme as usePaperTheme } from 'react-native-paper';
import { Spacing } from '@/constants/theme';
import { useImportStore } from '@/import-export/store';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const paper = usePaperTheme();
  const { customQuestions, customTopics, customDatasets } = useImportStore();

  return (
    <PaperProvider>
      <Stack.Screen options={{ title: 'Explore Topics' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: paper.colors.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
      >
        <Text style={[styles.title, { color: paper.colors.onBackground }]}>Topics</Text>

        {customTopics.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: paper.colors.onSurfaceVariant }]}>
              No custom topics yet. Import content to get started.
            </Text>
          </View>
        ) : (
          customTopics.map((topic) => (
            <View key={topic.id} style={[styles.topicCard, { backgroundColor: paper.colors.surface, borderColor: paper.colors.outlineVariant }]}>
              <Text style={[styles.topicTitle, { color: paper.colors.onBackground }]}>{topic.title}</Text>
              {topic.description && (
                <Text style={[styles.topicDesc, { color: paper.colors.onSurfaceVariant }]}>
                  {topic.description}
                </Text>
              )}
              <Text style={[styles.topicCount, { color: paper.colors.primary }]}>
                {customQuestions.filter(q => q.topicId === topic.id).length} questions
              </Text>
            </View>
          ))
        )}

        {customDatasets.length > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: paper.colors.outlineVariant }]} />
            <Text style={[styles.sectionTitle, { color: paper.colors.onBackground }]}>Datasets</Text>
            {customDatasets.map((dataset) => (
              <View key={dataset.id} style={[styles.datasetCard, { backgroundColor: paper.colors.surface, borderColor: paper.colors.outlineVariant }]}>
                <Text style={[styles.datasetName, { color: paper.colors.onBackground }]}>{dataset.name}</Text>
                <Text style={[styles.datasetDesc, { color: paper.colors.onSurfaceVariant }]}>
                  {dataset.description}
                </Text>
                <Text style={[styles.datasetCount, { color: paper.colors.primary }]}>
                  {dataset.tables.length} tables
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  title: { fontSize: 24, fontWeight: '700', marginBottom: Spacing.three },
  topicCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  topicTitle: { fontSize: 16, fontWeight: '600' },
  topicDesc: { fontSize: 12, marginTop: Spacing.half },
  topicCount: { fontSize: 12, marginTop: Spacing.one, fontWeight: '600' },
  datasetCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  datasetName: { fontSize: 14, fontWeight: '600' },
  datasetDesc: { fontSize: 12, marginTop: Spacing.half },
  datasetCount: { fontSize: 12, marginTop: Spacing.one, fontWeight: '600' },
  divider: { height: 1, marginVertical: Spacing.three },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: Spacing.two },
  emptyState: { padding: Spacing.four, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
