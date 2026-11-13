'use client'

import dynamic from 'next/dynamic'
import type { EditorProps } from '@monaco-editor/react'

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  { ssr: false, loading: () => null }
)

export interface SqlEditorProps {
  value: string
  onChange?: (value: string | undefined) => void
  onRun: () => void
  theme: 'vs-dark' | 'vs-light'
  readOnly?: boolean
}

export function SqlEditor({ value, onChange, onRun, theme }: SqlEditorProps): React.ReactElement {
  return (
    <MonacoEditor
      height="100%"
      language="sql"
      theme={theme}
      value={value}
      onChange={onChange}
      options={{
        minimap: { enabled: false },
        fontSize: 12,
        lineHeight: 19,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
        folding: true,
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        contextmenu: false,
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
        snippetSuggestions: 'top',
        cursorBlinking: 'solid',
        cursorSmoothCaretAnimation: 'off',
        smoothScrolling: false,
        selectionHighlight: true,
        scrollbar: { vertical: 'auto', horizontal: 'auto', useShadows: false },
        padding: { top: 8, bottom: 8 },
        renderWhitespace: 'selection',
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        glyphMargin: false,
        lineDecorationsWidth: 8,
        copyWithSyntaxHighlighting: true,
        multiCursorModifier: 'alt',
        links: false,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
      } satisfies EditorProps['options']}
      onMount={(editor) => {
        if (!editor) return
        editor.onKeyDown((event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault()
            onRun()
          }
        })
      }}
    />
  )
}
