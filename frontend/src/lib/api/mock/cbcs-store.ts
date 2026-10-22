import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { CbcsCategory } from "@/lib/api/cbcs-schemas";
import { postgresCbcs } from "@/lib/data/postgres/cbcs";
import { sharedState } from "./global-state";
import { ARTS_SCIENCE_COURSES, DEMO_REGISTRATIONS, MANAGEMENT_COURSES } from "./cbcs-demo-seed";

/*
 * CBCS & Electives: the courses a college offers and the students registered in them. In memory for the demo backend
 * (seeded once per college), PostgreSQL otherwise (data/postgres/cbcs.ts, tables cbcs_courses and
 * cbcs_registrations). `college` is the college's public id. Seats filled is not stored anywhere: it is the number of
 * registrations of the course.
 */

export interface CbcsCourseRow {
  id: string;
  college: string;
  code: string;
  title: string;
  offeringDepartment: string;
  semester: number;
  category: CbcsCategory;
  credits: number;
  seatsTotal: number;
  instructor: string;
  schedule: string;
  syllabusSummary: string;
  createdBySub: string;
  createdAt: string;
}

export type CbcsCourseDraft = Omit<CbcsCourseRow, "id" | "createdAt">;

export interface CbcsRegistrationRow {
  id: string;
  college: string;
  courseId: string;
  studentSub: string;
  studentName: string;
  regNo: string;
  department: string;
  semester: number;
  status: "Confirmed" | "Waitlisted" | "Pending Approval";
  registeredBy: string;
  registeredAt: string;
}

export type CbcsRegistrationDraft = Omit<CbcsRegistrationRow, "id" | "registeredAt" | "status">;

export type EnrollResult = { ok: CbcsRegistrationRow } | { error: "full" | "duplicate" | "no-course" };

export interface CbcsStore {
  /** Memory backend only: put the sample baskets in the first time a demo college is read. */
  prepare(college: string, stream: string): Promise<void>;
  courses(college: string): Promise<CbcsCourseRow[]>;
  course(id: string): Promise<CbcsCourseRow | undefined>;
  /** `undefined` when the course code is already used in this college. */
  createCourse(draft: CbcsCourseDraft): Promise<CbcsCourseRow | undefined>;
  setSeats(id: string, seatsTotal: number): Promise<CbcsCourseRow | undefined>;
  registrations(college: string): Promise<CbcsRegistrationRow[]>;
  registration(id: string): Promise<CbcsRegistrationRow | undefined>;
  /** Seat check, duplicate check and insert in one step, so two students can't take the last seat together. */
  enroll(draft: CbcsRegistrationDraft): Promise<EnrollResult>;
  drop(id: string): Promise<CbcsRegistrationRow | undefined>;
}

const courses = sharedState("cbcs.courses", () => new Map<string, CbcsCourseRow>());
const regs = sharedState("cbcs.registrations", () => new Map<string, CbcsRegistrationRow>());
const seeded = sharedState("cbcs.seeded", () => new Set<string>());

const newestFirst = (a: CbcsRegistrationRow, b: CbcsRegistrationRow) => b.registeredAt.localeCompare(a.registeredAt);

const memoryCbcs: CbcsStore = {
  async prepare(college, stream) {
    if (seeded.has(college)) return;
    seeded.add(college);
    const mgmt = stream === "management";
    const byCode = new Map<string, CbcsCourseRow>();
    (mgmt ? MANAGEMENT_COURSES : ARTS_SCIENCE_COURSES).forEach((c, i) => {
      const row: CbcsCourseRow = {
        ...c,
        id: randomUUID(),
        college,
        createdBySub: "",
        createdAt: new Date(Date.UTC(2026, 7, 1, 0, i)).toISOString(),
      };
      courses.set(row.id, row);
      byCode.set(row.code, row);
    });
    if (mgmt) return;
    for (const r of DEMO_REGISTRATIONS) {
      const c = byCode.get(r.courseCode);
      if (!c) continue;
      const id = randomUUID();
      regs.set(id, {
        id,
        college,
        courseId: c.id,
        studentSub: "",
        studentName: r.studentName,
        regNo: r.regNo,
        department: r.department,
        semester: r.semester,
        status: "Confirmed",
        registeredBy: "",
        registeredAt: r.registeredAt,
      });
    }
  },
  async courses(college) {
    return [...courses.values()].filter((c) => c.college === college).map((c) => structuredClone(c)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.code.localeCompare(b.code));
  },
  async course(id) {
    const c = courses.get(id);
    return c ? structuredClone(c) : undefined;
  },
  async createCourse(draft) {
    const code = draft.code.toUpperCase();
    if ([...courses.values()].some((c) => c.college === draft.college && c.code.toUpperCase() === code)) return undefined;
    const row: CbcsCourseRow = { ...structuredClone(draft), code, id: randomUUID(), createdAt: new Date().toISOString() };
    courses.set(row.id, row);
    return structuredClone(row);
  },
  async setSeats(id, seatsTotal) {
    const c = courses.get(id);
    if (!c) return undefined;
    c.seatsTotal = seatsTotal;
    return structuredClone(c);
  },
  async registrations(college) {
    return [...regs.values()].filter((r) => r.college === college).map((r) => structuredClone(r)).sort(newestFirst);
  },
  async registration(id) {
    const r = regs.get(id);
    return r ? structuredClone(r) : undefined;
  },
  async enroll(draft) {
    const course = courses.get(draft.courseId);
    if (!course) return { error: "no-course" };
    const all = [...regs.values()].filter((r) => r.courseId === course.id);
    if (all.some((r) => r.regNo.toUpperCase() === draft.regNo.toUpperCase())) return { error: "duplicate" };
    if (all.length >= course.seatsTotal) return { error: "full" };
    const row: CbcsRegistrationRow = { ...structuredClone(draft), id: randomUUID(), status: "Confirmed", registeredAt: new Date().toISOString() };
    regs.set(row.id, row);
    return { ok: structuredClone(row) };
  },
  async drop(id) {
    const r = regs.get(id);
    if (!r) return undefined;
    regs.delete(id);
    return r;
  },
};

/** Test helper (memory backend only). */
export function resetCbcsMemory() {
  courses.clear();
  regs.clear();
  seeded.clear();
}

export function cbcsStore(): CbcsStore {
  return dataBackend() === "postgres" ? postgresCbcs : memoryCbcs;
}
