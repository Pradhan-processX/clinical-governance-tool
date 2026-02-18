import * as XLSX from "xlsx";
import type { Evaluation } from "@/types";

interface OriginalRow {
  [key: string]: string | number | boolean | null;
}

export function buildEnrichedExcel(
  originalBuffer: Buffer,
  evaluations: Evaluation[]
): Buffer {
  const workbook = XLSX.read(originalBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const raw = XLSX.utils.sheet_to_json<OriginalRow>(worksheet, { defval: "" });

  // Map evaluations by source row index for quick lookup
  const evalByRow = new Map<number, Evaluation>();
  for (const ev of evaluations) {
    if (ev.sourceRowIndex !== null) {
      evalByRow.set(ev.sourceRowIndex, ev);
    }
  }

  const enriched = raw.map((row, idx) => {
    const rowIndex = idx + 2; // +2: 1 for header row, 1 for 1-based
    const ev = evalByRow.get(rowIndex);

    if (!ev) {
      return {
        ...row,
        "AI Status": "",
        Scenario: "",
        "Missing Mandatory": "",
        "Gaps Summary": "",
        "Documented Items": "",
      };
    }

    return {
      ...row,
      "AI Status": ev.evaluationStatus ?? "",
      Scenario: ev.classifiedScenarioCode ?? "",
      "Missing Mandatory": ev.missingMandatoryCount ?? "",
      "Gaps Summary": ev.gapsSummary ?? "",
      "Documented Items": `${ev.documentedItems ?? 0}/${ev.totalItems ?? 0}`,
    };
  });

  const newWorksheet = XLSX.utils.json_to_sheet(enriched);

  // Colour-code the AI Status column
  const range = XLSX.utils.decode_range(newWorksheet["!ref"] ?? "A1");
  const headers = Object.keys(enriched[0] ?? {});
  const statusColIndex = headers.indexOf("AI Status");

  if (statusColIndex >= 0) {
    for (let r = 1; r <= range.e.r; r++) {
      const cellAddr = XLSX.utils.encode_cell({ r, c: statusColIndex });
      const cell = newWorksheet[cellAddr];
      if (cell) {
        const status = String(cell.v).toLowerCase();
        let fgColor = "FFFFFF";
        if (status === "compliant") fgColor = "C6EFCE";
        else if (status === "partial") fgColor = "FFEB9C";
        else if (status === "non-compliant") fgColor = "FFC7CE";
        else if (status === "not-applicable") fgColor = "D9D9D9";

        cell.s = {
          fill: { patternType: "solid", fgColor: { rgb: fgColor } },
          font: { bold: true },
        };
      }
    }
  }

  const newWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Results");

  const buf = XLSX.write(newWorkbook, { type: "buffer", bookType: "xlsx", cellStyles: true });
  return Buffer.from(buf);
}
