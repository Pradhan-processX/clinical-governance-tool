// Load .env.local before any other imports so DB + Azure creds are available
import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "../lib/db";
import { getPool } from "../lib/db";
import { processBatch } from "../lib/batch-processor";

const POLL_INTERVAL_MS = 5_000;
const STUCK_JOB_TIMEOUT_MINUTES = 10;

// ─── Recovery ────────────────────────────────────────────────────────────────
// Reset jobs that have been stuck in 'processing' for longer than the timeout.
// This handles the case where the worker was killed mid-batch.
async function recoverStuckJobs(): Promise<void> {
  const pool = await getPool();

  const result = await pool.request()
    .input("timeoutMinutes", sql.Int, STUCK_JOB_TIMEOUT_MINUTES)
    .query<{ Id: string }>(`
      UPDATE BatchJobs
      SET Status = 'queued'
      OUTPUT INSERTED.Id
      WHERE Status = 'processing'
        AND StartedAt IS NOT NULL
        AND DATEDIFF(MINUTE, StartedAt, GETDATE()) > @timeoutMinutes
    `);

  if (result.recordset.length > 0) {
    const ids = result.recordset.map((r) => r.Id).join(", ");
    console.log(`[worker] Recovered ${result.recordset.length} stuck job(s): ${ids}`);
  }
}

// ─── Claim ───────────────────────────────────────────────────────────────────
// Atomically pick ONE queued job and mark it as processing.
async function claimJob(): Promise<string | null> {
  const pool = await getPool();

  const result = await pool.request()
    .query<{ Id: string }>(`
      UPDATE TOP(1) BatchJobs
      SET Status = 'processing'
      OUTPUT INSERTED.Id
      WHERE Status = 'queued'
    `);

  return result.recordset[0]?.Id ?? null;
}

// ─── Mark failed ─────────────────────────────────────────────────────────────
async function markBatchFailed(batchId: string, _error: unknown): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input("batchId", sql.NVarChar, batchId)
    .query(`
      UPDATE BatchJobs
      SET Status = 'failed', CompletedAt = GETDATE()
      WHERE Id = @batchId
    `);
}

// ─── Poll loop ────────────────────────────────────────────────────────────────
async function poll(): Promise<void> {
  await recoverStuckJobs();

  const batchId = await claimJob();
  if (!batchId) return;

  console.log(`[worker] Claimed batch ${batchId}`);

  try {
    await processBatch(batchId);
    console.log(`[worker] Completed batch ${batchId}`);
  } catch (err) {
    console.error(`[worker] Batch ${batchId} failed:`, err);
    await markBatchFailed(batchId, err);
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("[worker] Started. Polling every", POLL_INTERVAL_MS / 1000, "seconds.");

  while (true) {
    try {
      await poll();
    } catch (err) {
      console.error("[worker] Unexpected poll error:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main();
