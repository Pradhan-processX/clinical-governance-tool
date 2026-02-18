import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { buildEnrichedExcel } from "@/lib/excel-writer";

// Store original file buffers in memory (simple approach for MVP)
const fileBufferCache = new Map<string, Buffer>();

export function cacheFileBuffer(batchId: string, buffer: Buffer) {
  fileBufferCache.set(batchId, buffer);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const pool = await getPool();

    // Get batch info
    const batchResult = await pool.request()
      .input("id", sql.NVarChar, params.id)
      .query<{ FileName: string }>(`SELECT FileName FROM BatchJobs WHERE Id = @id`);

    if (batchResult.recordset.length === 0) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Get all evaluations for this batch
    const evalResult = await pool.request()
      .input("batchId", sql.NVarChar, params.id)
      .query<{
        Id: string;
        SourceRowIndex: number | null;
        ClassifiedScenarioCode: string | null;
        EvaluationStatus: string | null;
        TotalItems: number | null;
        DocumentedItems: number | null;
        MissingMandatoryCount: number | null;
        GapsSummary: string | null;
      }>(`
        SELECT Id, SourceRowIndex, ClassifiedScenarioCode, EvaluationStatus,
               TotalItems, DocumentedItems, MissingMandatoryCount, GapsSummary
        FROM Evaluations
        WHERE BatchId = @batchId
        ORDER BY SourceRowIndex ASC
      `);

    const evaluations = evalResult.recordset.map((r) => ({
      id: r.Id,
      sourceRowIndex: r.SourceRowIndex,
      classifiedScenarioCode: r.ClassifiedScenarioCode,
      evaluationStatus: r.EvaluationStatus,
      totalItems: r.TotalItems,
      documentedItems: r.DocumentedItems,
      missingMandatoryCount: r.MissingMandatoryCount,
      gapsSummary: r.GapsSummary,
    }));

    // Check if we have cached original file
    const originalBuffer = fileBufferCache.get(params.id);
    if (!originalBuffer) {
      return NextResponse.json(
        { error: "Original file not available for download. Please re-upload the file." },
        { status: 404 }
      );
    }

    const enrichedBuffer = buildEnrichedExcel(originalBuffer, evaluations as Parameters<typeof buildEnrichedExcel>[1]);

    const fileName = batchResult.recordset[0].FileName.replace(/\.xlsx?$/i, "") + "_results.xlsx";

    return new NextResponse(enrichedBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
