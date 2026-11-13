import type { Question, Dataset } from '@logixzen/shared/content'
import type { SqlResult } from '@logixzen/shared/sql-engine'
import {
  buildStaticHint,
  buildStaticErrorMessage,
  buildStaticExplanation,
} from './fallback'
import type { AiConfig } from './config'
import { useAiStore } from './store'

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface AiHintResult {
  text: string
  source: 'ai' | 'static'
  confidence: number
}

export interface AiErrorDiagnosis {
  explanation: string
  suggestion: string
  source: 'ai' | 'static'
}

/**
 * AI service for LogixZen mobile
 * Uses a server endpoint when configured, falls back to static hints
 */
export class AiService {
  private get config(): AiConfig {
    return useAiStore.getState().config
  }

  /**
   * Generate AI hint based on student answer and question context
   */
  async getHint(
    question: Question,
    studentAnswer: string,
    hintIndex: number
  ): Promise<AiHintResult> {
    if (!this.config.enabled) {
      return { text: buildStaticHint(question, hintIndex), source: 'static', confidence: 0.8 }
    }

    try {
      const hint = await this.callApi('hint', question, studentAnswer, hintIndex)
      return { text: hint, source: 'ai', confidence: 0.9 }
    } catch {
      return { text: buildStaticHint(question, hintIndex), source: 'static', confidence: 0.6 }
    }
  }

  /**
   * Diagnose SQL error and provide explanation
   */
  async diagnoseError(
    question: Question,
    error: string
  ): Promise<AiErrorDiagnosis> {
    if (!this.config.enabled) {
      return {
        explanation: buildStaticErrorMessage(error, question),
        suggestion: 'Check your SQL syntax and column names.',
        source: 'static',
      }
    }

    try {
      const diagnosis = await this.callApi('diagnose', question, error)
      return {
        explanation: diagnosis.explanation,
        suggestion: diagnosis.suggestion,
        source: 'ai',
      }
    } catch {
      return {
        explanation: buildStaticErrorMessage(error, question),
        suggestion: 'Check your SQL syntax and column names.',
        source: 'static',
      }
    }
  }

  /**
   * Stream AI response character by character
   * Returns async generator for incremental updates
   */
  async *streamResponse(
    question: Question,
    studentAnswer: string,
    mode: 'hint' | 'explain' | 'improve'
  ): AsyncGenerator<string> {
    if (!this.config.enabled) {
      const fallback = mode === 'explain'
        ? buildStaticExplanation(question)
        : buildStaticHint(question, 0)
      yield fallback
      return
    }

    try {
      const response = await this.callApi(mode, question, studentAnswer)
      // Stream text character by character for visual effect
      for (let i = 0; i < response.length; i++) {
        yield response[i]
        // Small delay for typewriter effect
        await new Promise(r => setTimeout(r, 15))
      }
    } catch {
      const fallback = mode === 'explain'
        ? buildStaticExplanation(question)
        : buildStaticHint(question, 0)
      yield fallback
    }
  }

  /**
   * Suggest improvements to student SQL query
   */
  async suggestImprovement(
    question: Question,
    studentAnswer: string
  ): Promise<string> {
    if (!this.config.enabled) {
      return 'Consider using the correct column names and SQL clauses as shown in the lesson.'
    }

    try {
      return await this.callApi('improve', question, studentAnswer)
    } catch {
      return 'Consider using the correct column names and SQL clauses as shown in the lesson.'
    }
  }

  private async callApi(
    mode: string,
    question: Question,
    context: string,
    hintIndex?: number
  ): Promise<string> {
    const { baseUrl, apiKey } = this.config
    if (!baseUrl) throw new Error('No AI base URL configured')

    const prompt = this.buildPrompt(mode, question, context, hintIndex)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mode,
        question: {
          id: question.id,
          title: question.title,
          description: question.description,
          type: question.type,
          hints: question.hints,
          explanation: question.explanation,
          datasetId: question.datasetId,
        },
        context,
        ...(hintIndex !== undefined ? { hintIndex } : {}),
      }),
    })

    if (!response.ok) throw new Error(`AI service error: ${response.status}`)
    const data = await response.json()
    return data.response ?? data.text ?? ''
  }

  private buildPrompt(
    mode: string,
    question: Question,
    context: string,
    hintIndex?: number
  ): string {
    const type = question.type
    let base = ''
    switch (mode) {
      case 'hint':
        base = `Provide a helpful hint for a SQL question about "${question.title}". `
        base += `Student answered: "${context}" ${hintIndex !== undefined ? `This is hint number ${hintIndex + 1}.` : ''}
        Keep it concise (max 2 sentences). Do not give the full answer.`
        break
      case 'diagnose':
        base = `A student got this SQL error: "${context}" for question "${question.title}". `
        base += `Explain what went wrong and how to fix it in one sentence.`
        break
      case 'explain':
        base = `Explain the solution to this SQL question: "${question.description}" `
        base += `Type: ${type}. Answer given: "${context}". `
        base += 'Provide a clear explanation of the correct approach.'
        break
      case 'improve':
        base = `Student wrote this SQL: "${context}" for question "${question.description}". `
        base += 'Suggest specific improvements to make the query correct.'
        break
      default:
        base = `Help with SQL question: ${question.description}`
    }
    return base
  }
}

export const aiService = new AiService()
