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

After setting env vars, hit `POST /api/setup` once (or use the Setup button in the UI). This creates all tables and seeds the three fall scenarios.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── setup/           # POST - creates schema + seeds data
│   │   ├── evaluate/        # POST - single note evaluation
│   │   ├── batch/           # upload, start, status, download, list
│   │   ├── evaluations/     # GET evaluations, summaries, single
│   │   └── scenarios/       # CRUD for clinical scenarios
│   ├── admin/scenarios/     # Scenario management UI
│   ├── batch/               # Batch upload/processing UI
│   ├── evaluate/            # Single evaluation UI
│   ├── dashboard-content.tsx
│   └── page.tsx             # Dashboard home
├── components/              # shadcn/ui components
├── lib/
│   ├── db.ts               # SQL Server connection pool (max 10)
│   ├── azure-openai.ts     # Azure OpenAI client wrapper
│   ├── evaluator.ts        # Core evaluation orchestration
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
- **BatchJobs** — Batch file tracking (Status: pending → processing → completed/failed)
- **Evaluations** — Per-note results (ClassifiedScenarioCode, Confidence, EvaluationStatus, DocumentedItems, MissingMandatoryCount)
- **ItemResults** — Per-checklist-item results (IsDocumented, Evidence, Gap)

**EvaluationStatus values:** `compliant` | `partial` | `non-compliant` | `not-applicable`

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
- **Prompts** are built in `prompt-builder.ts`; scenarios + checklist items are injected from DB at evaluation time
- **Azure OpenAI** response is requested as `response_format: { type: "json_object" }` — always parse with `JSON.parse`
- **Batch jobs** are processed asynchronously; polling `GET /api/batch/[id]/status` for progress
- **Excel column detection** is fuzzy/case-insensitive in `excel-parser.ts` — handles Manad export variations

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

## Missing / Next Work

### 1. Prompt management architecture (not implemented yet)

- Create a separate DB table for prompt templates and versions (for dynamic prompt selection at runtime).
- Add API routes/UI to manage prompt versions (create, activate/deactivate, rollback).
- Add evaluator logic to load active prompt version from DB instead of hardcoded-only prompt text.

### 2. Prompt versioning in repository (not implemented yet)

- Add a dedicated prompts folder (for example `src/prompts/`) to store versioned prompt files.
- Define a file naming/version convention (for example `v1.md`, `v2.md`) and metadata mapping to DB versions.
- Add a sync/import flow between files and DB prompt table.

### 3. AI Trace completeness

- Surface full system prompt in AI Trace detail consistently for all new evaluations.
- Keep backward compatibility: historical rows without stored system prompt should display as `N/A`.
