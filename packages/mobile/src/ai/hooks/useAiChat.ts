import { useState, useCallback, useRef } from 'react'
import type { Question } from '@logixzen/shared/content'
import type { SqlResult } from '@logixzen/shared/sql-engine'
import { aiService } from '../service'
import type { AiMessage } from '../service'
import { useAiStore } from '../store'

interface UseAiChatOptions {
  question: Question
  studentAnswer: string
  results?: SqlResult[]
  error?: string | null
}

export function useAiChat({ question, studentAnswer, results, error }: UseAiChatOptions) {
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastSource, setLastSource] = useState<'ai' | 'static' | null>(null)
  const abortRef = useRef(false)

  const getConfig = useCallback(() => useAiStore.getState().config, [])

  /**
   * Get AI hint for current question state
   */
  const getHint = useCallback(async (index: number): Promise<string> => {
    const config = getConfig()
    if (!config.enabled) {
      return aiService.getHint(question, studentAnswer, index)
    }
    const result = await aiService.getHint(question, studentAnswer, index)
    setLastSource(result.source)
    return result.text
  }, [question, studentAnswer, getConfig])

  /**
   * Get AI diagnosis for SQL error
   */
  const diagnoseError = useCallback(async (): Promise<{ explanation: string; suggestion: string }> => {
    const errorText = error ?? 'Unknown error'
    const result = await aiService.diagnoseError(question, errorText)
    setLastSource(result.source)
    return { explanation: result.explanation, suggestion: result.suggestion }
  }, [question, error])

  /**
   * Stream AI response character by character
   */
  const streamResponse = useCallback(async (
    mode: 'hint' | 'explain' | 'improve',
    onChunk: (chunk: string) => void,
    onComplete: (full: string) => void
  ): Promise<string> => {
    setIsGenerating(true)
    abortRef.current = false
    let full = ''
    try {
      // Get full response first, then yield chunks
      const response = await aiService.suggestImprovement(question, studentAnswer)
      // Simulate streaming by yielding characters
      for (let i = 0; i < response.length; i++) {
        if (abortRef.current) break
        const chunk = response[i]
        full += chunk
        onChunk(chunk)
      }
      onComplete(full)
      setLastSource('ai')
      return full
    } catch {
      const fallback = mode === 'explain'
        ? 'AI explanation unavailable. Check your connection.'
        : 'AI response unavailable. Try again later.'
      onComplete(fallback)
      setLastSource('static')
      return fallback
    } finally {
      setIsGenerating(false)
    }
  }, [question, studentAnswer])

  /**
   * Add user message and get AI response
   */
  const sendMessage = useCallback(async (userMessage: string) => {
    const config = getConfig()
    if (!config.enabled) {
      setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }])
      const staticMsg = 'AI is not configured. Enable it in Settings to use AI features.'
      setMessages(prev => [...prev, { role: 'assistant', content: staticMsg, timestamp: Date.now() }])
      return
    }

    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }])
    setIsGenerating(true)

    try {
      // Build response incrementally
      let full = ''
      const response = await aiService.suggestImprovement(question, userMessage)
      for (let i = 0; i < response.length; i++) {
        if (abortRef.current) break
        full += response[i]
        setMessages(prev => [...prev, { role: 'assistant', content: full, timestamp: Date.now() }])
      }
      setLastSource('ai')
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Check AI settings.',
        timestamp: Date.now(),
      }])
      setLastSource('static')
    } finally {
      setIsGenerating(false)
    }
  }, [question, getConfig])

  /**
   * Suggest SQL improvements
   */
  const suggestImprovement = useCallback(async (): Promise<string> => {
    const improvement = await aiService.suggestImprovement(question, studentAnswer)
    return improvement
  }, [question, studentAnswer])

  const clearHistory = useCallback(() => {
    setMessages([])
    setLastSource(null)
  }, [])

  const stopGeneration = useCallback(() => {
    abortRef.current = true
    setIsGenerating(false)
  }, [])

  return {
    messages,
    isGenerating,
    lastSource,
    getHint,
    diagnoseError,
    streamResponse,
    sendMessage,
    suggestImprovement,
    clearHistory,
    stopGeneration,
  }
}
