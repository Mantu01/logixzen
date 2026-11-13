'use client'

import { useState, useCallback } from 'react'
import { Bot, Key, Link, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useAiStore } from '@/stores/useAiStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type AiProvider = 'openai' | 'anthropic' | 'openrouter' | 'custom'

export function AiConfigSection(): React.ReactElement {
  const {
    provider, model, apiKey, baseUrl, privacySettings,
    setProvider, setModel, setApiKey, setBaseUrl, setPrivacySettings,
    testConnection, clearApiKey,
  } = useAiStore()

  const [showKey, setShowKey] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null)
  const [modelInput, setModelInput] = useState(model)
  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl ?? '')
  const [apiKeyInput, setApiKeyInput] = useState('')

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
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-mono">
          <Bot className="w-4 h-4 text-primary" />
          AI Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-muted">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AiProvider)}
            className="w-full text-xs font-mono bg-background border border-border rounded px-2 py-1.5 outline-none focus:border-primary"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="openrouter">OpenRouter</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Model */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-muted">Model</label>
          <Input
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onBlur={() => setModel(modelInput)}
            placeholder="gpt-4o-mini"
            className="text-xs font-mono h-8"
          />
        </div>

        {/* Base URL (custom) */}
        {provider === 'custom' && (
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted flex items-center gap-1">
              <Link className="w-3 h-3" />
              Base URL
            </label>
            <Input
              value={baseUrlInput}
              onChange={(e) => setBaseUrlInput(e.target.value)}
              onBlur={() => setBaseUrl(baseUrlInput)}
              placeholder="https://api.example.com"
              className="text-xs font-mono h-8"
            />
          </div>
        )}

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-muted flex items-center gap-1">
            <Key className="w-3 h-3" />
            API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={apiKey ? '••••••••••••' : 'sk-...'}
                className="text-xs font-mono h-8 pr-8"
              />
              <button
                onClick={() => setShowKey(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
            <Button
              onClick={() => void handleSaveApiKey()}
              disabled={!apiKeyInput.trim()}
              size="sm"
              className="h-8 text-xs font-mono"
            >
              Save
            </Button>
          </div>
          {apiKey && (
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted">Key configured</span>
              <button onClick={() => void handleClearKey()} className="text-error hover:underline font-mono">
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Test Connection */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleTestConnection()}
            disabled={testLoading || !apiKey}
            size="sm"
            variant="outline"
            className="h-8 text-xs font-mono"
          >
            {testLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Test Connection
          </Button>
          {testResult === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
          {testResult === 'failed' && <XCircle className="w-4 h-4 text-error" />}
        </div>

        {/* Privacy */}
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="text-xs font-mono text-muted flex items-center gap-1">
            <Eye className="w-3 h-3" />
            Privacy Settings
          </label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-mono">
              <input
                type="checkbox"
                checked={privacySettings.sendSchemaOnly}
                onChange={(e) => setPrivacySettings({ ...privacySettings, sendSchemaOnly: e.target.checked })}
                className="accent-primary"
              />
              Send schema only (no data)
            </label>
            <label className="flex items-center gap-2 text-xs font-mono">
              <input
                type="checkbox"
                checked={privacySettings.sendHistory}
                onChange={(e) => setPrivacySettings({ ...privacySettings, sendHistory: e.target.checked })}
                className="accent-primary"
              />
              Send query history
            </label>
            <label className="flex items-center gap-2 text-xs font-mono">
              <input
                type="checkbox"
                checked={privacySettings.sendProgress}
                onChange={(e) => setPrivacySettings({ ...privacySettings, sendProgress: e.target.checked })}
                className="accent-primary"
              />
              Send progress data
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
