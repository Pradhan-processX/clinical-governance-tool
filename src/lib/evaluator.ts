import { getPool, sql } from "./db";
import { callAzureOpenAI } from "./azure-openai";
import { buildSystemPrompt, buildSingleNotePrompt } from "./prompt-builder";
import { aiEvaluationResponseSchema } from "./schemas";
import type { ScenarioWithItems, AiEvaluationResponse } from "@/types";

async function getActiveScenarios(): Promise<ScenarioWithItems[]> {
  const pool = await getPool();
  const request = pool.request();

  const scenariosResult = await request.query<{
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
    WHERE IsActive = 1
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
    SELECT ci.Id, ci.ScenarioId, ci.ItemCode, ci.ItemText, ci.Mandatory, ci.SortOrder, ci.Keywords, ci.CreatedAt
    FROM ChecklistItems ci
    INNER JOIN Scenarios s ON s.Id = ci.ScenarioId
    WHERE s.IsActive = 1
    ORDER BY ci.SortOrder ASC
  `);

  const itemsByScenario: Record<string, ScenarioWithItems["checklistItems"]> = {};
  for (const item of itemsResult.recordset) {
    if (!itemsByScenario[item.ScenarioId]) {
      itemsByScenario[item.ScenarioId] = [];
    }
    itemsByScenario[item.ScenarioId].push({
      id: item.Id,
      scenarioId: item.ScenarioId,
      itemCode: item.ItemCode,
      itemText: item.ItemText,
      mandatory: item.Mandatory,
      sortOrder: item.SortOrder,
      keywords: item.Keywords,
      createdAt: item.CreatedAt?.toString() ?? "",
    });
  }

  return scenariosResult.recordset.map((s) => ({
    id: s.Id,
    code: s.Code,
    name: s.Name,
    category: s.Category,
    description: s.Description,
    classificationHints: s.ClassificationHints,
    isActive: s.IsActive,
    sortOrder: s.SortOrder,
    createdAt: s.CreatedAt?.toString() ?? "",
    updatedAt: s.UpdatedAt?.toString() ?? "",
    checklistItems: itemsByScenario[s.Id] ?? [],
  }));
}

export interface EvaluationInput {
  noteText: string;
  eventType?: string;
  forcedScenarioCode?: string;
}

export interface EvaluationResult extends AiEvaluationResponse {
  aiResponseRaw: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
}

async function attemptEvaluation(
  scenarios: ScenarioWithItems[],
  input: EvaluationInput
): Promise<EvaluationResult> {
  const systemPrompt = buildSingleNotePrompt(scenarios, input.forcedScenarioCode);
  const userMessage = input.eventType
    ? `Event Type: ${input.eventType}\n\nProgress Note:\n${input.noteText}`
    : `Progress Note:\n${input.noteText}`;

  const chatResult = await callAzureOpenAI(systemPrompt, userMessage);
  const parsed = aiEvaluationResponseSchema.parse(JSON.parse(chatResult.content));

  return {
    ...parsed,
    aiResponseRaw: chatResult.content,
    modelUsed: chatResult.model,
    promptTokens: chatResult.promptTokens,
    completionTokens: chatResult.completionTokens,
  };
}

export async function evaluateNote(input: EvaluationInput): Promise<EvaluationResult> {
  const scenarios = await getActiveScenarios();

  try {
    return await attemptEvaluation(scenarios, input);
  } catch {
    // Retry once
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await attemptEvaluation(scenarios, input);
  }
}
