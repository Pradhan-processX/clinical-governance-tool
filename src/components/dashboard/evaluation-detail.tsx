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

function formatClinicalRiskCategory(category: string | null, scenarioCode: string | null) {
  if (category && category.trim().length > 0) return category;
  if (!scenarioCode || scenarioCode === "NOT_APPLICABLE") return "—";
  const inferred = scenarioCode.split("_")[0];
  return inferred.charAt(0) + inferred.slice(1).toLowerCase();
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
          <div className="space-y-5">
            {/* Resident meta */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Resident Name</p>
                <p className="font-medium">{data.residentName ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Room No.</p>
                <p className="font-medium">{data.roomNumber ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Note Date</p>
                <p className="font-medium">{data.noteDate ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Written By</p>
                <p className="font-medium">{data.createdByName ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Clinical Risk Category</p>
                <p className="font-medium">{formatClinicalRiskCategory(data.clinicalRiskCategory, data.classifiedScenarioCode)}</p>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 text-sm bg-slate-50 rounded-md p-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">{data.totalItems ?? 0}</p>
                <p className="text-xs text-slate-500">Total Items</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{data.documentedItems ?? 0}</p>
                <p className="text-xs text-slate-500">Documented</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{data.missingMandatoryCount ?? 0}</p>
                <p className="text-xs text-slate-500">Missing Mandatory</p>
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
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Checklist Items</p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="w-8 px-3 py-2"></th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Item</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs w-28">Status</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Evidence / Gap</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.itemResults.map((item) => (
                        <tr
                          key={item.id}
                          className={item.isDocumented ? "bg-green-50" : item.mandatory ? "bg-red-50" : "bg-amber-50"}
                        >
                          <td className="px-3 py-2.5">
                            {item.isDocumented ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : item.mandatory ? (
                              <XCircle className="h-4 w-4 text-red-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-slate-800">{item.itemText}</span>
                            {item.mandatory && (
                              <span className="ml-1.5 text-xs text-red-500">*mandatory</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {item.isDocumented ? (
                              <span className="text-xs font-medium text-green-700">Documented</span>
                            ) : item.mandatory ? (
                              <span className="text-xs font-medium text-red-700">Missing</span>
                            ) : (
                              <span className="text-xs font-medium text-amber-700">Not documented</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            {item.evidence && (
                              <p className="text-green-700 italic">"{item.evidence}"</p>
                            )}
                            {item.gap && (
                              <p className="text-red-600 mt-0.5">{item.gap}</p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
