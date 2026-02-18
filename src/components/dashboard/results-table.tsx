"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EvaluationDetail } from "./evaluation-detail";
import type { Evaluation } from "@/types";

interface ResultsTableProps {
  evaluations: Evaluation[];
}

function statusVariant(status: string | null) {
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
    case "not-applicable": return "N/A";
    default: return "—";
  }
}

export function ResultsTable({ evaluations }: ResultsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scenarioFilter, setScenarioFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const scenarios = Array.from(
    new Set(evaluations.map((e) => e.classifiedScenarioCode).filter(Boolean))
  ) as string[];

  const filtered = evaluations.filter((e) => {
    if (statusFilter !== "all" && e.evaluationStatus !== statusFilter) return false;
    if (scenarioFilter !== "all" && e.classifiedScenarioCode !== scenarioFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !e.residentName?.toLowerCase().includes(q) &&
        !e.roomNumber?.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        <Input
          placeholder="Search resident or room..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9 text-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="compliant">Compliant</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="non-compliant">Non-Compliant</SelectItem>
            <SelectItem value="not-applicable">N/A</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scenarioFilter} onValueChange={setScenarioFilter}>
          <SelectTrigger className="w-52 h-9 text-sm">
            <SelectValue placeholder="All scenarios" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scenarios</SelectItem>
            {scenarios.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500 self-center ml-auto">
          {filtered.length} of {evaluations.length} notes
        </span>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Room</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Resident</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Date</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Time</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Event Type</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Scenario</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Status</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Missing</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400 text-sm">
                  No evaluations found
                </td>
              </tr>
            ) : (
              filtered.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2">{ev.roomNumber ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{ev.residentName ?? "—"}</td>
                  <td className="px-3 py-2">{ev.noteDate ?? "—"}</td>
                  <td className="px-3 py-2">{ev.noteTime ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{ev.eventType ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{ev.classifiedScenarioCode ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(ev.evaluationStatus) as Parameters<typeof Badge>[0]["variant"]}>
                      {statusLabel(ev.evaluationStatus)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {ev.missingMandatoryCount !== null && ev.missingMandatoryCount > 0 ? (
                      <span className="text-red-600 font-medium">{ev.missingMandatoryCount}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedId(ev.id)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EvaluationDetail
        evaluationId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
