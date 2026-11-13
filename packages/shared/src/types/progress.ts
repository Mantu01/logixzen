export interface ProgressRecord {
  questionId: string
  completed: boolean
  attempts: number
  bestScore: number
  lastAttemptAt: string
}

export interface TopicProgress {
  topicId: string
  totalQuestions: number
  completedQuestions: number
  averageScore: number
}

export interface UserProgress {
  userId: string
  totalPoints: number
  streak: number
  lastActiveAt: string
  badgeIds: string[]
  questionProgress: Record<string, ProgressRecord>
  topicProgress: Record<string, TopicProgress>
}
