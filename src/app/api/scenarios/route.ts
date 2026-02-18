import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { createScenarioSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const pool = await getPool();

    const scenariosResult = await pool.request().query<{
      Id: string;
      Code: string;
      Name: string;
      Category: string;
      Description: string | null;
      ClassificationHints: string | null;
      IsActive: boolean;
      SortOrder: number;
      CreatedAt: string;
      UpdatedAt: string;
    }>(`
      SELECT Id, Code, Name, Category, Description, ClassificationHints, IsActive, SortOrder, CreatedAt, UpdatedAt
      FROM Scenarios
      ORDER BY SortOrder ASC, Name ASC
    `);

    const itemsResult = await pool.request().query<{
      Id: string;
      ScenarioId: string;
      ItemCode: string;
      ItemText: string;
      Mandatory: boolean;
      SortOrder: number;
      Keywords: string | null;
      CreatedAt: string;
    }>(`
      SELECT Id, ScenarioId, ItemCode, ItemText, Mandatory, SortOrder, Keywords, CreatedAt
      FROM ChecklistItems
      ORDER BY SortOrder ASC
    `);

    const itemsByScenario: Record<string, typeof itemsResult.recordset> = {};
    for (const item of itemsResult.recordset) {
      if (!itemsByScenario[item.ScenarioId]) {
        itemsByScenario[item.ScenarioId] = [];
      }
      itemsByScenario[item.ScenarioId].push(item);
    }

    const scenarios = scenariosResult.recordset.map((s) => ({
      id: s.Id,
      code: s.Code,
      name: s.Name,
      category: s.Category,
      description: s.Description,
      classificationHints: s.ClassificationHints,
      isActive: Boolean(s.IsActive),
      sortOrder: s.SortOrder,
      createdAt: s.CreatedAt,
      updatedAt: s.UpdatedAt,
      checklistItems: (itemsByScenario[s.Id] ?? []).map((i) => ({
        id: i.Id,
        scenarioId: i.ScenarioId,
        itemCode: i.ItemCode,
        itemText: i.ItemText,
        mandatory: Boolean(i.Mandatory),
        sortOrder: i.SortOrder,
        keywords: i.Keywords,
        createdAt: i.CreatedAt,
      })),
    }));

    return NextResponse.json(scenarios);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createScenarioSchema.parse(body);
    const pool = await getPool();

    const request = pool.request();
    request.input("id", sql.NVarChar, data.id);
    request.input("code", sql.NVarChar, data.code);
    request.input("name", sql.NVarChar, data.name);
    request.input("category", sql.NVarChar, data.category);
    request.input("description", sql.NVarChar, data.description ?? null);
    request.input("classificationHints", sql.NVarChar, data.classificationHints ?? null);
    request.input("isActive", sql.Bit, data.isActive ? 1 : 0);
    request.input("sortOrder", sql.Int, data.sortOrder);

    await request.query(`
      INSERT INTO Scenarios (Id, Code, Name, Category, Description, ClassificationHints, IsActive, SortOrder)
      VALUES (@id, @code, @name, @category, @description, @classificationHints, @isActive, @sortOrder)
    `);

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
