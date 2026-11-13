// AI configuration — stored in AsyncStorage
export interface AiConfig {
  enabled: boolean
  // Provider-specific settings
  provider: 'logixzen' | 'openai' | 'anthropic'
  apiKey?: string
  baseUrl?: string
}

export const AI_CONFIG_KEY = 'logixzen_ai_config'
export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  provider: 'logixzen',
  baseUrl: '',
}
