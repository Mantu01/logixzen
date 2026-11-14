# LogixZen Desktop — Developer Guide

Technical reference for contributors. Covers architecture, IPC interface, store contracts, pack formats, question validators, extension points and build process.

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [IPC bridge reference](#2-ipc-bridge-reference)
3. [Stores & state management](#3-stores--state-management)
4. [SQL engine internals](#4-sql-engine-internals)
5. [Pack format specification](#5-pack-format-specification)
6. [Question types & validation](#6-question-types--validation)
7. [Grading engine](#7-grading-engine)
8. [AI assistant integration](#8-ai-assistant-integration)
9. [Build & run](#9-build--run)
10. [Extending the app](#10-extending-the-app)

---

## 1. Architecture overview

### Tech stack

| Layer | Technology |
|---|---|
| Shell | Electron 45 (nodeIntegration: false, contextIsolation: true, sandbox: true) |
| UI framework | Next.js 16 App Router / React 19 |
| State | Zustand with `persist` middleware (localStorage in renderer; native storage via IPC in main) |
| Editor | CodeMirror 6 (`@codemirror/lang-sql` with PostgreSQL dialect) |
| Diagrams | `@xyflow/react` (React Flow) |
| UI primitives | Radix UI + Tailwind CSS v4 |
| Data engine | `node:sqlite` (`DatabaseSync`) running in-memory SQLite |

### Process model

```
┌─────────────────────────────────────────────────────┐
│  Electron Main Process                               │
│                                                      │
│  main.ts   → creates BrowserWindow                   │
│              registers app protocol (logixzen://)    │
│              builds ApplicationMenu                    │
│              creates system tray                       │
│                                                      │
│  ipc.ts    → registers all handlers                  │
│              DesktopSqlEngine instance               │
│                                                      │
│  storage.ts → key-value store (localStorage shim)    │
│  secrets.ts → OS keychain-backed secrets             │
│  dialogs.ts → native file open/save dialogs          │
│  menu.ts   → macOS/Win/Linux application menus       │
│  tray.ts   → system tray icon with navigation        │
│                                                      │
│  sql/engine.ts → DesktopSqlEngine (SQLite in-memory) │
│  ai.ts     → AI completion handler                   │
│  notifications.ts → badge/streak native notifications│
└─────────────────────────────────────────────────────┘
                          ↕ IPC
┌─────────────────────────────────────────────────────┐
│  Renderer Process (Next.js)                         │
│                                                      │
│  src/app/layout.tsx  → root layout                   │
│  src/components/     → shared UI components          │
│  src/features/       → domain feature modules        │
│  src/stores/         → Zustand stores                │
│  src/electron/       → preload bridge wiring         │
│  src/sql/            → SQL store wrapper             │
│                                                      │
│  desktop-api.ts  → TypeScript interfaces exposed     │
│                     via contextBridge                │
│  use-desktop-bridge.ts → hook to detect Electron vs browser│
└─────────────────────────────────────────────────────┘
```

### Key design decisions

- **No direct database access from renderer**: All SQL executes in the main process. The renderer communicates through typed IPC calls (`window.logixzen.database.*`).
- **In-memory SQLite only**: Every database lives as an in-memory `DatabaseSync`. There is no disk persistence for data; everything resets on app restart unless re-imported.
- **Progress is local-first**: All progress data is stored in `nativeStorage` (platform-native keychain when available, falls back to localStorage). It can be exported/imported as JSON but is not synced to any server.
- **AI keys in OS keychain**: API keys are never stored in JavaScript-accessible memory after first save. They go through the `secrets:*` IPC channel to the main process where they live in the platform keychain.
- **Sandboxed execution for grading**: When grading a student answer, a fresh isolated SQLite instance is spun up with `isolatedRun()`, so student queries cannot observe or mutate another student's answers.

### Routing map

| Route | Page component | Purpose |
|---|---|---|
| `/` | `src/app/page.tsx` | Dashboard |
| `/import` | `src/app/import/page.tsx` | Data Hub |
| `/schema` | `src/app/schema/page.tsx` | Databases explorer |
| `/playground` | `src/app/playground/page.tsx` | SQL editor |
| `/learn` | `src/app/learn/page.tsx` | Topic list |
| `/learn/topic` | `src/app/learn/topic/page.tsx` | Question list (query param `?id=`) |
| `/learn/practice` | `src/app/learn/practice/page.tsx` | Question workspace (query params `?topic=&q=`) |
| `/notes` | `src/app/notes/page.tsx` | Notes viewer |
| `/progress` | `src/app/progress/page.tsx` | Stats & badges |
| `/settings` | `src/app/settings/page.tsx` | Settings |

Menu navigation uses a custom `logixzen://` protocol and IPC `navigate` events — handled by `MenuNavigation` component via `useDesktopBridge`.

---

## 2. IPC bridge reference

The bridge is exposed on `window.logixzen` via `contextBridge.exposeInMainWorld`. All methods are async (return Promises).

### `window.logixzen.window`

Control the native window chrome.

```typescript
minimize(): void
maximize(): void      // toggles fullscreen/maximized
close(): void
```

### `window.logixzen.storage`

Key-value storage backed by platform native storage (or localStorage fallback).

```typescript
get(key: string): Promise<string | null>
set(key: string, value: string): Promise<void>
delete(key: string): Promise<void>
getAll(): Promise<Record<string, string>>
```

Used internally by packs store for persisting imported content between sessions.

### `window.logixzen.secrets`

OS keychain-backed storage for sensitive values.

```typescript
store(key: string, value: string): Promise<void>
retrieve(key: string): Promise<string | null>
delete(key: string): Promise<void>
```

Currently used only for the AI API key (`"ai_api_key"`).

### `window.logixzen.dialog`

Native file picker dialogs.

```typescript
interface FileFilter { name: string; extensions: string[] }
interface OpenFileOptions { title?: string; filters?: FileFilter[] }
interface SaveFileOptions extends OpenFileOptions { defaultPath?: string }

openFile(options?: OpenFileOptions): Promise<string | null>  // null if cancelled
saveFile(options?: SaveFileOptions): Promise<string | null> // null if cancelled
```

### `window.logixzen.database`

The SQL engine. Every method delegates to `DesktopSqlEngine`.

```typescript
// Lifecycle
initialize(setupSql?: string, name?: string): Promise<void>
use(name: string): Promise<void>
list(): Promise<string[]>        // returns array of loaded database names
close(): Promise<void>

// Execution
execute(sql: string): Promise<SqlResult[]>
reset(setupSql?: string): Promise<void>   // reload current DB from setup SQL
isolatedRun(setupSql: string, sql: string): Promise<SqlResult[]>  // graded execution

// Import
loadSqlFile(filePath: string): Promise<void>   // reads and loads a .sql file into current DB
loadSqliteFile(filePath: string): Promise<void> // opens a .sqlite file read-only
importCsv(filePath: string, tableName: string): Promise<number>  // returns rows inserted

// Schema
getSchema(): Promise<TableInfo[]>
```

### `window.logixzen.files`

Simple text file I/O (read-only from disk).

```typescript
readText(filePath: string): Promise<string>
writeText(filePath: string, content: string): Promise<void>
```

### `window.logixzen.ai`

LLM completion proxy. Routes to the configured provider in the main process.

```typescript
interface AiCompletionRequest {
  provider: "openai" | "anthropic" | "openrouter" | "custom"
  model: string
  baseUrl: string | null   // used only when provider === "custom"
  prompt: string
  maxTokens?: number
}

complete(request: AiCompletionRequest): Promise<string>
```

### `window.logixzen.notifications`

Native OS notifications.

```typescript
badge(title: string, body: string): Promise<void>   // fired when a badge is earned
streak(streak: number): Promise<void>                // fired at streak >= 3
```

### `window.logixzen.menu`

Subscribe to menu navigation events (from the application menu / tray).

```typescript
onNavigate(callback: (path: string) => void): () => void  // returns unsubscribe function
```

### `window.logixzen.system`

```typescript
getVersion(): Promise<string>
getPlatform(): Promise<string>    // "win32" | "darwin" | "linux"
getName(): Promise<string>        // "LogixZen"
```

---

## 3. Stores & state management

All stores use Zustand with `persist` middleware. Persistence key = `"logixzen-*"`.

### `usePackStore` — data packs

```typescript
interface PackState {
  hydrated: boolean                        // true once localStorage is populated
  databases: Dataset[]
  questions: Question[]
  topics: Topic[]
  notes: Note[]
}

interface PackActions {
  importFile(text: string): PackImportOutcome   // auto-detects kind
  importDatabases(text: string): PackImportOutcome
  importQuestions(text: string): PackImportOutcome
  importNotes(text: string): PackImportOutcome
  addDataset(dataset: Dataset): void
  removeDataset(datasetId: string): void
  clearPack(kind: PackKind): void
  resetAll(): void
}
```

`PackImportOutcome`: `{ ok, kind, issues[], added, updated }`

Validation runs Zod schemas against incoming JSON before merging. Merges by `id` (adds new, keeps existing). `topics` are auto-derived from questions if none are provided in the pack.

### `useProgressStore` — learning progress

```typescript
interface ProgressState {
  solvedQuestions: Map<string, QuestionResult>  // questionId → { timestamp, attempts, bestTimeMs, hintsUsed }
  totalPoints: number
  streak: StreakState                           // { currentStreak, lastActiveDate, longestStreak }
  activity: Map<string, number>                 // dateISO → count of solves
  lastPosition: { topicId, questionId } | null
  badges: BadgeState                            // { earned: Map<id, { timestamp }> }
  settings: EditorSettings                      // { editorFontSize }
}
```

Persistence version: `3`. Migration strategy resets unknown fields to defaults on schema mismatch.

Export format (`ProgressExportFile`):
```json
{
  "version": 3,
  "exportedAt": "2026-11-13T...",
  "solvedQuestions": [["q-id", {"timestamp":..., "attempts":1, "bestTimeMs":4500, "hintsUsed":0}]],
  "totalPoints": 320,
  "streak": {"currentStreak": 3, "lastActiveDate": "2026-11-13", "longestStreak": 5},
  "activity": [["2026-11-10", 2], ["2026-11-11", 1]],
  "badges": [["first-query", {"timestamp": ...}]],
  "lastPosition": {"topicId": "select-basics", "questionId": "sb-01"}
}
```

### `useSqlStore` — active database session

```typescript
interface SqlStoreState {
  isInitialized: boolean
  isLoading: boolean
  lastResult: SqlResult[] | null
  schema: TableInfo[]
  error: string | null
  activeDatasetId: string | null
}
```

Actions: `activateDataset`, `execute`, `refreshSchema`, `reseed`, `clearError`. Automatically syncs schema metadata back into the pack store after activation.

### `useQueryHistoryStore`

Last 50 executed queries in the playground, each stamped with success/failure. Purged automatically on new entries beyond the limit.

### `useSnippetsStore`

User-created query snippets with titles. Persisted independently.

### `useAiStore`

Provider, model, base URL, privacy settings. API key is stored externally via secrets IPC.

---

## 4. SQL engine internals

### `DesktopSqlEngine` (`src/electron/sql/engine.ts`)

Wraps Node.js built-in `DatabaseSync` (SQLite). Runs entirely in-memory.

**Security rules** — these patterns are rejected before any SQL reaches SQLite:

| Blocked pattern | Reason |
|---|---|
| `ATTACH` | Prevents loading external databases |
| `DETACH` | Prevents removing in-memory databases |
| `LOAD_EXTENSION` | Blocks arbitrary native code |
| `IMPORT` | Blocks CSV import via SQL command |
| `CREATE VIRTUAL TABLE` | Prevents custom table types |

**Statement splitting** handles:
- Semicolon-delimited statements
- `GO` batch separators (SQL Server style)
- Single-quoted strings with escape sequences (`''`)
- Double-quoted identifiers with escape sequences (`""`)
- Line comments (`--`) and block comments (`/* */`)

**Max rows per SELECT**: 1,000. Results beyond this are silently truncated (for performance).

**Error translation**: Common SQLite errors are mapped to user-friendly messages:
- `"no such table"` → "Table not found. Check the spelling or explore the schema."
- `"no such column"` → "Column not found. Check the spelling or explore the schema."
- `"ambiguous column name"` → "Multiple tables have this column. Use table.column syntax."
- `"constraint failed"` → "Data violates a rule (duplicate key or constraint)."

**`USE` statement support**: A bare `USE <name>` at the top of a statement batch switches the active database inline, same as selecting from the dropdown.

**CSV import**: Creates a table with all columns as `TEXT`, infers column names from header row. Valid table names must match `/^[A-Za-z_][A-Za-z0-9_]*$/`.

### `compareResults` (`packages/shared/src/sql-engine/resultComparator.ts`)

Compares two `SqlResult` objects for grading. Options:

| Option | Default | Effect |
|---|---|---|
| `orderMatters` | `true` | Row order must match exactly |
| `columnNamesMatter` | `false` | Column names are compared case-insensitively |
| `floatTolerance` | `0.001` | Floating-point values compared within tolerance |
| `caseSensitiveStrings` | `false` | String comparison is case-insensitive by default |

Returns `{ match: boolean, message?: string }`.

---

## 5. Pack format specification

All packs target the shared package at `packages/shared/src/content/schemas.ts`. The current format version is **2**.

### Database pack (`DatabasePack`)

```json
{
  "version": 2,
  "datasets": [
    {
      "id": "school",
      "name": "School Management",
      "description": "Students, teachers, courses, enrollments",
      "setupSql": "CREATE TABLE students (...); ...",
      "tables": [
        {
          "name": "students",
          "description": "...",
          "columns": [
            {
              "name": "id",
              "type": "INTEGER",
              "primaryKey": true,
              "foreignKey": null,
              "description": "Student ID"
            },
            {
              "name": "department_id",
              "type": "INTEGER",
              "primaryKey": false,
              "foreignKey": { "table": "departments", "column": "id" },
              "description": "Department reference"
            }
          ]
        }
      ]
    }
  ]
}
```

Validations enforced by `DatasetSchema` (Zod):
- `id`: string, min 1, max 50 chars
- `name`: string, min 1, max 200 chars
- `description`: string, min 1, max 1000 chars
- `setupSql`: string, min 1, max 10 MB
- `tables`: 1–20 tables, each with 1–50 columns
- Each column: name (1–100), type (1–50), optional primaryKey (bool), optional foreignKey, optional description (≤500 chars)

### Questions pack (`QuestionsPack`)

```json
{
  "version": 2,
  "topics": [
    { "id": "select-basics", "title": "SELECT Basics", "description": "...", "order": 0 }
  ],
  "questions": [
    {
      "id": "sb-01",
      "topicId": "select-basics",
      "difficulty": "easy",
      "title": "List all students",
      "description": "Write a query that returns every student...",
      "datasetId": "school",
      "hints": ["Start with SELECT * FROM students", "You don't need WHERE"],
      "explanation": "This is a basic SELECT without any filters.",
      "tags": ["select", "basics"],
      "points": 10,
      "type": "query",
      "solutionSql": "SELECT * FROM students;",
      "validation": {
        "mode": "result-match",
        "orderMatters": true,
        "columnNamesMatter": false
      },
      "testCases": [
        {
          "id": "tc-01",
          "description": "Returns all students",
          "expected": { "type": "fromSolution" },
          "hidden": false
        }
      ]
    }
  ]
}
```

### Notes pack (`NotesPack`)

```json
{
  "version": 2,
  "notes": [
    {
      "id": "note-select",
      "title": "SELECT Statement",
      "category": "Syntax",
      "tags": ["select", "fundamentals"],
      "content": "# SELECT Statement\n\nBasic form:\n\n```\nSELECT column1, column2 FROM table;\n```\n\n- Use * to select all columns"
    }
  ]
}
```

---

## 6. Question types & validation

Each question has a `type` field that determines its structure and how it's graded.

| Type | Answer input | Validation mode | How it works |
|---|---|---|---|
| `query` | SQL editor | `result-match` | Compares result set against expected output or reference solution |
| `mcq-single` | Radio group | `mcq` | Checks if selected option ID matches `correctOptionId` |
| `mcq-multi` | Checkboxes | `mcq` | Checks if selected set equals `correctOptionIds` |
| `fill-blank` | Inline inputs | `fill-blank` | Splits template on `___`, checks each blank against accepted alternatives |
| `predict-output` | SQL editor | `predict-output` | Compares actual result against `expectedOutput` shape |
| `debug-query` | SQL editor | `result-match` | Runs broken query against dataset to show the error; then grades corrected answer |
| `dml-check` | SQL editor | `dml-check` | Executes the statement, runs verification query, checks affected row count |

### Validation config options

```typescript
interface ValidationConfig {
  mode: 'result-match' | 'mcq' | 'dml-check' | 'predict-output' | 'fill-blank' | 'table-design'
  columnNamesMatter?: boolean    // default: false
  columnOrderMatters?: boolean   // default: false
  orderMatters?: boolean         // default: true
  floatTolerance?: number        // default: 0.001
  caseSensitiveStrings?: boolean // default: false
  requiredTechniques?: string[]  // tags indicating techniques that must appear in answer
  forbiddenTechniques?: string[] // tags indicating techniques banned from answer
  verificationQuery?: string     // additional query to run after answer for dml-check
}
```

### Test case shapes

For `result-match`, `predict-output` and `debug-query`:

```json
{
  "id": "tc-01",
  "description": "Optional human-readable label",
  "expected": { "type": "literal", "columns": ["name","age"], "rows": [["Alice",30]] },
  "hidden": false
}
```

Or referencing the reference solution:

```json
{ "id": "tc-02", "expected": { "type": "fromSolution" }, "hidden": true }
```

---

## 7. Grading engine

Located in `src/features/learn/hooks/useGrading.ts`.

Flow:

1. Student clicks **Submit**
2. `grade(answer, hintsRevealed)` is called
3. For SQL types, the answer is run inside an isolated SQLite instance via `database.isolatedRun(setupSql, answer)`
4. Each test case is evaluated against the actual result using `compareResults()`
5. Points are awarded only on full pass across all test cases
6. `markSolved(questionId, timeMs, hintsUsed)` records the attempt
7. If this was the first solve, points are added and streak/activity updated
8. Badge conditions are checked; unlocked badges trigger notifications

### Point deduction for hints

The grader tracks `hintsUsed` but does not currently reduce point value for revealed hints — the full point value is always awarded on first correct submission regardless of hint usage. This may change in future versions.

### Difficulty labels

Rendered with color coding:
- `easy` → green border/text
- `medium` → amber/warning border/text
- `hard` → red/error border/text

---

## 8. AI assistant integration

### Architecture

```
Renderer → useAiStore → AiClient.complete()
                              ↓
              window.logixzen.ai.complete(request)  ← IPC
                              ↓
              main.ts → completeAi(request)
                              ↓
              fetch to provider API with stored API key
```

### Supported providers

| Provider | Model IDs | Base URL |
|---|---|---|
| OpenAI | `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo` | `https://api.openai.com/v1/chat/completions` |
| Anthropic | `claude-sonnet-4-5`, `claude-haiku-4-5` | `https://api.anthropic.com/v1/messages` |
| OpenRouter | any model in their catalog | `https://openrouter.ai/api/v1/chat/completions` |
| Custom | any | user-provided |

### Privacy settings

Default: `sendSchemaOnly: true`, `sendHistory: false`, `sendProgress: false`. When `sendSchemaOnly` is enabled, only column names/types (no row data) are sent to the AI. History and progress are never sent by default.

### AI actions

Available in the practice workspace when an API key is configured:

| Button | Prompt function | Input to model |
|---|---|---|
| Hint | `buildHintPrompt` | Question + current hint index + attempt count |
| Explain error | `buildErrorExplanationPrompt` | Question + SQL + error message |
| Explain query | `buildQueryExplanationPrompt` | Question + SQL |
| Alternatives | `buildAlternativesPrompt` | Question + student's SQL |

---

## 9. Build & run

### Prerequisites

- Node.js 20+
- pnpm 11+
- Git

### Install dependencies

```bash
pnpm install
```

### Development

```bash
cd apps/desktop
pnpm dev
```

This starts two processes in parallel:
- `dev:next` — Next.js dev server on `http://localhost:3000`
- `dev:electron` — TypeScript compilation + Electron launch

The Electron window connects to the dev server. DevTools open automatically in detach mode.

### Production build

```bash
pnpm build
```

Produces:
- `apps/desktop/.next/` — Next.js build output
- `apps/desktop/dist-electron/` — compiled Electron main/preload code
- `apps/desktop/out/` — exported static pages (used when packaged)
- Then `electron-builder` creates the distributable installer

### Running in browser preview only

If you want to test the UI without Electron:

```bash
cd apps/desktop
pnpm start
```

This starts Next.js alone. The desktop bridge (`window.logixzen`) will be undefined, so features requiring the SQL engine and AI will show an error message.

---

## 10. Extending the app

### Adding a new page

1. Create `src/app/<route>/page.tsx` (App Router convention)
2. Wrap content in `<PageShell>` for consistent chrome
3. Add a nav item to `GROUPS` in `src/components/app-shell/app-sidebar.tsx`
4. Optionally add a menu entry in `src/electron/menu.ts`

### Adding a new pack kind

1. Define the Zod schema in `packages/shared/src/content/schemas.ts`
2. Update `PackKind` type in `src/lib/packs/types.ts`
3. Add parser in `src/lib/packs/packs.ts`
4. Add tab and handling in `src/app/import/page.tsx`

### Adding a new question type

1. Add the Zod variant to `QuestionSchema` in `packages/shared/src/content/schemas.ts`
2. Add grading logic in `src/features/learn/hooks/useGrading.ts`
3. Add answer UI in `AnswerInputs` component in `src/features/learn/QuestionDetailContent.tsx`

### Adding a new badge

Add an entry to `BADGE_DEFINITIONS` in `src/features/badges/badgeDefinitions.ts`:

```typescript
{
  id: 'my-badge',
  title: 'My Badge',
  description: 'Description of what this badge means',
  icon: 'star',
  condition: (state) => state.solvedQuestions >= 25,
}
```

The condition receives a snapshot of `{ solvedQuestions, streak, totalPoints }`.

### Extending the SQL engine

Modify `DesktopSqlEngine` in `src/electron/sql/engine.ts`. After changes, rebuild the preload:

```bash
pnpm build:electron
```

Then restart the Electron app to pick up the new binary.

### Adding a new data pack

Place `.sql`, `.json` files in `docs/desktop/data/` and update `OFFICIAL_PACKS` in `src/lib/packs/official.ts`:

```typescript
{
  kind: "questions",
  label: "Advanced SQL",
  fileName: "advanced-questions.json",
  description: "Advanced topics covering window functions and CTEs.",
  url: `${OFFICIAL_PACK_BASE_URL}/advanced-questions.json`,
}
```

---

## Directory map

```
apps/desktop/src/
├── app/                      # Next.js pages (App Router)
│   ├── layout.tsx            # Root layout: ThemeApplier, TitleBar, Sidebar, StatusBar
│   ├── globals.css           # Design tokens (CSS variables)
│   ├── page.tsx              # Dashboard
│   ├── import/page.tsx       # Data Hub
│   ├── schema/page.tsx       # Database explorer
│   ├── playground/page.tsx   # SQL editor
│   ├── learn/page.tsx        # Topic list
│   ├── learn/topic/page.tsx  # Question list
│   ├── learn/practice/page.tsx # Exercise workspace
│   ├── notes/page.tsx        # Notes viewer
│   ├── progress/page.tsx     # Stats & badges
│   └── settings/page.tsx     # App settings
├── components/
│   ├── app-shell/
│   │   ├── app-sidebar.tsx   # Left navigation
│   │   ├── page-shell.tsx    # Page wrapper with title/subtitle/actions
│   │   └── status-bar.tsx    # Bottom status line
│   ├── editor/SqlCodeEditor.tsx  # CodeMirror SQL editor
│   ├── learn/AiActionButtons.tsx # AI helper buttons in practice
│   ├── playground/
│   │   ├── SchemaPanel.tsx   # Tree view of tables/columns
│   │   ├── ResultPanel.tsx   # Query results table
│   │   └── tool-dialogs.tsx  # History, Snippets, Copy, Run
│   ├── settings/AiConfigSection.tsx
│   ├── theme-applier.tsx     # Applies dark/light class to <html>
│   ├── title-bar.tsx         # Custom frameless title bar
│   └── ui/                   # Radix-based primitive components
├── electron/
│   ├── main.ts               # Entry point: window lifecycle, protocol, tray
│   ├── ipc.ts                # All IPC handler registrations
│   ├── preload.ts            # contextBridge exposure
│   ├── dialogs.ts            # File open/save dialog handlers
│   ├── menu.ts               # Native application menu
│   ├── tray.ts               # System tray integration
│   ├── storage.ts            # Key-value store
│   ├── secrets.ts            # OS keychain storage
│   ├── notifications.ts      # Native notification helpers
│   ├── ai.ts                 # LLM completion handler
│   └── sql/engine.ts         # DesktopSqlEngine (in-memory SQLite)
├── features/
│   ├── ai/AiClient.ts        # LLM client wrapper
│   ├── ai/AiPrompts.ts       # Prompt builders
│   ├── badges/badgeDefinitions.ts
│   ├── badges/useBadgeCheck.ts
│   ├── learn/Badge.tsx       # Difficulty/status badge component
│   ├── learn/hooks/useHints.ts
│   ├── learn/hooks/useGrading.ts
│   ├── learn/QuestionListContent.tsx
│   ├── learn/QuestionDetailContent.tsx
│   └── schema/er-diagram.tsx # React Flow ER diagram
├── hooks/use-desktop-bridge.ts
├── lib/
│   ├── packs/official.ts     # Official pack URLs
│   ├── packs/prompts.ts      # AI prompt templates for pack generation
│   ├── packs/packs.ts        # Pack parsing & serialization
│   ├── packs/types.ts        # Pack TypeScript types
│   ├── dataset-from-sql.ts   # SQL → Dataset conversion
│   ├── exportUtils.ts        # CSV/JSON export helpers
│   ├── native-storage.ts     # Platform-aware storage adapter
│   ├── save-file.ts          # File save dialog helper
│   └── utils.ts              # cn() utility
├── shared/desktop-api.ts     # DesktopApi interface definition
├── sql/useSqlStore.ts        # Active SQL session store
├── stores/
│   ├── usePackStore.ts       # Imported content (packs)
│   ├── useProgressStore.ts   # Points, streaks, badges
│   ├── useQueryHistoryStore.ts
│   ├── useSnippetsStore.ts
│   ├── useThemeStore.ts
│   └── useAiStore.ts
└── types/desktop.d.ts        # Global window.logixzen declaration
```

---

*Next: [Sample data files](./data/)*
