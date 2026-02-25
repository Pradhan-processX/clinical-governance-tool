# Pre-PR Checklist — Clinical Governance Tool

Run through every section before raising a pull request or merging any change.
A failing item is a blocker — fix it before merging.

---

## 1. SQL Injection

Every user-supplied value must go through `request.input()`. Column names and query structure can be hardcoded strings — that is safe. Only the **values** from users or external input are the risk.

- [ ] No string interpolation of user input directly into a query string
  ```typescript
  // FAIL — SQL injection risk
  request.query(`SELECT * FROM Evaluations WHERE Id = '${id}'`)

  // PASS — parameterised
  request.input("id", sql.NVarChar, id)
  request.query("SELECT * FROM Evaluations WHERE Id = @id")
  ```
- [ ] Dynamic WHERE clauses (conditions array) only ever interpolate **hardcoded column name fragments**, never user values
  ```typescript
  // PASS — column name is hardcoded, value is parameterised
  conditions.push("e.EvaluationStatus = @status")
  request.input("status", sql.NVarChar, status)
  ```
- [ ] Dynamic SET clauses (setParts array) only ever push hardcoded `"Column = @param"` strings
- [ ] Search inputs using LIKE use `request.input` with the `%` wrapper applied in code, not in the query string
  ```typescript
  // PASS
  request.input("search", sql.NVarChar, `%${search}%`)
  conditions.push("ResidentName LIKE @search")
  ```

---

## 2. Secrets & Sensitive Data in Logs

- [ ] No `console.log` of environment variables (`process.env.DB_SERVER`, `process.env.AZURE_OPENAI_API_KEY`, etc.)
- [ ] No `console.log` of patient data (resident names, note text, room numbers)
- [ ] No hardcoded credentials, API keys, or connection strings in any `.ts` file
- [ ] All secrets are `process.env.XXX` references only
- [ ] **Known issue to fix before production:** `console.log("DB_SERVER from env:", ...)` in `src/lib/db.ts` — remove it

---

## 3. Error Responses — Don't Leak Internals

- [ ] All `catch` blocks return `{ error: "short message" }` — not the full `error.stack` or raw SQL error
- [ ] SQL error messages (which can contain table names, column names, query fragments) are logged server-side only, not returned to the browser
  ```typescript
  // FAIL — leaks internal DB details to browser
  return NextResponse.json({ error: error.message }, { status: 500 })

  // PASS — log internally, return generic message
  console.error("DB error:", error)
  return NextResponse.json({ error: "Failed to load evaluations" }, { status: 500 })
  ```

---

## 4. Client / Server Boundary

- [ ] No import of `src/lib/db.ts`, `getPool()`, `sql`, or any `mssql` reference inside a file that has `"use client"` at the top
- [ ] No import of `src/lib/evaluator.ts`, `src/lib/batch-processor.ts`, or any server-only lib in client components
- [ ] If in doubt: does the file have `"use client"`? If yes, it cannot touch DB code.

> **Why:** `mssql` is a Node.js-only library. If it gets bundled into the client, Next.js throws a cryptic webpack error about `net`, `tls`, or `crypto` modules not found — nothing that looks like "you imported a DB file".

---

## 5. API Input Validation

- [ ] Every new `POST` / `PUT` API route validates its request body with a Zod schema from `src/lib/schemas.ts` before touching the DB
- [ ] Every new query parameter is sanitised (use `parseInt` with fallback, `String()` coercion, or Zod for query params)
- [ ] Page size / offset inputs are clamped to safe ranges (e.g. `Math.min(100, Math.max(1, pageSize))`)
- [ ] New Zod schemas added to `src/lib/schemas.ts`, not inline in route files

---

## 6. Database Connection Pool

- [ ] All DB access uses `await getPool()` — imported from `src/lib/db.ts`
- [ ] No `new ConnectionPool(...)` or `new sql.ConnectionPool(...)` anywhere in new code
- [ ] Each request creates a `pool.request()` — not reusing request objects across queries

---

## 7. DB Schema Changes

Any time a new column, table, or index is added:

- [ ] New column added to `runMigrations()` in `src/lib/db.ts` so existing live databases upgrade automatically on next server start
- [ ] Same new column also added to the `CREATE TABLE` statement in `src/app/api/setup/route.ts` for fresh installs
- [ ] Migration only uses `ALTER TABLE ... ADD` — never `DROP COLUMN`, `RENAME COLUMN`, or type changes (those require manual DB intervention)
- [ ] New indexes added to both `setup/route.ts` and confirmed safe to add on a live table

---

## 8. Azure OpenAI Calls

- [ ] Every new AI call sets `response_format: { type: "json_object" }` — without this the model returns markdown-wrapped JSON that crashes `JSON.parse`
- [ ] Every AI response is processed with `JSON.parse(response)` — never assumed to already be an object
- [ ] `PromptSent` and `SystemPromptSent` are captured and stored on the `Evaluations` row for AI Trace visibility
- [ ] Token counts (`promptTokens`, `completionTokens`) and `latencyMs` are captured and stored

---

## 9. Scenario Cache Invalidation

- [ ] Any route that creates, updates, or deletes a `Scenario` or `ChecklistItem` calls `invalidateScenariosCache()` after the DB write
- [ ] `invalidateScenariosCache()` is imported from `src/lib/evaluator.ts`

---

## 10. Production Scale — Think Before Merging

For any change that runs inside the batch processing loop (once per note):

- [ ] Is this operation fast enough at 500 notes? (e.g. an extra DB query per note at 500 notes = 500 extra queries)
- [ ] Does this add latency that multiplies across the batch?
- [ ] If this fails for one note, does it fail the whole batch or just that note?

For any change that stores state:

- [ ] Is this state stored only in memory? If yes — will losing it on server restart cause data inconsistency or a stuck job?
- [ ] Is anything written to local disk? Local disk won't survive a server move or cloud deployment.

For any new API route that returns patient data:

- [ ] Is this route accessible without authentication? (Currently all routes are — flag this explicitly if adding anything new that's sensitive)

---

## 11. Quick Code Hygiene

- [ ] No `console.log` left in from debugging (except intentional operational logs with a comment)
- [ ] No `// TODO` or `// FIXME` merged without a corresponding task to address it
- [ ] No `as any` TypeScript casts added without a comment explaining why it's necessary
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` completes without errors

---

## Sign-off

| Check | Status |
|---|---|
| SQL injection | ✅ / ❌ |
| Secrets & logs | ✅ / ❌ |
| Error responses | ✅ / ❌ |
| Client/server boundary | ✅ / ❌ |
| Input validation | ✅ / ❌ |
| DB connection pool | ✅ / ❌ |
| Schema changes | ✅ / ❌ |
| OpenAI calls | ✅ / ❌ |
| Scenario cache | ✅ / ❌ |
| Production scale | ✅ / ❌ |
| Code hygiene | ✅ / ❌ |