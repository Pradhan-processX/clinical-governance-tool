import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { evaluateNote } from "@/lib/evaluator";
import { singleEvaluateSchema } from "@/lib/schemas";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = singleEvaluateSchema.parse(body);

    const result = await evaluateNote({
      noteText: data.noteText,
      eventType: data.eventType,
      forcedScenarioCode: data.forcedScenarioCode,
    });

    // Store in DB
    const pool = await getPool();
    const evalId = uuidv4();
    const today = new Date().toISOString().split("T")[0];

    const request = pool.request();
    request.input("id", sql.NVarChar, evalId);
    request.input("batchDate", sql.Date, today);
    request.input("progressNoteText", sql.NVarChar(sql.MAX), data.noteText);
    request.input("eventType", sql.NVarChar, data.eventType ?? null);
    request.input("classifiedScenarioCode", sql.NVarChar, result.scenarioCode);
    request.input("confidence", sql.Float, result.confidence);
    request.input("evaluationStatus", sql.NVarChar, result.evaluationStatus);
    request.input("totalItems", sql.Int, result.totalItems);
    request.input("documentedItems", sql.Int, result.documentedItems);
    request.input("missingMandatoryCount", sql.Int, result.missingMandatoryCount);
    request.input("gapsSummary", sql.NVarChar, result.gapsSummary);
    request.input("aiResponseRaw", sql.NVarChar(sql.MAX), result.aiResponseRaw);
    request.input("modelUsed", sql.NVarChar, result.modelUsed);
    request.input("promptTokens", sql.Int, result.promptTokens);
    request.input("completionTokens", sql.Int, result.completionTokens);

    await request.query(`
      INSERT INTO Evaluations (Id, BatchDate, ProgressNoteText, EventType,
        ClassifiedScenarioCode, Confidence, EvaluationStatus, TotalItems, DocumentedItems,
        MissingMandatoryCount, GapsSummary, AiResponseRaw, ModelUsed, PromptTokens, CompletionTokens)
      VALUES (@id, @batchDate, @progressNoteText, @eventType,
        @classifiedScenarioCode, @confidence, @evaluationStatus, @totalItems, @documentedItems,
        @missingMandatoryCount, @gapsSummary, @aiResponseRaw, @modelUsed, @promptTokens, @completionTokens)
    `);

    // Insert item results
    for (const item of result.items) {
      const itemRequest = pool.request();
      itemRequest.input("id", sql.NVarChar, uuidv4());
      itemRequest.input("evaluationId", sql.NVarChar, evalId);
      itemRequest.input("itemCode", sql.NVarChar, item.itemCode);
      itemRequest.input("itemText", sql.NVarChar, item.itemText);
      itemRequest.input("mandatory", sql.Bit, item.mandatory ? 1 : 0);
      itemRequest.input("isDocumented", sql.Bit, item.isDocumented ? 1 : 0);
      itemRequest.input("evidence", sql.NVarChar(sql.MAX), item.evidence);
      itemRequest.input("gap", sql.NVarChar(sql.MAX), item.gap);

      await itemRequest.query(`
        INSERT INTO ItemResults (Id, EvaluationId, ItemCode, ItemText, Mandatory, IsDocumented, Evidence, Gap)
        VALUES (@id, @evaluationId, @itemCode, @itemText, @mandatory, @isDocumented, @evidence, @gap)
      `);
    }

    return NextResponse.json({
      evaluationId: evalId,
      ...result,
    });
  } catch (error) {
    console.error("Evaluate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
