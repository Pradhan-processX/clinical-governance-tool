import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getPool();
    const result = await pool.request().query<{
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

    return NextResponse.json(
      result.recordset.map((b) => ({
        id: b.Id,
        fileName: b.FileName,
        batchDate: b.BatchDate,
        totalNotes: b.TotalNotes,
        processedNotes: b.ProcessedNotes,
        failedNotes: b.FailedNotes,
        skippedNotes: b.SkippedNotes,
        status: b.Status,
        createdAt: b.CreatedAt,
      }))
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
