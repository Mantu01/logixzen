'use client'

import { useState } from 'react'
import { useProgressStore } from '@/stores/useProgressStore'
import { BADGE_DEFINITIONS } from '@/features/badges/badgeDefinitions'
import { useBadgeCheck } from '@/features/badges/useBadgeCheck'
import { Badge } from '@/features/learn/Badge'
import { Trophy, Flame, Star, ArrowRight, RefreshCw, Download, Upload } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ImportDialog } from '@/components/import/ImportDialog'

function StatCard({ label, value, icon }: {
  label: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-mono text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-mono text-xl font-bold">{value}</div>
    </div>
  )
}

export function ProgressContent(): React.ReactElement {
  const totalPoints = useProgressStore(s => s.totalPoints)
  const streak = useProgressStore(s => s.streak)
  const solvedQuestions = useProgressStore(s => s.solvedQuestions)
  const badges = useProgressStore(s => s.badges)
  const exportProgress = useProgressStore(s => s.exportProgress)
  const resetProgress = useProgressStore(s => s.resetProgress)
  const badgeChecks = useBadgeCheck()
  const [importOpen, setImportOpen] = useState(false)

  const handleExport = () => {
    const data = exportProgress()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logixzen-progress-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
      resetProgress()
    }
  }

  const earnedBadges = BADGE_DEFINITIONS.filter(b => badges.earned.has(b.id))

  const iconMap: Record<string, React.ReactNode> = {
    rocket: <ArrowRight className="w-4 h-4" />,
    star: <Star className="w-4 h-4" />,
    compass: <ArrowRight className="w-4 h-4 rotate-45" />,
    crown: <Trophy className="w-4 h-4" />,
    fire: <Flame className="w-4 h-4" />,
    shield: <Trophy className="w-4 h-4" />,
    coins: <Star className="w-4 h-4" />,
    medal: <Trophy className="w-4 h-4" />,
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader titleOverride="Progress" />
      <div className="page-content">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
          <StatCard label="Total Points" value={totalPoints} icon={<Star className="w-4 h-4 text-accent" />} />
          <StatCard label="Current Streak" value={`${streak.currentStreak} days`} icon={<Flame className="w-4 h-4 text-warning" />} />
          <StatCard label="Longest Streak" value={`${streak.longestStreak} days`} icon={<Flame className="w-4 h-4 text-error" />} />
          <StatCard label="Solved" value={solvedQuestions.size} icon={<Trophy className="w-4 h-4 text-success" />} />
        </div>

        {/* Badges Section */}
        <section className="mb-8">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted mb-4">
            Badges ({earnedBadges.length}/{BADGE_DEFINITIONS.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {BADGE_DEFINITIONS.map((badge) => {
              const isEarned = badges.earned.has(badge.id)
              const isUnlocked = badgeChecks.get(badge.id) ?? false
              return (
                <div
                  key={badge.id}
                  className={`card p-3 text-center transition-fast ${
                    isEarned
                      ? 'border-accent bg-accent-dim'
                      : isUnlocked
                      ? 'border-warning bg-warning-dim'
                      : 'opacity-60'
                  }`}
                >
                  <div className={`w-8 h-8 mx-auto flex items-center justify-center mb-2 ${
                    isEarned ? 'bg-accent text-background' :
                    isUnlocked ? 'bg-warning text-background' :
                    'bg-tertiary text-muted'
                  }`}>
                    {iconMap[badge.icon] ?? <Star className="w-4 h-4" />}
                  </div>
                  <div className="font-mono text-xs font-semibold mb-1">{badge.title}</div>
                  <div className="text-[10px] text-muted">{badge.description}</div>
                  {isEarned && <Badge variant="success" className="text-[9px] mt-2">Earned</Badge>}
                  {isUnlocked && !isEarned && <Badge variant="warning" className="text-[9px] mt-2">Close</Badge>}
                </div>
              )
            })}
          </div>
        </section>

        {/* Data Management */}
        <section className="card p-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted mb-4">
            Data Management
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={handleExport} className="btn btn-default btn-sm">
              <Download className="w-3.5 h-3.5" />
              Export Progress
            </button>
            <button onClick={() => setImportOpen(true)} className="btn btn-default btn-sm">
              <Upload className="w-3.5 h-3.5" />
              Import Progress
            </button>
            <button onClick={handleReset} className="btn btn-danger btn-sm ml-auto">
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Progress
            </button>
          </div>
        </section>
      </div>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
