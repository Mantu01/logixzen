import { useProgressStore } from '@/stores/useProgressStore'
import { BADGE_DEFINITIONS } from './badgeDefinitions'

export function useBadgeCheck(): Map<string, boolean> {
  const { solvedQuestions, streak, totalPoints } = useProgressStore()

  const snapshot = {
    solvedQuestions: solvedQuestions.size,
    streak: { currentStreak: streak.currentStreak },
    totalPoints,
  }

  const earned = new Map<string, boolean>()
  for (const badge of BADGE_DEFINITIONS) {
    earned.set(badge.id, badge.condition(snapshot))
  }

  return earned
}

export function checkBadgeUnlocks(prevCount: number, newCount: number): string[] {
  const unlocks: string[] = []
  for (const badge of BADGE_DEFINITIONS) {
    const prevSnapshot = { solvedQuestions: prevCount, streak: { currentStreak: 0 }, totalPoints: 0 }
    const newSnapshot = { solvedQuestions: newCount, streak: { currentStreak: 0 }, totalPoints: 0 }

    if (!badge.condition(prevSnapshot) && badge.condition(newSnapshot)) {
      unlocks.push(badge.id)
    }
  }
  return unlocks
}
