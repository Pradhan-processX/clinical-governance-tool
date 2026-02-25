# Production Readiness Backlog — Clinical Governance Tool
**Version:** v0.1 (Demo) → v1.0 (Production)
**Date:** February 2026

All PBIs below are required to move from demo to production.
Organized by Epic. Priority: Critical → High → Medium → Low.

---

## EPIC 17 — Security & Data Protection

---

### PBI-14 — Remove debug console.log exposing DB server hostname
**Type:** Bug
**Priority:** Critical
**Story Points:** 1
**Epic:** Security & Data Protection

**Description:**
`src/lib/db.ts` contains `console.log("DB_SERVER from env:", process.env.DB_SERVER)` which runs on every database pool connection. In production, application logs are accessible to operators and potentially support staff. Logging the database server hostname (`PXAEPRDSQL01\SQLEXPRESS`) exposes internal infrastructure details.

**Acceptance Criteria:**
- [ ] The `console.log("DB_SERVER from env:", ...)` line is removed from `src/lib/db.ts`
- [ ] No other environment variable values (`DB_PASSWORD`, `AZURE_OPENAI_API_KEY`, etc.) are logged anywhere in the codebase
- [ ] `npm run build` and `npm run lint` pass

**Notes:** Quick win. Do this first.

---

### PBI-13 — Sanitise error responses to not leak internal DB details
**Type:** Bug
**Priority:** Critical
**Story Points:** 3
**Epic:** Security & Data Protection

**Description:**
Multiple API route catch blocks return `error.message` directly to the browser:
```typescript
return NextResponse.json({ error: error.message }, { status: 500 })
```
When a SQL query fails, `mssql` error messages include table names, column names, query fragments, and sometimes the full query string. These internal details are returned in the HTTP response body and visible in the browser network tab.

**Affected files:** All files in `src/app/api/`

**Acceptance Criteria:**
- [ ] All catch blocks log the full error server-side (`console.error`)
- [ ] API responses return only a generic human-readable message (e.g. `"Failed to load evaluations"`)
- [ ] Internal DB error details are never present in any API response body
- [ ] Error HTTP status codes remain correct (400, 500, 404 as appropriate)

---

### PBI-15 — Add authentication layer
**Type:** Story
**Priority:** Critical
**Story Points:** 13
**Epic:** Security & Data Protection

**Description:**
The tool currently has no authentication. All API routes and pages are accessible to anyone on the network without login. The tool processes patient data (resident names, clinical notes, room numbers) — this is unacceptable in a production environment under Australian aged care regulations.

**Decision needed before implementation:**
- Auth method: Azure AD SSO (recommended for internal tools), NextAuth.js with credentials, or API key for programmatic access
- Role model: all authenticated users equal, OR admin/viewer roles
- Session handling: JWT or server-side session

**Acceptance Criteria:**
- [ ] All pages require authenticated session to access
- [ ] All API routes return 401 if no valid session
- [ ] `/api/setup` is protected (admin only or disabled after initial setup)
- [ ] Session timeout configured appropriately
- [ ] Auth method documented in CLAUDE.md and `.env.example`

**Dependencies:** Decision on auth method (Azure AD vs other)

---

## EPIC 18 — Reliability & Recovery

---

### PBI-16 — Detect and recover stuck batch jobs
**Type:** Tech Debt
**Priority:** Critical
**Story Points:** 5
**Epic:** Reliability & Recovery

**Description:**
Batch processing runs inside a Next.js API request loop. If the server restarts, crashes, or is redeployed mid-batch, the `BatchJobs.Status` stays permanently as `processing`. There is no detection, no timeout, and no recovery mechanism. The UI shows the batch as forever in-progress. Currently there is no way to retry without manually updating the DB.

**Root cause:** Prototype chose simplicity (in-process loop) over durability. Fine for demo, unacceptable for production with nightly automated ingestion.

**Acceptance Criteria:**
- [ ] On server startup, any `BatchJobs` with `Status = 'processing'` and `StartedAt` older than a configurable threshold (e.g. 2 hours) are reset to `pending` or marked `failed` with a clear error message
- [ ] A `GET /api/batch/{id}/recover` or admin UI button allows manually resetting a stuck batch
- [ ] `BatchJobs` table gains a `LastHeartbeatAt` column, updated every N notes during processing, so stuck detection is based on heartbeat, not just start time
- [ ] Stuck batch detection runs as a startup check in `db.ts` or `batch-processor.ts`

---

### PBI-17 — Prevent concurrent batch start (race condition)
**Type:** Bug
**Priority:** High
**Story Points:** 2
**Epic:** Reliability & Recovery

**Description:**
If two users (or two automated triggers) call `POST /api/batch/{id}/start` at the same time, both requests read `Status = 'pending'`, both proceed, and the same batch is processed twice. This creates duplicate `Evaluations` rows and inflated statistics.

**Acceptance Criteria:**
- [ ] `POST /api/batch/{id}/start` uses an atomic SQL `UPDATE BatchJobs SET Status = 'processing' WHERE Id = @id AND Status = 'pending'` and checks rows affected = 1 before proceeding
- [ ] If the batch is already `processing` or `completed`, the endpoint returns HTTP 409 with a clear message
- [ ] Tested: calling start twice in quick succession only processes the batch once

---

### PBI-18 — Fix blanket retry hiding real errors in evaluateNote
**Type:** Tech Debt
**Priority:** High
**Story Points:** 2
**Epic:** Reliability & Recovery

**Description:**
In `src/lib/evaluator.ts`, `evaluateNote()` has a blanket catch-all retry:
```typescript
catch {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return await evaluateWithScenarioSelection(allScenarios, input);
}
```
This retries on **any** error — including configuration errors (wrong API key, wrong deployment name), which will fail identically on retry and just double the latency. It also silently swallows the original error, making debugging harder.

**Acceptance Criteria:**
- [ ] Retry only occurs for transient errors: HTTP 429 (rate limit), HTTP 503 (service unavailable), network timeouts
- [ ] Non-retryable errors (HTTP 401, 403, 404, JSON parse failures) are thrown immediately without retry
- [ ] The original error is logged before any retry attempt
- [ ] Retry count and delay are named constants, not magic values

---

### PBI-19 — Prevent duplicate batch uploads
**Type:** Bug
**Priority:** High
**Story Points:** 3
**Epic:** Reliability & Recovery

**Description:**
The same Excel file can be uploaded multiple times with no warning. Each upload creates a new `BatchJobs` row and stub `Evaluations` rows. If both are processed, the history and summary statistics are doubled for those notes. Governance reports become inaccurate.

**Acceptance Criteria:**
- [ ] Upload endpoint checks for an existing `BatchJobs` row with the same `FileName` and `BatchDate`
- [ ] If a duplicate is detected, the API returns a warning response with the existing batch ID
- [ ] The UI displays the warning and asks the user to confirm before re-uploading (or redirects to the existing batch)
- [ ] Option: allow re-upload if the existing batch `Status = 'failed'` (legitimate retry)

---

## EPIC 19 — Cost Optimisation

---

### PBI-20 — Implement Stage 1 keyword pre-filter before AI evaluation
**Type:** Story
**Priority:** High
**Story Points:** 8
**Epic:** Cost Optimisation

**Description:**
Every note in a batch currently receives a full GPT-4.1 evaluation call, including routine care notes (daily medication reviews, wound dressings, daily observations) that return `NOT_APPLICABLE`. Based on typical aged care facility note volumes, an estimated 60–80% of notes are non-clinical-risk notes. Each wasted call costs tokens and adds latency.

**Important constraint:** EventType from Manad cannot be used as a filter — it contains note template categories (`Nurses Notes`, `Daily Progress`), not clinical event types. Pre-filtering must use ProgressNoteText only.

**Implementation:**
1. Add a `filterNote(noteText: string): { pass: boolean; matchedCategory?: string; reason: string }` function in a new `src/lib/note-filter.ts`
2. Keyword sets (configurable, not hardcoded): FALL, MEDICATION_ERROR, PRESSURE_INJURY, BEHAVIOUR
3. In `batch-processor.ts`, run filter before calling `evaluateNote()`
4. Notes that fail filter: mark `EvaluationStatus = 'not-applicable'`, `FilterResult = 'filtered_out'`, no AI call
5. Notes that pass filter: set `FilterResult = 'passed_filter'`, proceed to AI evaluation

**New DB columns required** (also add to `runMigrations()` in `db.ts`):
- `Evaluations.FilterResult` NVARCHAR(20): `passed_filter | filtered_out | not_filtered`
- `Evaluations.FilterReason` NVARCHAR(200): e.g. `"matched keyword: fell"` or `"no clinical keywords found"`

**Acceptance Criteria:**
- [ ] `filterNote()` function exists and is unit-testable independently of the AI/DB
- [ ] Keyword sets are defined as a named constant (not scattered in code), easy to extend
- [ ] `FilterResult` and `FilterReason` columns exist in DB (migration + setup)
- [ ] Batch history and AI Trace show filter result per note
- [ ] Notes marked `filtered_out` do not appear as AI costs in the AI Trace cost summary
- [ ] Summary statistics distinguish AI-evaluated notes from pre-filtered notes

---

## EPIC 20 — Performance & Scalability

---

### PBI-21 — Make batch concurrency configurable
**Type:** Story
**Priority:** Medium
**Story Points:** 5
**Epic:** Performance & Scalability

**Description:**
Batch processing is currently sequential with a hardcoded 500ms delay between notes. At this rate, 500 notes takes a minimum of 4+ minutes, before accounting for AI latency (~1–2s per note). With nightly automated ingestion of 200–500 notes, processing time matters.

**Prototype reason:** Sequential was the safe choice to avoid Azure OpenAI rate limit errors during development.

**Acceptance Criteria:**
- [ ] Batch processor supports configurable concurrency (e.g. `BATCH_CONCURRENCY=5` in env)
- [ ] Default remains 1 (sequential) to avoid breaking existing behaviour
- [ ] Rate limit errors (HTTP 429) trigger a backoff and retry, not a note failure
- [ ] Progress counter (`ProcessedNotes`) updates correctly under concurrent processing
- [ ] Tested at concurrency=3 and concurrency=5 without DB write conflicts

---

### PBI-22 — Move Excel file storage to Azure Blob Storage
**Type:** Tech Debt
**Priority:** Medium
**Story Points:** 8
**Epic:** Performance & Scalability

**Description:**
Original Excel files are stored as `VARBINARY(MAX)` in `BatchJobs.OriginalFile` in SQL Server. At scale (500 notes/day, daily batches, multiple facilities), this inflates the database significantly. SQL Server is not optimised for binary file storage — queries on the `BatchJobs` table will slow as `OriginalFile` data grows.

**Prototype reason:** VARBINARY was simpler than wiring up blob storage during initial development.

**Acceptance Criteria:**
- [ ] New batch uploads store the Excel file in Azure Blob Storage
- [ ] `BatchJobs` gains an `OriginalFileUrl` NVARCHAR column storing the blob URL
- [ ] `BatchJobs.OriginalFile` column is deprecated (kept for existing rows, not populated for new ones)
- [ ] Download endpoint reads from blob URL, not the DB column
- [ ] Blob container access is controlled (private, access via SAS token or managed identity)
- [ ] Blob URL stored in env config (`AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`)

**Dependencies:** Azure Storage account provisioned

---

## EPIC 21 — Observability & Operations

---

### PBI-23 — Add health check endpoint
**Type:** Story
**Priority:** Medium
**Story Points:** 2
**Epic:** Observability & Operations

**Description:**
There is no `/api/health` endpoint. Without it, there is no way to programmatically verify that the app is up and connected to its dependencies (SQL Server, Azure OpenAI). Monitoring tools, load balancers, and UiPath automation triggers cannot check tool health before sending data.

**Acceptance Criteria:**
- [ ] `GET /api/health` returns HTTP 200 with JSON when all dependencies are healthy
- [ ] Response includes status of each dependency: `{ db: "ok", azureOpenAI: "ok", overall: "healthy" }`
- [ ] Returns HTTP 503 with `{ overall: "unhealthy", db: "error", ... }` if any dependency fails
- [ ] DB check: runs a lightweight query (`SELECT 1`)
- [ ] Azure check: validates API key and endpoint are configured (does not make a billable AI call)
- [ ] Endpoint does not require authentication (monitoring tools need access without session)

---

### PBI-24 — Replace console.log with structured logging
**Type:** Tech Debt
**Priority:** Medium
**Story Points:** 5
**Epic:** Observability & Operations

**Description:**
All logging uses `console.log` and `console.error` with no structure, no log levels, and no correlation IDs. In production, it is impossible to trace a specific batch job's logs, filter by severity, or ship logs to a central system (Azure Monitor, Application Insights).

**Acceptance Criteria:**
- [ ] A lightweight logger is introduced (e.g. `pino` or a thin wrapper over `console`)
- [ ] Log levels: `debug`, `info`, `warn`, `error` — configurable via env (`LOG_LEVEL`)
- [ ] All batch processing logs include `batchId` as context
- [ ] All evaluation logs include `evaluationId` as context
- [ ] No sensitive data (patient names, note text, credentials) in log output
- [ ] In production, log output is structured JSON for Azure Monitor / Application Insights ingestion

---

## EPIC 22 — Multi-Tenancy Foundation (Phase 2 Prerequisite)

---

### PBI-25 — Add FacilityId to schema as multi-tenancy foundation
**Type:** Story
**Priority:** Low (but must be decided before any new feature that stores data)
**Story Points:** 13
**Epic:** Multi-Tenancy Foundation

**Description:**
The tool currently has a single database with no facility separation. All data — scenarios, batch jobs, evaluations — is shared. If the tool is deployed for more than one aged care facility, there is no way to separate or filter data by facility.

**This is a schema-level decision that is very expensive to retrofit later.** The column needs to be added before the data volume grows.

**Decision needed:** Will this tool be multi-tenant (one DB, FacilityId column) or multi-instance (separate DB per facility)?

- **Multi-tenant (recommended if >1 facility planned):** Add `FacilityId` to `Scenarios`, `BatchJobs`, `Evaluations`. All queries filter by FacilityId. Simpler to operate.
- **Multi-instance:** Deploy a separate app + DB per facility. Simpler per-facility isolation, harder to operate at scale.

**Acceptance Criteria (if multi-tenant chosen):**
- [ ] `FacilityId` NVARCHAR(50) NOT NULL added to `BatchJobs`, `Evaluations`
- [ ] `Scenarios` can be facility-specific or global (`FacilityId` nullable = global)
- [ ] All queries filter by `FacilityId` from the authenticated session
- [ ] `runMigrations()` adds `FacilityId` with a default value for existing rows
- [ ] New env variable `DEFAULT_FACILITY_ID` used for initial/single-facility deployment

**Dependencies:** PBI-03 (Auth) — FacilityId must come from the authenticated user's session

---

## Summary

| PBI | Title | Priority | Points | Epic |
|---|---|---|---|---|
| PBI-01 | Remove debug console.log from db.ts | Critical | 1 | Security |
| PBI-02 | Sanitise error responses | Critical | 3 | Security |
| PBI-03 | Add authentication layer | Critical | 13 | Security |
| PBI-04 | Detect and recover stuck batch jobs | Critical | 5 | Reliability |
| PBI-05 | Prevent concurrent batch start | High | 2 | Reliability |
| PBI-06 | Fix blanket retry hiding real errors | High | 2 | Reliability |
| PBI-07 | Prevent duplicate batch uploads | High | 3 | Reliability |
| PBI-08 | Implement Stage 1 keyword pre-filter | High | 8 | Cost |
| PBI-09 | Configurable batch concurrency | Medium | 5 | Performance |
| PBI-10 | Move Excel storage to Azure Blob | Medium | 8 | Performance |
| PBI-11 | Add health check endpoint | Medium | 2 | Observability |
| PBI-12 | Structured logging | Medium | 5 | Observability |
| PBI-13 | FacilityId multi-tenancy foundation | Low | 13 | Multi-Tenancy |

**Total story points: 70**
**Critical path to production (Critical + High PBIs): 37 points**