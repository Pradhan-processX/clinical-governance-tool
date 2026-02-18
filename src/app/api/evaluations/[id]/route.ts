import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const pool = await getPool();

    const evalResult = await pool.request()
      .input("id", sql.NVarChar, params.id)
      .query<{
        Id: string;
        BatchId: string | null;
        BatchDate: string;
        RoomNumber: string | null;
        ResidentName: string | null;
        NoteDate: string | null;
        NoteTime: string | null;
        EventType: string | null;
        ProgressNoteText: string;
        ClassifiedScenarioCode: string | null;
        Confidence: number | null;
        EvaluationStatus: string | null;
        TotalItems: number | null;
        DocumentedItems: number | null;
        MissingMandatoryCount: number | null;
        GapsSummary: string | null;
        AiResponseRaw: string | null;
        ModelUsed: string | null;
        PromptTokens: number | null;
        CompletionTokens: number | null;
        EvaluatedAt: string;
      }>(`
        SELECT * FROM Evaluations WHERE Id = @id
      `);

    if (evalResult.recordset.length === 0) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    const ev = evalResult.recordset[0];

    const itemsResult = await pool.request()
      .input("evaluationId", sql.NVarChar, params.id)
      .query<{
        Id: string;
        EvaluationId: string;
        ItemCode: string;
        ItemText: string;
        Mandatory: boolean;
        IsDocumented: boolean;
        Evidence: string;
        Gap: string;
      }>(`
        SELECT Id, EvaluationId, ItemCode, ItemText, Mandatory, IsDocumented, Evidence, Gap
        FROM ItemResults
        WHERE EvaluationId = @evaluationId
        ORDER BY ItemCode ASC
      `);

    return NextResponse.json({
      id: ev.Id,
      batchId: ev.BatchId,
      batchDate: ev.BatchDate,
      roomNumber: ev.RoomNumber,
      residentName: ev.ResidentName,
      noteDate: ev.NoteDate,
      noteTime: ev.NoteTime,
      eventType: ev.EventType,
      progressNoteText: ev.ProgressNoteText,
      classifiedScenarioCode: ev.ClassifiedScenarioCode,
      confidence: ev.Confidence,
      evaluationStatus: ev.EvaluationStatus,
      totalItems: ev.TotalItems,
      documentedItems: ev.DocumentedItems,
      missingMandatoryCount: ev.MissingMandatoryCount,
      gapsSummary: ev.GapsSummary,
      aiResponseRaw: ev.AiResponseRaw,
      modelUsed: ev.ModelUsed,
      promptTokens: ev.PromptTokens,
      completionTokens: ev.CompletionTokens,
      evaluatedAt: ev.EvaluatedAt,
      itemResults: itemsResult.recordset.map((i) => ({
        id: i.Id,
        evaluationId: i.EvaluationId,
        itemCode: i.ItemCode,
        itemText: i.ItemText,
        mandatory: Boolean(i.Mandatory),
        isDocumented: Boolean(i.IsDocumented),
        evidence: i.Evidence,
        gap: i.Gap,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
