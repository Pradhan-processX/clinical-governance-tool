import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { parseExcelBuffer } from "@/lib/excel-parser";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows } = parseExcelBuffer(buffer);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in Excel file." }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];
    const pool = await getPool();
    const batchId = uuidv4();

    const batchRequest = pool.request();
    batchRequest.input("id", sql.NVarChar, batchId);
    batchRequest.input("fileName", sql.NVarChar, file.name);
    batchRequest.input("originalFile", sql.VarBinary(sql.MAX), buffer);
    batchRequest.input("batchDate", sql.Date, today);
    batchRequest.input("totalNotes", sql.Int, rows.length);

    // Insert directly as 'queued' — no intermediate 'pending' state
    await batchRequest.query(`
      INSERT INTO BatchJobs (Id, FileName, OriginalFile, BatchDate, TotalNotes, Status)
      VALUES (@id, @fileName, @originalFile, @batchDate, @totalNotes, 'queued')
    `);

    return NextResponse.json({
      success: true,
      batchId,
      totalNotes: rows.length,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Start error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
