"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, ChevronLeft, ChevronRight, Copy, FileJson, RefreshCw } from "lucide-react";
import type { EvaluationWithItems } from "@/types";

interface TraceListItem {
  id: string;
  residentName: string | null;
  eventType: string | null;
  noteDate: string | null;
  createdByName: string | null;
  classifiedScenarioCode: string | null;
  evaluationStatus: "compliant" | "partial" | "non-compliant" | "not-applicable" | null;
  modelUsed: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number | null;
  evaluatedAt: string;
}

interface TraceListResponse {
  evaluations: TraceListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalTokens: number;
}

const PAGE_SIZE = 25;
const GPT_41_INPUT_COST_PER_TOKEN_USD = 2 / 1_000_000;
const GPT_41_OUTPUT_COST_PER_TOKEN_USD = 8 / 1_000_000;

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
    default: return "N/A";
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatText(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "N/A";
}

function calculateTraceCostUSD(promptTokens: number | null | undefined, completionTokens: number | null | undefined): number {
  const prompt = promptTokens ?? 0;
  const completion = completionTokens ?? 0;
  return (prompt * GPT_41_INPUT_COST_PER_TOKEN_USD) + (completion * GPT_41_OUTPUT_COST_PER_TOKEN_USD);
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(6)}`;
}

export function AiTraceContent() {
  const [data, setData] = useState<TraceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trace, setTrace] = useState<EvaluationWithItems | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchList = useCallback((params: {
    page: number;
    search: string;
    status: string;
    dateFrom: string;
    dateTo: string;
  }) => {
    setLoading(true);
    const q = new URLSearchParams({
      page: String(params.page),
      pageSize: String(PAGE_SIZE),
    });
    if (params.search) q.set("search", params.search);
    if (params.status !== "all") q.set("status", params.status);
    if (params.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params.dateTo) q.set("dateTo", params.dateTo);

    fetch(`/api/evaluations?${q}`)
      .then((r) => r.json())
      .then((d: TraceListResponse) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchList({ page, search, status, dateFrom, dateTo });
  }, [page, search, status, dateFrom, dateTo, fetchList]);

  useEffect(() => {
    if (!selectedId) {
      setTrace(null);
      setTraceError(null);
      return;
    }

    setTraceLoading(true);
    setTraceError(null);
    fetch(`/api/evaluations/${selectedId}`)
      .then(async (r) => {
        const payload = await r.json();
        if (!r.ok) {
          throw new Error(payload?.error ?? "Failed to load AI trace");
        }
        setTrace(payload as EvaluationWithItems);
      })
      .catch((err) => {
        setTrace(null);
        setTraceError(err instanceof Error ? err.message : "Failed to load AI trace");
      })
      .finally(() => setTraceLoading(false));
  }, [selectedId]);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  function clearFilters() {
    setSearch("");
    setSearchInput("");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  async function copyToClipboard(value: string, field: "system" | "request" | "response" | "parsed") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1200);
    } catch {
      setCopiedField(null);
    }
  }

  const evaluations = data?.evaluations ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = Boolean(search || status !== "all" || dateFrom || dateTo);

  const parsedAiResponse = useMemo(() => {
    if (!trace?.aiResponseRaw) return null;
    try {
      return JSON.stringify(JSON.parse(trace.aiResponseRaw), null, 2);
    } catch {
      return null;
    }
  }, [trace?.aiResponseRaw]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">AI Trace</h1>
          <p className="text-sm text-slate-500">Request task, response task, and full AI return payloads.</p>
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={() => fetchList({ page, search, status, dateFrom, dateTo })}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <form onSubmit={submitSearch} className="flex gap-1">
          <Input
            placeholder="Search resident, room, author..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-xs h-9 text-sm"
          />
          <Button type="submit" size="sm" variant="outline" className="h-9">Search</Button>
        </form>
        <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
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
          <Input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} className="h-9 text-sm w-36" />
          <span className="text-xs text-slate-500">To</span>
          <Input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} className="h-9 text-sm w-36" />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-xs text-slate-500" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Evaluated</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Resident</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Event</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Scenario</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Model</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Tokens</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Latency</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">Loading...</td></tr>
            ) : evaluations.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">No traces found</td></tr>
            ) : evaluations.map((ev) => (
              <tr key={ev.id} className={selectedId === ev.id ? "bg-blue-50/50" : "hover:bg-slate-50 transition-colors"}>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{formatDateTime(ev.evaluatedAt)}</td>
                <td className="px-3 py-2.5 text-slate-800 text-xs font-medium">{formatText(ev.residentName)}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{formatText(ev.eventType)}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{formatText(ev.classifiedScenarioCode)}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={statusVariant(ev.evaluationStatus) as Parameters<typeof Badge>[0]["variant"]}>
                    {statusLabel(ev.evaluationStatus)}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{formatText(ev.modelUsed)}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{(ev.promptTokens ?? 0) + (ev.completionTokens ?? 0)}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{ev.latencyMs ?? 0} ms</td>
                <td className="px-3 py-2.5">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => setSelectedId(ev.id)}>
                    View Trace
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Page {page} of {totalPages} - {total.toLocaleString()} records</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white">
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold text-slate-800">Trace Detail</h2>
          </div>
          {!selectedId && <p className="text-sm text-slate-500 mt-1">Select a row above to inspect AI trace data.</p>}
        </div>

        <div className="p-4 space-y-4">
          {traceLoading && (
            <p className="text-sm text-slate-500">Loading trace detail...</p>
          )}

          {!traceLoading && traceError && (
            <p className="text-sm text-red-600">{traceError}</p>
          )}

          {!traceLoading && !traceError && trace && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Model</p>
                  <p className="text-sm font-medium text-slate-800">{formatText(trace.modelUsed)}</p>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Prompt Tokens</p>
                  <p className="text-sm font-medium text-slate-800">{trace.promptTokens ?? 0}</p>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Completion Tokens</p>
                  <p className="text-sm font-medium text-slate-800">{trace.completionTokens ?? 0}</p>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Latency</p>
                  <p className="text-sm font-medium text-slate-800">{trace.latencyMs ?? 0} ms</p>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Total Tokens</p>
                  <p className="text-sm font-medium text-slate-800">{(trace.promptTokens ?? 0) + (trace.completionTokens ?? 0)}</p>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Cost (USD)</p>
                  <p className="text-sm font-medium text-slate-800">
                    {formatUsd(calculateTraceCostUSD(trace.promptTokens, trace.completionTokens))}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Cost formula: ({trace.promptTokens ?? 0} x $0.000002) + ({trace.completionTokens ?? 0} x $0.000008)
                {" "}={formatUsd(calculateTraceCostUSD(trace.promptTokens, trace.completionTokens))}
              </p>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">System Prompt (Passed To AI)</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => copyToClipboard(trace.systemPromptSent ?? "", "system")}
                    disabled={!trace.systemPromptSent}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {copiedField === "system" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap break-words max-h-80 overflow-auto">
                  {trace.systemPromptSent ?? "N/A"}
                </pre>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">User Message (Request Task)</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => copyToClipboard(trace.promptSent ?? "", "request")}
                    disabled={!trace.promptSent}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {copiedField === "request" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap break-words max-h-80 overflow-auto">
                  {trace.promptSent ?? "N/A"}
                </pre>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Response Task (Raw AI Response)</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => copyToClipboard(trace.aiResponseRaw ?? "", "response")}
                    disabled={!trace.aiResponseRaw}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {copiedField === "response" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap break-words max-h-80 overflow-auto">
                  {trace.aiResponseRaw ?? "N/A"}
                </pre>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileJson className="h-4 w-4 text-slate-500" />
                    Parsed AI JSON
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => copyToClipboard(parsedAiResponse ?? "", "parsed")}
                    disabled={!parsedAiResponse}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {copiedField === "parsed" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap break-words max-h-80 overflow-auto">
                  {parsedAiResponse ?? "AI response is not valid JSON."}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
