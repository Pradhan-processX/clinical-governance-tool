import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { buildEnrichedExcel } from "@/lib/excel-writer";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const pool = await getPool();

    // Get batch info and persisted original file bytes
    const batchResult = await pool.request()
      .input("id", sql.NVarChar, params.id)
      .query<{ FileName: string; OriginalFile: Buffer | null }>(`
        SELECT FileName, OriginalFile
        FROM BatchJobs
        WHERE Id = @id
      `);

    if (batchResult.recordset.length === 0) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const originalFileBytes = batchResult.recordset[0].OriginalFile;
    if (!originalFileBytes) {
      return NextResponse.json(
        { error: "Original file not stored for this batch. Re-upload and reprocess this batch to enable download." },
        { status: 404 }
      );
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

    const originalBuffer = Buffer.from(originalFileBytes);
    const enrichedBuffer = buildEnrichedExcel(originalBuffer, evaluations as Parameters<typeof buildEnrichedExcel>[1]);

    const fileName = batchResult.recordset[0].FileName.replace(/\.xlsx?$/i, "") + "_results.xlsx";

    return new NextResponse(new Uint8Array(enrichedBuffer), {
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
