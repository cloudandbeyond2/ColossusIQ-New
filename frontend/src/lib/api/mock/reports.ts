import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import type {
  CreateReportInput,
  CreateScheduleInput,
  ReportBreakdownItem,
  ReportCategory,
  ReportItem,
  ReportKpi,
  ReportsOverview,
  ScheduledReport,
} from "@/lib/api/schemas";
import { getStore } from "@/lib/data";
import { reportsData, type Frequency, type ReportMetrics, type ReportRow, type ScheduleRow } from "./reports-data";
import { listColleges } from "./records";

/*
 * Institutional reports. A report is a snapshot of the college's real records (students, staff, courses, quizzes,
 * placement drives) taken when it was compiled, so it never changes afterwards. Nothing is estimated: a figure the
 * college has no data for is shown as "no data", never made up. Schedules compile a new report each time they fall due.
 */

export class ReportError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const GENERATE_ROLES = new Set(["faculty", "hod", "placement", "institution", "admin"]);
const SCHEDULE_ROLES = new Set(["institution", "admin"]);
const ROLE_LABEL: Record<string, string> = {
  faculty: "Faculty Member",
  hod: "Head of Department",
  placement: "Placement Officer",
  institution: "Principal Office",
  admin: "Administrator",
};

export const canGenerateReports = (role: string) => GENERATE_ROLES.has(role);
export const canScheduleReports = (role: string) => SCHEDULE_ROLES.has(role);
const canDelete = (r: ReportRow, s: SessionPayload) => SCHEDULE_ROLES.has(s.role) || (r.authorSub !== "" && r.authorSub === s.sub);

async function collegeOf(session: SessionPayload): Promise<string> {
  if (session.college && session.college !== "all") return session.college;
  const first = (await listColleges())[0];
  if (!first) throw new ReportError("There is no college to report on yet.", 404);
  return first.id;
}

async function audit(session: SessionPayload, action: string, target: string) {
  await getStore().audit.add({
    actor: session.name,
    action,
    target,
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });
}

/* ── dates (UTC, yyyy-mm-dd) ── */
const today = () => new Date().toISOString().slice(0, 10);
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function addMonths(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  const target = d.getUTCMonth() + n;
  d.setUTCDate(1);
  d.setUTCMonth(target);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const orig = Number(day.slice(8, 10));
  d.setUTCDate(Math.min(orig, last));
  return d.toISOString().slice(0, 10);
}
function step(day: string, f: Frequency): string {
  switch (f) {
    case "Weekly":
      return addDays(day, 7);
    case "Bi-Weekly":
      return addDays(day, 14);
    case "Monthly":
      return addMonths(day, 1);
    default:
      return addMonths(day, 6);
  }
}

/* ── compiling a report from live records ── */
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const grade = (score: number | null, good: number, none: string) => (score === null ? none : score >= good ? "Target met" : "Below target");

function compile(m: ReportMetrics, input: CreateReportInput, scope: string) {
  const passRate = pct(m.quizPassed, m.quizAttempts);
  const onTrack = m.assessedStudents > 0 ? pct(m.assessedStudents - m.atRiskStudents, m.assessedStudents) : null;
  const conversion = pct(m.offers, m.openings);

  const kpis: ReportKpi[] = [
    { label: "Scope", value: scope },
    { label: "Active students", value: String(m.students) },
    { label: "Faculty & staff", value: String(m.staff) },
  ];
  const breakdown: ReportBreakdownItem[] = [
    { item: `${scope} - Active students`, evaluated: m.students, score: null, status: m.students > 0 ? "Recorded" : "No data" },
    { item: `${scope} - Active faculty & staff`, evaluated: m.staff, score: null, status: m.staff > 0 ? "Recorded" : "No data" },
    { item: `${scope} - Courses offered`, evaluated: m.courses, score: null, status: m.courses > 0 ? "Recorded" : "No data" },
  ];
  const parts = [`${m.students} active students`, `${m.staff} faculty and staff`, `${m.courses} courses`];

  if (input.includeGrades) {
    kpis.push({ label: "Quiz pass rate (50%+)", value: passRate === null ? "No attempts yet" : `${passRate}%` });
    breakdown.push({ item: `${scope} - Quiz pass rate (50% or above)`, evaluated: m.quizAttempts, score: passRate, status: grade(passRate, 80, "No attempts yet") });
    parts.push(`${m.quizAttempts} graded quiz attempts`);
  }
  if (input.includeRisk) {
    kpis.push({ label: "Students at risk", value: m.assessedStudents > 0 ? `${m.atRiskStudents} of ${m.assessedStudents}` : "No attempts yet" });
    breakdown.push({ item: `${scope} - Students averaging 60% or above`, evaluated: m.assessedStudents, score: onTrack, status: grade(onTrack, 80, "No attempts yet") });
  }
  if (input.includePlacements) {
    kpis.push({ label: "Offers recorded", value: m.drives > 0 ? `${m.offers} from ${m.drives} drives` : "No drives yet" });
    breakdown.push({ item: "Placement drives - Offers against openings", evaluated: m.drives, score: conversion, status: grade(conversion, 50, "No drives yet") });
    parts.push(`${m.drives} placement drives`);
  }
  const summary = `${input.category} report for ${m.collegeName || "the college"} (${scope}, ${input.period || "current term"}), compiled from live records on ${today()}: ${parts.join(", ")}.`;
  return { kpis, breakdown, summary };
}

function toItem(r: ReportRow, session: SessionPayload): ReportItem {
  const size = Buffer.byteLength(JSON.stringify({ k: r.kpis, b: r.breakdown, s: r.summary }));
  return {
    id: r.id,
    report: r.title,
    category: r.category,
    scope: r.scope,
    period: r.period,
    formats: ["PDF", "CSV"],
    generated: r.createdAt.slice(0, 10),
    fileSize: size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`,
    generatedBy: r.generatedBy,
    summary: r.summary,
    kpis: r.kpis,
    breakdown: r.breakdown,
    collegeId: r.college,
    authorRole: r.authorRole,
    createdAt: r.createdAt,
    canDelete: canDelete(r, session),
  };
}

function toSchedule(s: ScheduleRow): ScheduledReport {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    frequency: s.frequency,
    scope: s.scope,
    recipients: s.recipients,
    nextRun: s.nextRun,
    lastRun: s.lastRunAt,
    enabled: s.enabled,
  };
}

async function compileAndSave(opts: {
  college: string;
  title: string;
  category: ReportCategory;
  scope: string;
  period: string;
  flags: Pick<CreateReportInput, "includeGrades" | "includeRisk" | "includePlacements">;
  generatedBy: string;
  authorSub: string;
  authorRole: string;
  scheduleId: string | null;
}): Promise<ReportRow> {
  const metrics = await reportsData().metrics(opts.college, opts.scope);
  const { kpis, breakdown, summary } = compile(
    metrics,
    { report: opts.title, category: opts.category, scope: opts.scope, period: opts.period, ...opts.flags },
    opts.scope,
  );
  const saved = await reportsData().addReport({
    college: opts.college,
    title: opts.title,
    category: opts.category,
    scope: opts.scope,
    period: opts.period,
    summary,
    kpis,
    breakdown,
    generatedBy: opts.generatedBy,
    authorSub: opts.authorSub,
    authorRole: opts.authorRole,
    scheduleId: opts.scheduleId,
  });
  if (!saved) throw new ReportError("Could not save the report.", 404);
  return saved;
}

const dateLabel = (day: string) => day;

/** Compiles a report for every schedule that has fallen due, once each, then moves it forward. */
async function runDueSchedules(college: string): Promise<void> {
  const data = reportsData();
  const now = today();
  for (const s of await data.schedules(college)) {
    if (!s.enabled || s.nextRun > now) continue;
    let next = step(s.nextRun, s.frequency);
    while (next <= now) next = step(next, s.frequency);
    if (!(await data.advance(s.id, s.nextRun, next))) continue; // another request already ran it
    await compileAndSave({
      college,
      title: `${s.name} - ${dateLabel(now)}`,
      category: s.category,
      scope: s.scope,
      period: `Scheduled ${s.frequency.toLowerCase()} run`,
      flags: { includeGrades: true, includeRisk: true, includePlacements: s.category === "Placement" || s.category === "Institution" },
      generatedBy: "Scheduled run",
      authorSub: "",
      authorRole: "system",
      scheduleId: s.id,
    });
  }
}

export async function getReportsOverview(session: SessionPayload): Promise<ReportsOverview> {
  const college = await collegeOf(session);
  await runDueSchedules(college);
  const [reports, schedules, scopes] = await Promise.all([reportsData().reports(college), reportsData().schedules(college), reportsData().scopes(college)]);
  return {
    collegeId: college,
    reports: reports.map((r) => toItem(r, session)),
    scheduledReports: schedules.map(toSchedule),
    permissions: { generate: canGenerateReports(session.role), schedule: canScheduleReports(session.role) },
    scopes,
  };
}

export async function createReport(session: SessionPayload, input: CreateReportInput): Promise<ReportItem> {
  if (!canGenerateReports(session.role)) throw new ReportError("Your role can't compile reports.", 403);
  const college = await collegeOf(session);
  const scope = input.scope.trim();
  if (!(await reportsData().scopes(college)).includes(scope)) throw new ReportError(`"${scope}" isn't a department of this college.`, 400);
  const label = ROLE_LABEL[session.role] ?? session.role;
  const saved = await compileAndSave({
    college,
    title: input.report.trim(),
    category: input.category,
    scope,
    period: input.period.trim(),
    flags: input,
    generatedBy: session.name ? `${session.name} (${label})` : label,
    authorSub: session.sub,
    authorRole: session.role,
    scheduleId: null,
  });
  await audit(session, `Compiled report "${saved.title}" (${saved.category}, ${saved.scope})`, saved.id);
  return toItem(saved, session);
}

export async function deleteReport(session: SessionPayload, reportId: string): Promise<void> {
  const college = await collegeOf(session);
  const report = await reportsData().report(reportId);
  if (!report || report.college !== college) throw new ReportError("Report not found.", 404);
  if (!canDelete(report, session)) throw new ReportError("Only the person who compiled this report, or the principal's office, can delete it.", 403);
  await reportsData().removeReport(report.id);
  await audit(session, `Deleted report "${report.title}"`, report.id);
}

async function ownSchedule(session: SessionPayload, id: string): Promise<ScheduleRow> {
  const college = await collegeOf(session);
  const s = await reportsData().schedule(id);
  if (!s || s.college !== college) throw new ReportError("Schedule not found.", 404);
  return s;
}

function requireSchedule(session: SessionPayload) {
  if (!canScheduleReports(session.role)) throw new ReportError("Only the principal's office can manage report schedules.", 403);
}

export async function createSchedule(session: SessionPayload, input: CreateScheduleInput): Promise<ScheduledReport> {
  requireSchedule(session);
  const college = await collegeOf(session);
  const scope = input.scope.trim();
  if (!(await reportsData().scopes(college)).includes(scope)) throw new ReportError(`"${scope}" isn't a department of this college.`, 400);
  const first = input.startDate ?? step(today(), input.frequency);
  if (first < today()) throw new ReportError("The first run can't be in the past.", 400);
  const created = await reportsData().addSchedule({
    college,
    name: input.name.trim(),
    category: input.category,
    scope,
    frequency: input.frequency,
    recipients: input.recipients.trim(),
    enabled: true,
    nextRun: first,
    createdBySub: session.sub,
  });
  if (!created) throw new ReportError(`There is already a schedule called "${input.name.trim()}".`, 409);
  await audit(session, `Scheduled ${created.frequency.toLowerCase()} report "${created.name}"`, created.id);
  return toSchedule(created);
}

export async function toggleScheduledReport(session: SessionPayload, scheduleId: string): Promise<ScheduledReport> {
  requireSchedule(session);
  const s = await ownSchedule(session, scheduleId);
  const updated = await reportsData().setEnabled(s.id, !s.enabled);
  if (!updated) throw new ReportError("Schedule not found.", 404);
  await audit(session, `${updated.enabled ? "Resumed" : "Paused"} report schedule "${updated.name}"`, updated.id);
  return toSchedule(updated);
}

export async function deleteSchedule(session: SessionPayload, scheduleId: string): Promise<void> {
  requireSchedule(session);
  const s = await ownSchedule(session, scheduleId);
  await reportsData().removeSchedule(s.id);
  await audit(session, `Removed report schedule "${s.name}"`, s.id);
}
