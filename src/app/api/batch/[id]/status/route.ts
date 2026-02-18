import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.NVarChar, params.id)
      .query<{
        Id: string;
        FileName: string;
        BatchDate: string;
        TotalNotes: number;
        ProcessedNotes: number;
        FailedNotes: number;
        SkippedNotes: number;
        Status: string;
        ErrorMessage: string | null;
        StartedAt: string | null;
        CompletedAt: string | null;
        CreatedAt: string;
      }>(`
        SELECT Id, FileName, BatchDate, TotalNotes, ProcessedNotes, FailedNotes, SkippedNotes,
               Status, ErrorMessage, StartedAt, CompletedAt, CreatedAt
        FROM BatchJobs
        WHERE Id = @id
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const b = result.recordset[0];

    // Get live counts
    const countsResult = await pool.request()
      .input("batchId", sql.NVarChar, params.id)
      .query<{ Status: string; Count: number }>(`
        SELECT EvaluationStatus AS Status, COUNT(*) AS Count
        FROM Evaluations
        WHERE BatchId = @batchId AND EvaluationStatus IS NOT NULL
        GROUP BY EvaluationStatus
      `);

    const liveCounts: Record<string, number> = {};
    for (const row of countsResult.recordset) {
      liveCounts[row.Status] = row.Count;
    }

    return NextResponse.json({
      id: b.Id,
      fileName: b.FileName,
      batchDate: b.BatchDate,
      totalNotes: b.TotalNotes,
      processedNotes: b.ProcessedNotes,
      failedNotes: b.FailedNotes,
      skippedNotes: b.SkippedNotes,
      status: b.Status,
      errorMessage: b.ErrorMessage,
      startedAt: b.StartedAt,
      completedAt: b.CompletedAt,
      createdAt: b.CreatedAt,
      liveCounts: {
        compliant: liveCounts["compliant"] ?? 0,
        partial: liveCounts["partial"] ?? 0,
        nonCompliant: liveCounts["non-compliant"] ?? 0,
        notApplicable: liveCounts["not-applicable"] ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
