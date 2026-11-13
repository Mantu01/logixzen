'use client'

import Link from 'next/link'
import { loadQuestionsCached } from '@/lib/content/clientLoaders'
import { getTopicsOrdered } from '@logixzen/shared/content'
import type { Topic, Question } from '@logixzen/shared/content'
import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/features/learn/Badge'
import { PageHeader } from '@/components/PageHeader'

export function TopicListContent(): React.ReactElement {
  const [topics, setTopics] = useState<Topic[]>([])
  const [questionsMap, setQuestionsMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unsolved'>('all')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const topicsList = getTopicsOrdered()
        const qPromises = topicsList.map((t) =>
          loadQuestionsCached(t.id).catch(() => [] as Question[])
        )
        const results = await Promise.all(qPromises)
        const map: Record<string, number> = {}
        topicsList.forEach((t, i) => {
          if (results[i] && results[i].length > 0) map[t.id] = results[i].length
        })
        setTopics(topicsList)
        setQuestionsMap(map)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = topics.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader titleOverride="Practice" />
      <div className="page-content">
        <div className="max-w-3xl mx-auto">
          {/* Title */}
          <div className="mb-6">
            <h1 className="font-mono text-lg font-bold">Learn SQL</h1>
            <p className="text-sm text-muted mt-1">Master SQL through structured exercises</p>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search topics..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-full pl-9 pr-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-1 border border-border rounded-sm">
              {(['all', 'unsolved'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-mono transition-fast ${
                    filter === f
                      ? 'bg-accent-dim text-accent border border-accent-mid'
                      : 'text-muted hover-text border border-transparent'
                  }`}
                >
                  {f === 'all' ? 'All' : 'Unsolved'}
                </button>
              ))}
            </div>
          </div>

          {/* Topic List */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-tertiary animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">No topics match "{search}"</div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((topic) => {
                const count = questionsMap[topic.id] ?? 0
                return (
                  <Link
                    key={topic.id}
                    href={`/learn/${topic.id}`}
                    className="flex items-center gap-4 px-4 py-3 card hover-bg transition-fast group block"
                  >
                    <div className="w-8 h-8 bg-tertiary flex items-center justify-center text-xs font-mono text-muted group-hover:text-accent shrink-0">
                      {String(topic.order + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-medium truncate">{topic.title}</div>
                      {topic.description && (
                        <div className="text-xs text-muted truncate mt-0.5">{topic.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {count > 0 && (
                        <span className="text-[11px] font-mono text-muted">{count} questions</span>
                      )}
                      <span className="text-muted opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
