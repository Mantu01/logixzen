import { decryptWithWebCrypto } from './AiCrypto'
import {
  buildHintPrompt,
  buildErrorExplanationPrompt,
  buildQueryExplanationPrompt,
  buildAlternativesPrompt,
  type HintRequest,
  type ErrorExplanationRequest,
  type QueryExplanationRequest,
  type AlternativeQueryRequest,
  type AlternativeQuery,
} from './AiPrompts'

type AiProvider = 'openai' | 'anthropic' | 'openrouter' | 'custom'

interface PrivacySettings {
  sendSchemaOnly: boolean
  sendHistory: boolean
  sendProgress: boolean
}

interface AiConfig {
  provider: AiProvider
  model: string
  apiKey: string | null
  baseUrl: string | null
  privacySettings: PrivacySettings
}

interface ErrorResponse {
  error?: { message?: string }
}

interface AiResponse {
  choices?: [{ message?: { content?: string } }]
  content?: [{ text?: string }]
}

export class AiClient {
  private config: AiConfig

  constructor(config: AiConfig) {
    this.config = config
  }

  private getEndpoint(): string {
    switch (this.config.provider) {
      case 'openai':
        return 'https://api.openai.com/v1/chat/completions'
      case 'anthropic':
        return 'https://api.anthropic.com/v1/messages'
      case 'openrouter':
        return 'https://openrouter.ai/api/v1/chat/completions'
      case 'custom':
        if (!this.config.baseUrl) throw new Error('Custom provider requires a base URL')
        return this.config.baseUrl
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`)
    }
  }

  private getHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    switch (this.config.provider) {
      case 'openai':
      case 'openrouter':
        headers['Authorization'] = `Bearer ${apiKey}`
        break
      case 'anthropic':
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
        break
      case 'custom':
        headers['Authorization'] = `Bearer ${apiKey}`
        break
    }

    return headers
  }

  private async decryptApiKey(): Promise<string> {
    if (!this.config.apiKey) throw new Error('No API key configured')
    return decryptWithWebCrypto(this.config.apiKey)
  }

  async testConnection(): Promise<boolean> {
    try {
      const endpoint = this.getEndpoint()
      const key = await this.decryptApiKey()

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(key),
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'Say hello' }],
          max_tokens: 10,
        }),
      })

      return response.ok
    } catch {
      return false
    }
  }

  async generateHint(request: HintRequest): Promise<string> {
    const prompt = buildHintPrompt(request)
    return this.callWithPrompt(prompt)
  }

  async explainError(request: ErrorExplanationRequest): Promise<string> {
    const prompt = buildErrorExplanationPrompt(request)
    return this.callWithPrompt(prompt)
  }

  async explainQuery(request: QueryExplanationRequest): Promise<string> {
    const prompt = buildQueryExplanationPrompt(request)
    return this.callWithPrompt(prompt)
  }

  async suggestAlternatives(request: AlternativeQueryRequest): Promise<AlternativeQuery[]> {
    const prompt = buildAlternativesPrompt(request)
    const response = await this.callWithPrompt(prompt)
    return this.parseAlternativesResponse(response)
  }

  private async callWithPrompt(prompt: string): Promise<string> {
    const endpoint = this.getEndpoint()
    const key = await this.decryptApiKey()
    const isAnthropic = this.config.provider === 'anthropic'

    const body = isAnthropic
      ? {
          model: this.config.model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }
      : {
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
        }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(key),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json() as ErrorResponse
      throw new Error(error.error?.message ?? 'AI request failed')
    }

    const data = await response.json() as AiResponse
    return this.extractContent(data, isAnthropic)
  }

  private extractContent(data: AiResponse, isAnthropic: boolean): string {
    if (isAnthropic) {
      return data.content?.[0]?.text ?? ''
    }
    return data.choices?.[0]?.message?.content ?? ''
  }

  private parseAlternativesResponse(response: string): AlternativeQuery[] {
    const alternatives: AlternativeQuery[] = []
    const blocks = response.split(/ALTERNATIVE:/i).slice(1)

    for (const block of blocks) {
      const lines = block.trim().split('\n')
      const sql = lines[0]?.trim()
      const explanationLine = lines.find((l) => l.toLowerCase().startsWith('explanation:'))
      const explanation = explanationLine ? explanationLine.replace(/^explanation:\s*/i, '') : ''

      if (sql) {
        alternatives.push({ sql, explanation })
      }
    }

    return alternatives
  }
}
