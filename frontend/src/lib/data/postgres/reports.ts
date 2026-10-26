import "server-only";
import type { ReportMetrics, ReportRow, ReportsData, ScheduleRow } from "@/lib/api/mock/reports-data";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * Reports on PostgreSQL: generated_reports and report_schedules (prisma/migrations/20261030000000_reports_archive),
 * plus read-only counts from the college's own students, staff, courses, quizzes and placement drives.
 * Row-level security keeps each college to its own rows. Plain SQL, so it works before `prisma generate` is re-run.
 */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const iso = (v: unknown) => (v instanceof Date ? v : new Date(String(v))).toISOString();
const dayOf = (v: unknown) => (v instanceof Date ? v : new Date(String(v))).toISOString().slice(0, 10);
const json = <T>(v: unknown, fallback: T): T => (typeof v === "string" ? (JSON.parse(v) as T) : ((v as T) ?? fallback));

const REPORT = `r.id, r.college_id as "collegeId", r.title, r.category, r.scope, r.period, r.summary, r.kpis, r.breakdown,
  r.generated_by as "generatedBy", r.author_sub as "authorSub", r.author_role as "authorRole", r.schedule_id as "scheduleId", r.created_at as "createdAt"`;
const SCHEDULE = `s.id, s.college_id as "collegeId", s.name, s.category, s.scope, s.frequency, s.recipients, s.enabled,
  s.next_run as "nextRun", s.last_run_at as "lastRunAt", s.created_by_sub as "createdBySub"`;

async function toReport(r: Raw): Promise<ReportRow> {
  return {
    id: r.id,
    college: await collegePublic(r.collegeId),
    title: r.title,
    category: r.category,
    scope: r.scope,
    period: r.period,
    summary: r.summary,
    kpis: json(r.kpis, []),
    breakdown: json(r.breakdown, []),
    generatedBy: r.generatedBy,
    authorSub: r.authorSub,
    authorRole: r.authorRole,
    scheduleId: r.scheduleId ?? null,
    createdAt: iso(r.createdAt),
  };
}

async function toSchedule(r: Raw): Promise<ScheduleRow> {
  return {
    id: r.id,
    college: await collegePublic(r.collegeId),
    name: r.name,
    category: r.category,
    scope: r.scope,
    frequency: r.frequency,
    recipients: r.recipients,
    enabled: Boolean(r.enabled),
    nextRun: dayOf(r.nextRun),
    lastRunAt: r.lastRunAt ? iso(r.lastRunAt) : null,
    createdBySub: r.createdBySub,
  };
}

async function reportById(id: string): Promise<ReportRow | undefined> {
  if (!isUuid(id)) return undefined;
  const rows = await q<Raw>(`SELECT ${REPORT} FROM generated_reports r WHERE r.id = $1::uuid;`, id);
  return rows[0] ? toReport(rows[0]) : undefined;
}

async function scheduleById(id: string): Promise<ScheduleRow | undefined> {
  if (!isUuid(id)) return undefined;
  const rows = await q<Raw>(`SELECT ${SCHEDULE} FROM report_schedules s WHERE s.id = $1::uuid;`, id);
  return rows[0] ? toSchedule(rows[0]) : undefined;
}

/** Department ids of this college that match the scope name; null means the whole institution. */
async function deptFilter(cid: string, scope: string): Promise<number[] | null> {
  if (scope === "Institution") return null;
  const rows = await q<Raw>(
    `SELECT cd.department_id as id FROM college_departments cd JOIN departments d ON d.id = cd.department_id
     WHERE cd.college_id = $1::uuid AND d.name = $2;`,
    cid,
    scope,
  );
  return rows.map((r) => Number(r.id));
}

export const postgresReports: ReportsData = {
  async reports(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return Promise.all((await q<Raw>(`SELECT ${REPORT} FROM generated_reports r WHERE r.college_id = $1::uuid ORDER BY r.created_at DESC LIMIT 500;`, cid)).map(toReport));
  },
  report: reportById,
  async addReport(d) {
    const cid = await collegeUuid(d.college);
    if (!cid) return undefined;
    const rows = await q<Raw>(
      `INSERT INTO generated_reports (college_id, title, category, scope, period, summary, kpis, breakdown, generated_by, author_sub, author_role, schedule_id)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12::uuid) RETURNING id;`,
      cid, d.title, d.category, d.scope, d.period, d.summary, JSON.stringify(d.kpis), JSON.stringify(d.breakdown), d.generatedBy, d.authorSub, d.authorRole, d.scheduleId,
    );
    return reportById(rows[0]!.id);
  },
  async removeReport(id) {
    if (!isUuid(id)) return false;
    return (await q<Raw>(`DELETE FROM generated_reports WHERE id = $1::uuid RETURNING id;`, id)).length > 0;
  },
  async schedules(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return Promise.all((await q<Raw>(`SELECT ${SCHEDULE} FROM report_schedules s WHERE s.college_id = $1::uuid ORDER BY s.created_at;`, cid)).map(toSchedule));
  },
  schedule: scheduleById,
  async addSchedule(d) {
    const cid = await collegeUuid(d.college);
    if (!cid) return undefined;
    const rows = await q<Raw>(
      `INSERT INTO report_schedules (college_id, name, category, scope, frequency, recipients, enabled, next_run, created_by_sub)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::date, $9) ON CONFLICT DO NOTHING RETURNING id;`,
      cid, d.name, d.category, d.scope, d.frequency, d.recipients, d.enabled, d.nextRun, d.createdBySub,
    );
    return rows[0] ? scheduleById(rows[0].id) : undefined;
  },
  async setEnabled(id, enabled) {
    if (!isUuid(id)) return undefined;
    await q(`UPDATE report_schedules SET enabled = $2 WHERE id = $1::uuid;`, id, enabled);
    return scheduleById(id);
  },
  async removeSchedule(id) {
    if (!isUuid(id)) return false;
    return (await q<Raw>(`DELETE FROM report_schedules WHERE id = $1::uuid RETURNING id;`, id)).length > 0;
  },
  async advance(id, expected, next) {
    if (!isUuid(id)) return false;
    return (
      (await q<Raw>(
        `UPDATE report_schedules SET next_run = $3::date, last_run_at = now() WHERE id = $1::uuid AND next_run = $2::date RETURNING id;`,
        id, expected, next,
      )).length > 0
    );
  },
  async scopes(college) {
    const cid = await collegeUuid(college);
    const rows = cid
      ? await q<Raw>(
          `SELECT d.name FROM college_departments cd JOIN departments d ON d.id = cd.department_id
           WHERE cd.college_id = $1::uuid AND cd.status = 'Active' ORDER BY d.name;`,
          cid,
        )
      : [];
    return ["Institution", ...rows.map((r) => String(r.name))];
  },
  async metrics(college, scope) {
    const cid = await collegeUuid(college);
    const empty: ReportMetrics = { collegeName: "", students: 0, staff: 0, courses: 0, quizAttempts: 0, quizPassed: 0, assessedStudents: 0, atRiskStudents: 0, drives: 0, openings: 0, offers: 0, topPackage: 0 };
    if (!cid) return empty;
    const depts = await deptFilter(cid, scope);
    // No matching departments means no data for that scope, not the whole college.
    if (depts && depts.length === 0) return { ...empty, collegeName: (await q<Raw>(`SELECT name FROM colleges WHERE id = $1::uuid;`, cid))[0]?.name ?? "" };
    const dept = depts ? `AND department_id = ANY($2::int[])` : "";
    const args: unknown[] = depts ? [cid, depts] : [cid];
    const one = async (sql: string, ...extra: unknown[]) => (await q<Raw>(sql, ...extra))[0] ?? {};
    const [college_, st, sf, co, qz, risk, pl] = await Promise.all([
      one(`SELECT name FROM colleges WHERE id = $1::uuid;`, cid),
      one(`SELECT count(*)::int n FROM students WHERE college_id = $1::uuid AND status = 'Active' ${dept};`, ...args),
      one(`SELECT count(*)::int n FROM staff WHERE college_id = $1::uuid AND status = 'Active' ${dept};`, ...args),
      one(`SELECT count(*)::int n FROM courses WHERE college_id = $1::uuid ${dept};`, ...args),
      one(
        `SELECT count(*)::int n, count(*) FILTER (WHERE qa.percentage >= 50)::int passed
         FROM quiz_attempts qa JOIN students s ON s.id = qa.student_id
         WHERE qa.college_id = $1::uuid AND qa.percentage IS NOT NULL ${depts ? `AND s.department_id = ANY($2::int[])` : ""};`,
        ...args,
      ),
      one(
        `SELECT count(*)::int assessed, count(*) FILTER (WHERE avg_pct < 60)::int risk FROM (
           SELECT avg(qa.percentage) avg_pct FROM quiz_attempts qa JOIN students s ON s.id = qa.student_id
           WHERE qa.college_id = $1::uuid AND qa.percentage IS NOT NULL ${depts ? `AND s.department_id = ANY($2::int[])` : ""}
           GROUP BY qa.student_id) t;`,
        ...args,
      ),
      one(
        `SELECT count(*)::int n, coalesce(sum(openings),0)::int openings, coalesce(sum(offers),0)::int offers, coalesce(max(package_max),0)::float top
         FROM placement_drives WHERE college_id = $1::uuid AND status <> 'Draft';`,
        cid,
      ),
    ]);
    return {
      collegeName: String(college_.name ?? ""),
      students: Number(st.n ?? 0),
      staff: Number(sf.n ?? 0),
      courses: Number(co.n ?? 0),
      quizAttempts: Number(qz.n ?? 0),
      quizPassed: Number(qz.passed ?? 0),
      assessedStudents: Number(risk.assessed ?? 0),
      atRiskStudents: Number(risk.risk ?? 0),
      drives: Number(pl.n ?? 0),
      openings: Number(pl.openings ?? 0),
      offers: Number(pl.offers ?? 0),
      topPackage: Number(pl.top ?? 0),
    };
  },
};
