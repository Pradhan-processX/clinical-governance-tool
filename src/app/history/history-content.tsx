"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EvaluationDetail } from "@/components/dashboard/evaluation-detail";
import { ChevronLeft, ChevronRight, Download, FileText, TrendingDown } from "lucide-react";
import type { Evaluation } from "@/types";

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

function formatClinicalRiskCategory(category: string | null, scenarioCode: string | null) {
  if (category && category.trim().length > 0) return category;
  if (!scenarioCode || scenarioCode === "NOT_APPLICABLE") return "—";
  const inferred = scenarioCode.split("_")[0];
  return inferred.charAt(0) + inferred.slice(1).toLowerCase();
}

interface HistoryResponse {
  evaluations: Evaluation[];
  total: number;
  page: number;
  pageSize: number;
  totalTokens: number;
}

const PAGE_SIZE = 50;

export function HistoryContent() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchData = useCallback((params: {
    page: number; search: string; status: string;
    dateFrom: string; dateTo: string;
  }) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) });
    if (params.search) q.set("search", params.search);
    if (params.status !== "all") q.set("status", params.status);
    if (params.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params.dateTo) q.set("dateTo", params.dateTo);

    fetch(`/api/evaluations?${q}`)
      .then((r) => r.json())
      .then((d: HistoryResponse) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData({ page, search, status, dateFrom, dateTo });
  }, [page, search, status, dateFrom, dateTo, fetchData]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  function handleFilterChange(key: string, value: string) {
    setPage(1);
    if (key === "status") setStatus(value);
    if (key === "dateFrom") setDateFrom(value);
    if (key === "dateTo") setDateTo(value);
  }

  const evaluations = data?.evaluations ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const nonCompliantCount = evaluations.filter((e) => e.evaluationStatus === "non-compliant").length;
  const exportQuery = new URLSearchParams();
  if (search) exportQuery.set("search", search);
  if (status !== "all") exportQuery.set("status", status);
  if (dateFrom) exportQuery.set("dateFrom", dateFrom);
  if (dateTo) exportQuery.set("dateTo", dateTo);
  const exportUrl = `/api/evaluations/export${exportQuery.toString() ? `?${exportQuery.toString()}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Evaluation History</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9">
            <a href={exportUrl}>
              <Download className="h-4 w-4 mr-1.5" />
              Download Excel
            </a>
          </Button>
          <span className="text-sm text-slate-500">{total.toLocaleString()} records</span>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Notes</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{total.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Non-Compliant</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{nonCompliantCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">on this page</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <form onSubmit={handleSearchSubmit} className="flex gap-1">
          <Input
            placeholder="Search resident, room, author..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-xs h-9 text-sm"
          />
          <Button type="submit" size="sm" variant="outline" className="h-9">Search</Button>
        </form>
        <Select value={status} onValueChange={(v) => handleFilterChange("status", v)}>
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
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">From</span>
          <Input type="date" value={dateFrom} onChange={(e) => handleFilterChange("dateFrom", e.target.value)} className="h-9 text-sm w-36" />
          <span className="text-xs text-slate-500">To</span>
          <Input type="date" value={dateTo} onChange={(e) => handleFilterChange("dateTo", e.target.value)} className="h-9 text-sm w-36" />
        </div>
        {(search || status !== "all" || dateFrom || dateTo) && (
          <Button
            variant="ghost" size="sm" className="h-9 text-xs text-slate-500"
            onClick={() => { setSearch(""); setSearchInput(""); setStatus("all"); setDateFrom(""); setDateTo(""); setPage(1); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Room No.</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Resident Name</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Note Date</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Written By</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Event Type</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Clinical Risk Category</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Compliance</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Missing Items</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">Loading...</td></tr>
            ) : evaluations.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">No evaluations found</td></tr>
            ) : evaluations.map((ev) => (
              <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2.5 text-slate-600 text-xs">{ev.roomNumber ?? "—"}</td>
                <td className="px-3 py-2.5 font-medium text-slate-800 text-xs">{ev.residentName ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{ev.noteDate ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-500 text-xs">{ev.createdByName ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-500 text-xs">{ev.eventType ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-700 text-xs">
                  {formatClinicalRiskCategory(ev.clinicalRiskCategory, ev.classifiedScenarioCode)}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={statusVariant(ev.evaluationStatus) as Parameters<typeof Badge>[0]["variant"]}>
                    {statusLabel(ev.evaluationStatus)}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-center">
                  {ev.missingMandatoryCount !== null && ev.missingMandatoryCount > 0 ? (
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                      {ev.missingMandatoryCount}
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-100 text-green-700 text-xs font-bold">0</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => setSelectedId(ev.id)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Page {page} of {totalPages} · {total.toLocaleString()} records</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="h-8 w-8 text-xs" onClick={() => setPage(p)}>
                  {p}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <EvaluationDetail evaluationId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
