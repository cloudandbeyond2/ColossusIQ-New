import "server-only";
import type { CaseRow, SupportData } from "@/lib/api/mock/support-data";
import { skillImpact } from "@/lib/api/mock/support-data";
import type { EarlyWarningIntervention, SkillIntervention } from "@/lib/api/schemas";
import { db } from "./db";
import { collegeUuid } from "./lookups";

/*
 * Support cases/plans and skill programmes on PostgreSQL (prisma/migrations/20261101000000_support_and_skills).
 * Row-level security keeps each college to its own rows. Plain SQL, so it works before `prisma generate` is re-run.
 */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const dayOf = (v: unknown) => (v instanceof Date ? v : new Date(String(v))).toISOString().slice(0, 10);

const toAction = (r: Raw): EarlyWarningIntervention => ({
  id: r.id,
  studentId: r.studentSub,
  studentName: r.studentName,
  rollNo: r.rollNo,
  department: r.department,
  strategy: r.strategy,
  facultyLead: r.facultyLead,
  targetDate: r.targetDate,
  status: r.status,
  notes: r.notes,
  createdAt: dayOf(r.createdAt),
});

const toSkill = (r: Raw): SkillIntervention => ({
  id: r.id,
  title: r.title,
  department: r.department,
  batch: r.batch,
  targetSkill: r.targetSkill,
  facultyLead: r.facultyLead,
  duration: r.duration,
  enrolledCount: 0,
  status: r.status,
  impact: skillImpact(r.targetSkill),
});

const ACTION = `id, student_sub as "studentSub", student_name as "studentName", roll_no as "rollNo", department, strategy,
  faculty_lead as "facultyLead", target_date as "targetDate", status, notes, created_at as "createdAt"`;
const SKILL = `id, title, department, batch, target_skill as "targetSkill", faculty_lead as "facultyLead", duration, status`;

export const postgresSupport: SupportData = {
  async cases(college) {
    const out = new Map<string, CaseRow>();
    const cid = await collegeUuid(college);
    if (!cid) return out;
    const rows = await q<Raw>(
      `SELECT student_sub as "studentSub", status, assigned_mentor as "assignedMentor", notes, last_action_date as "lastActionDate"
       FROM student_support_cases WHERE college_id = $1::uuid;`,
      cid,
    );
    for (const r of rows) {
      out.set(r.studentSub, {
        studentSub: r.studentSub,
        status: r.status,
        assignedMentor: r.assignedMentor,
        notes: r.notes,
        lastActionDate: r.lastActionDate ? dayOf(r.lastActionDate) : null,
      });
    }
    return out;
  },
  async saveCase(college, sub, u) {
    const cid = await collegeUuid(college);
    if (!cid) return;
    await q(
      `INSERT INTO student_support_cases (college_id, student_sub, status, assigned_mentor, notes, last_action_date, updated_by_sub)
       VALUES ($1::uuid, $2, $3, COALESCE($4::text, ''), COALESCE($5::text, ''), $6::date, $7)
       ON CONFLICT (college_id, student_sub) DO UPDATE SET
         status = EXCLUDED.status,
         assigned_mentor = CASE WHEN $4::text IS NULL THEN student_support_cases.assigned_mentor ELSE EXCLUDED.assigned_mentor END,
         notes = CASE WHEN $5::text IS NULL THEN student_support_cases.notes ELSE EXCLUDED.notes END,
         last_action_date = EXCLUDED.last_action_date,
         updated_by_sub = EXCLUDED.updated_by_sub,
         updated_at = now();`,
      cid, sub, u.status, u.assignedMentor ?? null, u.notes ?? null, u.lastActionDate, u.updatedBySub,
    );
  },
  async actions(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return (await q<Raw>(`SELECT ${ACTION} FROM student_support_actions WHERE college_id = $1::uuid ORDER BY created_at DESC LIMIT 500;`, cid)).map(toAction);
  },
  async addAction(college, d) {
    const cid = await collegeUuid(college);
    if (!cid) return undefined;
    const rows = await q<Raw>(
      `INSERT INTO student_support_actions (college_id, student_sub, student_name, roll_no, department, strategy, faculty_lead, target_date, notes, author_sub)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${ACTION};`,
      cid, d.studentSub, d.studentName, d.rollNo, d.department, d.strategy, d.facultyLead, d.targetDate, d.notes, d.authorSub,
    );
    return rows[0] ? toAction(rows[0]) : undefined;
  },
  async skills(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return (await q<Raw>(`SELECT ${SKILL} FROM skill_interventions WHERE college_id = $1::uuid ORDER BY created_at DESC LIMIT 500;`, cid)).map(toSkill);
  },
  async addSkill(college, d) {
    const cid = await collegeUuid(college);
    if (!cid) return undefined;
    const rows = await q<Raw>(
      `INSERT INTO skill_interventions (college_id, title, department, batch, target_skill, faculty_lead, duration, author_sub)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8) RETURNING ${SKILL};`,
      cid, d.title, d.department, d.batch, d.targetSkill, d.facultyLead, d.duration, d.authorSub,
    );
    return rows[0] ? toSkill(rows[0]) : undefined;
  },
};
