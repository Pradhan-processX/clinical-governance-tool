# Implemented Features & Fixes

Tracks what has actually been built and shipped. For architecture decisions and coding conventions see CLAUDE.md. For the production backlog see jira-production-backlog.md.

---

## Commands

```bash
npm run dev      # Next.js dev server — http://localhost:3000
npm run worker   # Batch processing worker — run in a separate terminal
npm run build
npm run start
```

---

## Shipped Features

### Batch Upload & Evaluation
- Excel upload with fuzzy column auto-detection (handles Manad export variations)
- Upload & Preview step is **stateless** — parses Excel in memory, no DB write
- Start Evaluation writes BatchJob to DB as `queued` and returns batchId
- Worker polls every 5s for `queued` jobs, claims one at a time, runs evaluation
- Progress polling via `GET /api/batch/[id]/status` — UI polls until complete
- Enriched Excel download — original file re-read from `BatchJobs.OriginalFile`, AI results written as new columns, colour-coded (green/yellow/red)
- Batch list page showing all jobs with status and download links

### Single Note Evaluation
- `/evaluate` — paste a single progress note, get immediate AI result
- Scenario auto-detected from note text; falls back to manual selection
- Full checklist result shown inline

### Evaluation History (`/history`)
- Paginated list (50/page) with filters: status, date range, free-text search
- Columns: Room No., Resident Name, Note Date, Written By, Event Type, Clinical Risk Category, Compliance, Missing Items
- Clinical Risk Category derived from `Scenarios.Category`
- Inline detail drawer on "View"

### AI Trace (`/ai-trace`)
- Every evaluation stores `PromptSent` and `SystemPromptSent` on Evaluations table
- Paginated list (25/page) with status/date/text filters
- Detail pane: System Prompt, User Message, Raw AI Response, Parsed JSON
- Token stats: prompt tokens, completion tokens, latency ms, estimated USD cost (GPT-4.1 pricing: $2/M input, $8/M output)

### Scenario Admin (`/admin/scenarios`)
- Full CRUD for Scenarios and ChecklistItems
- Scenario cache invalidated on every create/update/delete via `invalidateScenariosCache()`

### Dashboard (`/`)
- Summary cards: total evaluated, compliant, partial, non-compliant counts
- Recent evaluations table

---

## Infrastructure & Architecture

### DB Connection (`src/lib/db.ts`)
- SQL config built lazily inside `getPool()` — env vars read at connection time, not import time (fixes worker dotenv loading issue)
- Auto-migration on every pool connect via `runMigrations()` — safely ALTERs missing columns, no manual re-setup needed
- Singleton connection pool (max 10)

### Worker (`src/worker/index.ts`)
- Loads `.env.local` via dotenv before any imports
- Polls `BatchJobs WHERE Status = 'queued'` every 5s
- Atomically claims jobs with `UPDATE TOP(1) ... OUTPUT INSERTED.Id`
- Stuck job recovery: resets jobs stuck in `processing` for > 10 min (uses `StartedAt`)
- Marks failed jobs with `Status = 'failed', CompletedAt = GETDATE()`

### Batch API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/batch/upload` | POST | Parse Excel, return preview — no DB write |
| `/api/batch/start` | POST | Accept file, insert BatchJob as `queued`, return batchId |
| `/api/batch/[id]/status` | GET | Poll processing progress |
| `/api/batch/[id]/download` | GET | Enriched Excel download |
| `/api/batch/list` | GET | All batch jobs |

### Excel Handling
- `excel-parser.ts` — fuzzy column detection, extracts rows, returns preview
- `excel-writer.ts` — enriches original Excel with AI columns + colour coding
- Original Excel stored as `VARBINARY(MAX)` in `BatchJobs.OriginalFile` at start time

---

## Database Schema (actual state)

### BatchJobs
`Id, FileName, OriginalFile (VARBINARY MAX), BatchDate, TotalNotes, Status, StartedAt, CompletedAt, ProcessedNotes, FailedNotes, SkippedNotes, LockedAt (via migration)`

**Status flow:** `queued → processing → completed | failed`
> Note: `pending` status no longer used. Batches go directly to `queued` when user confirms.

### Evaluations
`Id, BatchId, BatchDate, RoomNumber, ResidentName, NoteDate, NoteTime, EventType, CreatedByName, ProgressNoteText, SourceRowIndex, ClassifiedScenarioCode, Confidence, EvaluationStatus, TotalItems, DocumentedItems, MissingMandatoryCount, GapsSummary, AiResponseRaw, ModelUsed, PromptTokens, CompletionTokens, LatencyMs, PromptSent, SystemPromptSent, EvaluatedAt`

### ItemResults
`Id, EvaluationId, ItemCode, ItemText, Mandatory, IsDocumented, Evidence, Gap`

### Scenarios
`Id, Code, Name, Category, ClassificationHints, IsActive`

### ChecklistItems
`Id, ScenarioId, ItemCode, ItemText, Mandatory, Keywords`

---

## Known Gaps / Not Yet Implemented

| # | Item | Notes |
|---|---|---|
| 1 | Pre-filter layer | Every note hits GPT even if not a clinical risk note. ~60-80% waste. Keyword scan before AI call. Must use text only — EventType is not a clinical flag. |
| 2 | Prompt management UI | Prompts hardcoded in `prompt-builder.ts`. Need `PromptTemplates` table + versioning + per-category activation. |
| 3 | Initial vs follow-up checklists | One checklist per scenario, no `NoteType` dimension (initial / 24h / 72h / 7d). |
| 4 | Authentication | No auth. Single facility, internal use only. |
| 5 | Duplicate prevention | Re-uploading the same file creates new batch with duplicate evaluations. |
| 6 | Automated ingestion | Manual Manad export + upload. Target: nightly UiPath RPA or Manad API pull. |
| 7 | Batch recovery UI | Failed/stuck batches have no retry button in UI. Must be manually re-queued in DB. |
| 8 | Error sanitisation | Raw error messages returned to client in some routes. |

---

## Fix Log

### 2026-03-11 — Branch: `fix/batch-worker-and-upload-db`
**Problem 1:** Worker crashed on startup — `DB_SERVER = undefined`
- Root cause: `db.ts` read `process.env.*` at module import time; ES static imports are hoisted above dotenv.config(), so env was always empty when worker ran
- Fix: moved config construction into `buildConfig()` called lazily inside `getPool()`

**Problem 2:** Worker SQL errors on every poll — missing columns
- Root cause: `worker/index.ts` referenced `LockedAt`, `CreatedAt`, `ErrorMessage` columns that don't exist on `BatchJobs`
- Fix: rewrote `claimJob()` with `UPDATE TOP(1)`, `recoverStuckJobs()` using `StartedAt`, removed `ErrorMessage` from `markBatchFailed()`

**Problem 3:** DB bloat from abandoned previews
- Root cause: `/api/batch/upload` inserted a `BatchJob` row (including full Excel bytes as VARBINARY) on every preview, even if user never clicked Start
- Fix: upload route is now stateless (parse + preview only); new `/api/batch/start` route does the DB insert only on user confirmation, directly as `queued`
