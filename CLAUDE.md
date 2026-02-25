# Clinical Governance Tool — CLAUDE.md

## Project Overview

AI-powered clinical governance evaluation tool for Australian aged care facilities. Evaluates progress notes (specifically fall incident notes) against clinical governance checklists using Azure OpenAI (GPT-4.1). Built as a Next.js 14 App Router application with a SQL Server backend.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.5 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| AI | Azure OpenAI (GPT-4.1) via `openai` SDK |
| Database | SQL Server (MSSQL via `mssql` v10) |
| Data | Excel parsing/export via `xlsx` |
| Validation | Zod |

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://<resource>.cognitiveservices.azure.com
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_API_VERSION=2024-06-01

# SQL Server
DB_SERVER=<server>\SQLEXPRESS
DB_DATABASE=ClinicalGovernance
DB_USER=<username>
DB_PASSWORD=<password>
DB_PORT=1433
DB_TRUST_SERVER_CERTIFICATE=true
```

## Initial Database Setup

After setting env vars, hit `POST /api/setup` once (or use the Setup button in the UI). This creates all tables, indexes, and seeds the three fall scenarios.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── setup/           # POST - creates schema + indexes + seeds data
│   │   ├── evaluate/        # POST - single note evaluation
│   │   ├── batch/           # upload, start, status, download, list
│   │   ├── evaluations/     # GET evaluations, summaries, single
│   │   └── scenarios/       # CRUD for clinical scenarios
│   ├── admin/scenarios/     # Scenario management UI
│   ├── ai-trace/            # AI Trace view — token/latency/prompt/response inspector
│   ├── batch/               # Batch upload/processing UI
│   ├── evaluate/            # Single evaluation UI
│   ├── history/             # Evaluation history list with filters and detail drawer
│   ├── dashboard-content.tsx
│   └── page.tsx             # Dashboard home
├── components/              # shadcn/ui components
├── lib/
│   ├── db.ts               # SQL Server connection pool (max 10) + auto-migration + query<T> helper
│   ├── azure-openai.ts     # Azure OpenAI client wrapper
│   ├── evaluator.ts        # Core evaluation orchestration + invalidateScenariosCache()
│   ├── batch-processor.ts  # Async batch processing engine
│   ├── excel-parser.ts     # Auto-detect column names from Excel
│   ├── excel-writer.ts     # Enrich Excel with AI results + colour coding
│   ├── prompt-builder.ts   # System + user prompt construction
│   ├── schemas.ts          # Zod schemas for API validation
│   ├── seed.ts             # Seeds 3 fall scenarios with checklist items
│   └── utils.ts
└── types/                  # TypeScript type definitions
```

## Database Schema (SQL Server)

Five tables, all created by `/api/setup`:

- **Scenarios** — Clinical scenario definitions (Code, Name, Category, ClassificationHints)
- **ChecklistItems** — Items per scenario (ItemCode, ItemText, Mandatory, Keywords)
- **BatchJobs** — Batch file tracking (Status: pending → processing → completed/failed; **OriginalFile** stores raw Excel bytes for re-download)
- **Evaluations** — Per-note results (ClassifiedScenarioCode, Confidence, EvaluationStatus, DocumentedItems, MissingMandatoryCount, LatencyMs, CreatedByName, **PromptSent**, **SystemPromptSent**)
- **ItemResults** — Per-checklist-item results (IsDocumented, Evidence, Gap)

**EvaluationStatus values:** `compliant` | `partial` | `non-compliant` | `not-applicable`

### Indexes created by setup

`IX_Evaluations_BatchDate`, `IX_Evaluations_BatchId`, `IX_Evaluations_Status`, `IX_Evaluations_EvaluatedAt`, `IX_Evaluations_ResidentName`, `IX_Evaluations_RoomNumber`, `IX_Evaluations_Status_BatchDate`, `IX_ItemResults_EvaluationId`, `IX_ChecklistItems_ScenarioId`

### Auto-migration in db.ts

`runMigrations()` runs automatically on every pool connect and safely `ALTER TABLE`s missing columns onto existing tables. This lets the app upgrade live DBs without a manual setup re-run. Covers: `BatchJobs.OriginalFile`, `Evaluations.LatencyMs`, `Evaluations.CreatedByName`, `Evaluations.PromptSent`, `Evaluations.SystemPromptSent`.

## Pre-seeded Clinical Scenarios

| Code | Name | Checklist Items | Mandatory |
|---|---|---|---|
| FALL_WITNESSED_NO_HEADSTRIKE | Witnessed fall, no head strike | 12 | 8 |
| FALL_WITNESSED_HEADSTRIKE | Witnessed fall with head strike | 8 | 8 |
| FALL_UNWITNESSED | Unwitnessed fall (found on floor) | 12 | 12 |

## Key Architectural Patterns

- **Server components** fetch data directly; client components use fetch() to API routes
- **mssql** is in `serverComponentsExternalPackages` in `next.config.mjs` — do not move DB calls to client
- **Connection pool** is a module-level singleton in `src/lib/db.ts` — import `getPool()`, never create a new pool per request
- **`query<T>()` helper** exported from `db.ts` for parameterized queries without manual request setup
- **Prompts** are built in `prompt-builder.ts`; scenarios + checklist items are injected from DB at evaluation time
- **Azure OpenAI** response is requested as `response_format: { type: "json_object" }` — always parse with `JSON.parse`
- **Batch jobs** are processed asynchronously; polling `GET /api/batch/[id]/status` for progress
- **Excel column detection** is fuzzy/case-insensitive in `excel-parser.ts` — handles Manad export variations
- **Original Excel file** is stored as `VARBINARY(MAX)` in `BatchJobs.OriginalFile` at upload time so the download route can enrich and return it without needing the original file in memory
- **Scenario cache** is invalidated via `invalidateScenariosCache()` (exported from `evaluator.ts`) on every scenario create/update/delete

## AI Trace

`/ai-trace` provides a full observability view of every evaluation:

- **List:** paginated (25/page), filterable by status, date range, and free-text search
- **Detail pane:** System Prompt (passed to AI), User Message (request task), Raw AI Response, Parsed AI JSON
- **Token & cost stats:** prompt tokens, completion tokens, latency (ms), estimated USD cost using GPT-4.1 pricing ($2/M input, $8/M output)
- `PromptSent` and `SystemPromptSent` are stored on `Evaluations` at evaluation time; historical rows without them display as `N/A`

## Evaluation History

`/history` provides a searchable, filterable history list:

- Columns: Room No., Resident Name, Note Date, Written By, Event Type, **Clinical Risk Category**, Compliance, Missing Items
- Clinical Risk Category is derived from `Scenarios.Category` field (falls back to inferring from scenario code)
- Inline `EvaluationDetail` drawer opens on "View"
- Pagination: 50 records per page

## Manad Export — Known Data Characteristics

- **EventType column contains note template/documentation categories, NOT clinical event types.** Observed values: `PRN Effectiveness`, `Daily Progress`, `Nurses Notes`, `NIM Effectiveness`, `Assessment review`, `Reason code recorded`. These reflect the type of note written, not the clinical event that occurred.
- **A fall incident note may be logged under any EventType** (e.g. `Nurses Notes`, `Daily Progress`) — there is no reliable structured flag in the Manad export to identify clinical risk notes.
- **Clinical event detection must rely entirely on keyword scanning of `ProgressNoteText`** — EventType cannot be used as a pre-filter or routing gate.
- EventType is retained as stored metadata for display in history/reports and audit trail only.

## Coding Conventions

- All API routes use `NextRequest` / `NextResponse.json()`
- DB queries use parameterized inputs via `request.input()` — never string interpolation
- Zod schemas in `src/lib/schemas.ts` validate all API inputs
- Use `uuid` for generating IDs before DB insert
- Error responses: `{ error: "message" }` with appropriate HTTP status
- No ORM — raw SQL via `mssql`

## Important Notes

- `.env.local` must never be committed (already in .gitignore)
- `DB_TRUST_SERVER_CERTIFICATE=true` is intentional for internal SQL Express instances
- The AI model deployment name is `gpt-4.1` (not `gpt-4o`) — confirm in `.env.local`
- Excel exports colour-code rows: green = compliant, yellow = partial, red = non-compliant
- `console.log("DB_SERVER from env:", ...)` is present in `db.ts` — remove before production

## Current Version Status

**v0.1 — Demo / Prototype** (current state)
- Single facility, no authentication, no pre-filter, in-process batch engine
- Suitable for: internal demos, testing with real notes, prompt tuning
- Not suitable for: production deployment with patient data, automated nightly ingestion, multi-facility

**v1.0 — Production Target**
- All Critical + High PBIs resolved (see `docs/jira-production-backlog.md`)
- Authentication, error sanitisation, batch recovery, pre-filter, duplicate prevention
- Full backlog: 13 PBIs, 70 story points total — critical path is 37 points

See [docs/jira-production-backlog.md](docs/jira-production-backlog.md) for all PBIs with acceptance criteria.

## Missing / Next Work

### 1. Prompt management architecture (not implemented yet)

- Create a separate DB table (`PromptTemplates`) with columns: `Category`, `Version`, `VersionLabel`, `SystemHeader`, `ClassificationRules`, `EvaluationRules`, `OutputFormat`, `IsActive`.
- Add API routes/UI to manage prompt versions per clinical risk category (create, activate/deactivate, rollback).
- At evaluation time, load the active prompt template for the detected category from DB instead of using hardcoded prompt text from `prompt-builder.ts`.
- Enables category-specific rules (e.g. medication errors need stricter "5 rights" rules vs fall's "generous interpretation").

### 2. Prompt versioning in repository (not implemented yet)

- Add a dedicated prompts folder (for example `src/prompts/`) to store versioned prompt files.
- Define a file naming/version convention (for example `v1.md`, `v2.md`) and metadata mapping to DB versions.
- Add a sync/import flow between files and DB prompt table.

### 3. Pre-filter / cost reduction layer (not implemented yet)

- Currently every note in a batch receives a full GPT-4.1 evaluation call, including routine care notes that return `NOT_APPLICABLE`. This wastes ~60-80% of token spend.
- Implement a Stage 1 keyword scan on `ProgressNoteText` before calling the AI. Only notes containing clinical risk keywords proceed to AI evaluation; the rest are marked `not-applicable` with `FilterResult = 'filtered_out'` and no AI cost incurred.
- **Do NOT use EventType as a filter gate** — it contains note template categories, not clinical event types (see Manad Export section above). Pre-filtering must be text-only.
- Add `FilterResult` (`passed_filter | filtered_out`) and `FilterReason` columns to `Evaluations` for audit.
- Example keyword sets: FALL: `fell, fall, found on floor, slipped, found lying`; MEDICATION: `medication error, wrong dose, administered in error, omitted`.

### 4. Initial vs follow-up note checklists (not implemented yet)

- Fall management requires different checklists for initial notes (immediate response) vs follow-ups (24h, 72h, 7-day review). Current schema has one checklist per scenario with no note-sequence dimension.
- Add `NoteType` column to `Scenarios` (`initial | followup_24h | followup_72h | followup_7d | any`).
- Group scenarios by `(Category, NoteType)` — e.g. FALL would have 4 scenario groups each with its own checklist.
- AI determines note type during classification, or it is supplied from a Manad field if available.

### 5. Automated data ingestion (not implemented yet)

- Currently requires a governance manager to manually export from Manad and upload an Excel file.
- Target: nightly automated pull via Manad API (if available) or UiPath RPA (automates Manad UI export, saves file, POSTs to `/api/batch/upload`, POSTs to `/api/batch/{id}/start`).
- No changes to the core batch engine are needed — only a scheduler/trigger layer on top of the existing upload and start APIs.
