"use client";

import { useState, useEffect, useCallback } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { ResultsTable } from "@/components/dashboard/results-table";
import { BatchSelector } from "@/components/dashboard/batch-selector";
import type { Evaluation, EvaluationSummary, BatchJob } from "@/types";

export function DashboardContent() {
  const [batches, setBatches] = useState<BatchJob[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [summary, setSummary] = useState<EvaluationSummary>({
    total: 0,
    compliant: 0,
    partial: 0,
    nonCompliant: 0,
    notApplicable: 0,
    compliantPct: 0,
    partialPct: 0,
    nonCompliantPct: 0,
  });
  const [loading, setLoading] = useState(true);

  // Load batches
  useEffect(() => {
    fetch("/api/batch/list")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBatches(data);
          if (data.length > 0) setSelectedBatchId(data[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadData = useCallback(async (batchId: string) => {
    if (!batchId) return;
    setLoading(true);
    const [evRes, sumRes] = await Promise.all([
      fetch(`/api/evaluations?batchId=${batchId}`),
      fetch(`/api/evaluations/summary?batchId=${batchId}`),
    ]);
    const [evData, sumData] = await Promise.all([evRes.json(), sumRes.json()]);
    if (Array.isArray(evData)) setEvaluations(evData);
    if (sumData && typeof sumData.total === "number") setSummary(sumData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedBatchId) loadData(selectedBatchId);
  }, [selectedBatchId, loadData]);

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
          onSelect={setSelectedBatchId}
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
