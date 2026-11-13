export interface BadgeDefinition {
  id: string
  title: string
  description: string
  icon: string
  condition: (state: ProgressStateSnapshot) => boolean
}

export interface ProgressStateSnapshot {
  solvedQuestions: number
  streak: { currentStreak: number }
  totalPoints: number
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first-query',
    title: 'First Query',
    description: 'Solve your first question',
    icon: 'rocket',
    condition: (state) => state.solvedQuestions >= 1,
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Solve 10 questions',
    icon: 'star',
    condition: (state) => state.solvedQuestions >= 10,
  },
  {
    id: 'sql-explorer',
    title: 'SQL Explorer',
    description: 'Solve 50 questions',
    icon: 'compass',
    condition: (state) => state.solvedQuestions >= 50,
  },
  {
    id: 'sql-master',
    title: 'SQL Master',
    description: 'Solve 100 questions',
    icon: 'crown',
    condition: (state) => state.solvedQuestions >= 100,
  },
  {
    id: '3-day-streak',
    title: '3-Day Streak',
    description: 'Maintain a 3-day streak',
    icon: 'fire',
    condition: (state) => state.streak.currentStreak >= 3,
  },
  {
    id: 'week-warrior',
    title: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: 'shield',
    condition: (state) => state.streak.currentStreak >= 7,
  },
  {
    id: 'point-collector',
    title: 'Point Collector',
    description: 'Earn 500 points',
    icon: 'coins',
    condition: (state) => state.totalPoints >= 500,
  },
  {
    id: 'dedicated-practitioner',
    title: 'Dedicated Practitioner',
    description: 'Earn 1000 points',
    icon: 'medal',
    condition: (state) => state.totalPoints >= 1000,
  },
]
