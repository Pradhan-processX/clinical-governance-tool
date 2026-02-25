import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { updateScenarioSchema } from "@/lib/schemas";
import { invalidateScenariosCache } from "@/lib/evaluator";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = updateScenarioSchema.parse(body);
    const pool = await getPool();

    const setParts: string[] = ["UpdatedAt = GETDATE()"];
    const request = pool.request();
    request.input("id", sql.NVarChar, params.id);

    if (data.name !== undefined) {
      setParts.push("Name = @name");
      request.input("name", sql.NVarChar, data.name);
    }
    if (data.category !== undefined) {
      setParts.push("Category = @category");
      request.input("category", sql.NVarChar, data.category);
    }
    if (data.description !== undefined) {
      setParts.push("Description = @description");
      request.input("description", sql.NVarChar, data.description);
    }
    if (data.classificationHints !== undefined) {
      setParts.push("ClassificationHints = @classificationHints");
      request.input("classificationHints", sql.NVarChar, data.classificationHints);
    }
    if (data.isActive !== undefined) {
      setParts.push("IsActive = @isActive");
      request.input("isActive", sql.Bit, data.isActive ? 1 : 0);
    }
    if (data.sortOrder !== undefined) {
      setParts.push("SortOrder = @sortOrder");
      request.input("sortOrder", sql.Int, data.sortOrder);
    }

    await request.query(`UPDATE Scenarios SET ${setParts.join(", ")} WHERE Id = @id`);

    invalidateScenariosCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.NVarChar, params.id)
      .query("DELETE FROM Scenarios WHERE Id = @id");

    invalidateScenariosCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
