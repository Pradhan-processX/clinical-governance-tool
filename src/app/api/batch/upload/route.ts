import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { parseExcelBuffer, getPreviewRows } from "@/lib/excel-parser";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, mapping, headers, warnings } = parseExcelBuffer(buffer);
    const preview = getPreviewRows(buffer);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in Excel file." }, { status: 400 });
    }

    // Determine batch date (today)
    const today = new Date().toISOString().split("T")[0];

    // Create BatchJob
    const pool = await getPool();
    const batchId = uuidv4();

    const batchRequest = pool.request();
    batchRequest.input("id", sql.NVarChar, batchId);
    batchRequest.input("fileName", sql.NVarChar, file.name);
    batchRequest.input("batchDate", sql.Date, today);
    batchRequest.input("totalNotes", sql.Int, rows.length);

    await batchRequest.query(`
      INSERT INTO BatchJobs (Id, FileName, BatchDate, TotalNotes, Status)
      VALUES (@id, @fileName, @batchDate, @totalNotes, 'pending')
    `);

    // Insert evaluation stubs (EvaluationStatus = NULL = pending)
    for (const row of rows) {
      const evalRequest = pool.request();
      evalRequest.input("id", sql.NVarChar, uuidv4());
      evalRequest.input("batchId", sql.NVarChar, batchId);
      evalRequest.input("batchDate", sql.Date, today);
      evalRequest.input("roomNumber", sql.NVarChar, row.room);
      evalRequest.input("residentName", sql.NVarChar, row.residentName);
      evalRequest.input("noteDate", sql.NVarChar, row.date);
      evalRequest.input("noteTime", sql.NVarChar, row.time);
      evalRequest.input("eventType", sql.NVarChar, row.eventType);
      evalRequest.input("progressNoteText", sql.NVarChar(sql.MAX), row.notes);
      evalRequest.input("sourceRowIndex", sql.Int, row.rawRowIndex);

      await evalRequest.query(`
        INSERT INTO Evaluations (Id, BatchId, BatchDate, RoomNumber, ResidentName, NoteDate, NoteTime, EventType, ProgressNoteText, SourceRowIndex)
        VALUES (@id, @batchId, @batchDate, @roomNumber, @residentName, @noteDate, @noteTime, @eventType, @progressNoteText, @sourceRowIndex)
      `);
    }

    return NextResponse.json({
      batchId,
      totalNotes: rows.length,
      fileName: file.name,
      batchDate: today,
      mapping,
      headers,
      preview: preview.rows,
      warnings,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
