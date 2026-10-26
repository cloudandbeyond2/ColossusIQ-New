"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  ReportsOverviewSchema,
  ReportItemSchema,
  ScheduledReportSchema,
  type ReportCategory,
  type ReportItem,
  type ScheduledReport,
  type ReportsOverview,
  type CreateReportInput,
  type CreateScheduleInput,
} from "@/lib/api/schemas";
import { z } from "zod";
import {
  FileText,
  Search,
  Plus,
  Download,
  Filter,
  Eye,
  Trash2,
  CheckCircle2,
  Sparkles,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  FileCheck,
} from "lucide-react";
import type { Role } from "@/lib/auth/roles";
import {
  Badge,
  Button,
  Card,
  Field,
  EmptyState,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { toCsv } from "@/lib/csv";
import { LoadError } from "@/components/ui/load-error";
import { TemplateSkeleton } from "@/components/modules/shared";
import { cn } from "@/lib/utils";

/* ── Data Interfaces ────────────────────────────────── */
export type { ReportCategory, ReportItem, ScheduledReport, ReportsOverview, CreateReportInput };

const fmtDay = (v: string) =>
  new Date(v.length === 10 ? `${v}T00:00:00` : v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtWhen = (v: string) =>
  new Date(v).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/* ── Main Component ─────────────────────────────────── */

export function ReportsModule({ role }: { role?: Role }) {
  const qc = useQueryClient();

  // Backend Query
  const query = useQuery({
    queryKey: ["reports"],
    queryFn: () => apiFetch("/api/v1/reports", ReportsOverviewSchema),
  });

  const reports = useMemo(() => query.data?.reports ?? [], [query.data]);
  const scheduledReports = query.data?.scheduledReports ?? [];
  // what this person may do is decided by the server
  const perms = query.data?.permissions ?? { generate: false, schedule: false };
  const scopes = query.data?.scopes ?? ["Institution"];

  // Active tab state
  const [activeTab, setActiveTab] = useState<"all" | "scheduled">("all");

  // Filtering state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [scopeFilter, setScopeFilter] = useState<string>("All");
  const [periodFilter, setPeriodFilter] = useState<string>("All");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Modals state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<ReportItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Generator form inputs
  const [genTitle, setGenTitle] = useState("");
  const [genCategory, setGenCategory] = useState<ReportCategory>("Academic");
  const [genScope, setGenScope] = useState("Institution");
  const [genPeriod, setGenPeriod] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() >= 5 ? `AY ${y}-${String(y + 1).slice(2)} Odd semester` : `AY ${y - 1}-${String(y).slice(2)} Even semester`;
  });
  const [genIncludeRisk, setGenIncludeRisk] = useState(true);
  const [genIncludeGrades, setGenIncludeGrades] = useState(true);
  const [genIncludePlacements, setGenIncludePlacements] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Schedules
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [schedName, setSchedName] = useState("");
  const [schedCategory, setSchedCategory] = useState<ReportCategory>("Institution");
  const [schedScope, setSchedScope] = useState("Institution");
  const [schedFrequency, setSchedFrequency] = useState<ScheduledReport["frequency"]>("Monthly");
  const [schedRecipients, setSchedRecipients] = useState("");
  const [schedStart, setSchedStart] = useState("");
  const [schedError, setSchedError] = useState<string | null>(null);

  const scheduleMutation = useMutation({
    mutationFn: async (payload: CreateScheduleInput) =>
      apiFetch("/api/v1/reports/scheduled", ScheduledReportSchema, { method: "POST", body: payload }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setIsScheduleOpen(false);
      setSchedName("");
      setSchedRecipients("");
      setSchedStart("");
      setSchedError(null);
      setToast(`Schedule "${s.name}" created.`);
    },
    onError: (err) => setSchedError(err instanceof ApiError ? err.message : "Could not create the schedule."),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => apiFetch(`/api/v1/reports/scheduled/${id}`, z.object({ ok: z.boolean() }), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setToast("Schedule removed.");
    },
    onError: (err) => setToast(err instanceof ApiError ? err.message : "Could not remove the schedule."),
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateReportInput) => {
      return apiFetch("/api/v1/reports", ReportItemSchema, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: (newRep) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setIsGenerating(false);
      setIsGenerateOpen(false);
      setGenTitle("");
      setPage(1);
      setToast(`Report "${newRep.report}" compiled and permanently saved to institutional archive!`);
      setTimeout(() => setToast(null), 4000);
    },
    onError: (err) => {
      setIsGenerating(false);
      setToast("Error saving report: " + (err instanceof Error ? err.message : "Network error"));
      setTimeout(() => setToast(null), 4000);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return apiFetch(`/api/v1/reports/${reportId}`, z.object({ ok: z.boolean() }), {
        method: "DELETE",
      });
    },
    onMutate: async (reportId: string) => {
      await qc.cancelQueries({ queryKey: ["reports"] });
      const prevData = qc.getQueryData<ReportsOverview>(["reports"]);
      if (prevData) {
        const nextReports = prevData.reports.filter((r: ReportItem) => r.id !== reportId);
        qc.setQueryData(["reports"], {
          ...prevData,
          reports: nextReports,
        });
      }
      return { prevData };
    },
    onError: (err, _, context) => {
      if (context?.prevData) {
        qc.setQueryData(["reports"], context.prevData);
      }
      setToast("Failed to delete report: " + (err instanceof Error ? err.message : "Error"));
      setTimeout(() => setToast(null), 3000);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setToast("Report deleted from archive.");
      setTimeout(() => setToast(null), 2500);
    },
  });

  // Toggle Schedule Mutation
  const toggleScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      return apiFetch(`/api/v1/reports/scheduled/${scheduleId}/toggle`, ScheduledReportSchema, {
        method: "POST",
      });
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setToast(`${updated.enabled ? "Resumed" : "Paused"} schedule "${updated.name}".`);
      setTimeout(() => setToast(null), 2000);
    },
  });

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r: ReportItem) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.report.toLowerCase().includes(q) ||
        r.scope.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.period.toLowerCase().includes(q);

      const matchesCategory = categoryFilter === "All" || r.category === categoryFilter;
      const matchesScope = scopeFilter === "All" || r.scope === scopeFilter;
      const matchesPeriod = periodFilter === "All" || r.period === periodFilter;

      return matchesSearch && matchesCategory && matchesScope && matchesPeriod;
    });
  }, [reports, search, categoryFilter, scopeFilter, periodFilter]);

  // Paginated reports
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredReports.slice(startIndex, startIndex + pageSize);
  }, [filteredReports, currentPage, pageSize]);

  // Download real CSV helper
  const handleDownloadCsv = (report: ReportItem) => {
    const rows = [
      ["Report Name", report.report],
      ["Scope", report.scope],
      ["Period", report.period],
      ["Generated", fmtWhen(report.createdAt ?? report.generated)],
      ["Generated By", report.generatedBy],
      ["Summary", report.summary],
      [],
      ["Key Metrics", "Value"],
      ...report.kpis.map((k) => [k.label, k.value]),
      [],
      ["Breakdown Item", "Evaluated Cohort", "Score %", "Status"],
      ...report.breakdown.map((b) => [b.item, b.evaluated, b.score ?? "n/a", b.status]),
    ];

    const csvContent = toCsv(rows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${report.report.replace(/[^a-zA-Z0-9]/g, "_")}_Export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToast(`Downloaded "${report.report}" as CSV spreadsheet.`);
    setTimeout(() => setToast(null), 3000);
  };

  // Real PDF export: opens a print-ready page of the saved report (choose "Save as PDF" in the print dialog)
  const handleDownloadPdf = (report: ReportItem) => {
    const w = window.open("", "_blank");
    if (!w) {
      setToast("Allow pop-ups to export this report as a PDF.");
      return;
    }
    const esc = (v: unknown) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
    const kpis = report.kpis.map((k) => `<tr><td>${esc(k.label)}</td><td>${esc(k.value)}</td></tr>`).join("");
    const rows = report.breakdown
      .map((b) => `<tr><td>${esc(b.item)}</td><td>${esc(b.evaluated)}</td><td>${b.score === null ? "n/a" : esc(b.score) + "%"}</td><td>${esc(b.status)}</td></tr>`)
      .join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.report)}</title><style>body{font-family:system-ui,sans-serif;margin:32px;color:#111}h1{font-size:20px;margin:0 0 4px}p{color:#555;font-size:12px}table{border-collapse:collapse;width:100%;margin:12px 0 20px;font-size:12px}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f3f3}</style></head><body><h1>${esc(report.report)}</h1><p>${esc(report.category)} · ${esc(report.scope)} · ${esc(report.period)}<br>Generated by ${esc(report.generatedBy)} on ${esc(fmtWhen(report.createdAt ?? report.generated))}</p><p>${esc(report.summary)}</p><table><tr><th>Key metric</th><th>Value</th></tr>${kpis}</table><table><tr><th>Item</th><th>Evaluated</th><th>Score</th><th>Status</th></tr>${rows}</table></body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  // Handle generation of new report
  const handleCreateReport = () => {
    const title = genTitle.trim();
    if (!title) {
      setToast("Please enter a report title.");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setIsGenerating(true);
    createMutation.mutate({
      report: title,
      category: genCategory,
      scope: genScope,
      period: genPeriod,
      includeGrades: genIncludeGrades,
      includeRisk: genIncludeRisk,
      includePlacements: genIncludePlacements,
    });
  };

  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isLoading || !query.data) return <TemplateSkeleton />;

  const upcoming = scheduledReports.filter((s) => s.enabled).map((s) => s.nextRun).sort()[0];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="flex items-center justify-between rounded-xl border border-teal/40 bg-teal-soft/70 px-4 py-3 text-sm text-teal shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded p-1 hover:bg-teal/10"
            aria-label="Close notification"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium uppercase tracking-wider">Reports Ready</span>
            <FileText className="size-4 text-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{reports.length}</span>
            {role ? <Badge tone="brand" className="text-[10px]">{role.toUpperCase()}</Badge> : null}
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Download as CSV or print to PDF</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium uppercase tracking-wider">Scheduled Auto-Runs</span>
            <Clock className="size-4 text-sky" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">
              {scheduledReports.filter((s) => s.enabled).length}
            </span>
            <span className="text-xs text-ink-3">active crons</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">{upcoming ? `Next run: ${fmtDay(upcoming)}` : "No active schedules"}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium uppercase tracking-wider">Latest Report</span>
            <Download className="size-4 text-gold" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{reports[0]?.createdAt ? fmtDay(reports[0].createdAt) : "None yet"}</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Most recently compiled report</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium uppercase tracking-wider">Scopes Covered</span>
            <FileCheck className="size-4 text-teal" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal">{new Set(reports.map((r) => r.scope)).size}</span>
            <span className="text-xs text-ink-3">distinct scopes</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Departments with a compiled report</p>
        </Card>
      </div>

      {/* Main Container Card */}
      <Card>
        {/* Top Controls Bar */}
        <div className="border-b border-line p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                placeholder="Search reports by title, scope or keyword..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className={cn(inputClass, "pl-9 text-xs")}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {perms.generate ? (
                <Button
                  variant="primary"
                  onClick={() => setIsGenerateOpen(true)}
                  className="gap-1.5 text-xs h-9 px-3.5"
                >
                  <Plus className="size-3.5" /> Generate report
                </Button>
              ) : null}
            </div>
          </div>

          {/* Filter Pills & Dropdowns */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              <span className="text-ink-3 font-semibold uppercase text-[10px] mr-1 flex items-center gap-1">
                <Filter className="size-3" /> Type:
              </span>
              {["All", "Academic", "Department", "Placement", "Faculty", "Compliance", "Institution"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-medium transition-colors text-xs whitespace-nowrap",
                    categoryFilter === cat
                      ? "bg-brand text-white shadow-sm"
                      : "bg-surface-2 text-ink-2 hover:bg-surface-2/80 hover:text-ink"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Dropdowns for Scope & Period */}
            <div className="flex items-center gap-2 text-xs">
              <select
                value={scopeFilter}
                onChange={(e) => {
                  setScopeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                aria-label="Filter by scope"
              >
                <option value="All">All Scopes</option>
                {[...new Set(reports.map((r) => r.scope))].map((sc) => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>

              <select
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                aria-label="Filter by period"
              >
                <option value="All">All Periods</option>
                {[...new Set(reports.map((r) => r.period).filter(Boolean))].map((pd) => (
                  <option key={pd} value={pd}>
                    {pd}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex border-b border-line px-4 gap-4 text-xs font-semibold text-ink-3">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "py-2.5 border-b-2 transition-colors flex items-center gap-1.5",
              activeTab === "all"
                ? "border-brand text-brand"
                : "border-transparent hover:text-ink"
            )}
          >
            <FileText className="size-3.5" /> Generated Reports ({filteredReports.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scheduled")}
            className={cn(
              "py-2.5 border-b-2 transition-colors flex items-center gap-1.5",
              activeTab === "scheduled"
                ? "border-brand text-brand"
                : "border-transparent hover:text-ink"
            )}
          >
            <Clock className="size-3.5" /> Automated Schedules ({scheduledReports.length})
          </button>
        </div>

        {/* ═════════ TAB 1: REPORTS TABLE ═════════ */}
        {activeTab === "all" && (
          <div>
            {filteredReports.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  title="No reports match your filters"
                  body={search ? "Try adjusting your search terms or filter selections." : "Generate a report using the button above."}
                  action={
                    perms.generate ? (
                      <Button size="sm" onClick={() => setIsGenerateOpen(true)}>
                        <Plus className="size-3.5 mr-1" /> Generate report
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-surface-2/40 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                    <tr>
                      <th scope="col" className="px-5 py-3">Report</th>
                      <th scope="col" className="px-4 py-3">Scope</th>
                      <th scope="col" className="px-4 py-3">Period</th>
                      <th scope="col" className="px-4 py-3">Formats</th>
                      <th scope="col" className="px-4 py-3">Last Generated</th>
                      <th scope="col" className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {paginatedReports.map((r: ReportItem) => (
                      <tr
                        key={r.id}
                        onClick={() => setPreviewReport(r)}
                        className="hover:bg-surface-2/60 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-medium text-ink">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                              <FileText className="size-3.5" />
                            </span>
                            <div>
                              <p className="font-semibold text-ink hover:text-brand hover:underline">
                                {r.report}
                              </p>
                              <p className="text-[11px] text-ink-3 line-clamp-1 max-w-xs sm:max-w-md">
                                {r.summary}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <Badge
                            tone={
                              r.scope === "Institution"
                                ? "brand"
                                : r.scope === "CSE"
                                ? "teal"
                                : r.scope === "DBMS"
                                ? "sky"
                                : "neutral"
                            }
                          >
                            {r.scope}
                          </Badge>
                        </td>

                        <td className="px-4 py-3.5 text-ink-2 font-medium">
                          {r.period}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            {r.formats.map((fmt: string) => (
                              <button
                                key={fmt}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (fmt === "CSV" || fmt === "Excel") handleDownloadCsv(r);
                                  else handleDownloadPdf(r);
                                }}
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-surface-2 text-ink hover:bg-brand hover:text-white transition-colors"
                                title={`Download ${fmt}`}
                              >
                                {fmt}
                              </button>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-ink-3">
                          <span className="font-medium text-ink">{fmtWhen(r.createdAt ?? r.generated)}</span>
                          <span className="text-[10px] block text-ink-3">{r.fileSize}</span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewReport(r)}
                              className="rounded p-1 text-ink-3 hover:text-brand hover:bg-brand-soft transition-colors"
                              title="Preview Report"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadCsv(r)}
                              className="rounded p-1 text-ink-3 hover:text-teal hover:bg-teal-soft transition-colors"
                              title="Download Spreadsheet"
                            >
                              <Download className="size-3.5" />
                            </button>
                            {r.canDelete ? (
                            <button
                              type="button"
                              disabled={deleteMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                deleteMutation.mutate(r.id);
                              }}
                              className="rounded p-1 text-ink-3 hover:text-rose hover:bg-rose-soft transition-colors disabled:opacity-50"
                              title="Delete Report"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredReports.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-xs text-ink-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Showing <strong className="text-ink">{(currentPage - 1) * pageSize + 1}</strong> to{" "}
                    <strong className="text-ink">{Math.min(currentPage * pageSize, filteredReports.length)}</strong> of{" "}
                    <strong className="text-ink">{filteredReports.length}</strong> reports
                  </span>
                  <div className="flex items-center gap-1.5 sm:border-l sm:border-line sm:pl-3">
                    <span>Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="mr-2 text-ink-3">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="gap-1 px-2.5 h-8 text-xs"
                  >
                    <ChevronLeft className="size-3.5" /> Prev
                  </Button>

                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setPage(pNum)}
                        className={cn(
                          "size-8 rounded-lg text-xs font-medium transition-colors",
                          pNum === currentPage
                            ? "bg-brand text-white shadow-sm font-semibold"
                            : "text-ink-2 hover:bg-surface-2 hover:text-ink border border-line"
                        )}
                      >
                        {pNum}
                      </button>
                    ))}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="gap-1 px-2.5 h-8 text-xs"
                  >
                    Next <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═════════ TAB 2: SCHEDULED RUNS ═════════ */}
        {activeTab === "scheduled" && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-ink">Report Schedules</h4>
                <p className="text-xs text-ink-3">
                  Each schedule compiles a new report from live records when it falls due. Only the principal office manages schedules.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="teal">{scheduledReports.filter((s) => s.enabled).length} Active</Badge>
                {perms.schedule ? (
                  <Button size="sm" onClick={() => setIsScheduleOpen(true)} className="gap-1.5 text-xs">
                    <Plus className="size-3.5" /> New schedule
                  </Button>
                ) : null}
              </div>
            </div>

            {scheduledReports.length === 0 ? (
              <EmptyState
                title="No schedules yet"
                body={perms.schedule ? "Create a schedule to compile a report automatically." : "The principal office has not set up any report schedules."}
              />
            ) : (
              <div className="grid gap-3">
                {scheduledReports.map((sch) => (
                  <div
                    key={sch.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-line bg-surface hover:bg-surface-2/40 transition-colors text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-ink">{sch.name}</span>
                        <Badge tone="brand">{sch.frequency}</Badge>
                        <Badge tone="neutral">{sch.category}</Badge>
                        <Badge tone="neutral">{sch.scope}</Badge>
                      </div>
                      {sch.recipients ? (
                        <p className="text-xs text-ink-3">
                          Distribution list: <span className="font-mono text-[11px] text-ink">{sch.recipients}</span>
                        </p>
                      ) : null}
                      <p className="text-[11px] text-ink-3">
                        Next run: <span className="font-medium text-teal">{fmtDay(sch.nextRun)}</span>
                        {" · "}
                        Last run: <span className="font-medium text-ink">{sch.lastRun ? fmtWhen(sch.lastRun) : "not run yet"}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                        <span>{sch.enabled ? "Active" : "Paused"}</span>
                        <input
                          type="checkbox"
                          checked={sch.enabled}
                          disabled={!perms.schedule || toggleScheduleMutation.isPending}
                          onChange={() => {
                            toggleScheduleMutation.mutate(sch.id);
                          }}
                          className="rounded border-line text-brand focus:ring-brand size-4 cursor-pointer"
                        />
                      </label>
                      {perms.schedule ? (
                        <button
                          type="button"
                          disabled={deleteScheduleMutation.isPending}
                          onClick={() => deleteScheduleMutation.mutate(sch.id)}
                          className="rounded p-1 text-ink-3 hover:text-rose hover:bg-rose-soft transition-colors disabled:opacity-50"
                          title="Remove schedule"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ═════════ REPORT PREVIEW MODAL ═════════ */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="brand">{previewReport.category}</Badge>
                  <Badge tone="sky">{previewReport.scope}</Badge>
                  <span className="text-xs text-ink-3">{previewReport.period}</span>
                </div>
                <h3 className="text-lg font-bold text-ink">{previewReport.report}</h3>
                <p className="text-xs text-ink-3">
                  Generated by {previewReport.generatedBy} · {fmtWhen(previewReport.createdAt ?? previewReport.generated)} ({previewReport.fileSize})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Executive Summary */}
            <div className="rounded-xl bg-surface-2/50 p-4 border border-line text-xs space-y-1">
              <span className="font-semibold text-ink uppercase tracking-wider text-[10px]">
                Executive Briefing
              </span>
              <p className="text-ink-2 leading-relaxed">{previewReport.summary}</p>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {previewReport.kpis.map((kpi) => (
                <div key={kpi.label} className="p-3 rounded-xl border border-line bg-surface">
                  <span className="text-[11px] text-ink-3 block">{kpi.label}</span>
                  <span className="text-lg font-bold text-ink">{kpi.value}</span>
                  {kpi.delta && (
                    <span className="text-[10px] text-teal font-medium block">{kpi.delta}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Breakdown Table */}
            <div>
              <span className="text-xs font-semibold text-ink uppercase tracking-wider block mb-2">
                Detailed Evaluation Data
              </span>
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 text-ink-3 font-semibold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Category / Subject</th>
                      <th className="px-3.5 py-2.5 text-center">Evaluated Cohort</th>
                      <th className="px-3.5 py-2.5 text-center">Attainment Score</th>
                      <th className="px-3.5 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {previewReport.breakdown.map((row) => (
                      <tr key={row.item} className="hover:bg-surface-2/30">
                        <td className="px-3.5 py-2.5 font-medium text-ink">{row.item}</td>
                        <td className="px-3.5 py-2.5 text-center text-ink-3">{row.evaluated}</td>
                        <td className="px-3.5 py-2.5 text-center font-bold text-brand">{row.score === null ? "n/a" : `${row.score}%`}</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <Badge tone={row.score === null ? "neutral" : row.score >= 80 ? "teal" : "amber"}>
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownloadCsv(previewReport)}
                  className="gap-1.5 text-xs"
                >
                  <FileSpreadsheet className="size-3.5 text-teal" /> Download CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownloadPdf(previewReport)}
                  className="gap-1.5 text-xs"
                >
                  <FileText className="size-3.5 text-rose" /> Export PDF
                </Button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPreviewReport(null)}
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ GENERATE REPORT MODAL ═════════ */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-ink">Generate New Institutional Report</h3>
                  <p className="text-xs text-ink-3">Compiled from your college&apos;s live records</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateOpen(false)}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <Field label="Report Title" htmlFor="gen-title">
                <input
                  id="gen-title"
                  type="text"
                  value={genTitle}
                  onChange={(e) => setGenTitle(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. End of Term Department Performance"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Report Domain" htmlFor="gen-cat">
                  <select
                    id="gen-cat"
                    value={genCategory}
                    onChange={(e) => setGenCategory(e.target.value as ReportCategory)}
                    className={inputClass}
                  >
                    <option value="Academic">Academic (CO/PO)</option>
                    <option value="Department">Department Review</option>
                    <option value="Placement">Placements & CTC</option>
                    <option value="Faculty">Faculty & Research</option>
                    <option value="Compliance">NAAC / NBA Audit</option>
                    <option value="Institution">Institution-Wide</option>
                  </select>
                </Field>

                <Field label="Department Scope" htmlFor="gen-scope">
                  <select
                    id="gen-scope"
                    value={genScope}
                    onChange={(e) => setGenScope(e.target.value)}
                    className={inputClass}
                  >
                    {scopes.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc === "Institution" ? "Institution (All)" : sc}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Period / Term" htmlFor="gen-period">
                <input
                  id="gen-period"
                  type="text"
                  value={genPeriod}
                  onChange={(e) => setGenPeriod(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. AY 2026-27 Odd semester"
                />
              </Field>

              <div className="space-y-2 pt-1 border-t border-line">
                <span className="text-[11px] font-semibold text-ink-3 uppercase block">
                  Include Modules & Metrics
                </span>
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={genIncludeGrades}
                    onChange={(e) => setGenIncludeGrades(e.target.checked)}
                    className="rounded border-line text-brand focus:ring-brand size-3.5"
                  />
                  <span>Quiz pass-rate analytics</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={genIncludeRisk}
                    onChange={(e) => setGenIncludeRisk(e.target.checked)}
                    className="rounded border-line text-brand focus:ring-brand size-3.5"
                  />
                  <span>Students averaging below 60% on quizzes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={genIncludePlacements}
                    onChange={(e) => setGenIncludePlacements(e.target.checked)}
                    className="rounded border-line text-brand focus:ring-brand size-3.5"
                  />
                  <span>Placement drives, openings and offers</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsGenerateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isGenerating || createMutation.isPending || !genTitle}
                onClick={handleCreateReport}
                className="gap-1.5"
              >
                {isGenerating || createMutation.isPending ? <Spinner /> : <Sparkles className="size-3.5" />}
                {isGenerating || createMutation.isPending ? "Compiling & Saving…" : "Compile & Save Report"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink">New report schedule</h3>
              <button type="button" onClick={() => setIsScheduleOpen(false)} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            {schedError ? (
              <p className="rounded-xl border border-rose/20 bg-rose-soft px-3 py-2 text-xs text-rose" role="alert">
                {schedError}
              </p>
            ) : null}
            <div className="space-y-3.5 text-xs">
              <Field label="Schedule name" htmlFor="sch-name">
                <input id="sch-name" type="text" value={schedName} onChange={(e) => setSchedName(e.target.value)} className={inputClass} placeholder="e.g. Monthly department review" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Report domain" htmlFor="sch-cat">
                  <select id="sch-cat" value={schedCategory} onChange={(e) => setSchedCategory(e.target.value as ReportCategory)} className={inputClass}>
                    <option value="Academic">Academic</option>
                    <option value="Department">Department Review</option>
                    <option value="Placement">Placements</option>
                    <option value="Faculty">Faculty</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Institution">Institution-Wide</option>
                  </select>
                </Field>
                <Field label="Scope" htmlFor="sch-scope">
                  <select id="sch-scope" value={schedScope} onChange={(e) => setSchedScope(e.target.value)} className={inputClass}>
                    {scopes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Repeats" htmlFor="sch-freq">
                  <select id="sch-freq" value={schedFrequency} onChange={(e) => setSchedFrequency(e.target.value as ScheduledReport["frequency"])} className={inputClass}>
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="End of Term">End of Term (6 months)</option>
                  </select>
                </Field>
                <Field label="First run (optional)" htmlFor="sch-start">
                  <input id="sch-start" type="date" value={schedStart} onChange={(e) => setSchedStart(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Distribution list (optional)" htmlFor="sch-rcpt">
                <input id="sch-rcpt" type="text" value={schedRecipients} onChange={(e) => setSchedRecipients(e.target.value)} className={inputClass} placeholder="Who this report is for" />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button variant="secondary" size="sm" onClick={() => setIsScheduleOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={scheduleMutation.isPending || schedName.trim().length < 2}
                onClick={() => {
                  setSchedError(null);
                  scheduleMutation.mutate({
                    name: schedName.trim(),
                    category: schedCategory,
                    scope: schedScope,
                    frequency: schedFrequency,
                    recipients: schedRecipients.trim(),
                    ...(schedStart ? { startDate: schedStart } : {}),
                  });
                }}
              >
                {scheduleMutation.isPending ? <Spinner /> : null}
                Create schedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
