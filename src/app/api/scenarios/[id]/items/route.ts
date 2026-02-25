import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { createChecklistItemSchema } from "@/lib/schemas";
import { invalidateScenariosCache } from "@/lib/evaluator";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = createChecklistItemSchema.parse(body);
    const pool = await getPool();

    const request = pool.request();
    request.input("id", sql.NVarChar, data.id);
    request.input("scenarioId", sql.NVarChar, params.id);
    request.input("itemCode", sql.NVarChar, data.itemCode);
    request.input("itemText", sql.NVarChar, data.itemText);
    request.input("mandatory", sql.Bit, data.mandatory ? 1 : 0);
    request.input("sortOrder", sql.Int, data.sortOrder);
    request.input("keywords", sql.NVarChar, data.keywords ?? null);

    await request.query(`
      INSERT INTO ChecklistItems (Id, ScenarioId, ItemCode, ItemText, Mandatory, SortOrder, Keywords)
      VALUES (@id, @scenarioId, @itemCode, @itemText, @mandatory, @sortOrder, @keywords)
    `);

    invalidateScenariosCache();
    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
