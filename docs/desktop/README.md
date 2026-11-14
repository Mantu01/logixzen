# LogixZen Desktop — Documentation

Welcome to **LogixZen Desktop** — a fully offline, native-electron SQL practice application built for learners and professionals who want to master SQL through hands-on exercises, real-world databases, and AI-assisted learning.

This documentation is split into two independent parts so every reader finds exactly what they need:

| Audience | Read this |
|---|---|
| **End users / students** | [`user-guide.md`](./user-guide.md) — how to use every feature of the app |
| **Developers / contributors** | [`developer-guide.md`](./developer-guide.md) — architecture, API, store design, pack format |

In the `data/` sub-folder you will find three reference datasets (SQL, JSON, JSON) that power both the desktop app and any future web or mobile clients:

| File | Contents |
|---|---|
| [`sample-databases.sql`](./data/sample-databases.sql) | A complete School Management system — schema + seed data for every topic |
| [`sample-questions.json`](./data/sample-questions.json) | 150+ validated questions covering SELECT, JOINs, window functions, DML, CTEs and more |
| [`sample-notes.json`](./data/sample-notes.json) | Study notes grouped by category — theory, syntax cheat-sheets, common patterns |

---

## Quick facts

- **Tech stack**: Electron 45 · Next.js 16 (App Router) · React 19 · Zustand stores · CodeMirror 6 (SQL dialect) · Radix UI · Tailwind v4 · `node:sqlite` (native SQLite engine)
- **Architecture**: Renderer runs in Next.js; native SQL lives inside the Electron main process (`DesktopSqlEngine`) and is accessed via IPC bridge (`window.logixzen`)
- **Data packs**: Everything comes from importable `.sql` / `.json` files — there are no embedded datasets
- **Progress**: Points, streaks, badges, activity heatmap — persisted locally via Zustand persist middleware
- **AI assistant**: Optional, configurable (OpenAI / Anthropic / OpenRouter / custom). Keys are stored in the OS keychain via Electron secrets API
- **Offline-first**: No network calls unless you enable an AI provider; databases run entirely in-memory SQLite

---

## Table of contents — user guide

See [user-guide.md](./user-guide.md) for the full walkthrough of every screen, button and workflow.

## Table of contents — developer guide

See [developer-guide.md](./developer-guide.md) for architecture, IPC interface, store contracts, pack formats, question validators and extension points.

---

*Version: 0.1.0 · Last updated: 2026-11-13*
