import "server-only";
import type { ClinicalCase, ClinicalData, ClinicalSkill } from "@/lib/api/mock/clinical-data";
import { db, isUuid } from "./db";
import { collegeUuid } from "./lookups";

/* Clinical Rotations cases and DOPS skills on PostgreSQL (prisma/migrations/20261105000000_clinical_logbook_entries). */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const CASE = `id, bed, patient, diagnosis, complaints, to_char(case_date,'YYYY-MM-DD') as date, status, faculty,
  student_name as "studentName", student_sub as "studentSub", verified_by as "verifiedBy"`;
const SKILL = `id, code, name, level, status, notes, supervisor, student_name as "studentName", student_sub as "studentSub",
  to_char(performed_on,'YYYY-MM-DD') as date, certified_by as certifier`;

const toCase = (r: Raw): ClinicalCase => ({
  id: r.id, bed: r.bed, patient: r.patient, diagnosis: r.diagnosis, complaints: r.complaints, date: r.date, status: r.status,
  faculty: r.faculty, studentName: r.studentName, studentSub: r.studentSub, verifiedBy: r.verifiedBy,
});
const toSkill = (r: Raw): ClinicalSkill => ({
  id: r.id, code: r.code, name: r.name, level: r.level, status: r.status, notes: r.notes, supervisor: r.supervisor,
  studentName: r.studentName, studentSub: r.studentSub, date: r.date, certifier: r.certifier,
});

const needCollege = async (college: string) => {
  const cid = await collegeUuid(college);
  if (!cid) throw new Error("College not found");
  return cid;
};

/** Optional college / student filters as `WHERE` text plus positional args. */
async function scope(college: string | null, studentSub: string | undefined) {
  const parts: string[] = [];
  const args: unknown[] = [];
  if (college) {
    args.push(await needCollege(college));
    parts.push(`college_id = $${args.length}::uuid`);
  }
  if (studentSub) {
    args.push(studentSub);
    parts.push(`student_sub = $${args.length}::text`);
  }
  return { where: parts.length ? `WHERE ${parts.join(" AND ")}` : "", args };
}

export const postgresClinical: ClinicalData = {
  async cases(college, studentSub) {
    const { where, args } = await scope(college, studentSub);
    const rows = await q<Raw>(`SELECT ${CASE} FROM clinical_cases ${where} ORDER BY case_date DESC, created_at DESC`, ...args);
    return rows.map(toCase);
  },
  async addCase(college, i) {
    const cid = await needCollege(college);
    const rows = await q<Raw>(
      `INSERT INTO clinical_cases (college_id, student_sub, student_name, bed, patient, diagnosis, complaints, faculty, status, verified_by, verified_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $9 = 'Approved' THEN now() ELSE NULL END)
       RETURNING ${CASE}`,
      cid, i.studentSub, i.studentName, i.bed, i.patient, i.diagnosis, i.complaints, i.faculty, i.status, i.verifiedBy,
    );
    const row = rows[0];
    if (!row) throw new Error("Insert failed");
    return toCase(row);
  },
  async decideCase(college, id, status, by) {
    if (!isUuid(id)) return null;
    const args: unknown[] = [id, status, by];
    let extra = "";
    if (college) {
      args.push(await needCollege(college));
      extra = " AND college_id = $4::uuid";
    }
    const rows = await q<Raw>(
      `UPDATE clinical_cases SET status = $2, verified_by = $3, verified_at = now() WHERE id = $1::uuid${extra} RETURNING ${CASE}`,
      ...args,
    );
    return rows[0] ? toCase(rows[0]) : null;
  },
  async skills(college, studentSub) {
    const { where, args } = await scope(college, studentSub);
    const rows = await q<Raw>(`SELECT ${SKILL} FROM clinical_skills ${where} ORDER BY performed_on DESC, created_at DESC`, ...args);
    return rows.map(toSkill);
  },
  async addSkill(college, i) {
    const cid = await needCollege(college);
    const rows = await q<Raw>(
      `INSERT INTO clinical_skills (college_id, student_sub, student_name, code, name, level, notes, supervisor)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8) RETURNING ${SKILL}`,
      cid, i.studentSub, i.studentName, i.code, i.name, i.level, i.notes, i.supervisor,
    );
    const row = rows[0];
    if (!row) throw new Error("Insert failed");
    return toSkill(row);
  },
  async decideSkill(college, id, status, by) {
    if (!isUuid(id)) return null;
    const args: unknown[] = [id, status, by];
    let extra = "";
    if (college) {
      args.push(await needCollege(college));
      extra = " AND college_id = $4::uuid";
    }
    const rows = await q<Raw>(
      `UPDATE clinical_skills SET status = $2, certified_by = $3, certified_at = now() WHERE id = $1::uuid${extra} RETURNING ${SKILL}`,
      ...args,
    );
    return rows[0] ? toSkill(rows[0]) : null;
  },
};
