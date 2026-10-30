import "server-only";
import { ALL_COLLEGES } from "@/config/tenancy";
import { meetsDrive, packageText } from "@/lib/api/drive-schemas";
import type { ChartSpec, DashboardData, Insight, Kpi, RoleHome } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { todayIst } from "./drives";
import { driveStore, type DriveRow } from "./drive-store";
import { computeReadiness, type Readiness } from "./learning";
import { listColleges } from "./records";

/*
 * One live picture of placement for a college: the readiness board (every student's measured scores) next to the
 * placement drives (registered, shortlisted, offers, packages). The Placement Analytics page and the placement
 * home both read from here, so the two can never disagree, and neither holds a hand-typed number.
 */

export interface DeptStat {
  name: string;
  students: number;
  ready: number;
  readiness: number;
  interview: number;
}

export interface PlacementSnapshot {
  /** True when the scope spans every college: drive figures are per college, so they are left out. */
  allColleges: boolean;
  today: string;
  students: Readiness[];
  drives: DriveRow[];
  counts: { total: number; ready: number; almost: number; needs: number };
  avgReadiness: number;
  /** Share of students whose resume scores 70+ (the same bar the readiness gaps use). */
  resumePct: number;
  /** Share of students who have taken at least one mock interview. */
  interviewPct: number;
  avgInterview: number;
  weakest: { label: string; pct: number } | null;
  strongest: { label: string; pct: number } | null;
  departments: DeptStat[];
  drivesSummary: {
    total: number;
    draft: number;
    open: number;
    upcoming: number;
    completed: number;
    registered: number;
    shortlisted: number;
    offers: number;
    averagePackage: number | null;
    highestPackage: number | null;
  };
  offersByCompany: Array<{ name: string; Offers: number }>;
  byMonth: Array<{ name: string; Registered: number; Offers: number }>;
  nextDrives: Array<{ drive: DriveRow; eligible: number }>;
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export const shortDept = (name: string): string => {
  const s = name
    .replace(/^Department of\s+/i, "")
    .replace(/Engineering/gi, "Eng.")
    .replace(/Technology/gi, "Tech.")
    .replace(/\s+/g, " ")
    .trim();
  return (s || "General").slice(0, 24);
};

async function loadStudents(scope: string): Promise<Readiness[]> {
  const store = getStore();
  if (scope !== ALL_COLLEGES) return (await store.readiness.board(scope)).map(computeReadiness);
  const out: Readiness[] = [];
  for (const c of await listColleges()) out.push(...(await store.readiness.board(String(c.id))).map(computeReadiness));
  return out;
}

async function loadDrives(session: SessionPayload, scope: string): Promise<DriveRow[]> {
  if (scope !== ALL_COLLEGES) {
    try {
      return await driveStore().list({ ...session, college: scope });
    } catch (e) {
      console.warn("[placement-stats] drives unavailable:", e);
      return [];
    }
  }
  const out: DriveRow[] = [];
  try {
    for (const c of await listColleges()) {
      try {
        const rows = await driveStore().list({ ...session, college: String(c.id) });
        out.push(...rows);
      } catch {}
    }
  } catch (e) {
    console.warn("[placement-stats] drives unavailable across colleges:", e);
  }
  return out;
}

const DIMENSIONS: Array<{ label: string; of: (r: Readiness) => number }> = [
  { label: "Quiz average", of: (r) => r.quizAverage },
  { label: "Certificates", of: (r) => (Math.min(r.certificates, 4) / 4) * 100 },
  { label: "Aptitude", of: (r) => r.aptitude },
  { label: "Mock interview", of: (r) => r.interview },
  { label: "Resume", of: (r) => r.resume },
];

export async function placementSnapshot(session: SessionPayload, scope: string): Promise<PlacementSnapshot> {
  const today = todayIst();
  const [students, drives] = await Promise.all([loadStudents(scope), loadDrives(session, scope)]);

  const counts = {
    total: students.length,
    ready: students.filter((s) => s.status === "Placement ready").length,
    almost: students.filter((s) => s.status === "Almost ready").length,
    needs: students.filter((s) => s.status === "Needs work").length,
  };

  const taken = students.filter((s) => s.interview > 0);
  const dims = DIMENSIONS.map((d) => ({ label: d.label, pct: avg(students.map(d.of)) }));
  const ranked = students.length ? [...dims].sort((a, b) => a.pct - b.pct) : [];

  const byDept = new Map<string, Readiness[]>();
  for (const s of students) byDept.set(s.department || "General", [...(byDept.get(s.department || "General") ?? []), s]);
  const departments: DeptStat[] = [...byDept.entries()]
    .map(([name, rows]) => ({
      name: shortDept(name),
      students: rows.length,
      ready: rows.filter((r) => r.status === "Placement ready").length,
      readiness: avg(rows.map((r) => r.total)),
      interview: avg(rows.map((r) => r.interview)),
    }))
    .sort((a, b) => b.readiness - a.readiness);

  const counted = drives.filter((d) => d.status !== "Cancelled");
  const held = counted.filter((d) => d.status !== "Draft");
  const completed = counted.filter((d) => d.status === "Completed");
  const priced = completed.filter((d) => d.packageMax > 0);
  const withOffers = counted.filter((d) => d.offers > 0 && d.packageMax > 0);

  const company = new Map<string, number>();
  for (const d of counted) if (d.offers > 0) company.set(d.company, (company.get(d.company) ?? 0) + d.offers);

  const months = new Map<string, { Registered: number; Offers: number }>();
  for (const d of held) {
    const key = d.date.slice(0, 7);
    const m = months.get(key) ?? { Registered: 0, Offers: 0 };
    m.Registered += d.registered;
    m.Offers += d.offers;
    months.set(key, m);
  }
  const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

  const nextDrives = counted
    .filter((d) => (d.status === "Open" || d.status === "Draft") && d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company))
    .slice(0, 3)
    .map((drive) => ({ drive, eligible: students.filter((s) => meetsDrive(drive, s)).length }));

  return {
    allColleges: scope === ALL_COLLEGES,
    today,
    students,
    drives,
    counts,
    avgReadiness: avg(students.map((s) => s.total)),
    resumePct: pct(students.filter((s) => s.resume >= 70).length, students.length),
    interviewPct: pct(taken.length, students.length),
    avgInterview: avg(taken.map((s) => s.interview)),
    weakest: ranked[0] ?? null,
    strongest: ranked.length ? ranked[ranked.length - 1]! : null,
    departments,
    drivesSummary: {
      total: counted.length,
      draft: counted.filter((d) => d.status === "Draft").length,
      open: counted.filter((d) => d.status === "Open").length,
      upcoming: counted.filter((d) => (d.status === "Draft" || d.status === "Open") && d.date >= today).length,
      completed: completed.length,
      registered: held.reduce((n, d) => n + d.registered, 0),
      shortlisted: held.reduce((n, d) => n + d.shortlisted, 0),
      offers: counted.reduce((n, d) => n + d.offers, 0),
      averagePackage: priced.length ? Math.round((priced.reduce((n, d) => n + (d.packageMin + d.packageMax) / 2, 0) / priced.length) * 10) / 10 : null,
      highestPackage: withOffers.length ? Math.max(...withOffers.map((d) => d.packageMax)) : null,
    },
    offersByCompany: [...company.entries()]
      .map(([name, Offers]) => ({ name, Offers }))
      .sort((a, b) => b.Offers - a.Offers || a.name.localeCompare(b.name))
      .slice(0, 8),
    byMonth: [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, v]) => ({ name: monthLabel(key), ...v })),
    nextDrives,
  };
}

/* ── pieces both pages use ─────────────────────────────── */

const chart = (type: ChartSpec["type"], title: string, data: ChartSpec["data"], series: string[]): ChartSpec => ({ type, title, data, series, xKey: "name" });
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function offersChart(s: PlacementSnapshot): ChartSpec {
  return chart("bar", "Offers by company", s.offersByCompany.length ? s.offersByCompany : [{ name: "No offers yet", Offers: 0 }], ["Offers"]);
}

export function departmentChart(s: PlacementSnapshot): ChartSpec {
  return chart(
    "bar",
    "Readiness and mock interview by department",
    s.departments.length ? s.departments.map((d) => ({ name: d.name, Readiness: d.readiness, Interview: d.interview })) : [{ name: "No students yet", Readiness: 0, Interview: 0 }],
    ["Readiness", "Interview"],
  );
}

const gapKind = (gap: string): string | null =>
  gap.startsWith("Raise your quiz") ? "quiz average" : gap.startsWith("Earn") ? "certificates" : gap.startsWith("Score") ? "mock interview" : gap.startsWith("Complete your resume") ? "resume" : null;

export function placementInsights(s: PlacementSnapshot): Insight[] {
  const out: Insight[] = [];
  const n = s.counts.total;
  if (n > 0 && s.weakest && s.strongest && s.weakest.label !== s.strongest.label) {
    out.push({
      title: `${s.weakest.label} is the weakest readiness area`,
      body: `Students average ${s.weakest.pct}% in ${s.weakest.label.toLowerCase()}, against ${s.strongest.pct}% in ${s.strongest.label.toLowerCase()}. Targeted practice here lifts the most students toward placement ready.`,
      evidence: `${n} students on the readiness board`,
      tone: s.weakest.pct < 60 ? "amber" : "sky",
    });
  }
  if (s.counts.almost > 0) {
    const tally = new Map<string, number>();
    for (const st of s.students) if (st.status === "Almost ready") for (const g of st.gaps) { const k = gapKind(g); if (k) tally.set(k, (tally.get(k) ?? 0) + 1); }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({
      title: `${s.counts.almost} student${s.counts.almost === 1 ? " is" : "s are"} close to placement ready`,
      body: top ? `The most common gap among them is ${top[0]} (${top[1]} student${top[1] === 1 ? "" : "s"}). A short push there moves them onto the shortlist.` : "A small improvement in any score moves them onto the shortlist.",
      evidence: "Almost ready = total 55–69 or one criterion missing",
      tone: "teal",
    });
  }
  const depts = s.departments.filter((d) => d.students >= 2);
  if (depts.length >= 2) {
    const low = depts[depts.length - 1]!;
    const top = depts[0]!;
    if (top.readiness - low.readiness >= 5) {
      out.push({
        title: `${low.name} trails the other departments`,
        body: `${low.name} averages ${low.readiness} readiness with ${low.ready} of ${low.students} placement ready, against ${top.readiness} in ${top.name}.`,
        evidence: "Department averages of the readiness total",
        tone: "rose",
      });
    }
  }
  const next = s.nextDrives[0];
  if (next) {
    const { drive, eligible } = next;
    const thin = eligible > 0 && drive.registered < eligible / 2;
    out.push({
      title: thin ? `${drive.company} registrations are behind` : `${drive.company} is next on the calendar`,
      body: `${eligible} student${eligible === 1 ? " meets" : "s meet"} the rules for the ${dateLabel(drive.date)} drive and ${drive.registered} registered.${thin ? " Remind eligible students before registration closes." : ""}`,
      evidence: `${drive.role} · ${packageText(drive.packageMin, drive.packageMax)}`,
      tone: thin ? "amber" : "brand",
    });
  } else if (!s.allColleges && s.drives.length === 0) {
    out.push({ title: "No drives scheduled yet", body: "Offers, packages and the hiring funnel appear here as soon as the first drive is saved in Placement Drives.", evidence: "Placement Drives", tone: "sky" });
  }
  return out.slice(0, 4);
}

/* ── Placement Analytics page ──────────────────────────── */

export function analyticsDashboard(s: PlacementSnapshot): DashboardData {
  const d = s.drivesSummary;
  const none = s.counts.total === 0;
  const kpis: Kpi[] = [
    { label: "Placement readiness", value: none ? "–" : `${s.avgReadiness}%`, delta: none ? undefined : `${s.counts.ready} of ${s.counts.total} placement ready`, tone: "teal" },
    { label: "Offers", value: s.allColleges ? "–" : String(d.offers), delta: s.allColleges ? "Pick a college to see drives" : `${d.completed} drive${d.completed === 1 ? "" : "s"} completed`, tone: "gold" },
    { label: "Average package", value: d.averagePackage === null ? "–" : `₹${d.averagePackage} LPA`, hint: "Completed drives, mid-point of the range", delta: d.highestPackage ? `Highest ₹${d.highestPackage} LPA` : undefined, tone: "brand" },
    { label: "Resume completion", value: none ? "–" : `${s.resumePct}%`, hint: "Resume ATS score of 70 or more", tone: "brand" },
    { label: "Mock interview participation", value: none ? "–" : `${s.interviewPct}%`, delta: s.interviewPct ? `Average score ${s.avgInterview}` : undefined, tone: "teal" },
    { label: "Registered to offer", value: d.registered ? `${pct(d.offers, d.registered)}%` : "–", delta: d.registered ? `${d.offers} of ${d.registered} registered` : undefined, tone: "sky" },
  ];

  const bands = [
    { name: "0–39", Students: 0 },
    { name: "40–54", Students: 0 },
    { name: "55–69", Students: 0 },
    { name: "70–84", Students: 0 },
    { name: "85–100", Students: 0 },
  ];
  for (const st of s.students) bands[st.total >= 85 ? 4 : st.total >= 70 ? 3 : st.total >= 55 ? 2 : st.total >= 40 ? 1 : 0]!.Students++;

  const charts: ChartSpec[] = [
    offersChart(s),
    departmentChart(s),
    chart(
      "bar",
      "Hiring funnel",
      [
        { name: "Registered", Students: d.registered },
        { name: "Shortlisted", Students: d.shortlisted },
        { name: "Offers", Students: d.offers },
      ],
      ["Students"],
    ),
    chart("line", "Registrations and offers by drive month", s.byMonth.length ? s.byMonth : [{ name: "No drives yet", Registered: 0, Offers: 0 }], ["Registered", "Offers"]),
    chart(
      "donut",
      "Readiness status",
      [
        { name: "Placement ready", value: s.counts.ready },
        { name: "Almost ready", value: s.counts.almost },
        { name: "Needs work", value: s.counts.needs },
      ],
      ["value"],
    ),
    chart("bar", "Readiness score distribution", bands, ["Students"]),
  ];

  return { template: "dashboard", kpis, charts, insights: placementInsights(s) };
}

/* ── Placement home ────────────────────────────────────── */

export function placementHome(base: RoleHome, s: PlacementSnapshot): RoleHome {
  const d = s.drivesSummary;
  const queue: RoleHome["queue"] = s.nextDrives.map(({ drive, eligible }) => ({
    title: `${drive.company} drive${drive.status === "Draft" ? " (draft)" : ""} — shortlist`,
    meta: `${dateLabel(drive.date)} · ${eligible} eligible · ${drive.registered} registered`,
    href: "/placement/drives",
    tone: drive.status === "Draft" ? "amber" : "brand",
  }));
  if (s.counts.needs > 0) {
    queue.push({ title: `${s.counts.needs} student${s.counts.needs === 1 ? "" : "s"} need work`, meta: "Open the readiness board to see their gaps", href: "/placement/placement-board", tone: "rose" });
  }
  if (d.draft > 0 && s.nextDrives.every((n) => n.drive.status !== "Draft")) {
    queue.push({ title: `${d.draft} draft drive${d.draft === 1 ? "" : "s"} to publish`, meta: "Open registrations when ready", href: "/placement/drives", tone: "amber" });
  }
  if (!queue.length) queue.push({ title: "Schedule your first drive", meta: "Eligibility is worked out as soon as you save it", href: "/placement/drives", tone: "brand" });

  return {
    ...base,
    kpis: [
      { label: "Offers", value: String(d.offers), delta: `${d.completed} drive${d.completed === 1 ? "" : "s"} completed`, tone: "gold" },
      { label: "Placement ready", value: String(s.counts.ready), delta: `of ${s.counts.total} students`, tone: "brand" },
      { label: "Readiness", value: s.counts.total ? `${s.avgReadiness}%` : "–", tone: "teal" },
      { label: "Upcoming drives", value: String(d.upcoming), delta: d.open ? `${d.open} open now` : undefined, tone: "sky" },
    ],
    charts: [offersChart(s), departmentChart(s)],
    insights: placementInsights(s),
    queue: queue.slice(0, 5),
  };
}
