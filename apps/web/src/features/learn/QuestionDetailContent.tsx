'use client'

import { loadQuestionsCached } from '@/lib/content/clientLoaders'
import type { Question } from '@logixzen/shared/content'
import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Lightbulb, Eye, Play, Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { SqlEditor } from '@/components/editor/SqlEditor'
import { Badge } from '@/features/learn/Badge'
import { AiActionButtons } from '@/components/learn/AiActionButtons'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { useHints } from '@/features/learn/hooks/useHints'
import { useGrading } from '@/features/learn/hooks/useGrading'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'

interface QuestionDetailProps {
  topicId: string
  questionId: string
}

export function QuestionDetailContent({ topicId, questionId }: QuestionDetailProps): React.ReactElement {
  const { setQuestion, currentQuestion, answer, setAnswer, isSubmitted, gradeResult, submitAnswer, showSolutionFn, solvedIds } = usePracticeStore()
  const hintQuestion = currentQuestion ?? { id: '', topicId: '', difficulty: 'easy' as const, title: '', description: '', datasetId: '', hints: [], explanation: '', tags: [], points: 0 }
  const { revealHint, hintsRevealed } = useHints(hintQuestion)
  const { grade, isGrading } = useGrading(hintQuestion)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const qs = await loadQuestionsCached(topicId)
        setQuestions(qs)
        const idx = qs.findIndex(q => q.id === questionId)
        if (idx >= 0 && qs[idx]) {
          setQuestion(qs[idx], topicId, idx, qs)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [topicId, questionId])

  const handleRun = useCallback(async () => {
    if (!currentQuestion || !answer.trim()) return
    await grade(answer, hintsRevealed)
  }, [answer, hintsRevealed, grade])

  const handleNext = useCallback(() => {
    const state = usePracticeStore.getState()
    const nextQ = state.questions[state.currentIndex + 1]
    if (!nextQ) return
    const nextId = nextQ.id
    void loadQuestionsCached(topicId).then((all) => {
      const idx = all.findIndex(q => q.id === nextId)
      if (idx >= 0 && all[idx]) {
        usePracticeStore.getState().setQuestion(all[idx], topicId, idx, all)
        window.location.href = `/learn/${topicId}/${nextId}`
      }
    })
  }, [topicId])

  const handlePrev = useCallback(() => {
    const state = usePracticeStore.getState()
    const prevQ = state.questions[state.currentIndex - 1]
    if (!prevQ) return
    const prevId = prevQ.id
    void loadQuestionsCached(topicId).then((all) => {
      const idx = all.findIndex(q => q.id === prevId)
      if (idx >= 0 && all[idx]) {
        usePracticeStore.getState().setQuestion(all[idx], topicId, idx, all)
        window.location.href = `/learn/${topicId}/${prevId}`
      }
    })
  }, [topicId])

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader />
        <div className="page-content">
          <div className="space-y-3 max-w-4xl">
            <div className="h-6 bg-tertiary animate-pulse" />
            <div className="h-4 w-64 bg-tertiary animate-pulse" />
            <div className="h-48 bg-tertiary animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader />
        <div className="page-content">
          <div className="empty-state">
            <p>Question not found</p>
            <Link href={`/learn/${topicId}`} className="text-accent hover:underline text-sm font-mono mt-2 inline-block">
              ← Back to topic
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const q = currentQuestion as Question
  const currentIndex = usePracticeStore.getState().currentIndex
  const total = questions.length
  const isLast = currentIndex === total - 1
  const isFirst = currentIndex === 0

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <Link href={`/learn/${topicId}`} className="btn btn-ghost btn-sm flex items-center gap-1">
          <ArrowLeft size={12} />
          Back
        </Link>
        <span className="page-breadcrumb">{q.title}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-mono text-muted">{currentIndex + 1} / {total}</span>
          {solvedIds.has(q.id) && <CheckCircle2 size={14} className="text-success" />}
        </div>
      </div>

      <div className="page-content flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Question header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={q.difficulty === 'easy' ? 'success' : q.difficulty === 'medium' ? 'warning' : 'error'}>
                {q.difficulty}
              </Badge>
              <span className="text-xs font-mono text-muted">{q.points} pts</span>
            </div>
            <h1 className="font-mono text-base font-bold mb-2">{q.title}</h1>
            <p className="text-sm text-secondary leading-relaxed">{q.description}</p>
            <div className="flex items-center gap-2 mt-2 text-xs font-mono text-muted">
              <span>Dataset:</span>
              <span className="text-primary">{q.datasetId}</span>
            </div>
          </div>

          {/* SQL Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted uppercase tracking-wider">Your Query</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleRun()}
                  disabled={isGrading || !answer.trim()}
                  className="btn btn-primary btn-sm"
                >
                  {isGrading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Run
                </button>
                <button
                  onClick={() => void submitAnswer()}
                  disabled={isGrading || !answer.trim() || isSubmitted}
                  className="btn btn-default btn-sm"
                >
                  Submit
                </button>
              </div>
            </div>
            <div className="border border-border rounded-sm overflow-hidden">
              <SqlEditor
                value={answer}
                onChange={(v) => setAnswer(v ?? '')}
                onRun={() => void handleRun()}
                theme="vs-dark"
              />
            </div>
          </div>

          {/* Results */}
          {gradeResult && (
            <div className={`border-l-2 p-3 ${gradeResult.passed ? 'border-success bg-success-dim' : 'border-error bg-error-dim'}`}>
              <div className="flex items-center gap-2 mb-1">
                {gradeResult.passed ? (
                  <><CheckCircle2 size={14} className="text-success" /><span className="font-mono text-sm font-semibold text-success">Correct!</span></>
                ) : (
                  <><XCircle size={14} className="text-error" /><span className="font-mono text-sm font-semibold text-error">Incorrect</span></>
                )}
              </div>
              <p className="text-xs text-muted font-mono">
                {gradeResult.passed
                  ? `+${gradeResult.pointsEarned} points earned`
                  : gradeResult.testCases.find(tc => !tc.passed)?.error ?? 'Try again'}
              </p>
              <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-muted">
                <span>{gradeResult.totalTimeMs.toFixed(0)}ms</span>
                {gradeResult.testCases.map((tc) => (
                  <span key={tc.id} className={tc.passed ? 'text-success' : 'text-error'}>
                    {tc.passed ? '✓' : '✗'} {tc.id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Assistance */}
          <AiActionButtons
            question={q}
            dataset={q.datasetId as any}
            studentAnswer={answer}
            errorMessage={gradeResult && !gradeResult.passed ? gradeResult.testCases.find(tc => !tc.passed)?.error ?? 'Query failed' : null}
            onHint={(hint) => console.log('AI hint:', hint)}
            onExplainError={(exp) => console.log('AI error explain:', exp)}
            onExplainQuery={(exp) => console.log('AI query explain:', exp)}
          />

          {/* Hints */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lightbulb size={14} className="text-warning" />
                <span className="text-xs font-mono text-muted uppercase tracking-wider">Hints</span>
                <span className="text-[10px] font-mono text-muted">{hintsRevealed}/{q.hints.length}</span>
              </div>
              {hintsRevealed < q.hints.length && (
                <button
                  onClick={() => { revealHint(); setShowHint(true) }}
                  className="btn btn-ghost btn-xs"
                >
                  Show Hint
                </button>
              )}
            </div>
            {showHint && hintsRevealed > 0 && (
              <div className="space-y-1.5">
                {q.hints.slice(0, hintsRevealed).map((hint, i) => (
                  <p key={i} className="text-xs font-mono text-secondary bg-secondary border-l-2 border-warning px-3 py-2">
                    {hint}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Solution */}
          {isSubmitted && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-info" />
                  <span className="text-xs font-mono text-muted uppercase tracking-wider">Solution</span>
                </div>
                {!showSolution && (
                  <button
                    onClick={() => { showSolutionFn(); setShowSolution(true) }}
                    className="btn btn-ghost btn-xs"
                  >
                    Show Solution
                  </button>
                )}
              </div>
              {showSolution && (
                <div className="space-y-2">
                  <pre className="text-xs font-mono bg-secondary border border-border rounded-sm p-3 text-accent overflow-x-auto">
                    {'solutionSql' in q ? (q as any).solutionSql : ''}
                  </pre>
                  <p className="text-xs text-muted">{q.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              onClick={() => void handlePrev()}
              disabled={isFirst}
              className="btn btn-default btn-sm"
            >
              <ArrowLeft size={12} /> Previous
            </button>
            <button
              onClick={() => void handleNext()}
              disabled={isLast}
              className="btn btn-primary btn-sm"
            >
              Next <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
