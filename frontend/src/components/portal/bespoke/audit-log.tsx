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
const AuditEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  actor: z.string(),
  actorRole: z.string().optional().default(""),
  actorEmail: z.string().optional().default(""),
  tenant: z.string().optional().default(""),
  action: z.string(),
  category: z.enum(["auth", "config", "data", "ai", "user", "billing", "security", "content"]),
  severity: z.enum(["info", "warning", "critical"]),
  resource: z.string().optional().default(""),
  resourceId: z.string().optional().default(""),
  ip: z.string().optional().default(""),
  detail: z.string().optional().default(""),
  outcome: z.enum(["success", "failure"]).optional().default("success"),
});
type AuditEntry = z.infer<typeof AuditEntrySchema>;

const ResponseSchema = z.union([
  z.object({ entries: z.array(AuditEntrySchema) }).transform((v) => v.entries),
  z.object({ data: z.array(AuditEntrySchema) }).transform((v) => v.data),
  z.array(AuditEntrySchema),
  z.unknown().transform(() => [] as AuditEntry[]),
]);

// Demo entries
const DEMO: AuditEntry[] = [
  { id: "a001", timestamp: "2026-10-29T07:44:12Z", actor: "Rajesh Kumar", actorRole: "admin", actorEmail: "rajesh@colossusiq.com", tenant: "Platform", action: "ai-provider.update", category: "config", severity: "warning", resource: "ai-providers", resourceId: "gemini-1.5-pro", ip: "103.24.11.5", detail: "Default model changed from gemini-1.5-flash to gemini-1.5-pro", outcome: "success" },
  { id: "a002", timestamp: "2026-10-29T07:38:55Z", actor: "Priya Anand", actorRole: "institution", actorEmail: "principal@psg.edu.in", tenant: "PSG College", action: "user.role.change", category: "user", severity: "warning", resource: "users", resourceId: "usr-441", ip: "202.88.12.34", detail: "Role changed from faculty to hod for Dr. Suresh Babu", outcome: "success" },
  { id: "a003", timestamp: "2026-10-29T07:31:04Z", actor: "System", actorRole: "system", actorEmail: "", tenant: "SNS College", action: "ai.request.failed", category: "ai", severity: "critical", resource: "research-agent", resourceId: "req-8821", ip: "", detail: "Research agent exceeded token quota (4096 limit). Request aborted.", outcome: "failure" },
  { id: "a004", timestamp: "2026-10-29T07:22:40Z", actor: "Meena Krishnan", actorRole: "admin", actorEmail: "meena@colossusiq.com", tenant: "Platform", action: "module.toggle", category: "config", severity: "info", resource: "module-control", resourceId: "viva", ip: "103.24.11.5", detail: "Module 'Viva Simulator' disabled for role: student across 3 colleges", outcome: "success" },
  { id: "a005", timestamp: "2026-10-29T07:15:19Z", actor: "Arjun Selvam", actorRole: "institution", actorEmail: "admin@kpr.edu.in", tenant: "KPR Institute", action: "score.override", category: "data", severity: "critical", resource: "evaluation", resourceId: "eval-2291", ip: "49.207.88.100", detail: "AI score overridden: Q3 changed from 6/10 to 9/10 for student ID STU-882", outcome: "success" },
  { id: "a006", timestamp: "2026-10-29T07:08:02Z", actor: "Rajesh Kumar", actorRole: "admin", actorEmail: "rajesh@colossusiq.com", tenant: "Platform", action: "billing.waiver.grant", category: "billing", severity: "warning", resource: "billing", resourceId: "college-017", ip: "103.24.11.5", detail: "Fee waiver granted for Bannari Amman Institute (annual fee Rs. 12,000)", outcome: "success" },
  { id: "a007", timestamp: "2026-10-29T06:59:33Z", actor: "Divya Lakshmi", actorRole: "institution", actorEmail: "it@rvsgroup.edu.in", tenant: "RVS College", action: "integration.secret.update", category: "security", severity: "warning", resource: "integrations", resourceId: "whatsapp-gateway", ip: "122.167.44.21", detail: "WhatsApp gateway API key rotated", outcome: "success" },
  { id: "a008", timestamp: "2026-10-29T06:52:11Z", actor: "Unknown", actorRole: "", actorEmail: "unknown", tenant: "Amrita Vishwa", action: "auth.login.failed", category: "auth", severity: "critical", resource: "auth", resourceId: "", ip: "91.108.4.10", detail: "5 consecutive failed login attempts for admin@amrita.edu — account locked", outcome: "failure" },
  { id: "a009", timestamp: "2026-10-29T06:44:28Z", actor: "Meena Krishnan", actorRole: "admin", actorEmail: "meena@colossusiq.com", tenant: "Platform", action: "content.publish", category: "content", severity: "info", resource: "content-desk", resourceId: "ca-2026-10-29", ip: "103.24.11.5", detail: "Current affairs batch (28 items) published to 14 colleges", outcome: "success" },
  { id: "a010", timestamp: "2026-10-29T06:38:55Z", actor: "Suresh Babu", actorRole: "hod", actorEmail: "hod.cse@psg.edu.in", tenant: "PSG College", action: "certificate.issue", category: "data", severity: "info", resource: "certificate-authority", resourceId: "cert-9901", ip: "202.88.12.34", detail: "Certificate of Merit issued to student STU-441 (A+ grade, AI Fundamentals)", outcome: "success" },
  { id: "a011", timestamp: "2026-10-29T06:30:07Z", actor: "System", actorRole: "system", actorEmail: "", tenant: "Platform", action: "security.mfa.enforce", category: "security", severity: "info", resource: "security-settings", resourceId: "", ip: "", detail: "MFA enforcement activated for all institution-role users (3 colleges affected)", outcome: "success" },
  { id: "a012", timestamp: "2026-10-29T06:22:44Z", actor: "Rajesh Kumar", actorRole: "admin", actorEmail: "rajesh@colossusiq.com", tenant: "Platform", action: "college.suspend", category: "config", severity: "critical", resource: "colleges", resourceId: "college-004", ip: "103.24.11.5", detail: "College account suspended: Pending fee clearance (Rs. 48,000 overdue)", outcome: "success" },
];

function fmtTs(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-IN", { hour12: false, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

const SEVERITY_CLASS: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const CATEGORY_CLASS: Record<string, string> = {
  auth: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  config: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  data: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  ai: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  user: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  billing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  security: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  content: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

const OUTCOME_CLASS: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failure: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const CATEGORIES = ["all", "auth", "config", "data", "ai", "user", "billing", "security", "content"] as const;
const SEVERITIES = ["all", "info", "warning", "critical"] as const;

interface Props { role: string }

export function AuditLogModule({ role }: Props) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterOutcome, setFilterOutcome] = useState("all");
  const [filterTenant, setFilterTenant] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: raw, isLoading, error } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/audit-log", ResponseSchema);
      return res ?? DEMO;
    },
    staleTime: 60_000,
  });

  const entries: AuditEntry[] = raw ?? DEMO;

  const tenants = useMemo(() => ["all", ...Array.from(new Set(entries.map((e) => e.tenant).filter(Boolean))).sort()], [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (filterCategory !== "all" && e.category !== filterCategory) return false;
      if (filterSeverity !== "all" && e.severity !== filterSeverity) return false;
      if (filterOutcome !== "all" && e.outcome !== filterOutcome) return false;
      if (filterTenant !== "all" && e.tenant !== filterTenant) return false;
      if (q && !(`${e.actor} ${e.action} ${e.resource} ${e.detail} ${e.actorEmail} ${e.ip}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [entries, search, filterCategory, filterSeverity, filterOutcome, filterTenant]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const critical = filtered.filter((e) => e.severity === "critical").length;
    const failures = filtered.filter((e) => e.outcome === "failure").length;
    const categories = new Set(filtered.map((e) => e.category)).size;
    return { total, critical, failures, categories };
  }, [filtered]);

  const hasFilters = search || filterCategory !== "all" || filterSeverity !== "all" || filterOutcome !== "all" || filterTenant !== "all";

  function clearFilters() {
    setSearch(""); setFilterCategory("all"); setFilterSeverity("all"); setFilterOutcome("all"); setFilterTenant("all");
  }

  function exportCsv() {
    const header = "id,timestamp,actor,actorRole,actorEmail,tenant,action,category,severity,resource,resourceId,ip,detail,outcome";
    const rows = filtered.map((e) =>
      `${e.id},${e.timestamp},${JSON.stringify(e.actor)},${e.actorRole},${JSON.stringify(e.actorEmail)},${JSON.stringify(e.tenant)},${e.action},${e.category},${e.severity},${e.resource},${e.resourceId},${e.ip},${JSON.stringify(e.detail)},${e.outcome}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(filtered, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  if (isLoading) return <TemplateSkeleton />;
  if (error && !entries.length) return <LoadError message="Could not load audit log entries." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Security-relevant actions, configuration changes and score overrides — immutable and tamper-evident.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyJson}>{copied ? "Copied!" : "Copy JSON"}</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Events", value: stats.total.toLocaleString(), sub: "filtered" },
          { label: "Critical", value: stats.critical.toLocaleString(), sub: "severity", accent: stats.critical > 0 },
          { label: "Failures", value: stats.failures.toLocaleString(), sub: "outcome", accent: stats.failures > 0 },
          { label: "Categories", value: stats.categories.toLocaleString(), sub: "distinct" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={cn("mt-1 text-xl font-semibold", s.accent ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white")}>
              {s.value}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className={cn(inputClass, "w-56")}
          placeholder="Search actor, action, IP, detail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={cn(inputClass, "w-36")} value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)}>
          {tenants.map((t) => <option key={t} value={t}>{t === "all" ? "All Tenants" : t}</option>)}
        </select>
        <select className={cn(inputClass, "w-32")} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
        </select>
        <select className={cn(inputClass, "w-32")} value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s === "all" ? "All Severity" : s}</option>)}
        </select>
        <select className={cn(inputClass, "w-28")} value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)}>
          {["all", "success", "failure"].map((o) => <option key={o} value={o}>{o === "all" ? "All Outcomes" : o}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline">
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
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Resource</th>
              <th className="px-4 py-3 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                  No audit entries match your filters.
                </td>
              </tr>
            )}
            {filtered.map((entry) => (
              <React.Fragment key={entry.id}>
                <tr
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30",
                    entry.severity === "critical" && entry.outcome === "failure" && "bg-red-50/40 dark:bg-red-900/5",
                    expanded === entry.id && "bg-indigo-50/50 dark:bg-indigo-900/10"
                  )}
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {fmtTs(entry.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{entry.actor}</p>
                    {entry.actorRole && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{entry.actorRole}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{entry.tenant || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{entry.action}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", CATEGORY_CLASS[entry.category])}>
                      {entry.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", SEVERITY_CLASS[entry.severity])}>
                      {entry.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono">{entry.resource || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", OUTCOME_CLASS[entry.outcome ?? "success"])}>
                      {entry.outcome ?? "success"}
                    </span>
                  </td>
                </tr>
                {expanded === entry.id && (
                  <tr className="bg-indigo-50/30 dark:bg-indigo-900/5">
                    <td colSpan={8} className="px-6 py-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Log ID</p>
                          <p className="font-mono">{entry.id}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Actor Email</p>
                          <p>{entry.actorEmail || "—"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">IP Address</p>
                          <p className="font-mono">{entry.ip || "—"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Resource ID</p>
                          <p className="font-mono">{entry.resourceId || "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Detail</p>
                          <p className="leading-relaxed">{entry.detail || "No additional detail."}</p>
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
        Showing {filtered.length} of {entries.length} entries. Click a row to expand detail.
        {entries === DEMO && " (Demo data — connect the audit API to see live logs.)"}
        {" "}Audit entries are immutable and cannot be edited or deleted.
      </p>
    </div>
  );
}
