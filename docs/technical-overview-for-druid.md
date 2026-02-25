# Clinical Governance Tool — Technical Overview
**Prepared for:** Druid.ai Engineering Team
**Purpose:** Feasibility assessment for platform replication
**Date:** February 2026

---

## 1. Executive Summary

The Clinical Governance Tool is a custom web application built for Australian aged care facilities. Its core function is to **automatically evaluate nursing progress notes for fall incidents against structured clinical governance checklists** using a large language model (Azure OpenAI GPT-4.1).

The tool ingests batches of exported progress notes (from a care management system called Manad), sends each note to an AI model for evaluation, stores structured results in a SQL Server database, and produces a colour-coded compliance report back in Excel format.

It is used by clinical governance managers and quality teams to identify where nursing staff are not documenting required clinical actions after a resident fall.

---

## 2. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Web Application                     │
│              (Next.js 14, TypeScript, React)            │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Evaluate │  │  Batch   │  │ History  │  │AI Trace│  │
│  │  (single)│  │  Upload  │  │  View    │  │  View  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │              │              │              │      │
│       └──────────────┴──────────────┴──────────────┘     │
│                          │                               │
│                    API Routes (REST)                     │
│                          │                               │
│          ┌───────────────┴───────────────┐              │
│          │                               │              │
│   ┌──────▼──────┐               ┌────────▼────────┐     │
│   │   SQL Server │               │  Azure OpenAI   │     │
│   │  (MSSQL DB)  │               │   (GPT-4.1)    │     │
│   └─────────────┘               └─────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

**Components:**

| Component | Technology | Role |
|---|---|---|
| Frontend | Next.js 14 App Router, React, Tailwind CSS, shadcn/ui | User interface — upload, monitor, view results |
| Backend API | Next.js API Routes (Node.js) | REST endpoints, evaluation orchestration |
| Database | Microsoft SQL Server (MSSQL) | Persistent storage of all data |
| AI Model | Azure OpenAI — GPT-4.1 | Progress note classification and checklist evaluation |
| File I/O | xlsx library | Excel parsing (input) and enriched Excel generation (output) |

---

## 3. Data Stored — Database Schema

The database contains **five tables**.

---

### 3.1 `Scenarios`
Defines each clinical scenario that a note can be classified into.

| Column | Type | Description |
|---|---|---|
| Id | NVARCHAR(50) PK | Unique identifier |
| Code | NVARCHAR(50) UNIQUE | Machine-readable code, e.g. `FALL_UNWITNESSED` |
| Name | NVARCHAR(200) | Human label, e.g. "Unwitnessed Fall" |
| Category | NVARCHAR(50) | Clinical risk category, e.g. `FALL` |
| Description | NVARCHAR(MAX) | Plain-language description of the scenario |
| ClassificationHints | NVARCHAR(MAX) | Comma-separated keywords the AI uses to classify notes into this scenario |
| IsActive | BIT | Whether the scenario is live (inactive scenarios are excluded from evaluation) |
| SortOrder | INT | Display/evaluation priority order |
| CreatedAt / UpdatedAt | DATETIME2 | Audit timestamps |

**Seeded scenarios (3 pre-loaded):**

| Code | Name | Total Checklist Items | Mandatory Items |
|---|---|---|---|
| `FALL_WITNESSED_NO_HEADSTRIKE` | Witnessed Fall — No Head Strike | 12 | 8 |
| `FALL_WITNESSED_HEADSTRIKE` | Witnessed Fall — With Head Strike | 8 | 8 |
| `FALL_UNWITNESSED` | Unwitnessed Fall | 12 | 12 |

---

### 3.2 `ChecklistItems`
Each checklist item belongs to one scenario. The AI evaluates whether each item is documented in the note.

| Column | Type | Description |
|---|---|---|
| Id | NVARCHAR(50) PK | Unique identifier |
| ScenarioId | NVARCHAR(50) FK → Scenarios | Parent scenario |
| ItemCode | NVARCHAR(50) | Machine code, e.g. `UWF_07_VITALS` |
| ItemText | NVARCHAR(500) | Human-readable requirement, e.g. "Post-fall vitals taken (BP, HR, O2)" |
| Mandatory | BIT | If 1, missing this item affects compliance status |
| SortOrder | INT | Display order within scenario |
| Keywords | NVARCHAR(500) | Optional hint keywords for this specific item |

**Example checklist items for `FALL_UNWITNESSED`:**

```
UWF_01 — Incident report completed [mandatory]
UWF_02 — Post-fall assessment completed (head-to-toe, ROM, pain, skin) [mandatory]
UWF_03 — Time resident was found documented [mandatory]
UWF_04 — Who found the resident documented [mandatory]
UWF_05 — Position resident was found in documented [mandatory]
UWF_06 — Location where resident was found [mandatory]
UWF_07 — Post-fall vitals taken (BP, HR, O2) [mandatory]
UWF_08 — Pain assessment completed [mandatory]
UWF_09 — Injuries assessed and documented [mandatory]
UWF_10 — GP or doctor notified [mandatory]
UWF_11 — Neurological observations commenced as precaution [mandatory]
UWF_12 — Falls risk reassessment completed [mandatory]
```

---

### 3.3 `BatchJobs`
Tracks an uploaded Excel file as a processing job.

| Column | Type | Description |
|---|---|---|
| Id | NVARCHAR(50) PK | Batch job identifier (UUID) |
| FileName | NVARCHAR(255) | Original uploaded filename |
| OriginalFile | VARBINARY(MAX) | Raw Excel bytes stored for later enriched re-download |
| BatchDate | DATE | Date the batch was created |
| TotalNotes | INT | Total rows in the uploaded file |
| ProcessedNotes | INT | Notes successfully evaluated so far |
| FailedNotes | INT | Notes that errored during evaluation |
| SkippedNotes | INT | Notes classified as NOT_APPLICABLE |
| Status | NVARCHAR(20) | `pending` → `processing` → `completed` / `failed` |
| ErrorMessage | NVARCHAR(MAX) | Error detail if batch failed |
| StartedAt | DATETIME2 | When processing began |
| CompletedAt | DATETIME2 | When processing finished |
| CreatedAt | DATETIME2 | Upload timestamp |

---

### 3.4 `Evaluations`
One row per progress note evaluated. Stores both the input context and the full AI result.

| Column | Type | Description |
|---|---|---|
| Id | NVARCHAR(50) PK | Evaluation identifier (UUID) |
| BatchId | NVARCHAR(50) FK → BatchJobs | Parent batch (NULL for single evaluations) |
| BatchDate | DATE | Date of the batch |
| RoomNumber | NVARCHAR(20) | Resident room |
| ResidentName | NVARCHAR(100) | Resident name |
| NoteDate | NVARCHAR(50) | Date of the progress note |
| NoteTime | NVARCHAR(10) | Time of the progress note |
| EventType | NVARCHAR(50) | Type of event (e.g. "Fall") |
| CreatedByName | NVARCHAR(100) | Staff member who wrote the note |
| ProgressNoteText | NVARCHAR(MAX) | Full text of the progress note |
| SourceRowIndex | INT | Row number in the original Excel file |
| ClassifiedScenarioCode | NVARCHAR(50) | Scenario the AI matched, e.g. `FALL_UNWITNESSED` |
| Confidence | FLOAT | AI classification confidence (0.0 – 1.0) |
| EvaluationStatus | NVARCHAR(20) | `compliant` / `partial` / `non-compliant` / `not-applicable` |
| TotalItems | INT | Total checklist items evaluated |
| DocumentedItems | INT | Items the AI found documented in the note |
| MissingMandatoryCount | INT | Count of mandatory items not documented |
| GapsSummary | NVARCHAR(MAX) | Plain-text summary of missing documentation |
| AiResponseRaw | NVARCHAR(MAX) | Raw JSON string returned by the AI model |
| ModelUsed | NVARCHAR(50) | AI model name, e.g. `gpt-4.1` |
| PromptTokens | INT | Input tokens sent to AI |
| CompletionTokens | INT | Output tokens returned by AI |
| LatencyMs | INT | Round-trip API latency in milliseconds |
| PromptSent | NVARCHAR(MAX) | Full user message sent to AI (stored for tracing) |
| SystemPromptSent | NVARCHAR(MAX) | Full system prompt sent to AI (stored for tracing) |
| EvaluatedAt | DATETIME2 | Timestamp of evaluation |

**EvaluationStatus thresholds:**

| Status | Condition |
|---|---|
| `compliant` | 0 missing mandatory items |
| `partial` | 1–3 missing mandatory items |
| `non-compliant` | 4 or more missing mandatory items |
| `not-applicable` | Note does not match any clinical scenario |

---

### 3.5 `ItemResults`
One row per checklist item per evaluation. Stores the AI's evidence quote and gap description for each item.

| Column | Type | Description |
|---|---|---|
| Id | NVARCHAR(50) PK | Unique identifier |
| EvaluationId | NVARCHAR(50) FK → Evaluations | Parent evaluation |
| ItemCode | NVARCHAR(50) | Checklist item code |
| ItemText | NVARCHAR(500) | Checklist item description |
| Mandatory | BIT | Whether the item is mandatory |
| IsDocumented | BIT | 1 = AI found evidence, 0 = not documented |
| Evidence | NVARCHAR(MAX) | Exact quote from the note that satisfies the item |
| Gap | NVARCHAR(MAX) | Description of what is missing if not documented |

---

## 4. Data Flow

### 4.1 Batch Processing Flow (Primary Use Case)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BATCH FLOW                                 │
│                                                                     │
│  1. UPLOAD                                                          │
│  ──────────                                                         │
│  User uploads Manad Excel export (.xlsx)                            │
│        │                                                            │
│        ▼                                                            │
│  Excel Parser (fuzzy column detection):                             │
│    • Detects: Room, ResidentName, Date, Time, EventType,            │
│               CreatedByName, ProgressNoteText                       │
│    • Skips rows with empty note text                                │
│        │                                                            │
│        ▼                                                            │
│  Database:                                                          │
│    • INSERT BatchJobs (status = 'pending', stores raw Excel bytes)  │
│    • INSERT Evaluations stubs (one per note, EvaluationStatus NULL) │
│                                                                     │
│  2. START PROCESSING                                                │
│  ───────────────────                                                │
│  User clicks "Start" → POST /api/batch/{id}/start                  │
│        │                                                            │
│        ▼                                                            │
│  BatchJobs.Status → 'processing'                                    │
│        │                                                            │
│        ▼  (for each pending Evaluation row, in order)              │
│  ┌─────────────────────────────────────────────────┐               │
│  │              PER-NOTE EVALUATION LOOP           │               │
│  │                                                 │               │
│  │  a) Load active scenarios from cache (5-min TTL)│               │
│  │                                                 │               │
│  │  b) Build scenario shortlist:                   │               │
│  │     • Check resident's recent scenario history  │               │
│  │     • Score scenarios by keyword match          │               │
│  │     • Take top 6 most likely (efficiency)       │               │
│  │                                                 │               │
│  │  c) Build AI prompt:                            │               │
│  │     • System prompt = scenario definitions      │               │
│  │       + checklist items + rules                 │               │
│  │     • User message = resident name + event type │               │
│  │       + full progress note text                 │               │
│  │                                                 │               │
│  │  d) Call Azure OpenAI GPT-4.1                   │               │
│  │     • response_format: json_object              │               │
│  │     • Returns structured JSON                   │               │
│  │                                                 │               │
│  │  e) Retry logic:                                │               │
│  │     • If result = NOT_APPLICABLE or             │               │
│  │       confidence < 0.55 → retry with ALL        │               │
│  │       scenarios (not just shortlist)            │               │
│  │                                                 │               │
│  │  f) Write results to DB:                        │               │
│  │     • UPDATE Evaluations (all AI result fields) │               │
│  │     • INSERT ItemResults (one per checklist item│               │
│  │       with evidence quote and gap description)  │               │
│  │                                                 │               │
│  │  g) UPDATE BatchJobs progress counters          │               │
│  │                                                 │               │
│  │  h) 500ms rate-limit delay before next note     │               │
│  └─────────────────────────────────────────────────┘               │
│        │                                                            │
│        ▼                                                            │
│  BatchJobs.Status → 'completed' (or 'failed')                      │
│                                                                     │
│  3. POLL STATUS (UI)                                                │
│  ────────────────────                                               │
│  Frontend polls GET /api/batch/{id}/status every few seconds        │
│  Displays: processed / total, progress bar, elapsed time           │
│                                                                     │
│  4. DOWNLOAD RESULTS                                                │
│  ────────────────────                                               │
│  User clicks Download → GET /api/batch/{id}/download               │
│  • Reads original Excel bytes from BatchJobs.OriginalFile           │
│  • Injects AI result columns into each matching row                 │
│  • Applies row colour coding:                                       │
│      Green  = compliant                                             │
│      Yellow = partial                                               │
│      Red    = non-compliant                                         │
│  • Returns enriched .xlsx file                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Single Note Evaluation Flow

```
User enters note text (+ optional: resident name, event type)
        │
        ▼
POST /api/evaluate
        │
        ▼
evaluateNote() — same AI logic as batch
        │
        ▼
Results displayed inline on page (no DB persistence for ad-hoc mode)
```

---

## 5. AI Evaluation Logic — Detail

### 5.1 Scenario Classification + Checklist Evaluation (Single AI Call)

The tool performs **both classification and checklist evaluation in a single LLM call**. The AI is not asked "which scenario is this?" separately — it must classify and evaluate in one pass, returning a single structured JSON object.

### 5.2 System Prompt Structure

The system prompt injected for each evaluation contains:

```
You are a clinical governance evaluator for Australian aged care progress notes.

TASK: Read the progress note. Classify it into ONE scenario. Evaluate against that scenario's checklist.

AVAILABLE SCENARIOS:

## Witnessed Fall - No Head Strike (code: FALL_WITNESSED_NO_HEADSTRIKE)
Category: FALL
Classify as this when: fall, fell, found on floor, witnessed, observed falling, no head strike...
Checklist items:
- WF_01_TIME: Date and time of fall documented [mandatory: true]
- WF_02_WITNESS: Who witnessed the fall [mandatory: true]
... (all 12 items)

## Witnessed Fall - With Head Strike (code: FALL_WITNESSED_HEADSTRIKE)
... (all 8 items)

## Unwitnessed Fall (code: FALL_UNWITNESSED)
... (all 12 items)

CLASSIFICATION RULES:
1. Read the ENTIRE note first before classifying
2. Match the note to ONE scenario based on classification hints
3. If no match → return scenarioCode: "NOT_APPLICABLE"
4. Confidence must be 0.0-1.0

EVALUATION RULES:
1. Be GENEROUS in interpretation — "nil pain" counts as pain assessment done
2. Partial information counts — "staff found resident" counts as who found
3. Extract EXACT quote from the note as evidence for each documented item
4. If not documented, write a specific gap description

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{ "scenarioCode": "...", "confidence": 0.0, "evaluationStatus": "...", ... }
```

### 5.3 User Message Structure

```
Resident: [ResidentName]

Event Type: [EventType]

Written by: [CreatedByName]

Progress Note:
[Full text of the progress note]
```

### 5.4 AI JSON Response Format

```json
{
  "scenarioCode": "FALL_UNWITNESSED",
  "scenarioName": "Unwitnessed Fall",
  "confidence": 0.95,
  "evaluationStatus": "partial",
  "totalItems": 12,
  "documentedItems": 9,
  "missingMandatoryCount": 2,
  "gapsSummary": "Missing: GP notification, falls risk reassessment",
  "items": [
    {
      "itemCode": "UWF_07_VITALS",
      "itemText": "Post-fall vitals taken (BP, HR, O2)",
      "mandatory": true,
      "isDocumented": true,
      "evidence": "BP 130/80, HR 72, O2 sats 98%",
      "gap": ""
    },
    {
      "itemCode": "UWF_10_NOTIFY_GP",
      "itemText": "GP or doctor notified",
      "mandatory": true,
      "isDocumented": false,
      "evidence": "",
      "gap": "No mention of GP or doctor notification in the note"
    }
    ...
  ]
}
```

### 5.5 Scenario Shortlist Optimisation

When there are many scenarios in the system, sending all of them in every prompt is wasteful. The evaluator builds a shortlist of the most relevant scenarios before calling the AI:

1. **Resident history lookup** — check the last 5 unique scenario codes matched for this resident (in-memory cache, falls back to DB query). Seed the shortlist with those.
2. **Keyword scoring** — score all remaining scenarios by how many of their `ClassificationHints` and `category` keywords appear in the note + event type text. Phrases score higher than single words (score 3 vs 1).
3. **Take top 6** — pass only the 6 highest-scoring scenarios to the AI.
4. **Retry trigger** — if the result is `NOT_APPLICABLE` or confidence < 0.55, retry the call with **all** scenarios to ensure nothing was missed.

### 5.6 Caching

- **Scenario cache** — active scenarios + checklist items loaded from DB and cached in memory for 5 minutes. Invalidated immediately on any scenario create/update/delete admin action.
- **Resident scenario cache** — per-resident map of recent scenario codes, TTL 10 minutes. Used to fast-path the shortlist for repeat-resident notes.

---

## 6. Excel Input — Column Detection

The tool accepts Excel exports from **Manad** (a common Australian aged care clinical system). Column names vary between facilities and export versions. The parser uses **fuzzy substring matching** (case-insensitive) against a set of known patterns for each field:

| Field | Recognised header patterns |
|---|---|
| Room Number | "room no", "room number", "current number", "bed no", "room", "bed", "unit" |
| Resident Name | "resident name", "client name", "consumer name", "resident", "client", "patient" |
| Note Date | "note date", "entry date", "incident date", "date" |
| Note Time | "note time", "entry time", "incident time", "time" |
| Event Type | "event type", "note type", "event", "care area" |
| Created By | "created by name", "created by", "written by", "staff name", "clinician", "author" |
| Progress Notes | "progress notes", "progress note", "notes", "note", "content", "description" |

Rows with empty note text are silently skipped.

### 6.1 Important: EventType Does NOT Indicate Clinical Risk

The `EventType` column in Manad exports contains **note template/documentation categories**, not clinical event types. Confirmed observed values include:

| EventType value | What it means |
|---|---|
| `PRN Effectiveness` | A review note for a PRN (as-needed) medication |
| `Daily Progress` | Routine daily care note |
| `Nurses Notes` | General nursing note (any content) |
| `NIM Effectiveness` | Non-intrusive monitoring effectiveness review |
| `Assessment review` | Clinical assessment update |
| `Reason code recorded` | A coded reason entry |

**A fall incident progress note may be filed under `Nurses Notes`, `Daily Progress`, or any other template type.** EventType cannot be used to identify clinical risk events or route notes to the correct evaluation scenario.

**All clinical event detection must be performed by scanning the `ProgressNoteText` field directly** — either via keyword rules (Phase 2 pre-filter) or by the AI model itself (current approach).

---

## 7. Excel Output — Enriched Report

The download endpoint reads the original uploaded Excel bytes, then adds the following columns to each matching row:

| Added Column | Content |
|---|---|
| Scenario | Classified scenario name |
| Compliance Status | `compliant` / `partial` / `non-compliant` / `not-applicable` |
| Total Items | Total checklist items for the matched scenario |
| Documented Items | Number of items found in the note |
| Missing Mandatory | Count of missing mandatory items |
| Gaps Summary | Plain-text list of what was not documented |

Row background colours are applied:
- **Green** — compliant
- **Yellow** — partial
- **Red** — non-compliant
- **Grey / no fill** — not-applicable

---

## 8. Admin Features

### 8.1 Scenario Management (`/admin/scenarios`)

Full CRUD for clinical scenarios and their checklist items:
- Create, edit, deactivate, and delete scenarios
- Add, edit, reorder, and delete checklist items within a scenario
- Toggle mandatory/optional per item
- Set classification hints per scenario
- Scenario cache is automatically cleared on any change

### 8.2 Single Note Evaluation (`/evaluate`)

Manual evaluation page where a user can paste a single progress note, optionally specify resident name / event type, and see the full AI result immediately without creating a batch.

---

## 9. Observability — AI Trace (`/ai-trace`)

Every evaluation stores the full AI interaction for review:

- **System prompt sent** — the exact prompt injected as the AI's system message
- **User message sent** — the exact note text and metadata sent as the user turn
- **Raw AI response** — the complete JSON string returned by the model
- **Parsed AI JSON** — formatted/pretty-printed version
- **Token counts** — prompt tokens, completion tokens, total
- **Latency** — end-to-end API call time in milliseconds
- **Estimated cost (USD)** — calculated at GPT-4.1 pricing ($2/M input tokens, $8/M output tokens)

Historical evaluations from before this feature was added display `N/A` for prompt/response fields.

---

## 10. Evaluation History (`/history`)

Paginated, searchable list of all evaluations:

- Filter by: compliance status, date range, free-text (resident name, room, author)
- Displays: room, resident, note date, written by, event type, clinical risk category, compliance badge, missing item count
- Click through to full evaluation detail (all checklist items with evidence and gaps)
- 50 records per page

---

## 11. API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/setup` | Create DB schema, indexes, and seed 3 fall scenarios |
| POST | `/api/evaluate` | Single note evaluation |
| POST | `/api/batch/upload` | Upload Excel, create batch job and evaluation stubs |
| POST | `/api/batch/{id}/start` | Begin async processing of a batch |
| GET | `/api/batch/{id}/status` | Poll batch progress (processed/total/status) |
| GET | `/api/batch/{id}/download` | Download enriched colour-coded Excel |
| GET | `/api/batch/list` | List all batch jobs |
| GET | `/api/evaluations` | Query evaluations (paginated, filterable) |
| GET | `/api/evaluations/{id}` | Single evaluation with all item results |
| GET | `/api/evaluations/summary` | Aggregate statistics |
| GET/POST | `/api/scenarios` | List all scenarios / create scenario |
| PUT/DELETE | `/api/scenarios/{id}` | Update or delete a scenario |
| GET/POST | `/api/scenarios/{id}/items` | List / add checklist items |
| PUT/DELETE | `/api/scenarios/{id}/items/{itemId}` | Update or delete a checklist item |

---

## 12. Key Constraints and Requirements

| Requirement | Detail |
|---|---|
| **AI model** | Azure OpenAI GPT-4.1 (structured JSON output mode required) |
| **Database** | SQL Server — relational, parameterised queries, no ORM |
| **Batch size** | Designed for 50–500 notes per batch |
| **Rate limiting** | 500ms delay between notes to respect API rate limits |
| **Excel format** | Input: .xlsx (Manad export); Output: .xlsx enriched report |
| **Retry logic** | Low-confidence or NOT_APPLICABLE results retry with full scenario set |
| **Scenario flexibility** | Scenarios and checklists are fully configurable via admin UI |
| **Prompt storage** | Full system + user prompt stored per evaluation for audit/tracing |
| **Backwards compatibility** | Auto-migration adds new DB columns without breaking existing data |

---

## 13. What the Tool Does NOT Do

- It does **not** modify the source care system (Manad) — it is read-only input
- It does **not** send notifications or alerts (currently)
- It does **not** perform real-time/streaming evaluation — batch is async, single is synchronous
- It does **not** support multi-tenancy — single database, single organisation
- It does **not** have user authentication — currently internal-use only

---

## 14. Phase 2 — Planned Architectural Improvements

The following enhancements are designed but not yet implemented. They are documented here to inform platform feasibility assessment.

### 14.1 Automated Data Ingestion

**Current:** A governance manager manually exports from Manad and uploads an Excel file.

**Target:** Nightly automated pull with no human action required.

```
Manad System
     │
     ├── Option A: Direct Manad REST API (if available)
     └── Option B: UiPath RPA — automates Manad UI export → saves file → triggers batch
                                                              │
                                                              ▼
                                              POST /api/batch/upload  (scheduled, no user)
                                                              │
                                                              ▼
                                              POST /api/batch/{id}/start
                                                              │
                                                              ▼
                                              Results ready each morning
```

No changes to the core batch engine are needed — only a scheduler/trigger layer on top of the existing APIs.

### 14.2 Pre-Filter / Cost Reduction Layer

**Problem:** Every note in a batch currently receives a full GPT-4.1 evaluation, including routine care notes (daily progress, medication reviews, wound dressings) that return `NOT_APPLICABLE`. Estimated waste: 60–80% of token spend.

**Design — 2-stage pipeline:**

```
All Notes (e.g. 500/day)
        │
        ▼
Stage 1: Keyword scan on ProgressNoteText ONLY    ← free, no AI cost
        │                         │
      PASS                      SKIP
        │                         │
        │              mark FilterResult = 'filtered_out'
        │              no AI call, no token cost
        ▼
Stage 2: Full GPT-4.1 evaluation (current engine) ← AI cost only here
```

**Critical constraint:** EventType from Manad CANNOT be used as a filter gate (see Section 6.1). Pre-filtering must be text-only.

**Example keyword sets:**

| Category | Keywords |
|---|---|
| FALL | fell, fall, found on floor, slipped, found lying, on the floor |
| MEDICATION_ERROR | medication error, wrong dose, administered in error, omitted, wrong medication |
| PRESSURE_INJURY | pressure injury, wound, skin tear, stage 2, grade 3, pressure area |
| BEHAVIOUR | behavioural incident, aggressive, resistive, exit seeking |

**New DB columns needed:** `FilterResult` (`passed_filter | filtered_out`), `FilterReason` (audit text).

### 14.3 Initial vs Follow-up Note Checklists

**Problem:** Fall management has different documentation requirements for initial notes vs follow-up reviews. Current schema has one checklist per scenario with no time-sequence dimension.

| Note Type | When | Different Requirements |
|---|---|---|
| Initial | At time of fall | Immediate response: vitals, assessment, GP notification, incident report |
| Follow-up 24h | Next day | Neuro obs review, wound check, condition update, GP review outcome |
| Follow-up 72h | 3 days | Ongoing monitoring, care plan review |
| Follow-up 7d | 1 week | Falls risk reassessment, family communication outcome |

**Schema change:** Add `NoteType` column to `Scenarios` (`initial | followup_24h | followup_72h | followup_7d | any`). Group scenarios by `(Category, NoteType)`. FALL would become 4 scenario groups each with its own checklist. AI determines note type during classification.

### 14.4 Category-Specific Prompt Templates

**Problem:** One monolithic system prompt contains all scenarios for all categories. As new categories are added (Medication, Pressure Injury, Behaviour, Choking), the prompt grows large, evaluation rules conflict across categories, and prompt iteration requires touching shared code.

**Design — `PromptTemplates` table:**

| Column | Purpose |
|---|---|
| Category | `FALL`, `MEDICATION_ERROR`, `PRESSURE_INJURY`, etc. |
| Version | Integer version number |
| VersionLabel | `v1 - initial release`, `v2 - generous interpretation added` |
| SystemHeader | Role description and task definition for this category |
| ClassificationRules | Category-specific classification rules |
| EvaluationRules | Category-specific evaluation rules (e.g. medication uses "5 rights" check) |
| OutputFormat | JSON format definition (can differ per category) |
| IsActive | Only one active version per category at a time |

At evaluation time: Stage 1 pre-filter determines likely category → load `PromptTemplates WHERE Category = @category AND IsActive = 1` → build prompt from template + scenario definitions for that category only.

**Benefits:** Smaller prompts, lower token cost, category-specific accuracy, prompt versioning with rollback, A/B testing across versions.

---

## 15. Summary of Core Logic Flow (Plain Language)

1. A facility exports progress notes from Manad as an Excel file.
2. The governance manager uploads this file to the tool.
3. The tool reads each row, extracts the note text and resident metadata.
4. For each note, it asks the AI: *"What type of fall incident is this, and which required clinical actions are documented?"*
5. The AI returns a structured JSON response classifying the scenario and evaluating every checklist item.
6. Results are stored in the database — whether each item was documented, with a quote from the note as evidence, and a gap description if missing.
7. The compliance status is calculated: `compliant` (0 gaps), `partial` (1–3 gaps), `non-compliant` (4+ gaps).
8. The manager downloads a colour-coded Excel with all results added alongside the original data.
9. The full AI prompt and response for every note is stored and viewable in the AI Trace screen for audit and quality review.