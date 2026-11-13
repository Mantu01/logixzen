import type { Dataset, Question } from '@logixzen/shared/content'

// Browser-compatible loader with cache
const datasetCache = new Map<string, Dataset>()
const questionCache = new Map<string, Question[]>()

export async function loadDatasetsCached(): Promise<Dataset[]> {
  if (datasetCache.size > 0) return Array.from(datasetCache.values())

  const response: Response = await fetch('/api/content')
  if (!response.ok) throw new Error('Failed to load datasets')
  const data = await response.json() as { datasets: Dataset[] }
  for (const dataset of data.datasets) {
    datasetCache.set(dataset.id, dataset)
  }
  return Array.from(datasetCache.values())
}

export async function loadQuestionsCached(topicId: string): Promise<Question[]> {
  if (questionCache.has(topicId)) return questionCache.get(topicId)!

  const response: Response = await fetch(`/api/content/${encodeURIComponent(topicId)}`)
  if (!response.ok) throw new Error(`Failed to load questions for ${topicId}`)
  const data: Question[] = await response.json()
  questionCache.set(topicId, data)
  return data
}

export function invalidateQuestionCache(topicId?: string): void {
  if (topicId !== undefined) {
    questionCache.delete(topicId)
  } else {
    questionCache.clear()
  }
}
