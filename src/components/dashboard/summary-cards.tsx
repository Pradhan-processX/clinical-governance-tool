import { Card, CardContent } from "@/components/ui/card";
import type { EvaluationSummary } from "@/types";

interface SummaryCardsProps {
  summary: EvaluationSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{summary.total}</p>
          <p className="text-xs text-slate-400 mt-0.5">notes evaluated</p>
        </CardContent>
      </Card>

      <Card className="border-green-200">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-green-600 uppercase tracking-wide font-medium">Compliant</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{summary.compliant}</p>
          <p className="text-xs text-green-500 mt-0.5">{summary.compliantPct}% of total</p>
        </CardContent>
      </Card>

      <Card className="border-amber-200">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-amber-600 uppercase tracking-wide font-medium">Partial</p>
          <p className="text-3xl font-bold text-amber-700 mt-1">{summary.partial}</p>
          <p className="text-xs text-amber-500 mt-0.5">{summary.partialPct}% of total</p>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-red-600 uppercase tracking-wide font-medium">Non-Compliant</p>
          <p className="text-3xl font-bold text-red-700 mt-1">{summary.nonCompliant}</p>
          <p className="text-xs text-red-500 mt-0.5">{summary.nonCompliantPct}% of total</p>
        </CardContent>
      </Card>
    </div>
  );
}
