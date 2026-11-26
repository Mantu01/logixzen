import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { DatasetSchema, QuestionSchema } from './schemas'
import type { Dataset, Topic, Question } from './schemas'
import { TOPICS_META } from './meta'

const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')
const CONTENT_BASE = join(__dirname, '../../content')

function readJson<T>(relativePath: string): T {
  const absolutePath = join(CONTENT_BASE, relativePath)
  const raw = readFileSync(absolutePath, 'utf-8')
  return JSON.parse(raw) as T
}

const datasetCache = new Map<string, Dataset>()
const questionCache = new Map<string, Question[]>()

export function loadDataset(id: string): Dataset {
  const cached = datasetCache.get(id)
  if (cached !== undefined) return cached

  const raw = readJson<Dataset>(`datasets/${id}.json`)
  const dataset = DatasetSchema.parse(raw)
  datasetCache.set(id, dataset)
  return dataset
}

export function loadAllDatasets(): Dataset[] {
  if (datasetCache.size > 0) return Array.from(datasetCache.values())

  const ids = ['school']
  const results: Dataset[] = []
  for (const id of ids) {
    try {
      results.push(loadDataset(id))
    } catch {
    }
  }
  return results
}

export const loadDatasets = loadAllDatasets

export function loadQuestions(topicId: string): Question[] {
  const cached = questionCache.get(topicId)
  if (cached !== undefined) return cached

  const raw = readJson<Question[]>(`questions/${topicId}.json`)
  const questions = raw.map((q: unknown) => QuestionSchema.parse(q))
  questionCache.set(topicId, questions)
  return questions
}

export function loadTopics(): Topic[] {
  return TOPICS_META.slice().sort((a, b) => a.order - b.order)
}

export function getCacheStats(): { datasets: number; questions: number } {
  return { datasets: datasetCache.size, questions: questionCache.size }
}

export function invalidateCache(topicId?: string): void {
  if (topicId !== undefined) {
    questionCache.delete(topicId)
  } else {
    questionCache.clear()
  }
}
