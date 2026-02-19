import { getPool, sql } from "./db";
import { callAzureOpenAI } from "./azure-openai";
import { buildSingleNotePrompt } from "./prompt-builder";
import { aiEvaluationResponseSchema } from "./schemas";
import type { ScenarioWithItems, AiEvaluationResponse } from "@/types";

// In-memory cache for active scenarios.
let _scenariosCache: ScenarioWithItems[] | null = null;
let _scenariosCachedAt = 0;
const SCENARIOS_TTL_MS = 5 * 60 * 1000;

// Resident -> recent scenario codes cache for shortlist bootstrap.
const RESIDENT_SCENARIO_TTL_MS = 10 * 60 * 1000;
const MAX_RESIDENT_SCENARIO_CODES = 5;
const RESIDENT_HISTORY_SCAN_MULTIPLIER = 4;
const MAX_SHORTLIST_SCENARIOS = 6;
const LOW_CONFIDENCE_THRESHOLD = 0.55;

type ResidentScenarioCacheEntry = {
  codes: string[];
  cachedAt: number;
};

const _residentScenarioCache = new Map<string, ResidentScenarioCacheEntry>();

export function invalidateScenariosCache() {
  _scenariosCache = null;
  _scenariosCachedAt = 0;
  _residentScenarioCache.clear();
}

async function getActiveScenarios(): Promise<ScenarioWithItems[]> {
  if (_scenariosCache && Date.now() - _scenariosCachedAt < SCENARIOS_TTL_MS) {
    return _scenariosCache;
  }

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

  _scenariosCache = scenariosResult.recordset.map((s) => ({
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
  _scenariosCachedAt = Date.now();
  return _scenariosCache;
}

export interface EvaluationInput {
  noteText: string;
  residentName?: string;
  eventType?: string;
  createdByName?: string;
  forcedScenarioCode?: string;
}

export interface EvaluationResult extends AiEvaluationResponse {
  aiResponseRaw: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  promptSent: string;
  systemPromptSent: string;
}

async function attemptEvaluation(
  scenarios: ScenarioWithItems[],
  input: EvaluationInput
): Promise<EvaluationResult> {
  const systemPrompt = buildSingleNotePrompt(scenarios, input.forcedScenarioCode);
  const parts: string[] = [];
  if (input.residentName) parts.push(`Resident: ${input.residentName}`);
  if (input.eventType) parts.push(`Event Type: ${input.eventType}`);
  if (input.createdByName) parts.push(`Written by: ${input.createdByName}`);
  parts.push(`Progress Note:\n${input.noteText}`);
  const userMessage = parts.join("\n\n");

  const chatResult = await callAzureOpenAI(systemPrompt, userMessage);
  const parsed = aiEvaluationResponseSchema.parse(JSON.parse(chatResult.content));

  return {
    ...parsed,
    aiResponseRaw: chatResult.content,
    modelUsed: chatResult.model,
    promptTokens: chatResult.promptTokens,
    completionTokens: chatResult.completionTokens,
    latencyMs: chatResult.latencyMs,
    promptSent: userMessage,
    systemPromptSent: systemPrompt,
  };
}

function normalizeResidentName(residentName?: string): string | null {
  const normalized = residentName?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function rememberResidentScenario(residentName: string | undefined, scenarioCode: string) {
  if (scenarioCode === "NOT_APPLICABLE") return;

  const key = normalizeResidentName(residentName);
  if (!key) return;

  const existing = _residentScenarioCache.get(key)?.codes ?? [];
  const updated = [scenarioCode, ...existing.filter((code) => code !== scenarioCode)]
    .slice(0, MAX_RESIDENT_SCENARIO_CODES);

  _residentScenarioCache.set(key, { codes: updated, cachedAt: Date.now() });
}

async function getResidentRecentScenarioCodes(residentName?: string): Promise<string[]> {
  const key = normalizeResidentName(residentName);
  if (!key || !residentName) return [];

  const cached = _residentScenarioCache.get(key);
  if (cached && Date.now() - cached.cachedAt < RESIDENT_SCENARIO_TTL_MS) {
    return cached.codes;
  }

  const pool = await getPool();
  const topN = MAX_RESIDENT_SCENARIO_CODES * RESIDENT_HISTORY_SCAN_MULTIPLIER;
  const result = await pool.request()
    .input("residentName", sql.NVarChar, residentName)
    .query<{ ClassifiedScenarioCode: string | null }>(`
      SELECT TOP (${topN}) ClassifiedScenarioCode
      FROM Evaluations
      WHERE ResidentName = @residentName
        AND ClassifiedScenarioCode IS NOT NULL
        AND ClassifiedScenarioCode <> 'NOT_APPLICABLE'
      ORDER BY EvaluatedAt DESC
    `);

  const uniqueCodes: string[] = [];
  const seen = new Set<string>();
  for (const row of result.recordset) {
    const code = row.ClassifiedScenarioCode;
    if (!code || seen.has(code)) continue;
    uniqueCodes.push(code);
    seen.add(code);
    if (uniqueCodes.length >= MAX_RESIDENT_SCENARIO_CODES) break;
  }

  _residentScenarioCache.set(key, { codes: uniqueCodes, cachedAt: Date.now() });
  return uniqueCodes;
}

function scoreScenarioMatch(scenario: ScenarioWithItems, combinedText: string): number {
  let score = 0;

  const hints = scenario.classificationHints
    ?.split(/[,\n;]+/)
    .map((hint) => hint.trim().toLowerCase())
    .filter(Boolean) ?? [];

  for (const hint of hints) {
    if (combinedText.includes(hint)) {
      score += hint.includes(" ") ? 3 : 1;
    }
  }

  const category = scenario.category.trim().toLowerCase();
  if (category && combinedText.includes(category)) {
    score += 2;
  }

  const name = scenario.name.trim().toLowerCase();
  if (name && combinedText.includes(name)) {
    score += 3;
  }

  return score;
}

function buildScenarioShortlist(
  allScenarios: ScenarioWithItems[],
  residentScenarioCodes: string[],
  input: EvaluationInput
): ScenarioWithItems[] {
  if (allScenarios.length <= MAX_SHORTLIST_SCENARIOS) {
    return allScenarios;
  }

  const selected: ScenarioWithItems[] = [];
  const selectedCodes = new Set<string>();
  const pushScenario = (scenario: ScenarioWithItems | undefined) => {
    if (!scenario || selectedCodes.has(scenario.code)) return;
    selected.push(scenario);
    selectedCodes.add(scenario.code);
  };

  for (const code of residentScenarioCodes) {
    pushScenario(allScenarios.find((scenario) => scenario.code === code));
    if (selected.length >= MAX_SHORTLIST_SCENARIOS) return selected;
  }

  const combinedText = `${input.eventType ?? ""}\n${input.noteText}`.toLowerCase();
  const scored = allScenarios
    .map((scenario) => ({ scenario, score: scoreScenarioMatch(scenario, combinedText) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.scenario.sortOrder - b.scenario.sortOrder);

  for (const row of scored) {
    pushScenario(row.scenario);
    if (selected.length >= MAX_SHORTLIST_SCENARIOS) break;
  }

  return selected.length > 0 ? selected : allScenarios;
}

function shouldRetryWithAllScenarios(
  firstResult: EvaluationResult,
  candidateScenarios: ScenarioWithItems[],
  allScenarios: ScenarioWithItems[],
  input: EvaluationInput
): boolean {
  const forcedScenario = Boolean(input.forcedScenarioCode && input.forcedScenarioCode !== "AUTO");
  if (forcedScenario) return false;
  if (candidateScenarios.length >= allScenarios.length) return false;

  return firstResult.scenarioCode === "NOT_APPLICABLE" || firstResult.confidence < LOW_CONFIDENCE_THRESHOLD;
}

async function evaluateWithScenarioSelection(
  allScenarios: ScenarioWithItems[],
  input: EvaluationInput
): Promise<EvaluationResult> {
  const forcedScenario = Boolean(input.forcedScenarioCode && input.forcedScenarioCode !== "AUTO");
  const residentScenarioCodes = forcedScenario ? [] : await getResidentRecentScenarioCodes(input.residentName);

  const candidateScenarios = forcedScenario
    ? allScenarios
    : buildScenarioShortlist(allScenarios, residentScenarioCodes, input);

  const firstResult = await attemptEvaluation(candidateScenarios, input);

  if (shouldRetryWithAllScenarios(firstResult, candidateScenarios, allScenarios, input)) {
    const fallbackResult = await attemptEvaluation(allScenarios, input);
    rememberResidentScenario(input.residentName, fallbackResult.scenarioCode);
    return fallbackResult;
  }

  rememberResidentScenario(input.residentName, firstResult.scenarioCode);
  return firstResult;
}

export async function evaluateNote(input: EvaluationInput): Promise<EvaluationResult> {
  const allScenarios = await getActiveScenarios();

  try {
    return await evaluateWithScenarioSelection(allScenarios, input);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await evaluateWithScenarioSelection(allScenarios, input);
  }
}
