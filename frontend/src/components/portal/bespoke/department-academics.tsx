"use client";

import { useState, useMemo } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Award,
  BarChart2,
  RefreshCw,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* ── Zod schema ──────────────────────────────────────── */

const SubjectSchema = z.object({
  code: z.string(),
  name: z.string(),
  faculty: z.string().optional(),
  semester: z.number().default(1),
  enrolled: z.number().default(0),
  appeared: z.number().default(0),
  passed: z.number().default(0),
  passRate: z.number().default(0),
  avgMarks: z.number().default(0),
  highest: z.number().default(0),
  lowest: z.number().default(0),
  atRisk: z.number().default(0),
  trend: z.number().default(0),
});

const SemesterSummarySchema = z.object({
  sem: z.number(),
  label: z.string(),
  passRate: z.number(),
  enrolled: z.number(),
  atRisk: z.number(),
});

const DeptKpiSchema = z.object({
  label: z.string(),
  value: z.string(),
  delta: z.number().optional(),
  note: z.string().optional(),
});

const DeptAcademicsDataSchema = z.object({
  department: z.string().default("Department"),
  batch: z.string().default("2024-25"),
  exam: z.string().default("End Semester"),
  overallPassRate: z.number().default(0),
  totalStudents: z.number().default(0),
  atRiskCount: z.number().default(0),
  avgMarks: z.number().default(0),
  kpis: z.array(DeptKpiSchema).default([]),
  subjects: z.array(SubjectSchema).default([]),
  semesterSummary: z.array(SemesterSummarySchema).default([]),
  insights: z.array(z.string()).default([]),
});

const DashboardDataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  data: DeptAcademicsDataSchema.optional(),
  kpis: z.array(DeptKpiSchema).optional(),
  items: z.array(z.any()).optional(),
}).passthrough().transform((raw) => {
  if (raw.data) return raw.data;
  const kpis: z.infer<typeof DeptKpiSchema>[] = raw.kpis ?? [];
  return DeptAcademicsDataSchema.parse({
    department: (raw as any).department ?? "Department",
    batch: (raw as any).batch ?? "2024-25",
    exam: (raw as any).exam ?? "End Semester",
    overallPassRate: (raw as any).overallPassRate ?? 78,
    totalStudents: (raw as any).totalStudents ?? 0,
    atRiskCount: (raw as any).atRiskCount ?? 0,
    avgMarks: (raw as any).avgMarks ?? 0,
    kpis,
    subjects: (raw as any).subjects ?? [],
    semesterSummary: (raw as any).semesterSummary ?? [],
    insights: (raw as any).insights ?? [],
  });
});

type DeptAcademicsData = z.infer<typeof DeptAcademicsDataSchema>;
type Subject = z.infer<typeof SubjectSchema>;

/* ── Fallback data for demo/dev ──────────────────────── */

const DEMO: DeptAcademicsData = {
  department: "Computer Science & Engineering",
  batch: "2024-25",
  exam: "End Semester I",
  overallPassRate: 81,
  totalStudents: 240,
  atRiskCount: 28,
  avgMarks: 67,
  kpis: [
    { label: "Overall Pass Rate", value: "81%", delta: 4, note: "vs last sem" },
    { label: "Avg Marks", value: "67/100", delta: 3 },
    { label: "At-Risk Students", value: "28", delta: -5, note: "improvement" },
    { label: "Distinction (>=75)", value: "42%", delta: 6 },
  ],
  subjects: [
    { code: "CS301", name: "Data Structures", faculty: "Dr. Meena R.", semester: 3, enrolled: 60, appeared: 58, passed: 51, passRate: 88, avgMarks: 72, highest: 97, lowest: 28, atRisk: 4, trend: 5 },
    { code: "CS302", name: "Algorithm Design", faculty: "Prof. Kiran S.", semester: 3, enrolled: 60, appeared: 57, passed: 44, passRate: 77, avgMarks: 63, highest: 91, lowest: 22, atRisk: 9, trend: -3 },
    { code: "CS303", name: "Operating Systems", faculty: "Dr. Anand V.", semester: 3, enrolled: 60, appeared: 59, passed: 53, passRate: 90, avgMarks: 74, highest: 99, lowest: 38, atRisk: 3, trend: 8 },
    { code: "CS304", name: "Database Systems", faculty: "Ms. Priya T.", semester: 3, enrolled: 60, appeared: 55, passed: 40, passRate: 73, avgMarks: 59, highest: 88, lowest: 18, atRisk: 9, trend: -7 },
    { code: "CS305", name: "Computer Networks", faculty: "Prof. Raj L.", semester: 3, enrolled: 60, appeared: 58, passed: 47, passRate: 81, avgMarks: 65, highest: 94, lowest: 30, atRisk: 6, trend: 2 },
    { code: "CS401", name: "Compiler Design", faculty: "Dr. Meena R.", semester: 4, enrolled: 60, appeared: 56, passed: 39, passRate: 70, avgMarks: 55, highest: 85, lowest: 14, atRisk: 12, trend: -10 },
    { code: "CS402", name: "Machine Learning", faculty: "Dr. Anand V.", semester: 4, enrolled: 60, appeared: 58, passed: 52, passRate: 90, avgMarks: 76, highest: 98, lowest: 41, atRisk: 2, trend: 9 },
  ],
  semesterSummary: [
    { sem: 1, label: "Sem I", passRate: 88, enrolled: 60, atRisk: 4 },
    { sem: 2, label: "Sem II", passRate: 84, enrolled: 60, atRisk: 6 },
    { sem: 3, label: "Sem III", passRate: 81, enrolled: 60, atRisk: 8 },
    { sem: 4, label: "Sem IV", passRate: 78, enrolled: 60, atRisk: 10 },
  ],
  insights: [
    "Compiler Design (CS401) has the lowest pass rate (70%) — 12 students at risk. Consider remedial sessions.",
    "Machine Learning (CS402) shows a +9% trend — strongest improvement this semester.",
    "Database Systems drop of 7% signals potential pedagogy gap — review teaching methodology.",
    "Overall at-risk count decreased by 5 from last semester — intervention programs are effective.",
  ],
};

/* ── Mini components ──────────────────────────────────── */

function PassRateBar({ rate, size = "md" }: { rate: number; size?: "sm" | "md" }) {
  const color =
    rate >= 85 ? "bg-emerald-500" :
    rate >= 70 ? "bg-amber-500" :
    "bg-rose-500";
  const h = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className={cn("w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden", h)}>
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
    </div>
  );
}

function TrendBadge({ delta }: { delta: number }) {
  const up = delta >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded",
      up ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
         : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
    )}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{delta}%
    </span>
  );
}

function RingKpi({ label, value, color }: { label: string; value: number; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="6" className="stroke-black/10 dark:stroke-white/10" />
        <circle
          cx="36" cy="36" r={r} fill="none" strokeWidth="6"
          stroke={color}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" className="fill-[var(--fg)]">
          {value}%
        </text>
      </svg>
      <p className="text-xs text-[var(--fg-muted)] text-center leading-tight max-w-[72px]">{label}</p>
    </div>
  );
}

function SubjectRow({ s, onClick, expanded }: { s: Subject; onClick: () => void; expanded: boolean }) {
  const rateColor =
    s.passRate >= 85 ? "text-emerald-600 dark:text-emerald-400" :
    s.passRate >= 70 ? "text-amber-600 dark:text-amber-400" :
    "text-rose-600 dark:text-rose-400";
  return (
    <>
      <tr
        className="border-b border-[var(--border)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
        onClick={onClick}
      >
        <td className="py-3 px-4">
          <div className="font-mono text-xs text-[var(--fg-muted)]">{s.code}</div>
          <div className="font-medium text-sm mt-0.5">{s.name}</div>
          {s.faculty && <div className="text-xs text-[var(--fg-muted)] mt-0.5">{s.faculty}</div>}
        </td>
        <td className="py-3 px-4 text-center text-sm">{s.appeared}/{s.enrolled}</td>
        <td className="py-3 px-4">
          <div className={cn("text-center font-bold text-sm", rateColor)}>{s.passRate}%</div>
          <PassRateBar rate={s.passRate} size="sm" />
        </td>
        <td className="py-3 px-4 text-center text-sm">{s.avgMarks}</td>
        <td className="py-3 px-4 text-center">
          {s.trend !== 0 && <TrendBadge delta={s.trend} />}
        </td>
        <td className="py-3 px-4 text-center">
          {s.atRisk > 0 && (
            <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-xs">
              {s.atRisk} at risk
            </Badge>
          )}
        </td>
        <td className="py-3 px-4 text-center text-[var(--fg-muted)]">
          {expanded ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[var(--bg-subtle)]">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[var(--fg-muted)] text-xs mb-1">Highest Marks</p>
                <p className="font-semibold">{s.highest}/100</p>
              </div>
              <div>
                <p className="text-[var(--fg-muted)] text-xs mb-1">Lowest Marks</p>
                <p className="font-semibold text-rose-500">{s.lowest}/100</p>
              </div>
              <div>
                <p className="text-[var(--fg-muted)] text-xs mb-1">Absent Count</p>
                <p className="font-semibold">{s.enrolled - s.appeared}</p>
              </div>
            </div>
            {s.passRate < 70 && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Pass rate below threshold. Recommend scheduling faculty review and student counseling session.</span>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Tabs ──────────────────────────────────────────────── */

type Tab = "overview" | "subjects" | "at-risk" | "trends";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <BarChart2 className="h-4 w-4" /> },
  { id: "subjects", label: "Subjects", icon: <BookOpen className="h-4 w-4" /> },
  { id: "at-risk", label: "At Risk", icon: <AlertTriangle className="h-4 w-4" /> },
  { id: "trends", label: "Trends", icon: <TrendingUp className="h-4 w-4" /> },
];

/* ── Main component ────────────────────────────────────── */

export function DepartmentAcademicsModule({ role }: { role: Role }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [semFilter, setSemFilter] = useState<number | "all">("all");

  const { data: raw, isPending, isError, refetch } = useQuery({
    queryKey: ["department-academics", role],
    queryFn: () => apiFetch("/api/v1/modules/department-academics", DashboardDataSchema as any),
    staleTime: 60_000,
  });

  if (isPending) return <TemplateSkeleton />;

  const d: DeptAcademicsData = (raw as DeptAcademicsData | undefined) ?? DEMO;

  const semesters = Array.from(new Set(d.subjects.map((s) => s.semester))).sort((a, b) => a - b);
  const filtered = semFilter === "all" ? d.subjects : d.subjects.filter((s) => s.semester === semFilter);
  const atRiskSubjects = d.subjects.filter((s) => s.atRisk > 0).sort((a, b) => b.atRisk - a.atRisk);
  const worstSubjects = [...d.subjects].sort((a, b) => a.passRate - b.passRate).slice(0, 3);
  const bestSubjects = [...d.subjects].sort((a, b) => b.passRate - a.passRate).slice(0, 3);

  const overallMaxPassRate = d.semesterSummary.reduce((acc, s) => s.passRate > acc ? s.passRate : acc, 1);
  const overallMaxEnrolled = d.semesterSummary.reduce((acc, s) => s.enrolled > acc ? s.enrolled : acc, 1);

  return (
    <div className="space-y-6 pb-10">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg">{d.department}</h2>
          <p className="text-sm text-[var(--fg-muted)]">{d.exam} &middot; Batch {d.batch}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
          Could not load live data — showing demo data.
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {d.kpis.length > 0
          ? d.kpis.map((k) => (
              <Card key={k.label} className="p-4">
                <p className="text-xs text-[var(--fg-muted)] mb-1">{k.label}</p>
                <p className="text-2xl font-bold">{k.value}</p>
                {k.delta !== undefined && (
                  <div className="mt-1"><TrendBadge delta={k.delta} /></div>
                )}
                {k.note && <p className="text-xs text-[var(--fg-muted)] mt-1">{k.note}</p>}
              </Card>
            ))
          : [
              { label: "Pass Rate", value: `${d.overallPassRate}%`, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
              { label: "Total Students", value: String(d.totalStudents), icon: <Users className="h-5 w-5 text-blue-500" /> },
              { label: "At Risk", value: String(d.atRiskCount), icon: <AlertTriangle className="h-5 w-5 text-rose-500" /> },
              { label: "Avg Marks", value: `${d.avgMarks}/100`, icon: <Award className="h-5 w-5 text-amber-500" /> },
            ].map((k) => (
              <Card key={k.label} className="p-4 flex items-start gap-3">
                {k.icon}
                <div>
                  <p className="text-xs text-[var(--fg-muted)]">{k.label}</p>
                  <p className="text-xl font-bold">{k.value}</p>
                </div>
              </Card>
            ))
        }
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Ring meters */}
          {d.semesterSummary.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4 text-[var(--accent)]" />
                Pass Rate by Semester
              </h3>
              <div className="flex flex-wrap gap-6 justify-around">
                {d.semesterSummary.map((sem) => {
                  const color =
                    sem.passRate >= 85 ? "#10b981" :
                    sem.passRate >= 70 ? "#f59e0b" : "#f43f5e";
                  return (
                    <RingKpi key={sem.sem} label={sem.label} value={sem.passRate} color={color} />
                  );
                })}
              </div>
            </Card>
          )}

          {/* Best / Worst subjects */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" /> Top Subjects
              </h3>
              <div className="space-y-3">
                {bestSubjects.map((s) => (
                  <div key={s.code}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate max-w-[60%]">{s.name}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{s.passRate}%</span>
                    </div>
                    <PassRateBar rate={s.passRate} />
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <TrendingDown className="h-4 w-4" /> Needs Attention
              </h3>
              <div className="space-y-3">
                {worstSubjects.map((s) => (
                  <div key={s.code}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate max-w-[60%]">{s.name}</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">{s.passRate}%</span>
                    </div>
                    <PassRateBar rate={s.passRate} />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Insights */}
          {d.insights.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-[var(--accent)]" />
                Key Insights
              </h3>
              <ul className="space-y-2">
                {d.insights.map((ins, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[var(--fg-muted)]">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                    {ins}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* ── Subjects ── */}
      {tab === "subjects" && (
        <div className="space-y-4">
          {/* Semester filter */}
          {semesters.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSemFilter("all")}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  semFilter === "all"
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)]"
                )}
              >
                All Semesters
              </button>
              {semesters.map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSemFilter(sem)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    semFilter === sem
                      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)]"
                  )}
                >
                  Sem {sem}
                </button>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg-muted)] text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-left">Subject</th>
                  <th className="py-3 px-4 text-center">Appeared</th>
                  <th className="py-3 px-4 text-center">Pass Rate</th>
                  <th className="py-3 px-4 text-center">Avg</th>
                  <th className="py-3 px-4 text-center">Trend</th>
                  <th className="py-3 px-4 text-center">At Risk</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <SubjectRow
                    key={s.code}
                    s={s}
                    expanded={expandedRow === s.code}
                    onClick={() => setExpandedRow(expandedRow === s.code ? null : s.code)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-sm text-[var(--fg-muted)] py-8">No subjects for this semester.</p>
          )}
        </div>
      )}

      {/* ── At Risk ── */}
      {tab === "at-risk" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>{d.atRiskCount > 0 ? d.atRiskCount : atRiskSubjects.reduce((a, s) => a + s.atRisk, 0)} students</strong> across {atRiskSubjects.length} subjects are at risk of failing.
            </span>
          </div>

          {atRiskSubjects.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-medium">No students at risk</p>
              <p className="text-sm text-[var(--fg-muted)] mt-1">All subjects are performing above threshold.</p>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {atRiskSubjects.map((s) => (
                <Card key={s.code} className="p-4 border-l-4 border-l-rose-400">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className="text-xs text-[var(--fg-muted)]">{s.code} {s.faculty ? `· ${s.faculty}` : ""}</p>
                    </div>
                    <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-xs shrink-0">
                      {s.atRisk} students
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-xs text-[var(--fg-muted)] mb-2">
                    <span>Pass Rate: <strong className="text-rose-500">{s.passRate}%</strong></span>
                    <span>Avg: <strong>{s.avgMarks}/100</strong></span>
                    <span>Low: <strong>{s.lowest}/100</strong></span>
                  </div>
                  <PassRateBar rate={s.passRate} />
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Trends ── */}
      {tab === "trends" && (
        <div className="space-y-5">
          {/* Semester trend bar chart */}
          {d.semesterSummary.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Semester-wise Pass Rate</h3>
              <div className="space-y-3">
                {d.semesterSummary.map((sem) => {
                  const pct = overallMaxPassRate > 0 ? (sem.passRate / overallMaxPassRate) * 100 : sem.passRate;
                  const color =
                    sem.passRate >= 85 ? "bg-emerald-500" :
                    sem.passRate >= 70 ? "bg-amber-500" : "bg-rose-500";
                  return (
                    <div key={sem.sem} className="flex items-center gap-3 text-sm">
                      <span className="w-14 text-right text-[var(--fg-muted)] shrink-0">{sem.label}</span>
                      <div className="flex-1 bg-black/10 dark:bg-white/10 rounded-full h-4 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all flex items-center pl-2", color)}
                          style={{ width: `${pct}%` }}
                        >
                          <span className="text-white text-xs font-bold">{sem.passRate}%</span>
                        </div>
                      </div>
                      <span className="text-xs text-[var(--fg-muted)] w-16 shrink-0">{sem.enrolled} enrolled</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Subject trend movers */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Subject Trend (vs Last Semester)</h3>
            <div className="space-y-2">
              {[...d.subjects]
                .filter((s) => s.trend !== 0)
                .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend))
                .map((s) => (
                  <div key={s.code} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 truncate">{s.name}</span>
                    <TrendBadge delta={s.trend} />
                  </div>
                ))}
              {d.subjects.filter((s) => s.trend !== 0).length === 0 && (
                <p className="text-sm text-[var(--fg-muted)]">No trend data available.</p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
