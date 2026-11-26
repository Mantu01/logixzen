import type { Question } from "@logixzen/shared/content";
import type { GradeResult } from "@/features/learn/hooks/useGrading";
import { SUBJECT_REGISTRY, type SubjectId } from "@/lib/subjects";

export interface PracticeProvider {
  readonly subjectId: SubjectId;
  readonly label: string;
  readonly available: boolean;
  canEvaluate(question: Question): boolean;
  evaluateLocal?(question: Question, answer: string): GradeResult;
}

const PROVIDERS = new Map<string, PracticeProvider>();

export function registerPracticeProvider(provider: PracticeProvider): void {
  PROVIDERS.set(provider.subjectId, provider);
}

export function getPracticeProvider(
  subjectId: string,
): PracticeProvider | undefined {
  return PROVIDERS.get(subjectId);
}

export function listPracticeProviders(): PracticeProvider[] {
  return SUBJECT_REGISTRY.map((subject) => {
    const existing = PROVIDERS.get(subject.id);
    if (existing) return existing;
    return {
      subjectId: subject.id,
      label: subject.label,
      available: subject.state === "available",
      canEvaluate: () => false,
    };
  });
}

const SQL_QUESTION_TYPES = new Set<Question["type"]>([
  "query",
  "fill-blank",
  "predict-output",
  "dml-check",
  "mcq-single",
  "mcq-multi",
  "debug-query",
]);

registerPracticeProvider({
  subjectId: "sql",
  label: "SQL",
  available: true,
  canEvaluate: (question) => SQL_QUESTION_TYPES.has(question.type),
});
