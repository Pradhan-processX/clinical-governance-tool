import type { ScenarioWithItems } from "@/types";

const CLASSIFICATION_RULES = `

CLASSIFICATION RULES:
1. Read the ENTIRE note first before classifying
2. Match the note to ONE scenario based on classification hints
3. If the note does not match ANY scenario (e.g. medication note, specialist note, routine care), return scenarioCode: "NOT_APPLICABLE"
4. Confidence must be 0.0-1.0 reflecting how certain you are about the classification
`;

const EVALUATION_RULES = `

EVALUATION RULES:
1. Be GENEROUS in interpretation - "nil pain" counts as pain assessment done
2. Partial information counts - "staff found resident" counts as who found, even without specific name
3. Read the ENTIRE note before evaluating ANY item
4. For each item: extract the EXACT quote from the note that serves as evidence
5. If not documented, write a specific gap description of what's missing

STATUS THRESHOLDS:
- "compliant": 0 missing mandatory items
- "partial": 1-3 missing mandatory items
- "non-compliant": 4+ missing mandatory items
- "not-applicable": note doesn't match any clinical scenario
`;

const JSON_OUTPUT_FORMAT = `

RESPOND WITH ONLY THIS JSON - no markdown, no explanation:
{
  "scenarioCode": "FALL_UNWITNESSED",
  "scenarioName": "Unwitnessed Fall",
  "confidence": 0.95,
  "evaluationStatus": "partial",
  "totalItems": 12,
  "documentedItems": 8,
  "missingMandatoryCount": 3,
  "gapsSummary": "Missing: vitals, GP notification, neuro obs",
  "items": [
    {
      "itemCode": "UWF_01_INCIDENT_REPORT",
      "itemText": "Incident report completed",
      "mandatory": true,
      "isDocumented": false,
      "evidence": "",
      "gap": "No mention of incident report or RiskMan in the note"
    }
  ]
}`;

export function buildSystemPrompt(scenarios: ScenarioWithItems[]): string {
  let prompt = `You are a clinical governance evaluator for Australian aged care progress notes.

TASK: Read the progress note. Classify it into ONE scenario. Evaluate against that scenario's checklist.

AVAILABLE SCENARIOS:\n`;

  for (const s of scenarios) {
    prompt += `\n## ${s.name} (code: ${s.code})`;
    prompt += `\nCategory: ${s.category}`;
    if (s.classificationHints) {
      prompt += `\nClassify as this when: ${s.classificationHints}`;
    }
    prompt += `\nChecklist items:\n`;
    for (const item of s.checklistItems) {
      prompt += `- ${item.itemCode}: ${item.itemText} [mandatory: ${item.mandatory}]\n`;
    }
  }

  prompt += CLASSIFICATION_RULES;
  prompt += EVALUATION_RULES;
  prompt += JSON_OUTPUT_FORMAT;

  return prompt;
}

export function buildSingleNotePrompt(
  scenarios: ScenarioWithItems[],
  forcedScenarioCode?: string
): string {
  if (forcedScenarioCode && forcedScenarioCode !== "AUTO") {
    const scenario = scenarios.find((s) => s.code === forcedScenarioCode);
    if (scenario) {
      let prompt = `You are a clinical governance evaluator for Australian aged care progress notes.

TASK: Evaluate the progress note against the specified scenario checklist.

SCENARIO: ${scenario.name} (code: ${scenario.code})
Category: ${scenario.category}
Checklist items:\n`;
      for (const item of scenario.checklistItems) {
        prompt += `- ${item.itemCode}: ${item.itemText} [mandatory: ${item.mandatory}]\n`;
      }
      prompt += `\nClassify with scenarioCode: "${scenario.code}" and scenarioName: "${scenario.name}"`;
      prompt += EVALUATION_RULES;
      prompt += JSON_OUTPUT_FORMAT;
      return prompt;
    }
  }

  return buildSystemPrompt(scenarios);
}
