"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import type { EvaluationWithItems } from "@/types";

interface EvaluationDetailProps {
  evaluationId: string | null;
  onClose: () => void;
}

function statusBadgeVariant(status: string | null) {
  switch (status) {
    case "compliant": return "compliant";
    case "partial": return "partial";
    case "non-compliant": return "non-compliant";
    default: return "not-applicable";
  }
}

function statusLabel(status: string | null) {
  switch (status) {
    case "compliant": return "Compliant";
    case "partial": return "Partial";
    case "non-compliant": return "Non-Compliant";
    default: return "N/A";
  }
}

export function EvaluationDetail({ evaluationId, onClose }: EvaluationDetailProps) {
  const [data, setData] = useState<EvaluationWithItems | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!evaluationId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/evaluations/${evaluationId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [evaluationId]);

  return (
    <Dialog open={!!evaluationId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Evaluation Detail
            {data && (
              <Badge variant={statusBadgeVariant(data.evaluationStatus) as Parameters<typeof Badge>[0]["variant"]}>
                {statusLabel(data.evaluationStatus)}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Resident</p>
                <p className="font-medium">{data.residentName ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Room</p>
                <p className="font-medium">{data.roomNumber ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Date</p>
                <p className="font-medium">{data.noteDate ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Scenario</p>
                <p className="font-medium">{data.classifiedScenarioCode ?? "—"}</p>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 text-sm bg-slate-50 rounded-md p-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">{data.totalItems ?? 0}</p>
                <p className="text-xs text-slate-500">Total items</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{data.documentedItems ?? 0}</p>
                <p className="text-xs text-slate-500">Documented</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{data.missingMandatoryCount ?? 0}</p>
                <p className="text-xs text-slate-500">Missing mandatory</p>
              </div>
            </div>

            {/* Progress note */}
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Progress Note</p>
              <div className="bg-slate-50 rounded-md p-3 text-sm text-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {data.progressNoteText}
              </div>
            </div>

            {/* Checklist items */}
            {data.itemResults && data.itemResults.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Checklist</p>
                <div className="space-y-1">
                  {data.itemResults.map((item) => (
                    <div
                      key={item.id}
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-xs text-slate-500">{item.itemCode}</span>
                            {item.mandatory && (
                              <span className="text-xs text-red-500">*mandatory</span>
                            )}
                          </div>
                          <p className="text-slate-800">{item.itemText}</p>
                          {item.evidence && (
                            <p className="text-xs text-green-700 mt-0.5 italic">
                              Evidence: {item.evidence}
                            </p>
                          )}
                          {item.gap && (
                            <p className="text-xs text-red-600 mt-0.5">Gap: {item.gap}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.gapsSummary && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-xs text-red-600 font-medium uppercase tracking-wide mb-1">Gaps Summary</p>
                <p className="text-sm text-red-700">{data.gapsSummary}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
