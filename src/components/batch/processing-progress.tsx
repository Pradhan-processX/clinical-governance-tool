"use client";

import { useEffect, useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

interface BatchStatus {
  id: string;
  totalNotes: number;
  processedNotes: number;
  failedNotes: number;
  skippedNotes: number;
  status: string;
  liveCounts: {
    compliant: number;
    partial: number;
    nonCompliant: number;
    notApplicable: number;
  };
}

interface ProcessingProgressProps {
  batchId: string;
  totalNotes: number;
}

export function ProcessingProgress({ batchId, totalNotes }: ProcessingProgressProps) {
  const [status, setStatus] = useState<BatchStatus | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/batch/${batchId}/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        return data.status;
      }
    } catch {
      // ignore
    }
    return null;
  }, [batchId]);

  useEffect(() => {
    poll();
    const interval = setInterval(async () => {
      const s = await poll();
      if (s === "completed" || s === "failed") {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [poll]);

  const processed = status?.processedNotes ?? 0;
  const pct = totalNotes > 0 ? Math.round((processed / totalNotes) * 100) : 0;
  const done = status?.status === "completed" || status?.status === "failed";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        )}
        <span className="text-sm font-medium">
          {done
            ? "Processing complete"
            : `Processing note ${processed} of ${totalNotes}...`}
        </span>
      </div>

      <Progress value={pct} className="h-2" />

      {status && (
        <div className="grid grid-cols-4 gap-3 text-sm">
          <div className="text-center">
            <p className="text-lg font-bold text-green-600">{status.liveCounts.compliant}</p>
            <p className="text-xs text-slate-500">Compliant</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-600">{status.liveCounts.partial}</p>
            <p className="text-xs text-slate-500">Partial</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-600">{status.liveCounts.nonCompliant}</p>
            <p className="text-xs text-slate-500">Non-Compliant</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-400">{status.liveCounts.notApplicable}</p>
            <p className="text-xs text-slate-500">N/A</p>
          </div>
        </div>
      )}

      {done && (
        <div className="flex gap-2 pt-2">
          <Link href={`/?batchId=${batchId}`}>
            <Button size="sm">View Results</Button>
          </Link>
          <a href={`/api/batch/${batchId}/download`}>
            <Button size="sm" variant="outline">Download Enriched Excel</Button>
          </a>
        </div>
      )}
    </div>
  );
}
