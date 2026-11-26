"use client";

import { useCallback, useState } from "react";
import {
  Bot,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Key,
  Link,
} from "lucide-react";
import { useAiStore } from "@/stores/useAiStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AiProvider = "openai" | "anthropic" | "openrouter" | "custom";

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom" },
];

export function AiConfigSection(): React.ReactElement {
  const {
    provider,
    model,
    apiKey,
    baseUrl,
    privacySettings,
    setProvider,
    setModel,
    setApiKey,
    setBaseUrl,
    setPrivacySettings,
    testConnection,
    clearApiKey,
  } = useAiStore();

  const [showKey, setShowKey] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "failed" | null>(
    null,
  );
  const [modelInput, setModelInput] = useState(model);
  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl ?? "");
  const [apiKeyInput, setApiKeyInput] = useState("");

  const handleSaveApiKey = useCallback(async (): Promise<void> => {
    if (!apiKeyInput.trim()) return;
    await setApiKey(apiKeyInput);
    setApiKeyInput("");
  }, [apiKeyInput, setApiKey]);

  const handleTestConnection = useCallback(async (): Promise<void> => {
    setTestLoading(true);
    setTestResult(null);
    const result = await testConnection();
    setTestResult(result ? "success" : "failed");
    setTestLoading(false);
  }, [testConnection]);

  const handleClearKey = useCallback(async (): Promise<void> => {
    await clearApiKey();
    setTestResult(null);
  }, [clearApiKey]);

  return (
    <div className="border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="size-3.5 text-primary" />
        <span className="section-label">AI configuration</span>
        {testResult === "success" ? (
          <CheckCircle2 className="ml-auto size-3.5 text-success" />
        ) : null}
        {testResult === "failed" ? (
          <XCircle className="ml-auto size-3.5 text-destructive" />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[11.5px] text-muted">Provider</Label>
          <Select
            value={provider}
            onValueChange={(value) => setProvider(value as AiProvider)}
          >
            <SelectTrigger className="w-full text-[12px]">
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11.5px] text-muted">Model</Label>
          <Input
            value={modelInput}
            onChange={(event) => setModelInput(event.target.value)}
            onBlur={() => setModel(modelInput)}
            placeholder="gpt-4o-mini"
            className="font-mono text-[12px]"
          />
        </div>

        {provider === "custom" ? (
          <div className="col-span-2 space-y-1.5">
            <Label className="flex items-center gap-1 text-[11.5px] text-muted">
              <Link className="size-3" /> Base URL
            </Label>
            <Input
              value={baseUrlInput}
              onChange={(event) => setBaseUrlInput(event.target.value)}
              onBlur={() => setBaseUrl(baseUrlInput)}
              placeholder="https://api.example.com"
              className="font-mono text-[12px]"
            />
          </div>
        ) : null}

        <div className="col-span-2 space-y-1.5">
          <Label className="flex items-center gap-1 text-[11.5px] text-muted">
            <Key className="size-3" /> API key
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder={apiKey ? "••••••••••••" : "sk-..."}
                className="pr-9 font-mono text-[12px]"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                    onClick={() => setShowKey((value) => !value)}
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                  >
                    {showKey ? (
                      <EyeOff className="size-3" />
                    ) : (
                      <Eye className="size-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showKey ? "Hide API key" : "Show API key"}
                </TooltipContent>
              </Tooltip>
            </div>
            <Button
              onClick={() => void handleSaveApiKey()}
              disabled={!apiKeyInput.trim()}
              size="sm"
            >
              Save
            </Button>
            {apiKey ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => void handleClearKey()}
              >
                Clear
              </Button>
            ) : null}
          </div>
          {apiKey ? (
            <p className="text-[10.5px] text-success">
              Key configured — stored securely on this machine.
            </p>
          ) : null}
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <Button
            onClick={() => void handleTestConnection()}
            disabled={testLoading || !apiKey}
            size="sm"
            variant="outline"
          >
            {testLoading ? <Loader2 className="size-3 animate-spin" /> : null}
            Test connection
          </Button>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <Label className="mb-2 flex items-center gap-1 text-[11.5px] text-muted">
          <Eye className="size-3" /> Privacy
        </Label>
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-[12px]">
            <Checkbox
              checked={privacySettings.sendSchemaOnly}
              onCheckedChange={(checked) =>
                setPrivacySettings({
                  ...privacySettings,
                  sendSchemaOnly: checked === true,
                })
              }
            />
            Send schema only (no data)
          </Label>
          <Label className="flex items-center gap-2 text-[12px]">
            <Checkbox
              checked={privacySettings.sendHistory}
              onCheckedChange={(checked) =>
                setPrivacySettings({
                  ...privacySettings,
                  sendHistory: checked === true,
                })
              }
            />
            Send query history
          </Label>
          <Label className="flex items-center gap-2 text-[12px]">
            <Checkbox
              checked={privacySettings.sendProgress}
              onCheckedChange={(checked) =>
                setPrivacySettings({
                  ...privacySettings,
                  sendProgress: checked === true,
                })
              }
            />
            Send progress data
          </Label>
        </div>
      </div>
    </div>
  );
}
