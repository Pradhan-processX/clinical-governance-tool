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

function formatScenarioCode(code: string | null) {
  if (!code || code === "NOT_APPLICABLE") return "—";
  return code
    .replace(/^FALL_/, "")
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
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
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Input
          placeholder="Search resident name or room..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9 text-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="compliant">Compliant</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="non-compliant">Non-Compliant</SelectItem>
            <SelectItem value="not-applicable">N/A</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scenarioFilter} onValueChange={setScenarioFilter}>
          <SelectTrigger className="w-52 h-9 text-sm">
            <SelectValue placeholder="All fall types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fall Types</SelectItem>
            {scenarios.map((s) => (
              <SelectItem key={s} value={s}>{formatScenarioCode(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500 self-center ml-auto">
          {filtered.length} of {evaluations.length} records
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Room No.</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Resident Name</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Note Date</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Time</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Event Type</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Written By</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Fall Type</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Compliance</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Missing Items</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-slate-400 text-sm">
                  No evaluations found
                </td>
              </tr>
            ) : (
              filtered.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-slate-600">{ev.roomNumber ?? "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">{ev.residentName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{ev.noteDate ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{ev.noteTime ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{ev.eventType ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{ev.createdByName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-700 text-xs">{formatScenarioCode(ev.classifiedScenarioCode)}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={statusVariant(ev.evaluationStatus) as Parameters<typeof Badge>[0]["variant"]}>
                      {statusLabel(ev.evaluationStatus)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {ev.missingMandatoryCount !== null && ev.missingMandatoryCount > 0 ? (
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                        {ev.missingMandatoryCount}
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                        0
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
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
