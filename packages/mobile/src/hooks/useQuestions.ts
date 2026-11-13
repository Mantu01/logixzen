import { loadQuestions, loadAllDatasets, loadTopics, checkSafety } from '@logixzen/shared/content'
import type { Question, Dataset, Topic } from '@logixzen/shared/content'

export async function loadQuestion(topicId: string, questionId: string): Promise<Question | null> {
  const questions = await loadQuestions(topicId)
  return questions.find((q) => q.id === questionId) ?? null
}

export async function loadDatasetForQuestion(question: Question): Promise<Dataset | null> {
  const datasets = await loadAllDatasets()
  return datasets.find((d) => d.id === question.datasetId) ?? null
}

export async function getQuestionsForTopic(topicId: string): Promise<Question[]> {
  return loadQuestions(topicId)
}

export async function getAllTopics(): Promise<Topic[]> {
  return loadTopics()
}

export { checkSafety }
