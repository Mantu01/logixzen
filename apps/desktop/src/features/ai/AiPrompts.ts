import type { Question } from "@logixzen/shared/content";
import type { TableInfo } from "@/shared/desktop-api";

export interface PrivacySettings {
  sendSchemaOnly: boolean;
  sendHistory: boolean;
  sendProgress: boolean;
}

export interface ProgressDigest {
  solved: number;
  points: number;
  streak: number;
}

interface CommonRequest {
  question?: Question;
  sql?: string;
  privacySettings: PrivacySettings;
  schema?: TableInfo[];
  history?: string[];
  progress?: ProgressDigest;
}

export interface HintRequest extends CommonRequest {
  currentHintIndex: number;
  studentAttemptCount: number;
}

export interface ErrorExplanationRequest extends CommonRequest {
  errorMessage: string;
}

export interface QueryExplanationRequest extends CommonRequest {
  errorMessage?: string;
}

function schemaContext(tables: TableInfo[] | undefined): string {
  if (tables === undefined || tables.length === 0) return "";
  const lines = tables
    .slice(0, 20)
    .map(
      (table) =>
        `- ${table.name}(${table.columns.map((column) => `${column.name} ${column.type}`).join(", ")})`,
    );
  return `\nDatabase schema:\n${lines.join("\n")}\n`;
}

function historyContext(history: string[] | undefined): string {
  if (history === undefined || history.length === 0) return "";
  return `\nRecent queries from this session:\n${history
    .slice(-10)
    .map((query) => `- ${query}`)
    .join("\n")}\n`;
}

function progressContext(progress: ProgressDigest | undefined): string {
  if (progress === undefined) return "";
  return `\nStudent progress: ${progress.solved} questions solved, ${progress.points} points, ${progress.streak} day streak.\n`;
}

function contextBlock(request: CommonRequest): string {
  const parts: string[] = [];
  if (request.privacySettings.sendSchemaOnly)
    parts.push(schemaContext(request.schema));
  if (request.privacySettings.sendHistory)
    parts.push(historyContext(request.history));
  if (request.privacySettings.sendProgress)
    parts.push(progressContext(request.progress));
  return parts.join("");
}

export function buildHintPrompt(request: HintRequest): string {
  const { question, currentHintIndex, studentAttemptCount } = request;

  if (!question) {
    return "I need a question object to generate a hint.";
  }

  const hintContext =
    currentHintIndex > 0
      ? `\nThe student has already seen ${currentHintIndex} hint(s):\n${question.hints
          .slice(0, currentHintIndex)
          .map((hint, index) => `Hint ${index + 1}: ${hint}`)
          .join("\n")}`
      : "";

  return `You are a SQL tutor. The student is working on this question:

Title: ${question.title}
Difficulty: ${question.difficulty}
Description: ${question.description}
Hints available: ${question.hints.length}
${hintContext}${contextBlock(request)}
The student has made ${studentAttemptCount} attempt(s). Generate the NEXT hint (hint ${currentHintIndex + 1}) that:
1. Is not too obvious
2. Guides without giving away the answer
3. Is encouraging and supportive

Output ONLY the hint text, nothing else.`;
}

export function buildErrorExplanationPrompt(
  request: ErrorExplanationRequest,
): string {
  const { question, sql, errorMessage } = request;

  return `You are a SQL tutor. The student got an error running their query.
${contextBlock(request)}
Question: ${question?.title ?? "Unknown"}
Student's SQL: ${sql ?? "N/A"}
Error: ${errorMessage ?? "N/A"}

Explain the error in simple terms and suggest how to fix it. Keep the explanation under 3 sentences.`;
}

export function buildQueryExplanationPrompt(
  request: QueryExplanationRequest,
): string {
  const { question, sql } = request;

  return `You are a SQL tutor. Explain what this query does in simple terms.
${contextBlock(request)}
Question: ${question?.title ?? "Unknown"}
Student's SQL: ${sql ?? "N/A"}

Explain:
1. What the query returns
2. How it works step by step
3. Any important SQL concepts used

Keep it under 5 sentences.`;
}
