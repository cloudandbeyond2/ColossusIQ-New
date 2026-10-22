import "server-only";
import type { CbcsCourseRow, CbcsRegistrationRow, CbcsStore } from "@/lib/api/mock/cbcs-store";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * CBCS & Electives on PostgreSQL: `cbcs_courses` and `cbcs_registrations` (prisma/migrations/20261024000000_cbcs_electives).
 * Row-level security keeps each college to its own rows. Plain SQL, so it works before `prisma generate` has been re-run.
 */

interface CourseDb {
  id: string;
  collegeId: string;
  code: string;
  title: string;
  offeringDepartment: string;
  semester: number;
  category: string;
  credits: number;
  seatsTotal: number;
  instructor: string;
  schedule: string;
  syllabusSummary: string;
  createdBySub: string;
  createdAt: Date | string;
}

interface RegDb {
  id: string;
  collegeId: string;
  courseId: string;
  studentSub: string;
  studentName: string;
  regNo: string;
  department: string;
  semester: number;
  status: string;
  registeredBy: string;
  registeredAt: Date | string;
}

const COURSE_COLS = `id, college_id as "collegeId", code, title, offering_department as "offeringDepartment", semester, category,
  credits, seats_total as "seatsTotal", instructor, schedule, syllabus_summary as "syllabusSummary",
  created_by_sub as "createdBySub", created_at as "createdAt"`;
const REG_COLS = `id, college_id as "collegeId", course_id as "courseId", student_sub as "studentSub", student_name as "studentName",
  reg_no as "regNo", department, semester, status, registered_by as "registeredBy", registered_at as "registeredAt"`;

const iso = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toISOString();

async function toCourse(r: CourseDb): Promise<CbcsCourseRow> {
  return {
    id: r.id,
    college: (await collegePublic(r.collegeId)) ?? "",
    code: r.code,
    title: r.title,
    offeringDepartment: r.offeringDepartment,
    semester: Number(r.semester),
    category: r.category as CbcsCourseRow["category"],
    credits: Number(r.credits),
    seatsTotal: Number(r.seatsTotal),
    instructor: r.instructor,
    schedule: r.schedule,
    syllabusSummary: r.syllabusSummary,
    createdBySub: r.createdBySub,
    createdAt: iso(r.createdAt),
  };
}

async function toReg(r: RegDb): Promise<CbcsRegistrationRow> {
  return {
    id: r.id,
    college: (await collegePublic(r.collegeId)) ?? "",
    courseId: r.courseId,
    studentSub: r.studentSub,
    studentName: r.studentName,
    regNo: r.regNo,
    department: r.department,
    semester: Number(r.semester),
    status: r.status as CbcsRegistrationRow["status"],
    registeredBy: r.registeredBy,
    registeredAt: iso(r.registeredAt),
  };
}

export const postgresCbcs: CbcsStore = {
  async prepare() {
    // nothing to seed: a real college starts with an empty catalogue
  },
  async courses(college) {
    const id = await collegeUuid(college);
    if (!id) return [];
    const rows = await db().$queryRawUnsafe<CourseDb[]>(`SELECT ${COURSE_COLS} FROM cbcs_courses WHERE college_id = $1::uuid ORDER BY created_at DESC, code ASC LIMIT 1000;`, id);
    return Promise.all(rows.map(toCourse));
  },
  async course(id) {
    if (!isUuid(id)) return undefined;
    const rows = await db().$queryRawUnsafe<CourseDb[]>(`SELECT ${COURSE_COLS} FROM cbcs_courses WHERE id = $1::uuid LIMIT 1;`, id);
    return rows[0] ? toCourse(rows[0]) : undefined;
  },
  async createCourse(draft) {
    const collegeId = await collegeUuid(draft.college);
    if (!collegeId) throw new Error("Unknown college");
    const rows = await db().$queryRawUnsafe<CourseDb[]>(
      `INSERT INTO cbcs_courses (college_id, code, title, offering_department, semester, category, credits, seats_total, instructor, schedule, syllabus_summary, created_by_sub)
       VALUES ($1::uuid, upper($2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT DO NOTHING
       RETURNING ${COURSE_COLS};`,
      collegeId,
      draft.code,
      draft.title,
      draft.offeringDepartment,
      draft.semester,
      draft.category,
      draft.credits,
      draft.seatsTotal,
      draft.instructor,
      draft.schedule,
      draft.syllabusSummary,
      draft.createdBySub,
    );
    return rows[0] ? toCourse(rows[0]) : undefined;
  },
  async setSeats(id, seatsTotal) {
    if (!isUuid(id)) return undefined;
    const rows = await db().$queryRawUnsafe<CourseDb[]>(`UPDATE cbcs_courses SET seats_total = $2, updated_at = now() WHERE id = $1::uuid RETURNING ${COURSE_COLS};`, id, seatsTotal);
    return rows[0] ? toCourse(rows[0]) : undefined;
  },
  async registrations(college) {
    const id = await collegeUuid(college);
    if (!id) return [];
    const rows = await db().$queryRawUnsafe<RegDb[]>(`SELECT ${REG_COLS} FROM cbcs_registrations WHERE college_id = $1::uuid ORDER BY registered_at DESC LIMIT 5000;`, id);
    return Promise.all(rows.map(toReg));
  },
  async registration(id) {
    if (!isUuid(id)) return undefined;
    const rows = await db().$queryRawUnsafe<RegDb[]>(`SELECT ${REG_COLS} FROM cbcs_registrations WHERE id = $1::uuid LIMIT 1;`, id);
    return rows[0] ? toReg(rows[0]) : undefined;
  },
  async enroll(draft) {
    if (!isUuid(draft.courseId)) return { error: "no-course" };
    const course = await db().$queryRawUnsafe<{ id: string; collegeId: string }[]>(`SELECT id, college_id as "collegeId" FROM cbcs_courses WHERE id = $1::uuid LIMIT 1;`, draft.courseId);
    if (!course[0]) return { error: "no-course" };
    const dup = await db().$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int as n FROM cbcs_registrations WHERE course_id = $1::uuid AND upper(reg_no) = upper($2);`, draft.courseId, draft.regNo);
    if ((dup[0]?.n ?? 0) > 0) return { error: "duplicate" };
    // The seat check is part of the INSERT itself, so the last seat can't be given out twice.
    const rows = await db().$queryRawUnsafe<RegDb[]>(
      `INSERT INTO cbcs_registrations (college_id, course_id, student_sub, student_name, reg_no, department, semester, registered_by)
       SELECT c.college_id, c.id, $2, $3, $4, $5, $6, $7
       FROM cbcs_courses c
       WHERE c.id = $1::uuid AND (SELECT count(*) FROM cbcs_registrations r WHERE r.course_id = c.id) < c.seats_total
       ON CONFLICT DO NOTHING
       RETURNING ${REG_COLS};`,
      draft.courseId,
      draft.studentSub,
      draft.studentName,
      draft.regNo,
      draft.department,
      draft.semester,
      draft.registeredBy,
    );
    return rows[0] ? { ok: await toReg(rows[0]) } : { error: "full" };
  },
  async drop(id) {
    if (!isUuid(id)) return undefined;
    const rows = await db().$queryRawUnsafe<RegDb[]>(`DELETE FROM cbcs_registrations WHERE id = $1::uuid RETURNING ${REG_COLS};`, id);
    return rows[0] ? toReg(rows[0]) : undefined;
  },
};
