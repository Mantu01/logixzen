'use client'

import { loadQuestionsCached } from '@/lib/content/clientLoaders'
import { TOPICS_META } from '@logixzen/shared/content'
import { useProgressStore } from '@/stores/useProgressStore'
import { Loader2, AlertCircle, CheckCircle2, BookOpen, Play, Flame, Award } from 'lucide-react'
import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/PageHeader'

export function HomePageContent(): React.ReactElement {
  const [topics, setTopics] = useState<typeof TOPICS_META>([])
  const [questionsLoaded, setQuestionsLoaded] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { totalPoints, streak, solvedQuestions } = useProgressStore()

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const loaded: Record<string, number> = {}
        await Promise.all(
          TOPICS_META.map(async (topic) => {
            try {
              const qs = await loadQuestionsCached(topic.id)
              loaded[topic.id] = qs.length
            } catch {
              loaded[topic.id] = 0
            }
          })
        )
        setTopics(TOPICS_META)
        setQuestionsLoaded(loaded)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const totalQuestions = Object.values(questionsLoaded).reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col h-full">
      <PageHeader />
      <div className="page-content">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero */}
          <div className="space-y-2">
            <div className="font-mono text-sm text-muted">
              <span className="text-accent">$</span> welcome back
            </div>
            <h1 className="font-mono text-2xl font-bold tracking-tight">SQL Practice Platform</h1>
            <p className="text-sm text-muted max-w-lg">
              Master SQL through interactive exercises. Start with the playground for free exploration,
              or dive into structured lessons.
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                <Award size={14} className="text-accent shrink-0" />
                <span className="text-xs font-mono text-muted uppercase tracking-wider">Points</span>
              </div>
              <div className="font-mono text-xl font-bold">{totalPoints}</div>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                <Flame size={14} className="text-warning shrink-0" />
                <span className="text-xs font-mono text-muted uppercase tracking-wider">Streak</span>
              </div>
              <div className="font-mono text-xl font-bold">{streak.currentStreak}d</div>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={14} className="text-success shrink-0" />
                <span className="text-xs font-mono text-muted uppercase tracking-wider">Solved</span>
              </div>
              <div className="font-mono text-xl font-bold">{solvedQuestions.size}</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href="/playground"
              className="block card p-4 hover:bg-hover transition-fast group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-accent/15 flex items-center justify-center">
                  <Play size={14} className="text-accent" />
                </div>
                <span className="font-mono text-xs text-muted uppercase tracking-wider">playground</span>
              </div>
              <div className="font-semibold text-base">SQL Editor</div>
              <div className="text-xs text-muted mt-1">Run queries against loaded datasets</div>
            </a>
            <a
              href="/learn"
              className="block card p-4 hover:bg-hover transition-fast group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-accent/15 flex items-center justify-center">
                  <BookOpen size={14} className="text-accent" />
                </div>
                <span className="font-mono text-xs text-muted uppercase tracking-wider">practice</span>
              </div>
              <div className="font-semibold text-base">Questions</div>
              <div className="text-xs text-muted mt-1">Structured learning path</div>
            </a>
          </div>

          {/* Topics */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted">
                Topics
              </h2>
              {!loading && totalQuestions > 0 && (
                <span className="text-xs text-muted font-mono">
                  {totalQuestions} questions
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-tertiary animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="p-3 border-l-2 border-error bg-error-dim text-xs font-mono">
                <AlertCircle size={12} className="inline mr-1 text-error" />
                {error}
              </div>
            ) : (
              <div className="space-y-1">
                {topics.map((topic) => {
                  const count = questionsLoaded[topic.id] ?? 0
                  return (
                    <a
                      key={topic.id}
                      href={`/learn?topic=${topic.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 border border-border hover:border-border-strong hover:bg-hover transition-fast group block"
                    >
                      <div className="w-6 h-6 bg-tertiary flex items-center justify-center text-[10px] font-mono text-muted group-hover:text-accent shrink-0">
                        {String(topic.order + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-medium truncate">
                          {topic.title}
                        </div>
                        {topic.description && (
                          <div className="text-xs text-muted truncate">{topic.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {count > 0 && (
                          <span className="text-[10px] font-mono text-muted">
                            {count}q
                          </span>
                        )}
                        <span className="text-muted opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
