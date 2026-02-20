import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");

    const pool = await getPool();

    // 1. Fetch all completed batches
    const batchResult = await pool.request().query<{
      Id: string;
      FileName: string;
      BatchDate: string;
      TotalNotes: number;
      ProcessedNotes: number;
      FailedNotes: number;
      SkippedNotes: number;
      Status: string;
      CreatedAt: string;
    }>(`
      SELECT Id, FileName, BatchDate, TotalNotes, ProcessedNotes, FailedNotes, SkippedNotes, Status, CreatedAt
      FROM BatchJobs
      WHERE Status = 'completed'
      ORDER BY CreatedAt DESC
    `);

    const batches = batchResult.recordset.map((b) => ({
      id: b.Id,
      fileName: b.FileName,
      batchDate: b.BatchDate,
      totalNotes: b.TotalNotes,
      processedNotes: b.ProcessedNotes,
      failedNotes: b.FailedNotes,
      skippedNotes: b.SkippedNotes,
      status: b.Status,
      createdAt: b.CreatedAt,
    }));

    // Use requested batchId or fall back to most recent
    const activeBatchId = batchId ?? batches[0]?.id ?? null;

    if (!activeBatchId) {
      return NextResponse.json({ batches, evaluations: [], summary: emptySummary() });
    }

    // 2. Fetch evaluations + summary for the active batch in parallel
    const evRequest = pool.request();
    evRequest.input("batchId", sql.NVarChar, activeBatchId);

    const sumRequest = pool.request();
    sumRequest.input("batchId", sql.NVarChar, activeBatchId);

    const [evResult, sumResult] = await Promise.all([
      evRequest.query<{
        Id: string;
        BatchId: string | null;
        BatchDate: string;
        RoomNumber: string | null;
        ResidentName: string | null;
        NoteDate: string | null;
        NoteTime: string | null;
        EventType: string | null;
        ClinicalRiskCategory: string | null;
        ClassifiedScenarioCode: string | null;
        Confidence: number | null;
        EvaluationStatus: string | null;
        TotalItems: number | null;
        DocumentedItems: number | null;
        MissingMandatoryCount: number | null;
        GapsSummary: string | null;
        ModelUsed: string | null;
        LatencyMs: number | null;
        CreatedByName: string | null;
        EvaluatedAt: string;
      }>(`
        SELECT TOP 500 e.Id, e.BatchId, e.BatchDate, e.RoomNumber, e.ResidentName, e.NoteDate, e.NoteTime, e.EventType,
               s.Category AS ClinicalRiskCategory, e.ClassifiedScenarioCode, e.Confidence, e.EvaluationStatus, e.TotalItems, e.DocumentedItems,
               e.MissingMandatoryCount, e.GapsSummary, e.ModelUsed, e.LatencyMs, e.CreatedByName, e.EvaluatedAt
        FROM Evaluations e
        LEFT JOIN Scenarios s ON s.Code = e.ClassifiedScenarioCode
        WHERE e.BatchId = @batchId AND e.EvaluationStatus IS NOT NULL
        ORDER BY e.EvaluatedAt DESC
      `),
      sumRequest.query<{ Status: string; Count: number }>(`
        SELECT EvaluationStatus AS Status, COUNT(*) AS Count
        FROM Evaluations
        WHERE BatchId = @batchId AND EvaluationStatus IS NOT NULL
        GROUP BY EvaluationStatus
      `),
    ]);

    const evaluations = evResult.recordset.map((r) => ({
      id: r.Id,
      batchId: r.BatchId,
      batchDate: r.BatchDate,
      roomNumber: r.RoomNumber,
      residentName: r.ResidentName,
      noteDate: r.NoteDate,
      noteTime: r.NoteTime,
      eventType: r.EventType,
      clinicalRiskCategory: r.ClinicalRiskCategory,
      classifiedScenarioCode: r.ClassifiedScenarioCode,
      confidence: r.Confidence,
      evaluationStatus: r.EvaluationStatus,
      totalItems: r.TotalItems,
      documentedItems: r.DocumentedItems,
      missingMandatoryCount: r.MissingMandatoryCount,
      gapsSummary: r.GapsSummary,
      modelUsed: r.ModelUsed,
      latencyMs: r.LatencyMs,
      createdByName: r.CreatedByName,
      evaluatedAt: r.EvaluatedAt,
    }));

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of sumResult.recordset) {
      counts[row.Status] = row.Count;
      total += row.Count;
    }
    const compliant = counts["compliant"] ?? 0;
    const partial = counts["partial"] ?? 0;
    const nonCompliant = counts["non-compliant"] ?? 0;
    const notApplicable = counts["not-applicable"] ?? 0;

    const summary = {
      total,
      compliant,
      partial,
      nonCompliant,
      notApplicable,
      compliantPct: total > 0 ? Math.round((compliant / total) * 100) : 0,
      partialPct: total > 0 ? Math.round((partial / total) * 100) : 0,
      nonCompliantPct: total > 0 ? Math.round((nonCompliant / total) * 100) : 0,
    };

    return NextResponse.json({ batches, evaluations, summary, activeBatchId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function emptySummary() {
  return {
    total: 0, compliant: 0, partial: 0, nonCompliant: 0, notApplicable: 0,
    compliantPct: 0, partialPct: 0, nonCompliantPct: 0,
  };
}
