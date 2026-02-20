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
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50")));
    const offset = (page - 1) * pageSize;

    const pool = await getPool();
    const request = pool.request();
    const countRequest = pool.request();

    const conditions: string[] = ["e.EvaluationStatus IS NOT NULL"];

    if (batchId) {
      conditions.push("e.BatchId = @batchId");
      request.input("batchId", sql.NVarChar, batchId);
      countRequest.input("batchId", sql.NVarChar, batchId);
    }
    if (batchDate) {
      conditions.push("CAST(e.BatchDate AS DATE) = @batchDate");
      request.input("batchDate", sql.NVarChar, batchDate);
      countRequest.input("batchDate", sql.NVarChar, batchDate);
    }
    if (status && status !== "all") {
      conditions.push("e.EvaluationStatus = @status");
      request.input("status", sql.NVarChar, status);
      countRequest.input("status", sql.NVarChar, status);
    }
    if (scenario && scenario !== "all") {
      conditions.push("e.ClassifiedScenarioCode = @scenario");
      request.input("scenario", sql.NVarChar, scenario);
      countRequest.input("scenario", sql.NVarChar, scenario);
    }
    if (search) {
      conditions.push("(e.ResidentName LIKE @search OR e.RoomNumber LIKE @search OR e.CreatedByName LIKE @search)");
      request.input("search", sql.NVarChar, `%${search}%`);
      countRequest.input("search", sql.NVarChar, `%${search}%`);
    }
    if (dateFrom) {
      conditions.push("e.NoteDate >= @dateFrom");
      request.input("dateFrom", sql.NVarChar, dateFrom);
      countRequest.input("dateFrom", sql.NVarChar, dateFrom);
    }
    if (dateTo) {
      conditions.push("e.NoteDate <= @dateTo");
      request.input("dateTo", sql.NVarChar, dateTo);
      countRequest.input("dateTo", sql.NVarChar, dateTo);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    request.input("pageSize", sql.Int, pageSize);
    request.input("offset", sql.Int, offset);

    const [result, countResult] = await Promise.all([
      request.query<{
        Id: string;
        BatchId: string | null;
        BatchDate: string;
        RoomNumber: string | null;
        ResidentName: string | null;
        NoteDate: string | null;
        NoteTime: string | null;
        EventType: string | null;
        CreatedByName: string | null;
        ClinicalRiskCategory: string | null;
        ClassifiedScenarioCode: string | null;
        Confidence: number | null;
        EvaluationStatus: string | null;
        TotalItems: number | null;
        DocumentedItems: number | null;
        MissingMandatoryCount: number | null;
        GapsSummary: string | null;
        ModelUsed: string | null;
        PromptTokens: number | null;
        CompletionTokens: number | null;
        LatencyMs: number | null;
        EvaluatedAt: string;
      }>(`
        SELECT e.Id, e.BatchId, e.BatchDate, e.RoomNumber, e.ResidentName, e.NoteDate, e.NoteTime, e.EventType,
               e.CreatedByName, s.Category AS ClinicalRiskCategory, e.ClassifiedScenarioCode, e.Confidence, e.EvaluationStatus, e.TotalItems, e.DocumentedItems,
               e.MissingMandatoryCount, e.GapsSummary, e.ModelUsed, e.PromptTokens, e.CompletionTokens, e.LatencyMs, e.EvaluatedAt
        FROM Evaluations e
        LEFT JOIN Scenarios s ON s.Code = e.ClassifiedScenarioCode
        ${whereClause}
        ORDER BY e.EvaluatedAt DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
      countRequest.query<{ Total: number; TotalCostTokens: number }>(`
        SELECT
          COUNT(*) AS Total,
          SUM(ISNULL(e.PromptTokens, 0) + ISNULL(e.CompletionTokens, 0)) AS TotalCostTokens
        FROM Evaluations e
        ${whereClause}
      `),
    ]);

    const evaluations = result.recordset.map((r) => ({
      id: r.Id,
      batchId: r.BatchId,
      batchDate: r.BatchDate,
      roomNumber: r.RoomNumber,
      residentName: r.ResidentName,
      noteDate: r.NoteDate,
      noteTime: r.NoteTime,
      eventType: r.EventType,
      createdByName: r.CreatedByName,
      clinicalRiskCategory: r.ClinicalRiskCategory,
      classifiedScenarioCode: r.ClassifiedScenarioCode,
      confidence: r.Confidence,
      evaluationStatus: r.EvaluationStatus,
      totalItems: r.TotalItems,
      documentedItems: r.DocumentedItems,
      missingMandatoryCount: r.MissingMandatoryCount,
      gapsSummary: r.GapsSummary,
      modelUsed: r.ModelUsed,
      promptTokens: r.PromptTokens,
      completionTokens: r.CompletionTokens,
      latencyMs: r.LatencyMs,
      evaluatedAt: r.EvaluatedAt,
    }));

    const total = countResult.recordset[0]?.Total ?? 0;
    const totalTokens = countResult.recordset[0]?.TotalCostTokens ?? 0;

    return NextResponse.json({ evaluations, total, page, pageSize, totalTokens });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
