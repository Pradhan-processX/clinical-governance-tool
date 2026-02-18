import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchDate = searchParams.get("batchDate");
    const batchId = searchParams.get("batchId");

    const pool = await getPool();
    const request = pool.request();
    const conditions = ["EvaluationStatus IS NOT NULL"];

    if (batchId) {
      conditions.push("BatchId = @batchId");
      request.input("batchId", sql.NVarChar, batchId);
    } else if (batchDate) {
      conditions.push("CAST(BatchDate AS DATE) = @batchDate");
      request.input("batchDate", sql.NVarChar, batchDate);
    } else {
      // Default: most recent batch date
      const latestResult = await pool.request().query<{ BatchDate: string }>(`
        SELECT TOP 1 CAST(BatchDate AS DATE) AS BatchDate
        FROM Evaluations
        WHERE EvaluationStatus IS NOT NULL
        ORDER BY BatchDate DESC
      `);
      if (latestResult.recordset.length > 0) {
        const latestDate = latestResult.recordset[0].BatchDate;
        conditions.push("CAST(BatchDate AS DATE) = @batchDate");
        request.input("batchDate", sql.NVarChar, latestDate);
      }
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const result = await request.query<{
      Status: string;
      Count: number;
    }>(`
      SELECT EvaluationStatus AS Status, COUNT(*) AS Count
      FROM Evaluations
      ${whereClause}
      GROUP BY EvaluationStatus
    `);

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of result.recordset) {
      counts[row.Status] = row.Count;
      total += row.Count;
    }

    const compliant = counts["compliant"] ?? 0;
    const partial = counts["partial"] ?? 0;
    const nonCompliant = counts["non-compliant"] ?? 0;
    const notApplicable = counts["not-applicable"] ?? 0;

    return NextResponse.json({
      total,
      compliant,
      partial,
      nonCompliant,
      notApplicable,
      compliantPct: total > 0 ? Math.round((compliant / total) * 100) : 0,
      partialPct: total > 0 ? Math.round((partial / total) * 100) : 0,
      nonCompliantPct: total > 0 ? Math.round((nonCompliant / total) * 100) : 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
