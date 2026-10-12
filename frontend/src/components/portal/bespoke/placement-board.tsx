"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import { DriveOverview, meetsDrive, packageText } from "@/lib/api/drive-schemas";
import { ReadinessBoard, type Readiness } from "@/lib/api/learning-schemas";
import { toCsv } from "@/lib/csv";
import { LIVE_REFRESH_MS, PLACEMENT_KEYS } from "@/lib/placement-cache";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Progress, inputClass, toneForScore } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/api/schemas";

const STATUS_TONE: Record<Readiness["status"], Tone> = { "Placement ready": "teal", "Almost ready": "amber", "Needs work": "rose" };
const PAGE = 100;

type SortKey = "name" | "quizAverage" | "certificates" | "aptitude" | "interview" | "resume" | "total";
const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Student" },
  { key: "quizAverage", label: "Quiz avg" },
  { key: "certificates", label: "Certs" },
  { key: "aptitude", label: "Aptitude" },
  { key: "interview", label: "Interview" },
  { key: "resume", label: "Resume" },
  { key: "total", label: "Total" },
];

const dateText = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The placement officer's readiness board. It re-checks every 30 seconds and when the tab is shown again, so a student
 * finishing a quiz or a drive being saved shows up without a reload, and any open or upcoming drive can be picked to
 * see exactly who meets its rules.
 */
export function PlacementBoardModule() {
  const q = useQuery({
    queryKey: PLACEMENT_KEYS.board,
    queryFn: () => apiFetch("/api/v1/placement/board", ReadinessBoard),
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });
  const dq = useQuery({
    queryKey: PLACEMENT_KEYS.drives,
    queryFn: () => apiFetch("/api/v1/drives", DriveOverview),
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });
  const pathname = usePathname() ?? "";
  const canOpenDrives = pathname.startsWith("/placement");

  const [status, setStatus] = useState<"All" | Readiness["status"]>("All");
  const [dept, setDept] = useState("All");
  const [search, setSearch] = useState("");
  const [driveId, setDriveId] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });
  const [limit, setLimit] = useState(PAGE);

  const drives = useMemo(() => (dq.data?.items ?? []).filter((d) => d.status !== "Cancelled" && d.status !== "Completed"), [dq.data]);
  // A drive that was completed, cancelled or deleted while it was selected stops filtering.
  const drive = drives.find((d) => d.id === driveId);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = (q.data?.rows ?? []).filter(
      (r) => (status === "All" || r.status === status) && (dept === "All" || r.department === dept) && (!s || r.name.toLowerCase().includes(s)) && (!drive || meetsDrive(drive, r)),
    );
    const sign = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => sign * (sort.key === "name" ? a.name.localeCompare(b.name) : a[sort.key] - b[sort.key]) || b.total - a.total || a.name.localeCompare(b.name));
  }, [q.data, status, dept, search, drive, sort]);

  if (q.isLoading) return <TemplateSkeleton />;
  if (!q.data) return <EmptyState title="Board unavailable" body={q.error instanceof ApiError ? q.error.message : undefined} />;
  const all = q.data.rows;
  const rules = q.data.rules;
  const count = (s: Readiness["status"]) => all.filter((r) => r.status === s).length;
  const average = all.length ? Math.round(all.reduce((n, r) => n + r.total, 0) / all.length) : 0;
  const depts = [...new Set(all.map((r) => r.department))].sort();
  const multiCollege = new Set(all.map((r) => r.collegeId)).size > 1;
  const shown = rows.slice(0, limit);

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" }));
    setLimit(PAGE);
  };

  const exportCsv = () => {
    const csv = toCsv([
      ["Name", "Roll no (masked)", ...(multiCollege ? ["College"] : []), "Department", "Quiz avg %", "Certificates", "Aptitude", "Interview", "Resume", "Total", "Status"],
      ...rows.map((r) => [r.name, r.rollNo, ...(multiCollege ? [r.collegeName ?? ""] : []), r.department, r.quizAverage, r.certificates, r.aptitude, r.interview, r.resume, r.total, r.status]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `placement-shortlist${drive ? `-${slug(drive.company)}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshNow = () => {
    void q.refetch();
    void dq.refetch();
  };
  const busy = q.isFetching || dq.isFetching;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3 text-xs text-ink-3" aria-live="polite">
        <span>Live · updated {new Date(q.dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        <Button variant="secondary" onClick={refreshNow} disabled={busy}>
          <RefreshCw className={cn("size-3.5", busy && "animate-spin")} aria-hidden /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        {[
          { label: "Students tracked", value: String(all.length), icon: "users" },
          { label: "Placement ready", value: String(count("Placement ready")), icon: "badge-check" },
          { label: "Almost ready", value: String(count("Almost ready")), icon: "hourglass-end" },
          { label: "Needs work", value: String(count("Needs work")), icon: "triangle-warning" },
          { label: "Average total", value: all.length ? String(average) : "–", icon: "chart-line-up" },
        ].map((k) => (
          <Card key={k.label} className="p-5">
            <p className="flex items-center gap-2 text-sm text-ink-3">
              <Fi name={k.icon} /> {k.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{k.value}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4 text-sm text-ink-2">
        <b className="text-ink">Placement ready</b> = total ≥ {rules.minTotal}, quiz average ≥ {rules.minQuizAverage}%, ≥ {rules.minCertificates} certificates and mock interview ≥ {rules.minInterview}. Total =
        quiz 35% + certificates 20% + aptitude 15% + interview 15% + resume 15%.
      </Card>
      <Card>
        <CardHeader
          title="Readiness board"
          subtitle="Roll numbers masked · export only what a drive needs"
          action={
            <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
              <Fi name="download" /> Export shortlist (CSV)
            </Button>
          }
        />
        <CardBody>
          <div className="mb-4 flex flex-wrap gap-3">
            <label htmlFor="pb-search" className="sr-only">
              Search students
            </label>
            <input
              id="pb-search"
              className={`${inputClass} max-w-xs`}
              placeholder="Search student"
              maxLength={80}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE);
              }}
            />
            <label htmlFor="pb-status" className="sr-only">
              Status
            </label>
            <select id="pb-status" className={`${inputClass} w-auto!`} value={status} onChange={(e) => (setStatus(e.target.value as typeof status), setLimit(PAGE))}>
              {["All", "Placement ready", "Almost ready", "Needs work"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <label htmlFor="pb-dept" className="sr-only">
              Department
            </label>
            <select id="pb-dept" className={`${inputClass} w-auto! max-w-xs`} value={dept} onChange={(e) => (setDept(e.target.value), setLimit(PAGE))}>
              <option>All</option>
              {depts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            {drives.length ? (
              <>
                <label htmlFor="pb-drive" className="sr-only">
                  Eligible for drive
                </label>
                <select id="pb-drive" className={`${inputClass} w-auto! max-w-sm`} value={drive?.id ?? ""} onChange={(e) => (setDriveId(e.target.value), setLimit(PAGE))}>
                  <option value="">Any drive</option>
                  {drives.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.company} · {d.role} · {dateText(d.date)} ({d.eligible} eligible)
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </div>

          {drive ? (
            <div className="mb-4 rounded-xl bg-brand-soft p-4 text-sm text-ink-2">
              <p className="font-medium text-ink">
                Eligible for {drive.company} · {drive.role}
              </p>
              <p className="mt-0.5">
                {drive.departments.length ? drive.departments.join(", ") : "All departments"} · readiness {drive.minReadiness ? `${drive.minReadiness}+` : "any"} · {packageText(drive.packageMin, drive.packageMax)} ·{" "}
                {drive.registered} registered
                {canOpenDrives ? (
                  <>
                    {" · "}
                    <Link href="/placement/drives" className="font-medium text-brand hover:underline">
                      Open drive
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <EmptyState title="No students match" body={all.length ? "Try a different status, department or drive." : "Students appear here once they take quizzes or earn certificates."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="py-2 pr-3 font-medium" aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink">
                          {c.label}
                          {sort.key === c.key ? sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : null}
                        </button>
                      </th>
                    ))}
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.studentSub} className="border-b border-line/60 last:border-0 align-top">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-ink">{r.name}</p>
                        <p className="text-xs text-ink-3">
                          {r.rollNo} · {r.department}
                          {multiCollege ? ` · ${r.collegeName}` : ""}
                        </p>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{r.quizAverage}%</td>
                      <td className="py-3 pr-3 tabular-nums">{r.certificates}</td>
                      <td className="py-3 pr-3 tabular-nums">{r.aptitude}</td>
                      <td className="py-3 pr-3 tabular-nums">{r.interview}</td>
                      <td className="py-3 pr-3 tabular-nums">{r.resume}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 font-semibold tabular-nums text-ink">{r.total}</span>
                          <Progress value={r.total} tone={toneForScore(r.total)} className="w-20" label={`${r.name} total`} />
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                        {r.gaps.length ? <p className="mt-1 max-w-[220px] text-xs text-ink-3">{r.gaps[0]}</p> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
            <span>
              Showing {shown.length} of {rows.length}
              {rows.length !== all.length ? ` (filtered from ${all.length})` : ""}
            </span>
            {rows.length > shown.length ? (
              <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
                Show {Math.min(PAGE, rows.length - shown.length)} more
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
