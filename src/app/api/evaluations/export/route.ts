import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import * as XLSX from "xlsx";

const EXPORT_HEADERS = [
  "Record ID",
  "Service location",
  "Service wing",
  "Current number",
  "Client",
  "Date",
  "Time",
  "Late entry",
  "Event type",
  "Care area(s)",
  "Notes",
  "Created by name",
  "AI Status",
  "Scenario",
  "Missing Mandatory",
  "Gaps Summary",
  "Documented Items",
  "Full Checklist items ",
] as const;

function buildFileName(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const sec = String(now.getSeconds()).padStart(2, "0");
  return `evaluation_history_${yyyy}${mm}${dd}_${hh}${min}${sec}.xlsx`;
}

function safeText(value: string | null | undefined): string {
  return value ?? "";
}

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

    const pool = await getPool();
    const request = pool.request();
    const conditions: string[] = ["e.EvaluationStatus IS NOT NULL"];

    if (batchId) {
      conditions.push("e.BatchId = @batchId");
      request.input("batchId", sql.NVarChar, batchId);
    }
    if (batchDate) {
      conditions.push("CAST(e.BatchDate AS DATE) = @batchDate");
      request.input("batchDate", sql.NVarChar, batchDate);
    }
    if (status && status !== "all") {
      conditions.push("e.EvaluationStatus = @status");
      request.input("status", sql.NVarChar, status);
    }
    if (scenario && scenario !== "all") {
      conditions.push("e.ClassifiedScenarioCode = @scenario");
      request.input("scenario", sql.NVarChar, scenario);
    }
    if (search) {
      conditions.push("(e.ResidentName LIKE @search OR e.RoomNumber LIKE @search OR e.CreatedByName LIKE @search)");
      request.input("search", sql.NVarChar, `%${search}%`);
    }
    if (dateFrom) {
      conditions.push("e.NoteDate >= @dateFrom");
      request.input("dateFrom", sql.NVarChar, dateFrom);
    }
    if (dateTo) {
      conditions.push("e.NoteDate <= @dateTo");
      request.input("dateTo", sql.NVarChar, dateTo);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const result = await request.query<{
      Id: string;
      RoomNumber: string | null;
      ResidentName: string | null;
      NoteDate: string | null;
      NoteTime: string | null;
      EventType: string | null;
      CreatedByName: string | null;
      ClinicalRiskCategory: string | null;
      ProgressNoteText: string;
      EvaluationStatus: string | null;
      ClassifiedScenarioCode: string | null;
      MissingMandatoryCount: number | null;
      GapsSummary: string | null;
      DocumentedItems: number | null;
      TotalItems: number | null;
      FullChecklistItems: string | null;
    }>(`
      SELECT
        e.Id,
        e.RoomNumber,
        e.ResidentName,
        e.NoteDate,
        e.NoteTime,
        e.EventType,
        e.CreatedByName,
        s.Category AS ClinicalRiskCategory,
        e.ProgressNoteText,
        e.EvaluationStatus,
        e.ClassifiedScenarioCode,
        e.MissingMandatoryCount,
        e.GapsSummary,
        e.DocumentedItems,
        e.TotalItems,
        (
          SELECT STRING_AGG(
            CONCAT(
              ir.ItemCode,
              ': ',
              CASE WHEN ir.IsDocumented = 1 THEN 'Documented' ELSE 'Missing' END,
              CASE WHEN ir.Mandatory = 1 THEN ' (Mandatory)' ELSE ' (Optional)' END,
              CASE
                WHEN ISNULL(ir.Evidence, '') <> ''
                  THEN CONCAT(' | Evidence: ', REPLACE(REPLACE(ir.Evidence, CHAR(13), ' '), CHAR(10), ' '))
                ELSE ''
              END,
              CASE
                WHEN ISNULL(ir.Gap, '') <> ''
                  THEN CONCAT(' | Gap: ', REPLACE(REPLACE(ir.Gap, CHAR(13), ' '), CHAR(10), ' '))
                ELSE ''
              END
            ),
            CHAR(10)
          )
          FROM ItemResults ir
          WHERE ir.EvaluationId = e.Id
        ) AS FullChecklistItems
      FROM Evaluations e
      LEFT JOIN Scenarios s ON s.Code = e.ClassifiedScenarioCode
      ${whereClause}
      ORDER BY e.EvaluatedAt DESC
    `);

    const rows: (string | number)[][] = result.recordset.map((r) => [
      safeText(r.Id),
      "",
      "",
      safeText(r.RoomNumber),
      safeText(r.ResidentName),
      safeText(r.NoteDate),
      safeText(r.NoteTime),
      "",
      safeText(r.EventType),
      safeText(r.ClinicalRiskCategory),
      safeText(r.ProgressNoteText),
      safeText(r.CreatedByName),
      safeText(r.EvaluationStatus),
      safeText(r.ClassifiedScenarioCode),
      r.MissingMandatoryCount ?? "",
      safeText(r.GapsSummary),
      r.TotalItems === null ? "" : `${r.DocumentedItems ?? 0}/${r.TotalItems}`,
      safeText(r.FullChecklistItems),
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([Array.from(EXPORT_HEADERS), ...rows]);
    worksheet["!cols"] = [
      { wch: 38 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 56 },
      { wch: 24 },
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
      { wch: 40 },
      { wch: 16 },
      { wch: 80 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "History");
    const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${buildFileName()}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
