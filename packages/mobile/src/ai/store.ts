import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import type { AiConfig } from './config'
import { AI_CONFIG_KEY, DEFAULT_AI_CONFIG } from './config'

interface AiStoreState {
  config: AiConfig
  loadConfig: () => Promise<void>
  saveConfig: (config: AiConfig) => Promise<void>
  toggleEnabled: (enabled: boolean) => Promise<void>
}

export const useAiStore = create<AiStoreState>((set, get) => ({
  config: { ...DEFAULT_AI_CONFIG },

  loadConfig: async () => {
    try {
      const stored = await AsyncStorage.getItem(AI_CONFIG_KEY)
      if (stored) {
        const parsed: AiConfig = JSON.parse(stored)
        set({ config: parsed })
      }
    } catch {
      set({ config: { ...DEFAULT_AI_CONFIG } })
    }
  },

  saveConfig: async (config: AiConfig) => {
    await AsyncStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config))
    set({ config })
  },

  toggleEnabled: async (enabled: boolean) => {
    const next = { ...get().config, enabled }
    await AsyncStorage.setItem(AI_CONFIG_KEY, JSON.stringify(next))
    set({ config: next })
  },
}))
