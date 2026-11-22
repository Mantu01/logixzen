import type { Dataset, Question, Topic } from "@logixzen/shared/content";

export type PackKind = "databases" | "questions" | "notes" | "bundle";

export interface DatabasePack {
  version: number;
  datasets: Dataset[];
}

export interface QuestionsPack {
  version: number;
  topics?: Topic[];
  questions: Question[];
}

export interface Note {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
}

export interface NotesPack {
  version: number;
  notes: Note[];
}

export interface BundlePack {
  version: number;
  datasets?: Dataset[];
  questions?: Question[];
  topics?: Topic[];
  notes?: Note[];
}

export type PackFile = DatabasePack | QuestionsPack | NotesPack | BundlePack;

export interface PackIssue {
  path: string;
  message: string;
}

export interface PackParseResult<T> {
  ok: boolean;
  data: T | null;
  issues: PackIssue[];
}

export interface PackSummary {
  databases: number;
  questions: number;
  topics: number;
  notes: number;
  categories: number;
}
