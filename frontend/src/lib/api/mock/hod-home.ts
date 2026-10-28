import "server-only";

import { RESOURCES } from "@/config/resources";
import type { ChartSpec, Insight, Kpi, RoleHome } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { resolveUserDepartment } from "@/lib/auth/department";
import { getStore } from "@/lib/data";
import { formatNumber } from "@/lib/utils";
import { computeReadiness } from "./learning";
import { getEarlyWarningOverview, resolveCollegeId } from "./early-warning";
import { getCollege } from "./records";
import { getStudentsList } from "./students-store";
import { listProjects } from "./projects";

type QueueItem = RoleHome["queue"][number];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const short = (s: string, n = 10) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * The HOD home, computed from the department's own records: its students and their readiness, the quiz
 * results of its courses, open early-warning cases, project reviews and teaching staff. Nothing is fixed
 * text; a department with no data shows dashes and an honest empty state.
 */
export async function dynamicHodHome(session: SessionPayload): Promise<RoleHome> {
  const collegeId = await resolveCollegeId(session.college);
  const [dept, college] = await Promise.all([resolveUserDepartment(session), getCollege(collegeId)]);
  const store = getStore();
  const inDept = (d: unknown) => !dept || same(String(d ?? ""), dept);

  const [board, students, staff, courses, quizzes, attempts, early, projects] = await Promise.all([
    store.readiness.board(collegeId),
    getStudentsList({ collegeId, ...(dept ? { department: dept } : {}) }),
    store.records.all(RESOURCES.staff!, collegeId),
    store.records.all(RESOURCES.courses!, collegeId),
    store.quizzes.list(collegeId),
    store.attempts.list({ collegeId }),
    getEarlyWarningOverview(session, dept ?? "all").catch(() => null),
    listProjects({ ...session, college: collegeId }).catch(() => []),
  ]);

  const cohort = board.map(computeReadiness).filter((s) => inDept(s.department));
  const faculty = staff.filter((s) => s.status === "Active" && (s.staffType === "Teaching" || !s.staffType) && inDept(s.department));
  const deptCourses = courses.filter((c) => inDept(c.department));
  const activeCourses = deptCourses.filter((c) => c.status === "Active").length;

  // Pass % per course: a student passes a quiz when their best attempt reaches its pass mark.
  const byQuiz = new Map<string, { course: string; pass: number; total: number }>();
  for (const q of quizzes.filter((x) => inDept(x.department))) {
    const best = new Map<string, number>();
    for (const a of attempts.filter((t) => t.quizId === q.id)) best.set(a.studentSub, Math.max(best.get(a.studentSub) ?? 0, a.percentage));
    if (best.size === 0) continue;
    const row = byQuiz.get(q.course) ?? { course: q.course, pass: 0, total: 0 };
    for (const p of best.values()) {
      row.total += 1;
      if (p >= q.passMark) row.pass += 1;
    }
    byQuiz.set(q.course, row);
  }
  const passRows = [...byQuiz.values()].map((r) => ({ course: r.course, pct: Math.round((r.pass / r.total) * 100), n: r.total }));
  const totalPass = [...byQuiz.values()].reduce((a, r) => a + r.pass, 0);
  const totalTaken = [...byQuiz.values()].reduce((a, r) => a + r.total, 0);
  const passPct = totalTaken ? Math.round((totalPass / totalTaken) * 100) : null;

  const readiness = cohort.length ? avg(cohort.map((s) => s.total)) : null;
  const readyCount = cohort.filter((s) => s.status === "Placement ready").length;
  const almost = cohort.filter((s) => s.status === "Almost ready").length;
  const needs = cohort.filter((s) => s.status === "Needs work").length;

  const flagged = early?.students.filter((s) => s.riskLevel === "Critical" || s.riskLevel === "Moderate") ?? [];
  const pendingFlags = flagged.filter((s) => s.reviewStatus === "Pending review");
  const critical = pendingFlags.filter((s) => s.riskLevel === "Critical").length;
  const pendingProjects = projects.filter((p) => p.status === "Active" && !p.review?.facultyApproved && (p.stage === "AI Review" || p.stage === "Faculty Review")).length;

  const kpis: Kpi[] = [
    { label: "Students", value: formatNumber(students.length), hint: dept ?? "All departments", tone: "brand" },
    {
      label: "Pass percentage",
      value: passPct === null ? "—" : `${passPct}%`,
      delta: passPct === null ? "No quiz attempts yet" : `${totalTaken} student results`,
      tone: passPct === null ? "neutral" : passPct >= 85 ? "teal" : passPct >= 70 ? "sky" : "amber",
    },
    {
      label: "Placement readiness",
      value: readiness === null ? "—" : `${readiness}%`,
      delta: readiness === null ? "No active cohort" : `${readyCount} placement ready`,
      tone: readiness === null ? "neutral" : readiness >= 70 ? "teal" : readiness >= 55 ? "gold" : "amber",
    },
    { label: "Teaching faculty", value: String(faculty.length), delta: `${activeCourses} active course${activeCourses === 1 ? "" : "s"}`, tone: "sky" },
  ];

  const passChart: ChartSpec = {
    type: "bar",
    title: "Pass % by course",
    xKey: "name",
    series: ["Pass %"],
    data: passRows.length ? passRows.slice(0, 8).map((r) => ({ name: short(r.course), "Pass %": r.pct })) : [{ name: "No results yet", "Pass %": 0 }],
  };
  const readinessChart: ChartSpec = {
    type: "donut",
    title: "Placement readiness of the department",
    xKey: "name",
    series: ["value"],
    data: cohort.length
      ? [
          { name: "Placement ready", value: readyCount },
          { name: "Almost ready", value: almost },
          { name: "Needs work", value: needs },
        ].filter((d) => d.value > 0)
      : [{ name: "No students yet", value: 1 }],
  };

  const queue: QueueItem[] = [];
  if (pendingFlags.length > 0) {
    queue.push({
      title: `Early-warning reviews (${pendingFlags.length})`,
      meta: critical > 0 ? `${critical} critical · pending faculty/counsellor review` : "Pending faculty/counsellor review",
      href: "/hod/early-warning",
      tone: critical > 0 ? "rose" : "amber",
    });
  }
  if (pendingProjects > 0) {
    queue.push({
      title: `Approve project reviews (${pendingProjects})`,
      meta: "AI Project Review Board",
      href: "/hod/project-review",
      tone: "brand",
    });
  }
  if (cohort.length > 0) {
    queue.push({ title: "Department skill report", meta: `${needs} student${needs === 1 ? "" : "s"} need skill support`, href: "/hod/department-skills", tone: "teal" });
  }
  if (queue.length === 0) {
    queue.push({ title: "Department skill report", meta: "Nothing pending — review skills and interventions", href: "/hod/department-skills", tone: "teal" });
  }

  const insights: Insight[] = [];
  const weakest = [...passRows].filter((r) => r.n >= 3).sort((a, b) => a.pct - b.pct)[0];
  if (weakest && weakest.pct < 85) {
    insights.push({
      title: `${weakest.course} has the lowest pass rate`,
      body: `${weakest.pct}% of ${weakest.n} students passed. Consider a revision session or faculty review.`,
      evidence: "Quiz results of the department's courses",
      tone: weakest.pct < 60 ? "rose" : "amber",
    });
  }
  if (cohort.length >= 3) {
    const parts = [
      { k: "quiz average", v: avg(cohort.map((s) => s.quizAverage)) },
      { k: "aptitude", v: avg(cohort.map((s) => s.aptitude)) },
      { k: "mock interview", v: avg(cohort.map((s) => s.interview)) },
      { k: "resume", v: avg(cohort.map((s) => s.resume)) },
    ].sort((a, b) => a.v - b.v);
    const low = parts[0]!;
    insights.push({
      title: `Weakest readiness area: ${low.k}`,
      body: `The department averages ${low.v}% on ${low.k}. ${needs} of ${cohort.length} students are still in "Needs work".`,
      evidence: "Placement readiness board",
      tone: low.v < 50 ? "rose" : "amber",
    });
  }
  if (insights.length === 0) {
    insights.push({
      title: "Nothing to report yet",
      body: "Insights appear once students in the department attempt quizzes or build their readiness profile.",
      evidence: "No department results yet",
      tone: "sky",
    });
  }

  const collegeName = String(college?.name ?? "College");
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const deptLabel = dept ? (dept.startsWith("Department of") ? dept : `Department of ${dept}`) : collegeName;
  return {
    greeting: `${hello}, ${session.name} · ${deptLabel}`,
    department: dept ?? undefined,
    kpis,
    charts: [passChart, readinessChart],
    insights,
    queue,
  };
}
