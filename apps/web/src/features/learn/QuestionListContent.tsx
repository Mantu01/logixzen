'use client'

import { loadQuestionsCached } from '@/lib/content/clientLoaders'
import type { Topic, Question } from '@logixzen/shared/content'
import { useState, useEffect } from 'react'
import { Badge } from '@/features/learn/Badge'
import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'

interface QuestionListProps {
  topicId: string
}

export function QuestionListContent({ topicId }: QuestionListProps): React.ReactElement {
  const [topic, setTopic] = useState<Topic | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const allTopics = (await import('@logixzen/shared/content')).getTopicsOrdered()
        const found = allTopics.find(t => t.id === topicId)
        if (found) setTopic(found)

        const qs = await loadQuestionsCached(topicId)
        setQuestions(qs)
      } finally {
        setLoading(false)
      }
    })()
  }, [topicId])

  const filtered = questions.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase())
    const matchesDifficulty = difficulty === 'all' || q.difficulty === difficulty
    return matchesSearch && matchesDifficulty
  })

  const difficultyColor: Record<string, 'success' | 'warning' | 'error'> = {
    easy: 'success',
    medium: 'warning',
    hard: 'error',
  }

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <Link href="/learn" className="btn btn-ghost btn-sm flex items-center gap-1">
          <ArrowLeft size={12} />
          Topics
        </Link>
        <span className="page-breadcrumb">{loading ? 'Loading...' : topic?.title ?? topicId}</span>
      </div>

      <div className="page-content">
        <div className="max-w-3xl mx-auto">
          {/* Search & Filter */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search questions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-full pl-9 pr-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-1 border border-border rounded-sm">
              {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-2.5 py-1.5 text-xs font-mono transition-fast ${
                    difficulty === d
                      ? 'bg-accent-dim text-accent border border-accent-mid'
                      : 'text-muted hover-text border border-transparent'
                  }`}
                >
                  {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Question List */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-tertiary animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">No questions match your filters</div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((q, idx) => (
                <Link
                  key={q.id}
                  href={`/learn/${topicId}/${q.id}`}
                  className="flex items-center gap-4 px-4 py-3 card hover-bg transition-fast group block"
                >
                  <div className="w-7 h-7 bg-tertiary flex items-center justify-center text-xs font-mono text-muted group-hover:text-accent shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-medium truncate">{q.title}</div>
                    <div className="text-xs text-muted truncate mt-0.5">{q.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={difficultyColor[q.difficulty]}>{q.difficulty}</Badge>
                    <span className="text-[11px] font-mono text-muted">{q.points} pts</span>
                    <span className="text-muted opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
