import { useState, useCallback, useEffect, useRef } from 'react'
import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Dimensions } from 'react-native'
import { Text } from 'react-native-paper'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { loadQuestions, loadDataset, checkSafety } from '@logixzen/shared/content'
import type { Question, Dataset } from '@logixzen/shared/content'
import { useProgressStore } from '@/stores/useProgressStore'
import { gradeQuestion, setCurrentStudentSql } from '@logixzen/shared/practice/grader'
import type { SqlResult } from '@logixzen/shared/sql-engine'
import * as SQLite from 'expo-sqlite'
import { splitStatements } from '@logixzen/shared/sql-engine/statementSplitter'
import { useAiChat } from '@/ai/hooks/useAiChat'
import { AiChatPanel } from '@/components/AiChatPanel'
import { AiHintBubble } from '@/components/AiHintBubble'
import { AiErrorDiagnosisPanel } from '@/components/AiErrorDiagnosis'
import { useAiStore } from '@/ai/store'
import { useAiHint } from '@/ai/hooks/useAiHint'
import { buildStaticHint, buildStaticErrorMessage } from '@/ai/fallback'
import { AiSettingsScreen } from '@/app/ai-settings'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

type FeedbackState = { passed: boolean; score: number; message: string } | null

interface QuestionContentProps {
  question: Question
  dataset: Dataset | null
  answer: string
  setAnswer: (a: string) => void
  selectedOptions: string[]
  setSelectedOptions: (o: string[]) => void
  fillBlankAnswers: Record<number, string>
  setFillBlankAnswers: (a: Record<number, string>) => void
  showHint: boolean
  setShowHint: (v: boolean) => void
  hintIndex: number
  feedback: FeedbackState
  setFeedback: (f: FeedbackState) => void
  showExplanation: boolean
  setShowExplanation: (v: boolean) => void
  isRunning: boolean
  queryError: string | null
  difficultyColor: (d: string) => string
  handleHint: () => void
  handleExplain: () => void
  aiExplaining: boolean
  aiHint: ReturnType<typeof useAiHint>
  hasQueryError: boolean
  onSubmitQuery: () => void
}

function QuestionContent({
  question, dataset, answer, setAnswer, selectedOptions, setSelectedOptions,
  fillBlankAnswers, setFillBlankAnswers, showHint, setShowHint, hintIndex,
  feedback, setFeedback, showExplanation, setShowExplanation, isRunning,
  queryError, difficultyColor, handleHint, handleExplain, aiExplaining, aiHint, hasQueryError,
  onSubmitQuery,
}: QuestionContentProps) {

  const handleSubmitMCQ = useCallback(() => {
    let passed = false
    let msg = ''
    if (question.type === 'mcq-single') {
      passed = selectedOptions[0] === question.correctOptionId
      msg = passed ? 'Correct!' : 'Incorrect. Try again.'
    } else {
      const correctIds = Array.isArray(question.correctOptionIds) ? question.correctOptionIds : [question.correctOptionIds]
      const selSorted = [...selectedOptions].sort()
      const corSorted = [...correctIds].sort()
      passed = selSorted.join(',') === corSorted.join(',')
      msg = passed ? 'Correct!' : 'Incorrect. Try again.'
    }
    if (passed) {
      const actions = useProgressStore.getState().actions
      actions.markSolved(question.id)
      actions.addPoints(question.points)
    }
    setFeedback({ passed, score: passed ? question.points : 0, message: msg })
    setShowExplanation(true)
  }, [question, selectedOptions, setFeedback, setShowExplanation])

  const handleSubmitFillBlank = useCallback(() => {
    let passed = true
    let msg = ''
    const accepted = (question as any).acceptedAnswers ?? {}
    const userAnswers = Object.values(fillBlankAnswers)
    for (const [index, acceptedList] of Object.entries(accepted)) {
      const idx = parseInt(index, 10)
      const userAnswer = userAnswers[idx] ?? ''
      const list = Array.isArray(acceptedList) ? acceptedList : [acceptedList]
      const normalizedUser = userAnswer.trim().toLowerCase()
      const normalizedAccepted = list.map((a: string) => a.trim().toLowerCase())
      if (!normalizedAccepted.includes(normalizedUser)) {
        passed = false
        msg = `Blank ${idx + 1} incorrect. Accepted: ${list.join(' / ')}`
        break
      }
    }
    if (passed) msg = 'Correct!'
    if (passed) {
      const actions = useProgressStore.getState().actions
      actions.markSolved(question.id)
      actions.addPoints(question.points)
    }
    setFeedback({ passed, score: passed ? question.points : 0, message: msg })
    setShowExplanation(true)
  }, [question, fillBlankAnswers, setFeedback, setShowExplanation])

  const handleSubmitPredict = useCallback(() => {
    const expected = (question as any).expectedOutput ?? []
    const userAnswer = answer.trim().toLowerCase()
    let passed = false
    let msg = 'Check your prediction against the expected output.'
    for (const exp of expected) {
      const expValues = Object.values(exp).map((v: unknown) => String(v).toLowerCase())
      const matches = expValues.every((v: string) => userAnswer.includes(v))
      if (matches) { passed = true; msg = 'Correct prediction!'; break }
    }
    if (passed) {
      const actions = useProgressStore.getState().actions
      actions.markSolved(question.id)
      actions.addPoints(question.points)
    }
    setFeedback({ passed, score: passed ? question.points : 0, message: msg })
    setShowExplanation(true)
  }, [question, answer, setFeedback, setShowExplanation])

  return (
    <View style={styles.content}>
      <View style={styles.topicBadge}>
        <Text style={styles.pointsBadge}>{question.points} pts</Text>
        <View style={[styles.difficultyBadge, { borderColor: difficultyColor(question.difficulty) }]}>
          <Text style={[styles.difficultyText, { color: difficultyColor(question.difficulty) }]}>
            {question.difficulty.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{question.title}</Text>
      <Text style={styles.description}>{question.description}</Text>

      {dataset !== null && (
        <View style={styles.datasetChip}>
          <Text style={styles.datasetChipText}>Dataset: {dataset.name}</Text>
          <Text style={styles.datasetTableCount}>{dataset.tables.length} tables</Text>
        </View>
      )}

      {/* Query / Debug Query */}
      {(question.type === 'query' || question.type === 'debug-query') && (
        <View style={styles.inputContainer}>
          {question.type === 'debug-query' && 'brokenQuery' in question && (
            <View style={styles.brokenQueryBox}>
              <Text style={styles.brokenQueryLabel}>Broken Query:</Text>
              <Text style={styles.brokenQuery}>{(question as any).brokenQuery}</Text>
            </View>
          )}
          <TextInput
            style={styles.input}
            value={answer}
            onChangeText={setAnswer}
            placeholder={question.type === 'debug-query' ? "Fix the broken query..." : "Write your SQL here..."}
            placeholderTextColor="#6E7681"
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
          {feedback !== null && (
            <Text style={[feedback.passed ? styles.successText : styles.errorFeedText, styles.feedback]}>
              {feedback.message}
            </Text>
          )}
          {queryError !== null && !feedback && (
            <Text style={styles.errorFeedText}>{queryError}</Text>
          )}
        </View>
      )}

      {/* MCQ Single */}
      {question.type === 'mcq-single' && 'options' in question && (
        <View style={styles.optionsContainer}>
          {question.options!.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionBtn,
                selectedOptions.includes(option.id) && styles.optionSelected,
                feedback !== null && option.id === question.correctOptionId && styles.optionCorrect,
                feedback !== null && selectedOptions.includes(option.id) && option.id !== question.correctOptionId && styles.optionWrong,
              ]}
              onPress={() => setSelectedOptions([option.id])}
              activeOpacity={0.8}
            >
              <Text style={styles.optionText}>{option.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* MCQ Multi */}
      {question.type === 'mcq-multi' && 'options' in question && (
        <View style={styles.optionsContainer}>
          {question.options!.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionBtn,
                selectedOptions.includes(option.id) && styles.optionSelected,
                feedback !== null && (Array.isArray(question.correctOptionIds) ? question.correctOptionIds : [question.correctOptionIds]).includes(option.id) && styles.optionCorrect,
                feedback !== null && selectedOptions.includes(option.id) && !(Array.isArray(question.correctOptionIds) ? question.correctOptionIds : [question.correctOptionIds]).includes(option.id) && styles.optionWrong,
              ]}
              onPress={() => setSelectedOptions(prev => prev.includes(option.id) ? prev.filter(id => id !== option.id) : [...prev, option.id])}
              activeOpacity={0.8}
            >
              <Text style={styles.optionText}>{option.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Fill Blank */}
      {question.type === 'fill-blank' && (
        <View style={styles.fillBlankContainer}>
          <Text style={styles.fillBlankLabel}>Complete the query:</Text>
          <Text style={styles.blankTemplate}>{(question as any).blankTemplate}</Text>
          {Object.entries((question as any).acceptedAnswers ?? {}).map(([index, _accepted], i) => (
            <TextInput
              key={index}
              style={styles.blankInput}
              value={fillBlankAnswers[i] ?? ''}
              onChangeText={(val) => setFillBlankAnswers(prev => ({ ...prev, [i]: val }))}
              placeholder="Answer"
              placeholderTextColor="#6E7681"
              autoCapitalize="none"
            />
          ))}
          {feedback !== null && (
            <Text style={[feedback.passed ? styles.successText : styles.errorFeedText, styles.feedback]}>
              {feedback.message}
            </Text>
          )}
        </View>
      )}

      {/* Predict Output */}
      {question.type === 'predict-output' && (
        <View style={styles.predictContainer}>
          <Text style={styles.predictLabel}>Predict the output:</Text>
          <TextInput
            style={styles.input}
            value={answer}
            onChangeText={setAnswer}
            placeholder="Describe the expected result..."
            placeholderTextColor="#6E7681"
            multiline
          />
          {feedback !== null && (
            <Text style={[feedback.passed ? styles.successText : styles.errorFeedText, styles.feedback]}>
              {feedback.message}
            </Text>
          )}
        </View>
      )}

      {/* AI Hint Bubble */}
      {showHint && question.hints !== undefined && question.hints[hintIndex] !== undefined && (
        <View style={styles.hintSection}>
          {aiHint.isAiEnabled && aiHint.aiHint !== null ? (
            <AiHintBubble
              hint={aiHint.aiHint}
              confidence={aiHint.aiHint.confidence}
              onRefresh={aiHint.refreshHint}
            />
          ) : (
            <View style={styles.hintBox}>
              <Text style={styles.hintTextInner}>{question.hints[hintIndex].text}</Text>
            </View>
          )}
        </View>
      )}

      {/* Explanation */}
      {showExplanation && (
        <View style={styles.explanationBox}>
          <Text style={styles.explanationTitle}>Explanation</Text>
          {aiExplaining ? (
            <Text style={styles.explanationText}>Generating explanation...</Text>
          ) : (
            <Text style={styles.explanationText}>
              {question.explanation ?? 'Review the question requirements carefully.'}
            </Text>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {question.hints !== undefined && question.hints.length > 0 && (
          <TouchableOpacity
            style={[styles.hintBtn, hintIndex >= question.hints.length - 1 ? styles.hintBtnDisabled : null]}
            onPress={handleHint}
            disabled={hintIndex >= (question.hints?.length ?? 0) - 1}
            accessibilityLabel={`Show hint ${Math.min(hintIndex + 1, question.hints?.length ?? 1)}`}
          >
            <Text style={styles.hintText}>
              Hint {Math.min(hintIndex + 1, question.hints?.length ?? 1)}/{question.hints?.length ?? 0}
            </Text>
          </TouchableOpacity>
        )}

        {(question.type === 'query' || question.type === 'debug-query') && (
          <TouchableOpacity
            style={[styles.submitBtn, answer.trim().length === 0 || isRunning ? styles.submitBtnDisabled : null]}
            onPress={onSubmitQuery}
            disabled={answer.trim().length === 0 || isRunning}
            accessibilityLabel="Submit answer"
          >
            <Text style={styles.submitText}>{isRunning ? 'Grading...' : 'Submit'}</Text>
          </TouchableOpacity>
        )}

        {(question.type === 'mcq-single' || question.type === 'mcq-multi') && (
          <TouchableOpacity
            style={[styles.submitBtn, selectedOptions.length === 0 ? styles.submitBtnDisabled : null]}
            onPress={handleSubmitMCQ}
            disabled={selectedOptions.length === 0}
            accessibilityLabel="Submit answer"
          >
            <Text style={styles.submitText}>Submit</Text>
          </TouchableOpacity>
        )}

        {question.type === 'fill-blank' && (
          <TouchableOpacity
            style={[styles.submitBtn, Object.keys(fillBlankAnswers).length === 0 ? styles.submitBtnDisabled : null]}
            onPress={handleSubmitFillBlank}
            disabled={Object.keys(fillBlankAnswers).length === 0}
            accessibilityLabel="Submit answer"
          >
            <Text style={styles.submitText}>Submit</Text>
          </TouchableOpacity>
        )}

        {question.type === 'predict-output' && (
          <TouchableOpacity
            style={[styles.submitBtn, answer.trim().length === 0 ? styles.submitBtnDisabled : null]}
            onPress={handleSubmitPredict}
            disabled={answer.trim().length === 0}
            accessibilityLabel="Submit answer"
          >
            <Text style={styles.submitText}>Submit</Text>
          </TouchableOpacity>
        )}

        {(question.type === 'query' || question.type === 'debug-query') && feedback !== null && (
          <TouchableOpacity
            style={styles.explainBtn}
            onPress={handleExplain}
            disabled={aiExplaining}
            accessibilityLabel="Get AI explanation"
          >
            <Text style={styles.explainText}>{aiExplaining ? 'Explaining...' : 'Explain'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  topicBadge: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  pointsBadge: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#3FB950' },
  difficultyBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  difficultyText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 10, fontWeight: '600' },
  title: { fontFamily: 'JetBrainsMono-Regular', fontSize: 16, fontWeight: '600', color: '#E6EDF3', marginBottom: 8 },
  description: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#8B949E', lineHeight: 22, marginBottom: 12 },
  datasetChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C2128', borderWidth: 1, borderColor: '#30363D', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12, gap: 8 },
  datasetChipText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#E6EDF3' },
  datasetTableCount: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#8B949E' },
  inputContainer: { borderWidth: 1, borderColor: '#30363D', borderRadius: 4, backgroundColor: '#0D1117', padding: 12, marginBottom: 12 },
  brokenQueryBox: { marginBottom: 12, padding: 8, backgroundColor: 'rgba(248,81,73,0.1)', borderRadius: 4, borderWidth: 1, borderColor: '#F85149' },
  brokenQueryLabel: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#F85149', marginBottom: 4 },
  brokenQuery: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#F85149' },
  input: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#E6EDF3', lineHeight: 20, minHeight: 100 },
  feedback: { marginTop: 8 },
  successText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#3FB950' },
  errorFeedText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#F85149' },
  optionsContainer: { marginBottom: 16, gap: 8 },
  optionBtn: { borderWidth: 1, borderColor: '#30363D', borderRadius: 4, padding: 12, backgroundColor: '#161B22' },
  optionSelected: { borderColor: '#58A6FF', backgroundColor: 'rgba(88,166,255,0.12)' },
  optionCorrect: { borderColor: '#3FB950', backgroundColor: 'rgba(63,185,80,0.12)' },
  optionWrong: { borderColor: '#F85149', backgroundColor: 'rgba(248,81,73,0.12)' },
  optionText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#E6EDF3' },
  fillBlankContainer: { marginBottom: 16 },
  fillBlankLabel: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#8B949E', marginBottom: 8 },
  blankTemplate: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#E6EDF3', marginBottom: 12, padding: 8, backgroundColor: '#161B22', borderRadius: 4 },
  blankInput: { borderWidth: 1, borderColor: '#30363D', borderRadius: 4, padding: 12, marginBottom: 8, backgroundColor: '#0D1117', fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#E6EDF3' },
  predictContainer: { borderWidth: 1, borderColor: '#30363D', borderRadius: 4, padding: 12, marginBottom: 12 },
  predictLabel: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#8B949E', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  hintBtn: { borderWidth: 1, borderColor: '#30363D', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#161B22' },
  hintBtnDisabled: { opacity: 0.4 },
  hintText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#8B949E' },
  submitBtn: { flex: 1, backgroundColor: '#3FB950', borderRadius: 4, paddingVertical: 10, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#0D1117', fontWeight: '600' },
  explainBtn: { borderWidth: 1, borderColor: '#58A6FF', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(88,166,255,0.1)' },
  explainText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#58A6FF' },
  hintSection: { marginBottom: 12 },
  hintBox: { borderWidth: 1, borderColor: '#D29922', backgroundColor: 'rgba(210,153,34,0.12)', borderRadius: 4, padding: 12, marginBottom: 12 },
  hintTextInner: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#D29922' },
  explanationBox: { borderWidth: 1, borderColor: '#3FB950', backgroundColor: 'rgba(63,185,80,0.08)', borderRadius: 4, padding: 12, marginBottom: 16 },
  explanationTitle: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#3FB950', fontWeight: '600', marginBottom: 6 },
  explanationText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#E6EDF3', lineHeight: 20 },
})

// Main screen component
export default function QuestionScreen() {
  const router = useRouter()
  const { topicId, questionId } = useLocalSearchParams<{ topicId: string; questionId: string }>()

  const [question, setQuestion] = useState<Question | null>(null)
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [fillBlankAnswers, setFillBlankAnswers] = useState<Record<number, string>>({})
  const [showHint, setShowHint] = useState(false)
  const [hintIndex, setHintIndex] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [showAiSettings, setShowAiSettings] = useState(false)
  const [aiExplaining, setAiExplaining] = useState(false)

  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null)
  const aiEnabled = useAiStore(state => state.config.enabled)

  // Submit handler — initializes DB and grades query
  const handleSubmitQuery = useCallback(async () => {
    if (question === null || answer.trim().length === 0) return
    if (dbRef.current === null && dataset !== null) {
      const db = SQLite.openDatabaseSync(':memory:')
      try {
        const statements = splitStatements(dataset.setupSql)
        for (const stmt of statements) await db.execAsync(stmt.sql)
        dbRef.current = db
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return
      }
    }
    const safety = checkSafety(answer.trim())
    if (!safety.valid) {
      setFeedback({ passed: false, score: 0, message: 'Query contains unsafe operations' })
      setQueryError('Query contains unsafe operations')
      return
    }
    setCurrentStudentSql(answer.trim())
    setIsRunning(true)
    setQueryError(null)
    try {
      const db = dbRef.current!
      const statements = splitStatements(answer.trim())
      let lastResult: SqlResult[] = []
      for (const stmt of statements) {
        const trimmed = stmt.sql.trim().toUpperCase()
        try {
          if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
            const rows = await db.getAllAsync(stmt.sql)
            const columns = rows.length > 0 ? Object.keys(rows[0]) : []
            lastResult = [{ columns, rows, rowsAffected: 0, statementIndex: stmt.index, isSelect: true, executionTimeMs: 0 }]
          } else {
            await db.execAsync(stmt.sql)
            const changes = await db.getFirstAsync<{ changes: number }>('SELECT changes()')
            lastResult = [{ columns: [], rows: [], rowsAffected: changes?.changes ?? 0, statementIndex: stmt.index, isSelect: false, executionTimeMs: 0 }]
          }
        } catch (err) {
          lastResult = [{ columns: [], rows: [], rowsAffected: 0, statementIndex: stmt.index, isSelect: false, executionTimeMs: 0, error: err instanceof Error ? err.message : String(err) }]
        }
      }
      const result = await gradeQuestion(answer.trim(), question, dataset!, { execute: async (sql) => lastResult })
      setFeedback({ passed: result.passed, score: result.score, message: result.feedback })
      if (result.passed) {
        const actions = useProgressStore.getState().actions
        actions.markSolved(question.id)
        const penalty = hintIndex * (question.points * 0.1)
        actions.addPoints(Math.max(1, Math.round(question.points - penalty)))
      }
      setShowExplanation(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setFeedback({ passed: false, score: 0, message })
      setQueryError(message)
      setShowExplanation(true)
    } finally {
      setIsRunning(false)
    }
  }, [question, answer, dataset, hintIndex])

  const aiHint = useAiHint({
    question: question ?? { id: '', topicId: '', type: 'query', difficulty: 'easy', title: '', description: '', datasetId: '', points: 0 },
    studentAnswer: answer,
    hintIndex,
    error: queryError,
  })

  const aiChat = useAiChat({
    question: question ?? { id: '', topicId: '', type: 'query', difficulty: 'easy', title: '', description: '', datasetId: '', points: 0 },
    studentAnswer: answer,
    error: queryError,
  })

  const loadQuestion = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const questions = await loadQuestions(topicId as string)
      const found = questions.find((q) => q.id === questionId)
      if (found === undefined) { setError(`Question "${questionId}" not found`) }
      else {
        setQuestion(found)
        const ds = await loadDataset(found.datasetId)
        setDataset(ds)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [topicId, questionId])

  useEffect(() => { void loadQuestion() }, [loadQuestion])

  const handleHint = useCallback(async () => {
    if (question !== null && hintIndex < (question.hints?.length ?? 0)) {
      if (aiEnabled) {
        await aiHint.refreshHint()
      }
      setHintIndex(i => i + 1)
      setShowHint(true)
    }
  }, [question, hintIndex, aiEnabled, aiHint])

  const handleExplain = useCallback(async () => {
    if (question === null) return
    setAiExplaining(true)
    try {
      if (aiEnabled) {
        const full = await aiChat.streamResponse('explain', () => {}, (f) => {
          setFeedback(prev => prev ? { ...prev, message: f } : null)
        })
        if (full) setFeedback(prev => prev ? { ...prev, message: full } : null)
      } else {
        const exp = question.explanation ?? 'No explanation available.'
        setFeedback(prev => prev ? { ...prev, message: exp } : null)
      }
    } catch {
      setFeedback(prev => prev ? { ...prev, message: 'Could not generate explanation.' } : null)
    } finally {
      setAiExplaining(false)
    }
  }, [question, aiEnabled, aiChat])

  const handleAiSend = useCallback((msg: string) => { void aiChat.sendMessage(msg) }, [aiChat])
  const handleAiImprove = useCallback(async () => {
    if (question === null || answer.trim().length === 0) return
    if (aiEnabled) {
      const improvement = await aiChat.suggestImprovement()
      setQueryError(improvement)
    }
  }, [question, answer, aiEnabled, aiChat])

  const difficultyColor = (diff: string): string => {
    switch (diff) { case 'easy': return '#3FB950'
    case 'medium': return '#D29922'
    case 'hard': return '#F85149'
    default: return '#8B949E' }
  }

  const questionContentProps = {
    question: question!,
    dataset,
    answer, setAnswer,
    selectedOptions, setSelectedOptions,
    fillBlankAnswers, setFillBlankAnswers,
    showHint, setShowHint, hintIndex,
    feedback, setFeedback,
    showExplanation, setShowExplanation,
    isRunning, queryError,
    difficultyColor,
    handleHint, handleExplain, aiExplaining,
    aiHint,
    hasQueryError: queryError !== null,
    onSubmitQuery: handleSubmitQuery,
  }

  // AI settings overlay
  if (showAiSettings) {
    return (
      <View style={styles.container}>
        <AiSettingsScreen onDismiss={() => setShowAiSettings(false)} />
      </View>
    )
  }

  // AI chat split view
  if (showAiPanel && question !== null) {
    return (
      <View style={styles.container}>
        <View style={styles.topHalf}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
              <Text style={styles.backBtn}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={styles.questionType}>{question.type}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => { setShowAiPanel(false); setShowAiSettings(true) }} accessibilityLabel="AI Settings" style={styles.aiSettingsBtn}>
                <Text style={styles.aiSettingsText}>⚙</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={styles.scrollContent}>
            <QuestionContent {...questionContentProps} />
          </ScrollView>
        </View>
        <AiChatPanel
          messages={aiChat.messages}
          isGenerating={aiChat.isGenerating}
          onSend={handleAiSend}
          onStop={aiChat.stopGeneration}
          questionTitle={question.title}
        />
        <TouchableOpacity style={styles.closeAiBtn} onPress={() => setShowAiPanel(false)} accessibilityLabel="Close AI panel">
          <Text style={styles.closeAiText}>Close AI</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading question...</Text>
      </View>
    )
  }

  if (error !== null || question === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Question not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadQuestion} accessibilityLabel="Retry">
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.backBtn}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.questionType}>{question.type}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowAiSettings(true)}
            accessibilityLabel="AI Settings"
            style={styles.aiSettingsBtn}
          >
            <Text style={styles.aiSettingsText}>⚙</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowAiPanel(true)}
            accessibilityLabel="Open AI Assistant"
            style={[styles.aiPanelBtn, aiEnabled ? styles.aiPanelBtnActive : null]}
          >
            <Text style={[styles.aiPanelText, aiEnabled ? styles.aiPanelTextActive : null]}>AI</Text>
          </TouchableOpacity>
        </View>
      </View>

      <QuestionContent {...questionContentProps} />

      {aiEnabled && aiHint.aiDiagnosis && queryError !== null && (
        <AiErrorDiagnosisPanel
          diagnosis={aiHint.aiDiagnosis}
          onImprove={handleAiImprove}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={() => router.back()} accessibilityLabel="Back to topic">
          <Text style={styles.nextText}>Back to Topic</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  topHalf: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  headerActions: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  backBtn: { fontFamily: 'JetBrainsMono-Regular', fontSize: 18, color: '#3FB950' },
  questionType: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, color: '#8B949E', marginLeft: 12, textTransform: 'uppercase' },
  aiSettingsBtn: { padding: 4 },
  aiSettingsText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 16, color: '#8B949E' },
  aiPanelBtn: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#30363D', borderRadius: 4 },
  aiPanelBtnActive: { borderColor: '#3FB950', backgroundColor: 'rgba(63,185,80,0.1)' },
  aiPanelText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: '#8B949E' },
  aiPanelTextActive: { color: '#3FB950', fontWeight: '700' },
  scrollContent: { flex: 1 },
  closeAiBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#30363D',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 10,
  },
  closeAiText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#E6EDF3' },
  footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#30363D' },
  nextBtn: { borderWidth: 1, borderColor: '#30363D', borderRadius: 4, paddingVertical: 10, alignItems: 'center' },
  nextText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#E6EDF3' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#8B949E' },
  errorText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#F85149', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderColor: '#30363D', borderRadius: 4, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 13, color: '#3FB950' },
})
