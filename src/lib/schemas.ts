import { z } from "zod";

export const aiItemResultSchema = z.object({
  itemCode: z.string(),
  itemText: z.string(),
  mandatory: z.boolean(),
  isDocumented: z.boolean(),
  evidence: z.string().default(""),
  gap: z.string().default(""),
});

export const aiEvaluationResponseSchema = z.object({
  scenarioCode: z.string(),
  scenarioName: z.string(),
  confidence: z.number().min(0).max(1),
  evaluationStatus: z.enum(["compliant", "partial", "non-compliant", "not-applicable"]),
  totalItems: z.number().int().min(0),
  documentedItems: z.number().int().min(0),
  missingMandatoryCount: z.number().int().min(0),
  gapsSummary: z.string(),
  items: z.array(aiItemResultSchema),
});

export type AiEvaluationResponse = z.infer<typeof aiEvaluationResponseSchema>;
export type AiItemResult = z.infer<typeof aiItemResultSchema>;

// Request validation schemas
export const createScenarioSchema = z.object({
  id: z.string().min(1).max(50),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  description: z.string().optional(),
  classificationHints: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateScenarioSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  classificationHints: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const createChecklistItemSchema = z.object({
  id: z.string().min(1).max(50),
  itemCode: z.string().min(1).max(50),
  itemText: z.string().min(1).max(500),
  mandatory: z.boolean().default(true),
  sortOrder: z.number().int(),
  keywords: z.string().optional(),
});

export const updateChecklistItemSchema = z.object({
  itemText: z.string().min(1).max(500).optional(),
  mandatory: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  keywords: z.string().optional(),
});

export const singleEvaluateSchema = z.object({
  noteText: z.string().min(10),
  eventType: z.string().optional(),
  forcedScenarioCode: z.string().optional(),
});
