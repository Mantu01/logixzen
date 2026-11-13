import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AiClient } from "@/features/ai/AiClient";
import type {
  AlternativeQuery,
  AlternativeQueryRequest,
  ErrorExplanationRequest,
  HintRequest,
  QueryExplanationRequest,
} from "@/features/ai/AiPrompts";
import type { AiProvider } from "@/shared/desktop-api";
import { nativeStorage } from "@/lib/native-storage";

interface PrivacySettings {
  sendSchemaOnly: boolean;
  sendHistory: boolean;
  sendProgress: boolean;
}

interface AiState {
  provider: AiProvider;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
  privacySettings: PrivacySettings;
  isConnected: boolean;

  setProvider: (provider: AiProvider) => void;
  setModel: (model: string) => void;
  setApiKey: (key: string) => Promise<void>;
  refreshKey: () => Promise<void>;
  setBaseUrl: (url: string) => void;
  setPrivacySettings: (settings: PrivacySettings) => void;
  testConnection: () => Promise<boolean>;
  generateHint: (request: HintRequest) => Promise<string>;
  explainError: (request: ErrorExplanationRequest) => Promise<string>;
  explainQuery: (request: QueryExplanationRequest) => Promise<string>;
  suggestAlternatives: (request: AlternativeQueryRequest) => Promise<AlternativeQuery[]>;
  clearApiKey: () => Promise<void>;
}

function client(state: AiState): AiClient {
  return new AiClient({ provider: state.provider, model: state.model, baseUrl: state.baseUrl });
}

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: null,
      baseUrl: null,
      privacySettings: { sendSchemaOnly: true, sendHistory: false, sendProgress: false },
      isConnected: false,

      setProvider: (provider) => set({ provider }),
      setModel: (model) => set({ model }),

      setApiKey: async (apiKey) => {
        if (window.logixzen === undefined) {
          return;
        }
        await window.logixzen.secrets.store("ai_api_key", apiKey);
        set({ apiKey: "stored" });
      },

      refreshKey: async () => {
        if (window.logixzen === undefined) {
          return;
        }
        const stored = await window.logixzen.secrets.retrieve("ai_api_key");
        set({ apiKey: stored === null ? null : "stored" });
      },

      setBaseUrl: (baseUrl) => set({ baseUrl: baseUrl.trim() === "" ? null : baseUrl }),
      setPrivacySettings: (privacySettings) => set({ privacySettings }),

      testConnection: async () => {
        try {
          const result = await client(get()).testConnection();
          set({ isConnected: result });
          return result;
        } catch {
          set({ isConnected: false });
          return false;
        }
      },

      generateHint: (request) => client(get()).generateHint(request),
      explainError: (request) => client(get()).explainError(request),
      explainQuery: (request) => client(get()).explainQuery(request),
      suggestAlternatives: (request) => client(get()).suggestAlternatives(request),

      clearApiKey: async () => {
        await window.logixzen?.secrets.delete("ai_api_key");
        set({ apiKey: null, isConnected: false });
      },
    }),
    {
      name: "logixzen-ai",
      version: 1,
      storage: createJSONStorage(() => nativeStorage),
      partialize: (state) => ({
        provider: state.provider,
        model: state.model,
        baseUrl: state.baseUrl,
        privacySettings: state.privacySettings,
      }),
    },
  ),
);
