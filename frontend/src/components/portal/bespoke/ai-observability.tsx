"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, Spinner, inputClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

// Schema
const LogSchema = z.object({
  id: z.string(),
  tenant: z.string(),
  college: z.string().optional().default(""),
  agent: z.string(),
  model: z.string(),
  promptVersion: z.string().optional().default("v1"),
  sources: z.number().optional().default(0),
  inputTokens: z.number(),
  outputTokens: z.number(),
  latencyMs: z.number(),
  costUsd: z.number(),
  status: z.enum(["success", "error", "timeout"]),
  timestamp: z.string(),
  endpoint: z.string().optional().default(""),
});
type LogEntry = z.infer<typeof LogSchema>;

const ResponseSchema = z.union([
  z.object({ logs: z.array(LogSchema) }).transform((v) => v.logs),
  z.object({ data: z.array(LogSchema) }).transform((v) => v.data),
  z.array(LogSchema),
  z.unknown().transform(() => [] as LogEntry[]),
]);

// Demo data
const DEMO: LogEntry[] = [
  { id: "log-001", tenant: "PSG College of Arts", college: "PSG Arts", agent: "mentor", model: "gemini-1.5-pro", promptVersion: "v3", sources: 4, inputTokens: 812, outputTokens: 340, latencyMs: 1240, costUsd: 0.0018, status: "success", timestamp: "2026-10-29T07:12:04Z", endpoint: "/api/ai/mentor/chat" },
  { id: "log-002", tenant: "Coimbatore Institute", college: "CIT", agent: "study-planner", model: "gemini-1.5-flash", promptVersion: "v2", sources: 2, inputTokens: 530, outputTokens: 610, latencyMs: 890, costUsd: 0.0009, status: "success", timestamp: "2026-10-29T07:08:51Z", endpoint: "/api/ai/study-planner" },
  { id: "log-003", tenant: "RVS College", college: "RVS", agent: "document", model: "claude-sonnet-4-6", promptVersion: "v1", sources: 1, inputTokens: 2100, outputTokens: 980, latencyMs: 2340, costUsd: 0.0047, status: "success", timestamp: "2026-10-29T07:05:22Z", endpoint: "/api/ai/document/extract" },
  { id: "log-004", tenant: "Amrita Vishwa", college: "Amrita", agent: "viva", model: "gemini-1.5-pro", promptVersion: "v2", sources: 0, inputTokens: 660, outputTokens: 420, latencyMs: 3800, costUsd: 0.0022, status: "timeout", timestamp: "2026-10-29T07:01:09Z", endpoint: "/api/ai/viva/session" },
  { id: "log-005", tenant: "Bannari Amman", college: "BIST", agent: "faculty-copilot", model: "gemini-1.5-flash", promptVersion: "v4", sources: 3, inputTokens: 1450, outputTokens: 760, latencyMs: 1560, costUsd: 0.0014, status: "success", timestamp: "2026-10-29T06:58:17Z", endpoint: "/api/ai/copilot/lesson" },
  { id: "log-006", tenant: "SNS College", college: "SNS", agent: "exam", model: "claude-sonnet-4-6", promptVersion: "v2", sources: 6, inputTokens: 3200, outputTokens: 1400, latencyMs: 4100, costUsd: 0.0089, status: "success", timestamp: "2026-10-29T06:55:44Z", endpoint: "/api/ai/exam/generate" },
  { id: "log-007", tenant: "KPR Institute", college: "KPR", agent: "career", model: "gemini-1.5-pro", promptVersion: "v1", sources: 2, inputTokens: 740, outputTokens: 310, latencyMs: 1050, costUsd: 0.0016, status: "success", timestamp: "2026-10-29T06:50:30Z", endpoint: "/api/ai/career/roadmap" },
  { id: "log-008", tenant: "Sri Krishna", college: "SKC", agent: "competitive", model: "gemini-1.5-flash", promptVersion: "v3", sources: 5, inputTokens: 920, outputTokens: 880, latencyMs: 1700, costUsd: 0.0011, status: "success", timestamp: "2026-10-29T06:47:19Z", endpoint: "/api/ai/competitive/quiz" },
  { id: "log-009", tenant: "Hindusthan College", college: "HICAS", agent: "research", model: "claude-sonnet-4-6", promptVersion: "v1", sources: 8, inputTokens: 4100, outputTokens: 1900, latencyMs: 5600, costUsd: 0.0131, status: "error", timestamp: "2026-10-29T06:43:02Z", endpoint: "/api/ai/research/search" },
  { id: "log-010", tenant: "Karpagam Academy", college: "KAU", agent: "mentor", model: "gemini-1.5-pro", promptVersion: "v3", sources: 3, inputTokens: 680, outputTokens: 290, latencyMs: 1180, costUsd: 0.0015, status: "success", timestamp: "2026-10-29T06:39:55Z", endpoint: "/api/ai/mentor/chat" },
];

function fmtTs(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-IN", { hour12: false, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

function fmtCost(n: number) {
  return n < 0.001 ? `$${(n * 1000).toFixed(3)}m` : `$${n.toFixed(4)}`;
}

function fmtLatency(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

const MODEL_COLORS: Record<string, string> = {
  "gemini-1.5-pro": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "gemini-1.5-flash": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "claude-sonnet-4-6": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "gpt-4o": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const STATUS_COLOR: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  timeout: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

interface Props { role: string }

export function AiObservabilityModule({ role }: Props) {
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterModel, setFilterModel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTenant, setFilterTenant] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: raw, isLoading, error } = useQuery({
    queryKey: ["ai-observability"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/ai-observability/logs", ResponseSchema);
      return res ?? DEMO;
    },
    staleTime: 60_000,
  });

  const logs: LogEntry[] = raw ?? DEMO;

  const agents = useMemo(() => ["all", ...Array.from(new Set(logs.map((l) => l.agent))).sort()], [logs]);
  const models = useMemo(() => ["all", ...Array.from(new Set(logs.map((l) => l.model))).sort()], [logs]);
  const tenants = useMemo(() => ["all", ...Array.from(new Set(logs.map((l) => l.tenant))).sort()], [logs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((l) => {
      if (filterAgent !== "all" && l.agent !== filterAgent) return false;
      if (filterModel !== "all" && l.model !== filterModel) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (filterTenant !== "all" && l.tenant !== filterTenant) return false;
      if (q && !(`${l.tenant} ${l.agent} ${l.model} ${l.endpoint}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [logs, search, filterAgent, filterModel, filterStatus, filterTenant]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const avgLatency = total ? Math.round(filtered.reduce((s, l) => s + l.latencyMs, 0) / total) : 0;
    const totalTokens = filtered.reduce((s, l) => s + l.inputTokens + l.outputTokens, 0);
    const totalCost = filtered.reduce((s, l) => s + l.costUsd, 0);
    const errors = filtered.filter((l) => l.status !== "success").length;
    return { total, avgLatency, totalTokens, totalCost, errors };
  }, [filtered]);

  function exportCsv() {
    const header = "id,tenant,agent,model,promptVersion,sources,inputTokens,outputTokens,latencyMs,costUsd,status,timestamp,endpoint";
    const rows = filtered.map((l) =>
      `${l.id},${JSON.stringify(l.tenant)},${l.agent},${l.model},${l.promptVersion},${l.sources},${l.inputTokens},${l.outputTokens},${l.latencyMs},${l.costUsd},${l.status},${l.timestamp},${JSON.stringify(l.endpoint)}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(filtered, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select a textarea
    }
  }

  if (isLoading) return <TemplateSkeleton />;
  if (error && !logs.length) return <LoadError message="Could not load AI observability logs." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">AI Observability</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Every AI request across all tenants — agent, model, tokens, latency and cost.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyJson}>
            {copied ? "Copied!" : "Copy JSON"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Requests", value: stats.total.toLocaleString(), sub: `${stats.errors} error${stats.errors !== 1 ? "s" : ""}` },
          { label: "Avg Latency", value: fmtLatency(stats.avgLatency), sub: "across filtered" },
          { label: "Total Tokens", value: stats.totalTokens.toLocaleString(), sub: "input + output" },
          { label: "Estimated Cost", value: `$${stats.totalCost.toFixed(4)}`, sub: "USD filtered" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className={cn(inputClass, "w-52")}
          placeholder="Search tenant, agent, endpoint…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={cn(inputClass, "w-40")} value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)}>
          {tenants.map((t) => <option key={t} value={t}>{t === "all" ? "All Tenants" : t}</option>)}
        </select>
        <select className={cn(inputClass, "w-36")} value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
          {agents.map((a) => <option key={a} value={a}>{a === "all" ? "All Agents" : a}</option>)}
        </select>
        <select className={cn(inputClass, "w-40")} value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
          {models.map((m) => <option key={m} value={m}>{m === "all" ? "All Models" : m}</option>)}
        </select>
        <select className={cn(inputClass, "w-32")} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          {["all", "success", "error", "timeout"].map((s) => <option key={s} value={s}>{s === "all" ? "All Status" : s}</option>)}
        </select>
        {(search || filterAgent !== "all" || filterModel !== "all" || filterStatus !== "all" || filterTenant !== "all") && (
          <button
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
            onClick={() => { setSearch(""); setFilterAgent("all"); setFilterModel("all"); setFilterStatus("all"); setFilterTenant("all"); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Prompt v</th>
              <th className="px-4 py-3 font-medium text-right">Sources</th>
              <th className="px-4 py-3 font-medium text-right">Tokens</th>
              <th className="px-4 py-3 font-medium text-right">Latency</th>
              <th className="px-4 py-3 font-medium text-right">Cost</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                  No logs match your filters.
                </td>
              </tr>
            )}
            {filtered.map((log) => (
              <React.Fragment key={log.id}>
                <tr
                  className={cn(
                    "hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors",
                    expanded === log.id && "bg-indigo-50/50 dark:bg-indigo-900/10"
                  )}
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono text-xs">
                    {fmtTs(log.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{log.tenant}</span>
                    {log.college && <span className="ml-1.5 text-xs text-gray-400">({log.college})</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{log.agent}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", MODEL_COLORS[log.model] ?? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300")}>
                      {log.model}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{log.promptVersion}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{log.sources}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                    <span title={`In: ${log.inputTokens} / Out: ${log.outputTokens}`}>
                      {(log.inputTokens + log.outputTokens).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-600 dark:text-gray-300">
                    {fmtLatency(log.latencyMs)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-600 dark:text-gray-300">
                    {fmtCost(log.costUsd)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", STATUS_COLOR[log.status])}>
                      {log.status}
                    </span>
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr className="bg-indigo-50/30 dark:bg-indigo-900/5">
                    <td colSpan={10} className="px-6 py-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-gray-600 dark:text-gray-400">
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Log ID</p>
                          <p className="font-mono">{log.id}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Endpoint</p>
                          <p className="font-mono break-all">{log.endpoint || "—"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Input Tokens</p>
                          <p>{log.inputTokens.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Output Tokens</p>
                          <p>{log.outputTokens.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">RAG Sources</p>
                          <p>{log.sources}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Prompt Version</p>
                          <p>{log.promptVersion}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Latency</p>
                          <p>{log.latencyMs.toLocaleString()} ms</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Cost (USD)</p>
                          <p>${log.costUsd.toFixed(6)}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Showing {filtered.length} of {logs.length} log entries. Click a row to expand details.
        {logs === DEMO && " (Demo data — connect the observability API to see live logs.)"}
      </p>
    </div>
  );
}
