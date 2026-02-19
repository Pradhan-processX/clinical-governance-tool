"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { ScenarioWithItems, AiEvaluationResponse, AiItemResult } from "@/types";

interface EvaluateFormProps {
  scenarios: ScenarioWithItems[];
}

function statusVariant(status: string) {
  switch (status) {
    case "compliant": return "compliant";
    case "partial": return "partial";
    case "non-compliant": return "non-compliant";
    default: return "not-applicable";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "compliant": return "Compliant";
    case "partial": return "Partial";
    case "non-compliant": return "Non-Compliant";
    default: return "N/A";
  }
}

export function EvaluateForm({ scenarios }: EvaluateFormProps) {
  const [noteText, setNoteText] = useState("");
  const [residentName, setResidentName] = useState("");
  const [scenarioCode, setScenarioCode] = useState("AUTO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiEvaluationResponse | null>(null);

  const handleEvaluate = async () => {
    if (!noteText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteText,
          residentName: residentName.trim() || undefined,
          forcedScenarioCode: scenarioCode === "AUTO" ? undefined : scenarioCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Evaluation failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1 block">
          Resident Name (optional)
        </label>
        <Input
          placeholder="e.g. Smith, John"
          value={residentName}
          onChange={(e) => setResidentName(e.target.value)}
          className="h-9 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1 block">
          Progress Note
        </label>
        <Textarea
          placeholder="Paste the progress note here..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="min-h-[200px] text-sm font-mono"
        />
      </div>

      <div className="flex gap-3 items-end">
        <div className="w-64">
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            Scenario (optional)
          </label>
          <Select value={scenarioCode} onValueChange={setScenarioCode}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AUTO">Auto-detect</SelectItem>
              {scenarios.map((s) => (
                <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleEvaluate}
          disabled={loading || !noteText.trim()}
          className="h-9"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Evaluating...</>
          ) : (
            "Evaluate"
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 mt-4">
          {/* Header */}
          <div className="flex items-center gap-3 pb-3 border-b">
            <Badge variant={statusVariant(result.evaluationStatus) as Parameters<typeof Badge>[0]["variant"]} className="text-sm px-3 py-1">
              {statusLabel(result.evaluationStatus)}
            </Badge>
            <div>
              <p className="font-medium text-slate-800">{result.scenarioName}</p>
              <p className="text-xs text-slate-500">
                Confidence: {Math.round(result.confidence * 100)}% &middot;{" "}
                {result.documentedItems}/{result.totalItems} items documented &middot;{" "}
                {result.missingMandatoryCount} missing mandatory
              </p>
            </div>
          </div>

          {result.gapsSummary && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <span className="font-medium">Gaps: </span>{result.gapsSummary}
            </div>
          )}

          {/* Checklist */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Checklist</p>
            {result.items.map((item: AiItemResult) => (
              <div
                key={item.itemCode}
                className={`rounded-md border p-2.5 text-sm ${
                  item.isDocumented
                    ? "border-green-200 bg-green-50"
                    : item.mandatory
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-start gap-2">
                  {item.isDocumented ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  ) : item.mandatory ? (
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">{item.itemCode}</span>
                      {item.mandatory && <span className="text-xs text-red-500">*</span>}
                    </div>
                    <p className="text-slate-800">{item.itemText}</p>
                    {item.evidence && (
                      <p className="text-xs text-green-700 mt-0.5 italic">"{item.evidence}"</p>
                    )}
                    {item.gap && (
                      <p className="text-xs text-red-600 mt-0.5">{item.gap}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
