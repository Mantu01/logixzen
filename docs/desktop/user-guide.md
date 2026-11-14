# LogixZen Desktop — User Guide

A friendly guide to every screen, button and feature. If you are here to learn SQL, start at **Getting started**.

---

## Getting started

### 1. Install data packs

Launch the app and you'll land on the **Dashboard**. If it's your first time, you'll see an empty state with four cards:

```
Import data packs → Explore the schema → Open the editor → Start practicing
```

Click **Data Hub** (sidebar · Import icon) to install official packs, or paste SQL / JSON directly.

Official packs live at `https://raw.githubusercontent.com/Mantu01/logixzen/main/docs/desktop/data`:

| Pack | File | What it gives you |
|---|---|---|
| Databases | `sample-databases.sql` | 8 tables — students, teachers, courses, enrollments, departments, books, loans, authors |
| Questions | `sample-questions.json` | 150+ exercises across 22 topics |
| Notes | `sample-notes.json` | Study notes organized by category |

You can also paste raw SQL or JSON into the **Paste instead** dialog on the Data Hub page.

### 2. Activate a database

Go to **Databases** (sidebar · Database icon). You'll see the loaded datasets listed as tabs. Click one to make it active (green dot). The sidebar also shows a count next to "Databases".

If nothing is showing, go back to Data Hub and confirm the pack was imported successfully.

### 3. Write your first query

Open **Editor** (sidebar · Terminal icon). The left panel is a CodeMirror SQL editor with PostgreSQL syntax highlighting and autocomplete. The right panel shows the schema tree.

Type a query and press **Ctrl+Enter** (or click Run). Results appear below.

Try:
```sql
SELECT * FROM students LIMIT 5;
```

### 4. Start practicing

Navigate to **Practice** (sidebar · Graduation cap icon). Browse topics, pick one, answer questions, earn points. Use hints when stuck, view solutions after submitting.

---

## Screen-by-screen walkthrough

### Dashboard (`/`)

Shows your stats at a glance and quick links to get going.

| Widget | What it shows |
|---|---|
| Points / Solved / Streak | Current progress summary |
| Continue where you left off | Resume link to your last question (if any) |
| Topics list | Each topic with question count; click to jump in |
| Databases grid | Up to 3 recent databases; click "Manage" for full list |

Empty state prompts: Import → Schema → Editor → Learn.

---

### Data Hub (`/import`)

All pack operations live here. Three tabs:

#### Databases tab
- Drag-and-drop zone for `.sql` files (also accepts `.txt`)
- Optional **database name** field — this becomes the identifier used with `USE <name>`
- Paste SQL via the "Paste SQL instead" button
- Official packs section: one-click download & install from GitHub
- AI prompt section: copy-paste prompts for AI-generated databases

Validation runs before every import. Failed imports show specific error paths.

#### Questions tab
- Drop a `.json` questions pack (or paste)
- Auto-detects version and validates against the schema
- Shows added / updated counts after success

#### Notes tab
- Drop a `.json` notes pack (or paste)
- Same validation pipeline as questions

#### Bottom export bar
| Button | Action |
|---|---|
| Export .sql | Downloads all installed databases as a single `.sql` file |
| Export questions | Downloads your questions pack as JSON |
| Export notes | Downloads your notes pack as JSON |
| Clear all | Deletes every imported pack (irreversible) |

---

### Databases (`/schema`)

Two-panel layout: left = schema browser, right = detail view.

**View modes** (top-right toggle):
- **ER diagram** — interactive force-directed graph of tables and foreign keys
- **Tables** — structured list with column details and sample rows

**Top toolbar**:
- Database selector pills — click to switch active database
- Reset data — re-runs the setup SQL to refresh seed data
- New database — opens dialog to define schema inline or load a `.sql` file
- Trash icon on the active pill — removes the database

**ER Diagram interactions**:
- Hover a table to highlight its relationships
- Drag nodes to rearrange
- Zoom / pan with mouse wheel and drag on background
- Mini-map in bottom-right corner
- "Fit view" button resets zoom

**Table inspector** (Tables view):
- Search filters by table name or column name
- Grid shows columns, types, PK/FK indicators
- Sample rows preview (up to 5 per table)

---

### Editor (`/playground`)

Full SQL workspace with resizable panels.

**Layout** (drag separators to resize):
- Top-left: Query editor (CodeMirror with SQL dialect)
- Bottom-left: Result panel (table view with sorting / pagination)
- Right: Schema panel (tree of tables and columns)

**Toolbar buttons**:
| Button | Keyboard | Action |
|---|---|---|
| Database select dropdown | — | Switch active dataset (`USE`) |
| ER view | — | Opens ER diagram dialog (fullscreen) |
| History | — | Shows past queries; click to reload |
| Snippets | — | Save / reuse frequent queries |
| Copy | `Ctrl+Shift+C` | Copies current SQL to clipboard |
| Run | `Ctrl+Enter` | Executes the query |

**Result panel features**:
- Multi-statement results shown as numbered tabs (`#1`, `#2` …)
- Column header clicks sort ascending / descending / clear
- Filter box searches across all columns
- Pagination: 50 rows per page, prev/next buttons
- Export buttons: CSV · JSON · Copy as markdown

**Snippet dialogs**:
- **History** — last 50 successful queries, timestamped; click to insert
- **Snippets** — save named snippets; click to insert; delete individually

---

### Practice (`/learn`)

Browse topics and track completion.

**Controls**:
- Search box — filter by topic name
- Filter tabs: All / Unsolved
- Continue button — returns to your last position

**Topic row** shows:
- Topic name (title-cased from slug)
- Total / solved counts
- Difficulty breakdown (E / M / H)
- Progress bar (blue until 100%, then green)
- Percentage completed

---

### Topic detail (`/learn/topic?id=<id>`)

List of questions within one topic.

**Controls**:
- Search — filters by title, description or tags
- Difficulty filter — All / Easy / Medium / Hard
- Back link to all topics

**Question row** shows:
- Check mark if already solved
- Question number (sequential within topic)
- Title and tags
- Difficulty badge (color-coded)
- Point value
- X icon on solved items (hides unsolved indicator)

---

### Question workspace (`/learn/practice?topic=<id>&q=<id>`)

The core exercise view.

**Header** (right side):
- "Solved" badge if you've answered correctly before
- **Run** — executes your answer against the dataset without grading (for exploration)
- **Submit** — grades your answer against test cases

**Question content**:
- Difficulty badge + tags
- Description text
- For `debug-query` type: broken SQL displayed in an error-styled block
- For `dml-check` type: the required statement shape and expected affected-row count
- For `predict-output` type: expected output shape preview

**Answer area**:
- SQL questions → CodeMirror editor
- MCQ-single → radio group
- MCQ-multi → checkboxes
- Fill-blank → inline input fields

**AI buttons** (appear when API key is configured):
- 💡 Hint — generates a tutor-style hint from the AI
- 🔍 Explain error — explains any runtime error in plain language
- 📄 Explain query — breaks down what your query does step by step

**After submit**:
- Grade report: pass/fail per test case with messages
- Hint panel: reveals one hint at a time (marked yellow)
- Solution panel: shows reference solution and explanation (only visible after passing or clicking "Show solution")

**Navigation**: Previous / Next buttons at the bottom

---

### Notes (`/notes`)

Study notes from imported packs. Split-pane layout.

**Left pane** — note list:
- Click a note to open it
- Selected note gets a blue highlight

**Right pane** — note content:
- Category label (primary color)
- Title, tags, formatted body
- Supports headings (`#` / `##` / `###`), code blocks (```` ``` ````), bullet lists

**Toolbar**:
- Search box — matches against title, content and tags
- Category chips — filter by category; click "All" to show everything

Empty state directs you to import the notes pack from Data Hub.

---

### Progress (`/progress`)

Stats dashboard and achievement tracker.

**Summary stats**:
| Stat | Meaning |
|---|---|
| Completion % | solved ÷ total questions |
| Solved | number of questions answered correctly |
| Streak | current day streak (resets if you skip a day) |
| Best time | fastest solve across all questions |

**Activity heatmap**:
- 182-day view (26 weeks × 7 days)
- Color intensity correlates with daily solved count (0–4+)
- Longest streak shown in header

**Badges** (9 total):
| Badge | Condition |
|---|---|
| First Query | Solve 1 question |
| Getting Started | Solve 10 questions |
| SQL Explorer | Solve 50 questions |
| SQL Master | Solve 100 questions |
| 3-Day Streak | Maintain 3 consecutive days |
| Week Warrior | Maintain 7 consecutive days |
| Point Collector | Earn 500 points |
| Dedicated Practitioner | Earn 1000 points |

Earned badges show the date they were unlocked. Locked badges are dimmed.

**Actions**:
- Import — restore progress from a `.json` export
- Export — download progress as `logixzen-progress.json`
- Reset — permanent clear of all progress (with confirmation dialog)

---

### Settings (`/settings`)

| Setting | Description |
|---|---|
| Theme | Light / Dark / System — applies globally via CSS variables |
| Editor font size | Slider 11–20 px with live preview |
| AI configuration | Provider, model, API key, base URL (custom providers) |
| Privacy options | Send schema only (default); send history / progress (off by default) |
| About | App name, runtime (Electron vs browser preview), engine version, build version |

**AI privacy controls**:
- ✅ Send schema only — shares table/column metadata but never actual row data
- ☐ Send query history — includes past queries in context
- ☐ Send progress data — includes points/streak/badge status

---

## Sidebar navigation

The left sidebar groups features under two headers:

**Data**
- Editor — SQL playground
- Databases — schema explorer
- Data Hub — import / export

**Learn**
- Practice — question bank
- Notes — study material
- Progress — stats and badges

At the bottom: Stats bar (points / solved / streak) and Settings link. Collapsible with the chevron button.

---

## Tips & tricks

1. **Use the debugger** — Press Run before Submit to see what your query produces without losing attempts.
2. **Save snippets** — Frequently useful queries (JOIN patterns, date formats) can be saved and reused.
3. **Reset a database** — If your Playground queries mutate state, click "Reset data" on the Databases page to reload seeds.
4. **Multiple databases** — You can load several databases simultaneously; switch between them with the dropdown in the Editor toolbar.
5. **Streaks matter** — Daily practice keeps your streak alive; missed days reset it to zero.
6. **Hidden test cases** — Some question test cases are hidden until you pass; they don't affect grading differently.
7. **Progress is local** — Everything stays on your machine. Use Export/Import on the Progress page to move it between devices.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "No database selected" in Editor | Go to Databases page and click a database tab to activate it |
| Engine connected indicator is red | You're running in browser preview mode; start the app with `pnpm dev` in Electron mode for full functionality |
| Cannot import a pack | Check the error messages in the outcome banner; common causes are missing `version` field or invalid JSON structure |
| AI buttons don't appear | Set an API key in Settings > AI assistant |
| Results truncated at 1000 rows | This is intentional; use a more specific query to narrow results |
| Foreign key errors on import | Ensure `PRAGMA foreign_keys = ON;` is present or set it manually after initialization |

---

*Next: [Developer Guide](./developer-guide.md)*
