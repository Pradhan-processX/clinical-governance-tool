import { NextRequest, NextResponse } from "next/server";
import { parseExcelBuffer, getPreviewRows } from "@/lib/excel-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, headers, warnings } = parseExcelBuffer(buffer);
    const preview = getPreviewRows(buffer);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in Excel file." }, { status: 400 });
    }

    // No DB write here — the file is only stored when the user confirms by clicking Start Evaluation.
    return NextResponse.json({
      totalNotes: rows.length,
      fileName: file.name,
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
