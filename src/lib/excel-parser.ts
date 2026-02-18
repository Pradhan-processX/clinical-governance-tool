import * as XLSX from "xlsx";
import type { ExcelRow, ColumnMapping, ParsedExcel } from "@/types";

const COLUMN_PATTERNS: Record<keyof ColumnMapping, string[]> = {
  room: ["room", "room no", "room number", "bed", "bed no"],
  residentName: ["resident", "name", "resident name", "client", "client name"],
  date: ["date"],
  time: ["time"],
  eventType: ["event type", "event", "type", "note type", "category"],
  notes: ["notes", "progress notes", "note", "content", "description", "text"],
};

function fuzzyMatch(header: string, patterns: string[]): boolean {
  const normalized = header.toLowerCase().trim();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function detectColumnMapping(headers: string[]): { mapping: ColumnMapping; warnings: string[] } {
  const mapping: ColumnMapping = {
    room: null,
    residentName: null,
    date: null,
    time: null,
    eventType: null,
    notes: null,
  };
  const warnings: string[] = [];

  for (const [key, patterns] of Object.entries(COLUMN_PATTERNS) as [keyof ColumnMapping, string[]][]) {
    const idx = headers.findIndex((h) => fuzzyMatch(h, patterns));
    if (idx !== -1) {
      mapping[key] = idx;
    }
  }

  if (mapping.notes === null) {
    warnings.push("Could not auto-detect the progress notes column. Please map it manually.");
  }

  return { mapping, warnings };
}

export function parseExcelBuffer(buffer: Buffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const raw = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "" });

  if (raw.length < 2) {
    return {
      rows: [],
      mapping: { room: null, residentName: null, date: null, time: null, eventType: null, notes: null },
      headers: [],
      warnings: ["Excel file appears to be empty or has no data rows."],
    };
  }

  const headers = (raw[0] as string[]).map((h) => String(h));
  const { mapping, warnings } = detectColumnMapping(headers);

  const rows: ExcelRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as string[];

    const notesValue = mapping.notes !== null ? String(row[mapping.notes] ?? "") : "";
    if (!notesValue.trim()) continue; // Skip rows with no note text

    rows.push({
      room: mapping.room !== null ? String(row[mapping.room] ?? "").trim() || null : null,
      residentName: mapping.residentName !== null ? String(row[mapping.residentName] ?? "").trim() || null : null,
      date: mapping.date !== null ? String(row[mapping.date] ?? "").trim() || null : null,
      time: mapping.time !== null ? String(row[mapping.time] ?? "").trim() || null : null,
      eventType: mapping.eventType !== null ? String(row[mapping.eventType] ?? "").trim() || null : null,
      notes: notesValue.trim(),
      rawRowIndex: i + 1, // 1-based row number (accounting for header)
    });
  }

  return { rows, mapping, headers, warnings };
}

export function getPreviewRows(buffer: Buffer, count = 3): { headers: string[]; rows: string[][] } {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "" });

  const headers = raw.length > 0 ? (raw[0] as string[]).map((h) => String(h)) : [];
  const rows = raw.slice(1, count + 1).map((r) => (r as string[]).map((c) => String(c)));

  return { headers, rows };
}
