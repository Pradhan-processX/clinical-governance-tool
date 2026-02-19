"use client";

import { useState, useEffect, useCallback } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { ResultsTable } from "@/components/dashboard/results-table";
import { BatchSelector } from "@/components/dashboard/batch-selector";
import type { Evaluation, EvaluationSummary, BatchJob } from "@/types";

const emptySummary: EvaluationSummary = {
  total: 0, compliant: 0, partial: 0, nonCompliant: 0, notApplicable: 0,
  compliantPct: 0, partialPct: 0, nonCompliantPct: 0,
};

export function DashboardContent() {
  const [batches, setBatches] = useState<BatchJob[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [summary, setSummary] = useState<EvaluationSummary>(emptySummary);
  const [loading, setLoading] = useState(true);

  // Initial load — single request returns batches + most recent batch data
  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.batches)) setBatches(data.batches);
        if (data.activeBatchId) setSelectedBatchId(data.activeBatchId);
        if (Array.isArray(data.evaluations)) setEvaluations(data.evaluations);
        if (data.summary && typeof data.summary.total === "number") setSummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // When user picks a different batch, fetch only that batch's data
  const handleBatchSelect = useCallback((batchId: string) => {
    setSelectedBatchId(batchId);
    setLoading(true);
    fetch(`/api/dashboard?batchId=${batchId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.evaluations)) setEvaluations(data.evaluations);
        if (data.summary && typeof data.summary.total === "number") setSummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading && batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <p className="text-sm">Loading dashboard...</p>
      </div>
    );
  }

  if (batches.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <p className="text-lg font-medium text-slate-500 mb-2">No batches yet</p>
        <p className="text-sm">
          Upload an Excel file via{" "}
          <a href="/batch" className="text-blue-500 hover:underline">
            Batch Upload
          </a>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
        <BatchSelector
          batches={batches}
          selectedBatchId={selectedBatchId}
          onSelect={handleBatchSelect}
        />
      </div>

      <SummaryCards summary={summary} />

      <div>
        <h2 className="text-sm font-medium text-slate-600 mb-3">Evaluation Results</h2>
        <ResultsTable evaluations={evaluations} />
      </div>
    </div>
  );
}
