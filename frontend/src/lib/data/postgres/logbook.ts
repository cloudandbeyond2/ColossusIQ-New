import "server-only";
import type { EntryRow, LogbookData } from "@/lib/api/mock/logbook-data";
import type { LogbookCompetency } from "@/lib/api/logbook-schemas";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * Competency logbook on PostgreSQL (prisma/migrations/20261102000000_competency_logbook).
 * Row-level security keeps each college to its own rows. Plain SQL, so it works before `prisma generate` is re-run.
 */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const iso = (v: unknown) => (v ? (v instanceof Date ? v : new Date(String(v))).toISOString() : "");

const COMP = `id, code, description, department, level, college_id as "collegeId"`;
const ENTRY = `id, college_id as "collegeId", competency_id as "competencyId", student_sub as "studentSub", student_name as "studentName",
  roll_no as "rollNo", attempts, status, notes, remarks, certified_by as "certifiedBy", certified_at as "certifiedAt"`;

const toComp = (r: Raw): LogbookCompetency => ({ id: r.id, code: r.code, description: r.description, department: r.department, level: r.level });

async function toEntry(r: Raw): Promise<EntryRow> {
  return {
    id: r.id,
    college: await collegePublic(r.collegeId),
    competencyId: r.competencyId,
    studentSub: r.studentSub,
    studentName: r.studentName,
    rollNo: r.rollNo,
    attempts: Number(r.attempts),
    status: r.status,
    notes: r.notes,
    remarks: r.remarks,
    certifiedBy: r.certifiedBy,
    certifiedAt: iso(r.certifiedAt),
  };
}

async function entryById(id: string): Promise<EntryRow | undefined> {
  if (!isUuid(id)) return undefined;
  const rows = await q<Raw>(`SELECT ${ENTRY} FROM logbook_entries WHERE id = $1::uuid;`, id);
  return rows[0] ? toEntry(rows[0]) : undefined;
}

export const postgresLogbook: LogbookData = {
  async competencies(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return (await q<Raw>(`SELECT ${COMP} FROM logbook_competencies WHERE college_id = $1::uuid ORDER BY department, code;`, cid)).map(toComp);
  },
  async competency(id) {
    if (!isUuid(id)) return undefined;
    const rows = await q<Raw>(`SELECT ${COMP} FROM logbook_competencies WHERE id = $1::uuid;`, id);
    return rows[0] ? { ...toComp(rows[0]), college: await collegePublic(rows[0].collegeId) } : undefined;
  },
  async addCompetencies(college, items, authorSub) {
    const cid = await collegeUuid(college);
    if (!cid) return 0;
    let added = 0;
    for (const it of items) {
      const rows = await q<Raw>(
        `INSERT INTO logbook_competencies (college_id, code, description, department, level, created_by_sub)
         VALUES ($1::uuid, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING id;`,
        cid, it.code, it.description, it.department, it.level, authorSub,
      );
      added += rows.length;
    }
    return added;
  },
  async removeCompetency(id) {
    if (!isUuid(id)) return false;
    return (await q<Raw>(`DELETE FROM logbook_competencies WHERE id = $1::uuid RETURNING id;`, id)).length > 0;
  },
  async entries(college, studentSub) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    const rows = studentSub
      ? await q<Raw>(`SELECT ${ENTRY} FROM logbook_entries WHERE college_id = $1::uuid AND student_sub = $2 ORDER BY updated_at DESC;`, cid, studentSub)
      : await q<Raw>(`SELECT ${ENTRY} FROM logbook_entries WHERE college_id = $1::uuid ORDER BY updated_at DESC LIMIT 5000;`, cid);
    return Promise.all(rows.map(toEntry));
  },
  entry: entryById,
  async request(college, competencyId, who, notes) {
    const cid = await collegeUuid(college);
    if (!cid || !isUuid(competencyId)) return undefined;
    const rows = await q<Raw>(
      `INSERT INTO logbook_entries (college_id, competency_id, student_sub, student_name, roll_no, notes)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
       ON CONFLICT (competency_id, student_sub) DO UPDATE SET
         attempts = logbook_entries.attempts + 1, status = 'Pending review', notes = EXCLUDED.notes,
         student_name = EXCLUDED.student_name, roll_no = EXCLUDED.roll_no, updated_at = now()
       RETURNING id;`,
      cid, competencyId, who.sub, who.name, who.rollNo, notes,
    );
    return rows[0] ? entryById(rows[0].id) : undefined;
  },
  async review(id, status, remarks, by) {
    if (!isUuid(id)) return undefined;
    await q(
      `UPDATE logbook_entries SET status = $2::text, remarks = $3, certified_by = $4,
         certified_at = CASE WHEN $2::text = 'Certified' THEN now() ELSE NULL END, updated_at = now()
       WHERE id = $1::uuid;`,
      id, status, remarks, by,
    );
    return entryById(id);
  },
};
