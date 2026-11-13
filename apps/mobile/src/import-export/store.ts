import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { UserProgress, ProgressRecord } from '@logixzen/shared';
import type { ImportedDataset, ImportedTopic, ImportedQuestion } from './schemas';

const PROGRESS_KEY = 'logixzen_progress';
const CUSTOM_DATASETS_KEY = 'logixzen_custom_datasets';
const CUSTOM_TOPICS_KEY = 'logixzen_custom_topics';
const CUSTOM_QUESTIONS_KEY = 'logixzen_custom_questions';

const DEFAULT_PROGRESS: UserProgress = {
  userId: 'local-user',
  totalPoints: 0,
  streak: 0,
  lastActiveAt: new Date().toISOString(),
  badgeIds: [],
  questionProgress: {},
  topicProgress: {},
};

interface ImportPreview {
  datasets: ImportedDataset[];
  topics: ImportedTopic[];
  questions: ImportedQuestion[];
  datasetCount: number;
  topicCount: number;
  questionCount: number;
}

interface ImportState {
  importPreview: ImportPreview | null;
  isImporting: boolean;
  importError: string | null;

  progress: UserProgress;
  loadProgress: () => Promise<void>;
  markQuestionComplete: (questionId: string, score: number) => Promise<void>;
  resetProgress: () => Promise<void>;

  customDatasets: ImportedDataset[];
  customTopics: ImportedTopic[];
  customQuestions: ImportedQuestion[];
  loadCustomContent: () => Promise<void>;
  saveCustomContent: (data: ImportPreview) => Promise<void>;
  clearCustomContent: () => Promise<void>;

  setImportPreview: (preview: ImportPreview | null) => void;
  setIsImporting: (isImporting: boolean) => void;
  setImportError: (error: string | null) => void;
}

export const useImportStore = create<ImportState>((set, get) => ({
  importPreview: null,
  isImporting: false,
  importError: null,
  progress: DEFAULT_PROGRESS,
  customDatasets: [],
  customTopics: [],
  customQuestions: [],

  setImportPreview: (importPreview) => set({ importPreview }),
  setIsImporting: (isImporting) => set({ isImporting }),
  setImportError: (importError) => set({ importError }),

  loadProgress: async () => {
    try {
      const stored = await AsyncStorage.getItem(PROGRESS_KEY);
      if (stored) {
        set({ progress: JSON.parse(stored) });
      }
    } catch {
      // use default
    }
  },

  markQuestionComplete: async (questionId: string, score: number) => {
    const { progress, customQuestions } = get();
    const now = new Date().toISOString();
    const existing = progress.questionProgress[questionId];

    const updatedQuestionProgress = {
      ...progress.questionProgress,
      [questionId]: {
        questionId,
        completed: true,
        attempts: (existing?.attempts ?? 0) + 1,
        bestScore: Math.max(score, existing?.bestScore ?? 0),
        lastAttemptAt: now,
      } as ProgressRecord,
    };

    const totalPoints = Object.values(updatedQuestionProgress)
      .filter((r) => r.completed)
      .reduce((sum, r) => sum + r.bestScore, 0);

    const newProgress: UserProgress = {
      ...progress,
      totalPoints,
      lastActiveAt: now,
      questionProgress: updatedQuestionProgress,
    };

    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(newProgress));
    set({ progress: newProgress });
  },

  resetProgress: async () => {
    await AsyncStorage.removeItem(PROGRESS_KEY);
    set({ progress: DEFAULT_PROGRESS });
  },

  loadCustomContent: async () => {
    try {
      const [datasets, topics, questions] = await Promise.all([
        AsyncStorage.getItem(CUSTOM_DATASETS_KEY),
        AsyncStorage.getItem(CUSTOM_TOPICS_KEY),
        AsyncStorage.getItem(CUSTOM_QUESTIONS_KEY),
      ]);
      set({
        customDatasets: datasets ? JSON.parse(datasets) : [],
        customTopics: topics ? JSON.parse(topics) : [],
        customQuestions: questions ? JSON.parse(questions) : [],
      });
    } catch {
      set({ customDatasets: [], customTopics: [], customQuestions: [] });
    }
  },

  saveCustomContent: async (data: ImportPreview) => {
    await Promise.all([
      AsyncStorage.setItem(CUSTOM_DATASETS_KEY, JSON.stringify(data.datasets)),
      AsyncStorage.setItem(CUSTOM_TOPICS_KEY, JSON.stringify(data.topics)),
      AsyncStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(data.questions)),
    ]);
    set({
      customDatasets: data.datasets,
      customTopics: data.topics,
      customQuestions: data.questions,
    });
  },

  clearCustomContent: async () => {
    await Promise.all([
      AsyncStorage.removeItem(CUSTOM_DATASETS_KEY),
      AsyncStorage.removeItem(CUSTOM_TOPICS_KEY),
      AsyncStorage.removeItem(CUSTOM_QUESTIONS_KEY),
    ]);
    set({ customDatasets: [], customTopics: [], customQuestions: [] });
  },
}));
