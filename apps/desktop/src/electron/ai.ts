import { net } from "electron";
import type { AiCompletionRequest } from "../shared/desktop-api";
import { retrieveSecret } from "./secrets";

interface ErrorBody {
  error?: { message?: string };
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  content?: Array<{ text?: string }>;
}

function endpointFor(request: AiCompletionRequest): string {
  switch (request.provider) {
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "openrouter":
      return "https://openrouter.ai/api/v1/chat/completions";
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "custom": {
      if (request.baseUrl === null || request.baseUrl.trim() === "") {
        throw new Error("Custom provider requires a base URL");
      }
      return request.baseUrl;
    }
  }
}

function headersFor(
  request: AiCompletionRequest,
  apiKey: string,
): Record<string, string> {
  if (request.provider === "anthropic") {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export async function completeAi(
  request: AiCompletionRequest,
): Promise<string> {
  const apiKey = retrieveSecret("ai_api_key");
  if (apiKey === null || apiKey.trim() === "") {
    throw new Error("No AI API key configured");
  }

  const endpoint = endpointFor(request);
  const body = {
    model: request.model,
    max_tokens: request.maxTokens ?? 1024,
    messages: [{ role: "user", content: request.prompt }],
  };

  const response = await net.fetch(endpoint, {
    method: "POST",
    headers: headersFor(request, apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new Error(
      error.error?.message ?? `AI request failed (${response.status})`,
    );
  }

  const data = (await response.json()) as ChatResponse;
  return request.provider === "anthropic"
    ? (data.content?.[0]?.text ?? "")
    : (data.choices?.[0]?.message?.content ?? "");
}
