"use client";

import { useMemo } from "react";
import CodeMirror, { EditorView, type Extension } from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";

interface SqlCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  onSubmit?: () => void;
  fontSize?: number;
  placeholder?: string;
  readOnly?: boolean;
  tables?: Record<string, string[]>;
  minHeight?: string;
  maxHeight?: string;
}

export function SqlCodeEditor({
  value,
  onChange,
  onRun,
  onSubmit,
  fontSize = 13,
  placeholder,
  readOnly = false,
  tables,
  minHeight = "120px",
  maxHeight = "none",
}: SqlCodeEditorProps): React.ReactElement {
  const extensions = useMemo(() => {
    const list: Extension[] = [
      sql({ dialect: PostgreSQL, schema: tables, upperCaseKeywords: true }),
      syntaxHighlighting(highlightStyle),
      EditorView.lineWrapping,
      Prec.high(
        keymap.of([
          {
            key: "Mod-Enter",
            preventDefault: true,
            run: () => {
              if (onRun === undefined) return false;
              onRun();
              return true;
            },
          },
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              if (onSubmit === undefined) return false;
              onSubmit();
              return true;
            },
          },
        ]),
      ),
    ];
    return list;
  }, [tables, onRun, onSubmit]);

  return (
    <div
      data-editor-root
      className="cm-logixzen h-full min-h-0 overflow-hidden"
      style={{ minHeight, maxHeight }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        theme={theme}
        extensions={extensions}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          highlightSelectionMatches: false,
          tabSize: 2,
        }}
        style={{ fontSize, height: "100%" }}
      />
    </div>
  );
}

const theme = EditorView.theme({
  "&": {
    color: "var(--foreground)",
    backgroundColor: "var(--editor)",
  },
  ".cm-content": {
    caretColor: "var(--primary)",
    fontFamily: "var(--font-mono)",
    padding: "8px 0",
  },
  ".cm-line": {
    padding: "0 12px",
  },
  ".cm-placeholder": {
    color: "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "var(--primary)", fontWeight: "600" },
  { tag: [t.string, t.special(t.string)], color: "var(--success)" },
  { tag: [t.number, t.integer, t.float], color: "var(--warning)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "color-mix(in oklab, var(--muted-foreground) 70%, transparent)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--info)" },
  { tag: [t.operator, t.operatorKeyword], color: "var(--foreground)" },
  { tag: [t.punctuation, t.separator], color: "var(--muted-foreground)" },
  { tag: [t.bool, t.null], color: "var(--warning)", fontWeight: "600" },
  { tag: [t.typeName, t.className], color: "var(--info)" },
  { tag: [t.variableName, t.propertyName], color: "var(--foreground)" },
  { tag: [t.meta, t.processingInstruction], color: "var(--muted-foreground)" },
  { tag: t.invalid, color: "var(--error)" },
]);
