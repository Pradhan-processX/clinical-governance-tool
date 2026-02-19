import { getPool, sql } from "./db";
import { evaluateNote } from "./evaluator";
import { v4 as uuidv4 } from "uuid";
import type { ExcelRow } from "@/types";

async function getExcelRows(batchId: string): Promise<ExcelRow[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input("batchId", sql.NVarChar, batchId);

  // Rows are temporarily stored in Evaluations with a "pending" marker
  const result = await request.query<{
    Id: string;
    RoomNumber: string | null;
    ResidentName: string | null;
    NoteDate: string | null;
    NoteTime: string | null;
    EventType: string | null;
    CreatedByName: string | null;
    ProgressNoteText: string;
    SourceRowIndex: number | null;
  }>(`
    SELECT Id, RoomNumber, ResidentName, NoteDate, NoteTime, EventType, CreatedByName, ProgressNoteText, SourceRowIndex
    FROM Evaluations
    WHERE BatchId = @batchId AND EvaluationStatus IS NULL
    ORDER BY SourceRowIndex ASC
  `);

  return result.recordset.map((r) => ({
    room: r.RoomNumber,
    residentName: r.ResidentName,
    date: r.NoteDate,
    time: r.NoteTime,
    eventType: r.EventType,
    createdByName: r.CreatedByName,
    notes: r.ProgressNoteText,
    rawRowIndex: r.SourceRowIndex ?? 0,
  }));
}

export async function processBatch(batchId: string): Promise<void> {
  const pool = await getPool();

  // Update status to processing
  await pool.request()
    .input("batchId", sql.NVarChar, batchId)
    .input("startedAt", sql.DateTime2, new Date())
    .query(`
      UPDATE BatchJobs
      SET Status = 'processing', StartedAt = @startedAt
      WHERE Id = @batchId
    `);

  // Get pending evaluations for this batch
  const pendingResult = await pool.request()
    .input("batchId", sql.NVarChar, batchId)
    .query<{
      Id: string;
      RoomNumber: string | null;
      ResidentName: string | null;
      NoteDate: string | null;
      NoteTime: string | null;
      EventType: string | null;
      CreatedByName: string | null;
      ProgressNoteText: string;
      SourceRowIndex: number | null;
      BatchDate: string;
    }>(`
      SELECT Id, RoomNumber, ResidentName, NoteDate, NoteTime, EventType, CreatedByName, ProgressNoteText, SourceRowIndex, BatchDate
      FROM Evaluations
      WHERE BatchId = @batchId AND EvaluationStatus IS NULL
      ORDER BY SourceRowIndex ASC
    `);

  const rows = pendingResult.recordset;
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const result = await evaluateNote({
        noteText: row.ProgressNoteText,
        residentName: row.ResidentName ?? undefined,
        eventType: row.EventType ?? undefined,
        createdByName: row.CreatedByName ?? undefined,
      });

      if (result.scenarioCode === "NOT_APPLICABLE") {
        skipped++;
      }

      const updateRequest = pool.request();
      updateRequest.input("id", sql.NVarChar, row.Id);
      updateRequest.input("classifiedScenarioCode", sql.NVarChar, result.scenarioCode);
      updateRequest.input("confidence", sql.Float, result.confidence);
      updateRequest.input("evaluationStatus", sql.NVarChar, result.evaluationStatus);
      updateRequest.input("totalItems", sql.Int, result.totalItems);
      updateRequest.input("documentedItems", sql.Int, result.documentedItems);
      updateRequest.input("missingMandatoryCount", sql.Int, result.missingMandatoryCount);
      updateRequest.input("gapsSummary", sql.NVarChar, result.gapsSummary);
      updateRequest.input("aiResponseRaw", sql.NVarChar(sql.MAX), result.aiResponseRaw);
      updateRequest.input("modelUsed", sql.NVarChar, result.modelUsed);
      updateRequest.input("promptTokens", sql.Int, result.promptTokens);
      updateRequest.input("completionTokens", sql.Int, result.completionTokens);
      updateRequest.input("latencyMs", sql.Int, result.latencyMs);
      updateRequest.input("promptSent", sql.NVarChar(sql.MAX), result.promptSent);
      updateRequest.input("evaluatedAt", sql.DateTime2, new Date());

      await updateRequest.query(`
        UPDATE Evaluations SET
          ClassifiedScenarioCode = @classifiedScenarioCode,
          Confidence = @confidence,
          EvaluationStatus = @evaluationStatus,
          TotalItems = @totalItems,
          DocumentedItems = @documentedItems,
          MissingMandatoryCount = @missingMandatoryCount,
          GapsSummary = @gapsSummary,
          AiResponseRaw = @aiResponseRaw,
          ModelUsed = @modelUsed,
          PromptTokens = @promptTokens,
          CompletionTokens = @completionTokens,
          LatencyMs = @latencyMs,
          PromptSent = @promptSent,
          EvaluatedAt = @evaluatedAt
        WHERE Id = @id
      `);

      // Insert item results
      for (const item of result.items) {
        const itemRequest = pool.request();
        itemRequest.input("id", sql.NVarChar, uuidv4());
        itemRequest.input("evaluationId", sql.NVarChar, row.Id);
        itemRequest.input("itemCode", sql.NVarChar, item.itemCode);
        itemRequest.input("itemText", sql.NVarChar, item.itemText);
        itemRequest.input("mandatory", sql.Bit, item.mandatory ? 1 : 0);
        itemRequest.input("isDocumented", sql.Bit, item.isDocumented ? 1 : 0);
        itemRequest.input("evidence", sql.NVarChar(sql.MAX), item.evidence);
        itemRequest.input("gap", sql.NVarChar(sql.MAX), item.gap);

        await itemRequest.query(`
          INSERT INTO ItemResults (Id, EvaluationId, ItemCode, ItemText, Mandatory, IsDocumented, Evidence, Gap)
          VALUES (@id, @evaluationId, @itemCode, @itemText, @mandatory, @isDocumented, @evidence, @gap)
        `);
      }

      processed++;
    } catch (error) {
      failed++;
      // Mark this evaluation as failed
      await pool.request()
        .input("id", sql.NVarChar, row.Id)
        .input("gapsSummary", sql.NVarChar, `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
        .query(`
          UPDATE Evaluations SET
            EvaluationStatus = 'not-applicable',
            GapsSummary = @gapsSummary
          WHERE Id = @id
        `);
    }

    // Update batch progress counter
    await pool.request()
      .input("batchId", sql.NVarChar, batchId)
      .input("processed", sql.Int, processed)
      .input("failed", sql.Int, failed)
      .input("skipped", sql.Int, skipped)
      .query(`
        UPDATE BatchJobs SET
          ProcessedNotes = @processed,
          FailedNotes = @failed,
          SkippedNotes = @skipped
        WHERE Id = @batchId
      `);

    // Rate limit delay
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Final update
  await pool.request()
    .input("batchId", sql.NVarChar, batchId)
    .input("status", sql.NVarChar, failed === rows.length ? "failed" : "completed")
    .input("completedAt", sql.DateTime2, new Date())
    .query(`
      UPDATE BatchJobs SET
        Status = @status,
        CompletedAt = @completedAt
      WHERE Id = @batchId
    `);
}
