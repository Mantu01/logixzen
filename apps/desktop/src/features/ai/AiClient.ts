import {
  buildAlternativesPrompt,
  buildErrorExplanationPrompt,
  buildHintPrompt,
  buildQueryExplanationPrompt,
  type AlternativeQuery,
  type AlternativeQueryRequest,
  type ErrorExplanationRequest,
  type HintRequest,
  type QueryExplanationRequest,
} from "./AiPrompts";
import type { AiProvider } from "@/shared/desktop-api";

interface AiConfig {
  provider: AiProvider;
  model: string;
  baseUrl: string | null;
}

export class AiClient {
  private config: AiConfig;

  constructor(config: AiConfig) {
    this.config = config;
  }

  private async complete(prompt: string, maxTokens = 1024): Promise<string> {
    if (window.logixzen === undefined) {
      throw new Error("Desktop bridge unavailable");
    }
    return window.logixzen.ai.complete({
      provider: this.config.provider,
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      prompt,
      maxTokens,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.complete("Reply with the single word: ok", 10);
      return true;
    } catch {
      return false;
    }
  }

  async generateHint(request: HintRequest): Promise<string> {
    return this.complete(buildHintPrompt(request));
  }

  async explainError(request: ErrorExplanationRequest): Promise<string> {
    return this.complete(buildErrorExplanationPrompt(request));
  }

  async explainQuery(request: QueryExplanationRequest): Promise<string> {
    return this.complete(buildQueryExplanationPrompt(request));
  }

  async suggestAlternatives(request: AlternativeQueryRequest): Promise<AlternativeQuery[]> {
    const response = await this.complete(buildAlternativesPrompt(request));
    return response
      .split(/ALTERNATIVE:/i)
      .slice(1)
      .map((block) => {
        const lines = block.trim().split("\n");
        const sql = (lines[0] ?? "").trim();
        const explanation =
          lines.find((line) => line.toLowerCase().startsWith("explanation:"))?.replace(/^explanation:\s*/i, "") ??
          "";
        return { sql, explanation };
      })
      .filter((alternative) => alternative.sql.length > 0);
  }
}
