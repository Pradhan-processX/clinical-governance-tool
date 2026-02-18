import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");
    const batchDate = searchParams.get("batchDate");
    const status = searchParams.get("status");
    const scenario = searchParams.get("scenario");
    const search = searchParams.get("search");

    const pool = await getPool();
    const request = pool.request();

    const conditions: string[] = ["EvaluationStatus IS NOT NULL"];

    if (batchId) {
      conditions.push("BatchId = @batchId");
      request.input("batchId", sql.NVarChar, batchId);
    }
    if (batchDate) {
      conditions.push("CAST(BatchDate AS DATE) = @batchDate");
      request.input("batchDate", sql.NVarChar, batchDate);
    }
    if (status && status !== "all") {
      conditions.push("EvaluationStatus = @status");
      request.input("status", sql.NVarChar, status);
    }
    if (scenario && scenario !== "all") {
      conditions.push("ClassifiedScenarioCode = @scenario");
      request.input("scenario", sql.NVarChar, scenario);
    }
    if (search) {
      conditions.push("(ResidentName LIKE @search OR RoomNumber LIKE @search)");
      request.input("search", sql.NVarChar, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await request.query<{
      Id: string;
      BatchId: string | null;
      BatchDate: string;
      RoomNumber: string | null;
      ResidentName: string | null;
      NoteDate: string | null;
      NoteTime: string | null;
      EventType: string | null;
      ClassifiedScenarioCode: string | null;
      Confidence: number | null;
      EvaluationStatus: string | null;
      TotalItems: number | null;
      DocumentedItems: number | null;
      MissingMandatoryCount: number | null;
      GapsSummary: string | null;
      ModelUsed: string | null;
      EvaluatedAt: string;
    }>(`
      SELECT Id, BatchId, BatchDate, RoomNumber, ResidentName, NoteDate, NoteTime, EventType,
             ClassifiedScenarioCode, Confidence, EvaluationStatus, TotalItems, DocumentedItems,
             MissingMandatoryCount, GapsSummary, ModelUsed, EvaluatedAt
      FROM Evaluations
      ${whereClause}
      ORDER BY EvaluatedAt DESC
    `);

    const evaluations = result.recordset.map((r) => ({
      id: r.Id,
      batchId: r.BatchId,
      batchDate: r.BatchDate,
      roomNumber: r.RoomNumber,
      residentName: r.ResidentName,
      noteDate: r.NoteDate,
      noteTime: r.NoteTime,
      eventType: r.EventType,
      classifiedScenarioCode: r.ClassifiedScenarioCode,
      confidence: r.Confidence,
      evaluationStatus: r.EvaluationStatus,
      totalItems: r.TotalItems,
      documentedItems: r.DocumentedItems,
      missingMandatoryCount: r.MissingMandatoryCount,
      gapsSummary: r.GapsSummary,
      modelUsed: r.ModelUsed,
      evaluatedAt: r.EvaluatedAt,
    }));

    return NextResponse.json(evaluations);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
