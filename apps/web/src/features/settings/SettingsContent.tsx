'use client'

import { useProgressStore } from '@/stores/useProgressStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { AiConfigSection } from '@/components/settings/AiConfigSection'
import { Settings, Type, Sun, Moon, MonitorSmartphone, Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { ImportDialog } from '@/components/import/ImportDialog'

export function SettingsContent(): React.ReactElement {
  const { settings, setTheme, setFontSize, exportProgress, importProgress, resetProgress } = useProgressStore()
  const setAppTheme = useThemeStore((state) => state.setTheme)
  const [importOpen, setImportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'combined' | 'questions' | 'schema' | 'notes'>('combined')

  const handleThemeChange = (t: 'light' | 'dark' | 'system'): void => {
    setTheme(t)
    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setAppTheme(prefersDark ? 'dark' : 'light')
    } else {
      setAppTheme(t)
    }
  }

  const handleExportProgress = (): void => {
    const data = exportProgress()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logixzen-progress-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = (): void => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
      resetProgress()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <span className="page-breadcrumb">Settings</span>
      </div>
      <div className="page-content overflow-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Appearance */}
          <section className="card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted" />
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted">Appearance</h2>
            </div>

            <div>
              <label className="text-xs font-mono text-muted mb-2 block">Theme</label>
              <div className="flex items-center gap-2">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border transition-fast ${
                      settings.theme === t
                        ? 'border-accent bg-accent-dim text-accent'
                        : 'border-border hover-bg text-secondary'
                    }`}
                  >
                    {t === 'light' && <Sun size={12} />}
                    {t === 'dark' && <Moon size={12} />}
                    {t === 'system' && <MonitorSmartphone size={12} />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Editor */}
          <section className="card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-muted" />
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted">Editor</h2>
            </div>

            <div>
              <label className="text-xs font-mono text-muted mb-2 block">
                Font Size: {settings.editorFontSize}px
              </label>
              <input
                type="range"
                min="12"
                max="20"
                value={settings.editorFontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted font-mono mt-1">
                <span>12px</span>
                <span>20px</span>
              </div>
            </div>
          </section>

          {/* Data Management */}
          <section className="card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-muted" />
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted">Data Management</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-muted mb-1.5 block">Export Progress</label>
                <div className="flex items-center gap-2">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
                    className="input input-sm w-40"
                  >
                    <option value="combined">Combined (All)</option>
                    <option value="questions">Questions Only</option>
                    <option value="schema">Schema Only</option>
                    <option value="notes">Notes Only</option>
                  </select>
                  <button className="btn btn-default btn-sm" onClick={handleExportProgress}>
                    <Download size={11} />
                    Export
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImportOpen(true)}
                  className="btn btn-default btn-sm"
                >
                  <Upload size={11} />
                  Import Data
                </button>
                <button
                  onClick={handleReset}
                  className="btn btn-danger btn-sm ml-auto"
                >
                  Reset Progress
                </button>
              </div>
            </div>
          </section>

          {/* AI Configuration */}
          <AiConfigSection />

          {/* About */}
          <section className="card p-4">
            <div className="font-mono text-sm font-semibold mb-2">About LogixZen</div>
            <div className="text-xs text-muted space-y-1">
              <p>Version: 0.2.0</p>
              <p>Built with Next.js 16, TypeScript, and SQLite WASM</p>
              <p>Learn SQL interactively with offline-first practice</p>
            </div>
          </section>
        </div>
      </div>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
