import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AiClient } from '@/features/ai/AiClient'
import type { HintRequest, ErrorExplanationRequest, QueryExplanationRequest, AlternativeQueryRequest } from '@/features/ai/AiPrompts'

type AiProvider = 'openai' | 'anthropic' | 'openrouter' | 'custom'

interface PrivacySettings {
  sendSchemaOnly: boolean
  sendHistory: boolean
  sendProgress: boolean
}

interface AiState {
  provider: AiProvider
  model: string
  apiKey: string | null
  baseUrl: string | null
  privacySettings: PrivacySettings
  isConnected: boolean

  setProvider: (provider: AiProvider) => void
  setModel: (model: string) => void
  setApiKey: (key: string) => Promise<void>
  setBaseUrl: (url: string) => void
  setPrivacySettings: (settings: PrivacySettings) => void
  testConnection: () => Promise<boolean>
  generateHint: (request: HintRequest) => Promise<string>
  explainError: (request: ErrorExplanationRequest) => Promise<string>
  explainQuery: (request: QueryExplanationRequest) => Promise<string>
  suggestAlternatives: (request: AlternativeQueryRequest) => Promise<Array<{ sql: string; explanation: string }>>
  clearApiKey: () => Promise<void>
}

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: null,
      baseUrl: null,
      privacySettings: {
        sendSchemaOnly: true,
        sendHistory: false,
        sendProgress: false,
      },
      isConnected: false,

      setProvider: (provider) => set({ provider }),
      setModel: (model) => set({ model }),

      setApiKey: async (apiKey) => {
        const { encryptWithWebCrypto } = await import('@/features/ai/AiCrypto')
        const encrypted = await encryptWithWebCrypto(apiKey)
        localStorage.setItem('logixzen_ai_key', encrypted)
        set({ apiKey: encrypted })
      },

      setBaseUrl: (baseUrl) => set({ baseUrl }),

      setPrivacySettings: (privacySettings) => set({ privacySettings }),

      testConnection: async () => {
        const client = new AiClient(get())
        try {
          const result = await client.testConnection()
          set({ isConnected: result })
          return result
        } catch {
          set({ isConnected: false })
          return false
        }
      },

      generateHint: async (request) => {
        const client = new AiClient(get())
        return client.generateHint(request)
      },

      explainError: async (request) => {
        const client = new AiClient(get())
        return client.explainError(request)
      },

      explainQuery: async (request) => {
        const client = new AiClient(get())
        return client.explainQuery(request)
      },

      suggestAlternatives: async (request) => {
        const client = new AiClient(get())
        return client.suggestAlternatives(request)
      },

      clearApiKey: async () => {
        localStorage.removeItem('logixzen_ai_key')
        set({ apiKey: null, isConnected: false })
      },
    }),
    {
      name: 'logixzen-ai',
      version: 1,
    }
  )
)
