'use client'

import { useState, useCallback } from 'react'
import { Bot, Key, Link, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useAiStore } from '@/stores/useAiStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type AiProvider = 'openai' | 'anthropic' | 'openrouter' | 'custom'

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: 'Custom' },
]

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
  } = useAiStore()

  const [showKey, setShowKey] = useState<boolean>(false)
  const [testLoading, setTestLoading] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null)
  const [modelInput, setModelInput] = useState<string>(model)
  const [baseUrlInput, setBaseUrlInput] = useState<string>(baseUrl ?? '')
  const [apiKeyInput, setApiKeyInput] = useState<string>('')

  const handleSaveApiKey = useCallback(async (): Promise<void> => {
    if (!apiKeyInput.trim()) return
    await setApiKey(apiKeyInput)
    setApiKeyInput('')
  }, [apiKeyInput, setApiKey])

  const handleTestConnection = useCallback(async (): Promise<void> => {
    setTestLoading(true)
    setTestResult(null)
    const result = await testConnection()
    setTestResult(result ? 'success' : 'failed')
    setTestLoading(false)
  }, [testConnection])

  const handleClearKey = useCallback(async (): Promise<void> => {
    await clearApiKey()
    setTestResult(null)
  }, [clearApiKey])

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-sm">
          <Bot className="h-4 w-4 text-primary" />
          AI Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="font-mono text-xs text-muted">Provider</Label>
          <Select value={provider} onValueChange={(value) => setProvider(value as AiProvider)}>
            <SelectTrigger className="w-full font-mono text-xs">
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

        <div className="space-y-2">
          <Label className="font-mono text-xs text-muted">Model</Label>
          <Input
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onBlur={() => setModel(modelInput)}
            placeholder="gpt-4o-mini"
            className="font-mono text-xs"
          />
        </div>

        {provider === 'custom' && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1 font-mono text-xs text-muted">
              <Link className="h-3 w-3" /> Base URL
            </Label>
            <Input
              value={baseUrlInput}
              onChange={(e) => setBaseUrlInput(e.target.value)}
              onBlur={() => setBaseUrl(baseUrlInput)}
              placeholder="https://api.example.com"
              className="font-mono text-xs"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="flex items-center gap-1 font-mono text-xs text-muted">
            <Key className="h-3 w-3" /> API Key
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={apiKey ? '••••••••••••' : 'sk-...'}
                className="pr-9 font-mono text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
            <Button onClick={() => void handleSaveApiKey()} disabled={!apiKeyInput.trim()} size="sm" className="font-mono text-xs">
              Save
            </Button>
          </div>
          {apiKey && (
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted">Key configured</span>
              <Button
                variant="link"
                size="xs"
                onClick={() => void handleClearKey()}
                className="font-mono text-destructive"
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleTestConnection()}
            disabled={testLoading || !apiKey}
            size="sm"
            variant="outline"
            className="font-mono text-xs"
          >
            {testLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            Test Connection
          </Button>
          {testResult === 'success' && <CheckCircle2 className="h-4 w-4 text-success" />}
          {testResult === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="flex items-center gap-1 font-mono text-xs text-muted">
            <Eye className="h-3 w-3" /> Privacy Settings
          </Label>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 font-mono text-xs">
              <Checkbox
                checked={privacySettings.sendSchemaOnly}
                onCheckedChange={(checked) =>
                  setPrivacySettings({ ...privacySettings, sendSchemaOnly: checked === true })
                }
              />
              Send schema only (no data)
            </Label>
            <Label className="flex items-center gap-2 font-mono text-xs">
              <Checkbox
                checked={privacySettings.sendHistory}
                onCheckedChange={(checked) =>
                  setPrivacySettings({ ...privacySettings, sendHistory: checked === true })
                }
              />
              Send query history
            </Label>
            <Label className="flex items-center gap-2 font-mono text-xs">
              <Checkbox
                checked={privacySettings.sendProgress}
                onCheckedChange={(checked) =>
                  setPrivacySettings({ ...privacySettings, sendProgress: checked === true })
                }
              />
              Send progress data
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
