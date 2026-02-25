import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { updateChecklistItemSchema } from "@/lib/schemas";
import { invalidateScenariosCache } from "@/lib/evaluator";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const body = await req.json();
    const data = updateChecklistItemSchema.parse(body);
    const pool = await getPool();

    const setParts: string[] = [];
    const request = pool.request();
    request.input("itemId", sql.NVarChar, params.itemId);
    request.input("scenarioId", sql.NVarChar, params.id);

    if (data.itemText !== undefined) {
      setParts.push("ItemText = @itemText");
      request.input("itemText", sql.NVarChar, data.itemText);
    }
    if (data.mandatory !== undefined) {
      setParts.push("Mandatory = @mandatory");
      request.input("mandatory", sql.Bit, data.mandatory ? 1 : 0);
    }
    if (data.sortOrder !== undefined) {
      setParts.push("SortOrder = @sortOrder");
      request.input("sortOrder", sql.Int, data.sortOrder);
    }
    if (data.keywords !== undefined) {
      setParts.push("Keywords = @keywords");
      request.input("keywords", sql.NVarChar, data.keywords);
    }

    if (setParts.length === 0) {
      return NextResponse.json({ success: true });
    }

    await request.query(
      `UPDATE ChecklistItems SET ${setParts.join(", ")} WHERE Id = @itemId AND ScenarioId = @scenarioId`
    );

    invalidateScenariosCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const pool = await getPool();
    await pool.request()
      .input("itemId", sql.NVarChar, params.itemId)
      .input("scenarioId", sql.NVarChar, params.id)
      .query("DELETE FROM ChecklistItems WHERE Id = @itemId AND ScenarioId = @scenarioId");

    invalidateScenariosCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
