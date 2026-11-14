import { useCallback, useState } from "react";
import { compareResults } from "@logixzen/shared/sql-engine";
import type { SqlResult } from "@/shared/desktop-api";
import type { Question } from "@logixzen/shared/content";
import { usePackStore } from "@/stores/usePackStore";

export interface TestCaseResult {
  id: string;
  label: string;
  passed: boolean;
  hidden: boolean;
  message?: string;
}

export interface GradeResult {
  passed: boolean;
  testCases: TestCaseResult[];
  pointsEarned: number;
  totalTimeMs: number;
}

const EMPTY_RESULT: SqlResult = {
  columns: [],
  rows: [],
  rowsAffected: 0,
  statementIndex: 0,
  isSelect: false,
  executionTimeMs: 0,
};

function pickResult(results: SqlResult[]): SqlResult {
  const ok = results.filter((result) => result.error === undefined);
  const select = ok.filter((result) => result.isSelect && result.columns.length > 0);
  return select.at(-1) ?? ok.at(-1) ?? results[0] ?? EMPTY_RESULT;
}

export function useGrading(question: Question | null): {
  grade: (answer: string) => Promise<GradeResult>;
  isGrading: boolean;
  runAnswer: (answer: string) => Promise<SqlResult[]>;
} {
  const [isGrading, setIsGrading] = useState(false);

  const runAnswer = useCallback(async (answer: string): Promise<SqlResult[]> => {
    const dataset = findDataset(question);
    if (!dataset || window.logixzen === undefined) return [];
    return window.logixzen.database.isolatedRun(dataset.setupSql, answer);
  }, [question]);

  const grade = useCallback(
    async (answer: string): Promise<GradeResult> => {
      setIsGrading(true);
      const started = performance.now();
      try {
        return await gradeQuestion(question, answer, started);
      } finally {
        setIsGrading(false);
      }
    },
    [question],
  );

  return { grade, isGrading, runAnswer };
}

function findDataset(question: Question | null) {
  if (!question) return null;
  const databases = usePackStore.getState().databases;
  return databases.find((item) => item.id === question.datasetId) ?? null;
}

async function gradeQuestion(
  question: Question | null,
  answer: string,
  started: number,
): Promise<GradeResult> {
  if (!question) {
    return failed("no-question", "No question is loaded", started);
  }

  if (question.type === "mcq-single") {
    const passed = answer === question.correctOptionId;
    return {
      passed,
      testCases: [singleCase("answer", "Correct option", passed, passed ? undefined : "Selected option is wrong.")],
      pointsEarned: passed ? question.points : 0,
      totalTimeMs: performance.now() - started,
    };
  }

  if (question.type === "mcq-multi") {
    const selected = new Set(answer.split(",").filter(Boolean));
    const correct = new Set(question.correctOptionIds);
    const passed = selected.size === correct.size && Array.from(correct).every((id) => selected.has(id));
    return {
      passed,
      testCases: [singleCase("answer", "Correct selection", passed, passed ? undefined : "Select every correct option, and only those.")],
      pointsEarned: passed ? question.points : 0,
      totalTimeMs: performance.now() - started,
    };
  }

  if (question.type === "fill-blank") {
    const submitted = answer.split("|").map((part) => part.trim());
    const cases = Object.entries(question.acceptedAnswers).map(([position, accepted]) => {
      const index = Number(position);
      const value = submitted[Number.isNaN(index) ? submitted.length : index] ?? "";
      const passed = accepted.some((option) => option.toLowerCase() === value.toLowerCase());
      return singleCase(`blank-${position}`, `Blank ${position}`, passed, passed ? undefined : `Blank ${position} is wrong.`);
    });
    const passed = cases.every((testCase) => testCase.passed);
    return {
      passed,
      testCases: cases,
      pointsEarned: passed ? question.points : 0,
      totalTimeMs: performance.now() - started,
    };
  }

  const dataset = findDataset(question);
  if (!dataset) {
    return failed("dataset", `Dataset "${question.datasetId}" not found. Import the databases pack first.`, started);
  }
  const bridge = window.logixzen;
  if (bridge === undefined) {
    return failed("bridge", "Desktop bridge unavailable. Run the Electron app.", started);
  }

  if (question.type === "dml-check") {
    const results = await bridge.database.isolatedRun(
      dataset.setupSql,
      `${stripTrailingSemicolon(question.dmlStatement)};\n${question.verificationQuery}`,
    );
    const affected = results.reduce((total, result) => total + result.rowsAffected, 0);
    const verification = pickResult(results);
    const failedStatement = results.find((result) => result.error !== undefined);
    const passed = failedStatement === undefined && affected === question.expectedChanges && verification.error === undefined;
    return {
      passed,
      testCases: [
        singleCase(
          "rows-affected",
          `Affects ${question.expectedChanges} rows`,
          passed,
          failedStatement?.error ?? verification.error ?? (passed ? undefined : `Expected ${question.expectedChanges} affected rows, got ${affected}.`),
        ),
      ],
      pointsEarned: passed ? question.points : 0,
      totalTimeMs: performance.now() - started,
    };
  }

  if (question.type === "predict-output") {
    const actual = pickResult(await bridge.database.isolatedRun(dataset.setupSql, answer));
    const expectedColumns = Object.keys(question.expectedOutput[0] ?? {});
    const expected: SqlResult = {
      ...EMPTY_RESULT,
      columns: expectedColumns,
      rows: question.expectedOutput.map((row) => {
        const record: Record<string, unknown> = {};
        for (const column of expectedColumns) record[column] = row[column];
        return record;
      }),
      isSelect: true,
    };
    const comparison = compareResults(actual, expected, {
      orderMatters: question.validation.orderMatters,
      columnNamesMatter: false,
      floatTolerance: question.validation.floatTolerance,
      caseSensitiveStrings: question.validation.caseSensitiveStrings,
    });
    return {
      passed: comparison.match,
      testCases: [singleCase("output", "Predicted output", comparison.match, comparison.message)],
      pointsEarned: comparison.match ? question.points : 0,
      totalTimeMs: performance.now() - started,
    };
  }

  const typed = question;
  if (!("solutionSql" in typed)) {
    return failed("solution", "This question has no reference solution.", started);
  }

  const cases: TestCaseResult[] = [];
  let anyFailed = false;
  for (const testCase of typed.testCases) {
    const label = testCase.description ?? `Case ${testCase.id}`;
    let actual: SqlResult;
    let expected: SqlResult;
    let failure: string | undefined;

    const answerResults = await bridge.database.isolatedRun(dataset.setupSql, answer);
    const answerError = answerResults.find((result) => result.error !== undefined);
    if (answerError) {
      actual = answerError;
      expected = EMPTY_RESULT;
      failure = answerError.error;
    } else if (testCase.expected.type === "fromSolution") {
      const solutionResults = await bridge.database.isolatedRun(dataset.setupSql, typed.solutionSql);
      const solutionError = solutionResults.find((result) => result.error !== undefined);
      if (solutionError) {
        actual = answerResults[0] ?? EMPTY_RESULT;
        expected = EMPTY_RESULT;
        failure = `Reference solution failed: ${solutionError.error}`;
      } else {
        actual = pickResult(answerResults);
        expected = pickResult(solutionResults);
      }
    } else {
      actual = pickResult(answerResults);
      const literal = testCase.expected.type === "literal" ? testCase.expected : null;
      expected = {
        ...EMPTY_RESULT,
        columns: literal?.columns ?? [],
        rows: (literal?.rows ?? []).map((row) => {
          const record: Record<string, unknown> = {};
          literal?.columns.forEach((column, index) => {
            record[column] = row[index];
          });
          return record;
        }),
        isSelect: true,
      };
    }

    const comparison = failure === undefined
      ? compareResults(actual, expected, {
          orderMatters: typed.validation.orderMatters,
          columnNamesMatter: typed.validation.columnNamesMatter,
          floatTolerance: typed.validation.floatTolerance,
          caseSensitiveStrings: typed.validation.caseSensitiveStrings,
        })
      : { match: false, message: failure };

    if (!comparison.match) anyFailed = true;
    cases.push({
      id: testCase.id,
      label: testCase.hidden ? `${label} (hidden)` : label,
      passed: comparison.match,
      hidden: testCase.hidden,
      message: comparison.match ? undefined : comparison.message,
    });
  }

  const passed = !anyFailed;
  return {
    passed,
    testCases: cases,
    pointsEarned: passed ? question.points : 0,
    totalTimeMs: performance.now() - started,
  };
}

function singleCase(id: string, label: string, passed: boolean, message?: string): TestCaseResult {
  return { id, label, passed, hidden: false, message: passed ? undefined : message };
}

function failed(id: string, message: string, started: number): GradeResult {
  return {
    passed: false,
    testCases: [singleCase(id, "Setup", false, message)],
    pointsEarned: 0,
    totalTimeMs: performance.now() - started,
  };
}

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;+\s*$/, "");
}
