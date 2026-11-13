import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { z } from 'zod';
import type { ImportValidationResult, ImportedDataset, ImportedTopic, ImportedQuestion } from './schemas';
import { LogixZenImportSchema, IMPORT_FORMAT_VERSION } from './schemas';
import { useImportStore } from './store';

export async function pickJsonFile(): Promise<string | null> {
  try {
    const result = await FileSystem.StorageAccessFramework.pickDocument({
      mimeType: 'application/json',
    });
    const uri = result.uri;
    const contents = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return contents;
  } catch {
    // User cancelled or error
    return null;
  }
}

export function validateImport(data: unknown): ImportValidationResult {
  const result = LogixZenImportSchema.safeParse(data);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors: ImportValidationResult['errors'] = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

  return { valid: false, errors };
}

export async function exportProgress(): Promise<void> {
  const { progress } = useImportStore.getState();

  const exportData = {
    formatVersion: IMPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'logixzen-mobile',
    progress,
  };

  const json = JSON.stringify(exportData, null, 2);
  const fileName = `logixzen-progress-${Date.now()}.json`;

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    UTI: 'public.json',
  });
}

export async function saveImportedContent(preview: {
  datasets: ImportedDataset[];
  topics: ImportedTopic[];
  questions: ImportedQuestion[];
}): Promise<void> {
  await useImportStore.getState().saveCustomContent(preview);
}

export function getCombinedDatasets(
  bundled: ImportedDataset[],
  custom: ImportedDataset[]
): ImportedDataset[] {
  const existingIds = new Set(custom.map((d) => d.id));
  const newOnes = bundled.filter((d) => !existingIds.has(d.id));
  return [...custom, ...newOnes];
}

export function getCombinedTopics(
  bundled: ImportedTopic[],
  custom: ImportedTopic[]
): ImportedTopic[] {
  const existingIds = new Set(custom.map((t) => t.id));
  const newOnes = bundled.filter((t) => !existingIds.has(t.id));
  return [...custom, ...newOnes];
}

export function getCombinedQuestions(
  bundled: ImportedQuestion[],
  custom: ImportedQuestion[]
): ImportedQuestion[] {
  const existingIds = new Set(custom.map((q) => q.id));
  const newOnes = bundled.filter((q) => !existingIds.has(q.id));
  return [...custom, ...newOnes];
}
