// Scenario & Checklist types
export interface Scenario {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  classificationHints: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  scenarioId: string;
  itemCode: string;
  itemText: string;
  mandatory: boolean;
  sortOrder: number;
  keywords: string | null;
  createdAt: string;
}

export interface ScenarioWithItems extends Scenario {
  checklistItems: ChecklistItem[];
}

// Batch Job types
export interface BatchJob {
  id: string;
  fileName: string;
  batchDate: string;
  totalNotes: number;
  processedNotes: number;
  failedNotes: number;
  skippedNotes: number;
  status: "pending" | "processing" | "completed" | "failed";
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// Evaluation types
export interface Evaluation {
  id: string;
  batchId: string | null;
  batchDate: string;
  roomNumber: string | null;
  residentName: string | null;
  noteDate: string | null;
  noteTime: string | null;
  eventType: string | null;
  createdByName: string | null;
  clinicalRiskCategory: string | null;
  progressNoteText: string;
  sourceRowIndex: number | null;
  classifiedScenarioCode: string | null;
  confidence: number | null;
  evaluationStatus: "compliant" | "partial" | "non-compliant" | "not-applicable" | null;
  totalItems: number | null;
  documentedItems: number | null;
  missingMandatoryCount: number | null;
  gapsSummary: string | null;
  aiResponseRaw: string | null;
  modelUsed: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number | null;
  evaluatedAt: string;
}

export interface ItemResult {
  id: string;
  evaluationId: string;
  itemCode: string;
  itemText: string;
  mandatory: boolean;
  isDocumented: boolean;
  evidence: string;
  gap: string;
}

export interface EvaluationWithItems extends Evaluation {
  promptSent: string | null;
  systemPromptSent: string | null;
  itemResults: ItemResult[];
}

// AI Response types
export interface AiItemResult {
  itemCode: string;
  itemText: string;
  mandatory: boolean;
  isDocumented: boolean;
  evidence: string;
  gap: string;
}

export interface AiEvaluationResponse {
  scenarioCode: string;
  scenarioName: string;
  confidence: number;
  evaluationStatus: "compliant" | "partial" | "non-compliant" | "not-applicable";
  totalItems: number;
  documentedItems: number;
  missingMandatoryCount: number;
  gapsSummary: string;
  items: AiItemResult[];
}

// Excel parsing types
export interface ExcelRow {
  room: string | null;
  residentName: string | null;
  date: string | null;
  time: string | null;
  eventType: string | null;
  createdByName: string | null;
  notes: string;
  rawRowIndex: number;
}

export interface ColumnMapping {
  room: number | null;
  residentName: number | null;
  date: number | null;
  time: number | null;
  eventType: number | null;
  createdByName: number | null;
  notes: number | null;
}

export interface ParsedExcel {
  rows: ExcelRow[];
  mapping: ColumnMapping;
  headers: string[];
  warnings: string[];
}

// Summary stats
export interface EvaluationSummary {
  total: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
  notApplicable: number;
  compliantPct: number;
  partialPct: number;
  nonCompliantPct: number;
}

// API filter types
export interface EvaluationFilters {
  batchId?: string;
  batchDate?: string;
  status?: string;
  scenario?: string;
  search?: string;
}
