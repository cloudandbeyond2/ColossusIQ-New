import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { RESOURCES } from "@/config/resources";
import {
  CbcsCategory,
  CbcsCategoryRule,
  CbcsCategorySummary,
  CbcsCourse,
  CbcsKpis,
  CbcsOverview,
  CbcsPermissions,
  CbcsStudentChoice,
  CreateCbcsCourseInput,
  EnrollStudentElectiveInput,
  UpdateCbcsSeatsInput,
  UpdateCbcsWindowInput,
} from "@/lib/api/cbcs-schemas";
import type { ListData } from "@/lib/api/schemas";
import { cbcsStore, type CbcsCourseRow, type CbcsRegistrationRow } from "./cbcs-store";
import { collegeStream, getCollege, listColleges } from "./records";
import { getStudentAcademicProfile } from "./student-profile";

/*
 * CBCS & Electives. Courses and registrations are the college's own records (cbcs-store.ts); seats filled is the
 * number of registrations. The registration window and the enrolment policy are the college's settings. The UGC
 * category table below is the regulation itself, not college data.
 */

export class CbcsError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const SETTINGS_SLUG = "cbcs-electives";

export const CBCS_CATEGORIES: CbcsCategory[] = [
  "Discipline-Specific Elective (DSE)",
  "Generic Elective (GE)",
  "Skill Enhancement Course (SEC)",
  "Ability Enhancement (AECC)",
  "Value-Added Course (VAC)",
];

/** UGC CBCS credit structure per course category (regulation text shown on the "NEP Credit Distribution" tab). */
const CATEGORY_RULES: CbcsCategoryRule[] = [
  { category: "Discipline-Specific Elective (DSE)", credits: "3 – 4 Credits", objective: "Advanced specialization in primary major", requirement: "Mandatory (Min 4)", mandatory: true },
  { category: "Generic Elective (GE)", credits: "3 Credits", objective: "Interdisciplinary studies from other departments", requirement: "Mandatory (Min 2)", mandatory: true },
  { category: "Skill Enhancement Course (SEC)", credits: "2 – 3 Credits", objective: "Practical, lab-based digital and analytical tools", requirement: "Mandatory (Min 3)", mandatory: true },
  { category: "Ability Enhancement (AECC)", credits: "2 Credits", objective: "Environmental Studies and Professional Communication", requirement: "Mandatory (Min 2)", mandatory: true },
  { category: "Value-Added Course (VAC)", credits: "1 – 2 Credits", objective: "Ethics, mental wellness, cyber hygiene, and yoga", requirement: "Recommended", mandatory: false },
];

/** Shown until the institution writes its own policy lines. */
const DEFAULT_POLICIES = [
  "Students register for electives through the portal while the registration window is open.",
  "Seats are allotted in the order registrations are received, until a course reaches its capacity.",
];

const ALLOCATION_RULE = "First-Come-First-Served (FCFS)";

const canManageCourses = (role: string) => role === "institution" || role === "hod" || role === "admin";
const canManageWindow = (role: string) => role === "institution" || role === "admin";
const canEnrollOthers = (role: string) => role === "institution" || role === "hod" || role === "admin" || role === "faculty";

function permissionsOf(role: string): CbcsPermissions {
  return { manageCourses: canManageCourses(role), manageWindow: canManageWindow(role), enrollOthers: canEnrollOthers(role), selfEnroll: role === "student" };
}

/** The college a request works on. The university-wide admin scope has none, so it works on the first college. */
async function collegeOf(session: SessionPayload): Promise<string> {
  if (session.college && session.college !== "all") return session.college;
  const first = (await listColleges())[0];
  if (!first) throw new CbcsError("There is no college to manage electives for yet.", 404);
  return first.id;
}

/* ── window & policy settings ─────────────────────────────────────────────────────────────────────────────── */

interface WindowSettings {
  open: boolean;
  deadline: string;
  policies: string[];
}

async function readWindow(college: string): Promise<WindowSettings> {
  const saved = await getStore().settings.get(college, SETTINGS_SLUG);
  const lines = typeof saved?.policies === "string" ? saved.policies.split("\n").map((l) => l.trim()).filter(Boolean) : [];
  return {
    open: typeof saved?.open === "boolean" ? saved.open : true,
    deadline: typeof saved?.deadline === "string" ? saved.deadline : "",
    policies: lines.length ? lines : DEFAULT_POLICIES,
  };
}

/** "2026-10-24 17:00 IST" (or "2026-10-24T17:00") as an instant; undefined when there is no usable deadline. */
function deadlineInstant(deadline: string): number | undefined {
  const text = deadline.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!m) return undefined;
  const t = /^[ T](\d{2}):(\d{2})/.exec(text.slice(10));
  const [, y, mo, d] = m;
  // a date without a time runs to the end of that day
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(t?.[1] ?? 23), Number(t?.[2] ?? 59)) - 5.5 * 3_600_000;
}

function windowState(w: WindowSettings, now = Date.now()): { open: boolean; reason: string } {
  if (!w.open) return { open: false, reason: "The registration window is closed." };
  const at = deadlineInstant(w.deadline);
  if (at !== undefined && now > at) return { open: false, reason: `The registration deadline (${w.deadline}) has passed.` };
  return { open: true, reason: "" };
}

/* ── reading the basket ──────────────────────────────────────────────────────────────────────────────────── */

const istStamp = (iso: string) => {
  const d = new Date(Date.parse(iso) + 5.5 * 3_600_000);
  return Number.isNaN(d.getTime()) ? iso : `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
};

function toCourse(row: CbcsCourseRow, filled: number): CbcsCourse {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    offeringDepartment: row.offeringDepartment,
    semester: row.semester,
    category: row.category,
    credits: row.credits,
    seatsTotal: row.seatsTotal,
    seatsFilled: filled,
    instructor: row.instructor,
    schedule: row.schedule,
    syllabusSummary: row.syllabusSummary,
    status: filled >= row.seatsTotal ? "Full" : "Open",
  };
}

function toChoice(r: CbcsRegistrationRow, course: CbcsCourseRow): CbcsStudentChoice {
  return {
    id: r.id,
    studentName: r.studentName,
    regNo: r.regNo,
    department: r.department,
    semester: r.semester,
    courseId: course.id,
    courseCode: course.code,
    courseTitle: course.title,
    category: course.category,
    credits: course.credits,
    registeredAt: istStamp(r.registeredAt),
    status: r.status,
  };
}

async function loadBasket(college: string, stream: string) {
  const store = cbcsStore();
  await store.prepare(college, stream);
  const [rows, regs] = await Promise.all([store.courses(college), store.registrations(college)]);
  const filled = new Map<string, number>();
  for (const r of regs) if (r.status === "Confirmed") filled.set(r.courseId, (filled.get(r.courseId) ?? 0) + 1);
  const courses = rows.map((c) => toCourse(c, filled.get(c.id) ?? 0));
  const byId = new Map(rows.map((c) => [c.id, c]));
  const choices = regs.flatMap((r) => {
    const c = byId.get(r.courseId);
    return c ? [{ reg: r, choice: toChoice(r, c) }] : [];
  });
  return { courses, regs, choices };
}

async function departmentsOf(college: string, courses: CbcsCourse[]): Promise<string[]> {
  const names = new Set<string>();
  try {
    for (const r of await getStore().records.all(RESOURCES.departments!, college)) {
      const n = String(r.department ?? "").trim();
      if (n) names.add(n);
    }
  } catch {
    // fall back to the departments the courses already use
  }
  for (const c of courses) names.add(c.offeringDepartment);
  return [...names].sort();
}

async function streamOf(college: string): Promise<string> {
  const c = await getCollege(college);
  return (await collegeStream(college)) || (c?.type === "Management" ? "management" : "artsScience");
}

export async function getCbcsOverview(session: SessionPayload): Promise<CbcsOverview> {
  const collegeId = await collegeOf(session);
  const college = await getCollege(collegeId);
  const stream = await streamOf(collegeId);
  const [{ courses, choices }, win] = await Promise.all([loadBasket(collegeId, stream), readWindow(collegeId)]);
  const state = windowState(win);

  const totalCapacity = courses.reduce((sum, c) => sum + c.seatsTotal, 0);
  const totalEnrolled = courses.reduce((sum, c) => sum + c.seatsFilled, 0);
  const kpis: CbcsKpis = {
    totalCourses: courses.length,
    totalCapacity,
    totalEnrolled,
    seatUtilizationPercent: totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 1000) / 10 : 0,
    fullCoursesCount: courses.filter((c) => c.status === "Full").length,
    registrationWindowOpen: state.open,
    registrationDeadline: win.deadline,
    totalCreditsOffered: courses.reduce((sum, c) => sum + c.credits, 0),
  };

  const categorySummaries: CbcsCategorySummary[] = CBCS_CATEGORIES.map((category) => {
    const list = courses.filter((c) => c.category === category);
    const capacity = list.reduce((s, c) => s + c.seatsTotal, 0);
    const enrolled = list.reduce((s, c) => s + c.seatsFilled, 0);
    return { category, count: list.length, capacity, enrolled, utilization: capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0 };
  });

  // A student sees only their own registrations; staff see the whole college.
  const isStudent = session.role === "student";
  const visible = isStudent ? choices.filter((c) => c.reg.studentSub === session.sub) : choices;
  const viewer = isStudent
    ? await getStudentAcademicProfile(session).then(
        (p) => ({ name: p.name, regNo: p.rollNo, department: p.department, semester: p.semester }),
        () => null,
      )
    : null;

  return {
    collegeId,
    collegeName: college ? String(college.name) : collegeId,
    stream,
    kpis,
    courses,
    studentRegistrations: visible.map((c) => c.choice),
    categorySummaries,
    departments: await departmentsOf(collegeId, courses),
    categoryRules: CATEGORY_RULES,
    policies: win.policies,
    allocationRule: ALLOCATION_RULE,
    registrationOpenNow: state.open,
    registrationClosedReason: state.reason,
    permissions: permissionsOf(session.role),
    myCourseIds: isStudent ? visible.map((c) => c.reg.courseId) : [],
    viewer,
  };
}

/* ── writes ──────────────────────────────────────────────────────────────────────────────────────────────── */

const auditCollege = (session: SessionPayload) => (session.college === "all" ? null : session.college);

async function ownCourse(college: string, id: string): Promise<CbcsCourseRow> {
  const c = await cbcsStore().course(id);
  if (!c || c.college !== college) throw new CbcsError("CBCS course not found.", 404);
  return c;
}

async function filledOf(college: string, courseId: string): Promise<number> {
  return (await cbcsStore().registrations(college)).filter((r) => r.courseId === courseId && r.status === "Confirmed").length;
}

export async function createCbcsCourse(session: SessionPayload, input: CreateCbcsCourseInput): Promise<CbcsCourse> {
  const collegeId = await collegeOf(session);
  const created = await cbcsStore().createCourse({
    college: collegeId,
    code: input.code.trim().toUpperCase(),
    title: input.title.trim(),
    offeringDepartment: input.offeringDepartment.trim(),
    semester: input.semester,
    category: input.category,
    credits: input.credits,
    seatsTotal: input.seatsTotal,
    instructor: input.instructor.trim(),
    schedule: input.schedule.trim(),
    syllabusSummary: input.syllabusSummary.trim(),
    createdBySub: session.sub,
  });
  if (!created) throw new CbcsError(`A course with code ${input.code.trim().toUpperCase()} already exists.`, 409);

  await getStore().audit.add({
    actor: session.name,
    action: `Added CBCS Elective Course: ${created.code} - ${created.title}`,
    target: "cbcs-electives",
    collegeId: auditCollege(session),
    actorSub: session.sub,
  });
  return toCourse(created, 0);
}

export async function updateCbcsSeats(
  session: SessionPayload,
  input: UpdateCbcsSeatsInput,
): Promise<{ ok: boolean; course: CbcsCourse }> {
  const collegeId = await collegeOf(session);
  await ownCourse(collegeId, input.courseId);
  const filled = await filledOf(collegeId, input.courseId);
  if (input.seatsTotal < filled) {
    throw new CbcsError(`Cannot set capacity below the ${filled} students already registered.`);
  }
  const updated = await cbcsStore().setSeats(input.courseId, input.seatsTotal);
  if (!updated) throw new CbcsError("CBCS course not found.", 404);

  await getStore().audit.add({
    actor: session.name,
    action: `Updated Seat Capacity for ${updated.code} to ${updated.seatsTotal}`,
    target: "cbcs-electives",
    collegeId: auditCollege(session),
    actorSub: session.sub,
  });
  return { ok: true, course: toCourse(updated, filled) };
}

export async function enrollStudentElective(
  session: SessionPayload,
  input: EnrollStudentElectiveInput,
): Promise<{ ok: boolean; registration: CbcsStudentChoice }> {
  const collegeId = await collegeOf(session);
  const course = await ownCourse(collegeId, input.courseId);
  const isStudent = session.role === "student";
  if (!isStudent && !canEnrollOthers(session.role)) throw new CbcsError("You cannot register students for electives.", 403);

  // Students can register only while the window is open; staff can register on a student's behalf at any time.
  if (isStudent) {
    const state = windowState(await readWindow(collegeId));
    if (!state.open) throw new CbcsError(state.reason, 403);
  }

  let studentName: string;
  let regNo: string;
  let department: string;
  let semester: number;
  if (isStudent) {
    const p = await getStudentAcademicProfile(session);
    studentName = p.name;
    regNo = p.rollNo;
    department = p.department;
    semester = p.semester;
  } else {
    studentName = (input.studentName ?? "").trim();
    regNo = (input.regNo ?? "").trim();
    if (!studentName || !regNo) throw new CbcsError("Enter the student's name and register number.");
    department = (input.department ?? "").trim();
    semester = input.semester ?? course.semester;
  }

  const result = await cbcsStore().enroll({
    college: collegeId,
    courseId: course.id,
    studentSub: isStudent ? session.sub : "",
    studentName,
    regNo,
    department,
    semester,
    registeredBy: session.sub,
  });
  if ("error" in result) {
    if (result.error === "full") throw new CbcsError("This elective course has reached maximum seat capacity.", 409);
    if (result.error === "duplicate") throw new CbcsError(`${studentName} (${regNo}) is already registered in ${course.code}.`, 409);
    throw new CbcsError("CBCS course not found.", 404);
  }

  await getStore().audit.add({
    actor: session.name,
    action: `Enrolled student ${studentName} in ${course.code}`,
    target: "cbcs-electives",
    collegeId: auditCollege(session),
    actorSub: session.sub,
  });
  return { ok: true, registration: toChoice(result.ok, course) };
}

export async function dropStudentElective(session: SessionPayload, registrationId: string): Promise<{ ok: boolean }> {
  const collegeId = await collegeOf(session);
  const reg = await cbcsStore().registration(registrationId);
  if (!reg || reg.college !== collegeId) throw new CbcsError("Registration record not found.", 404);

  if (session.role === "student") {
    if (reg.studentSub !== session.sub) throw new CbcsError("You can only drop your own registrations.", 403);
    const state = windowState(await readWindow(collegeId));
    if (!state.open) throw new CbcsError(state.reason, 403);
  } else if (!canEnrollOthers(session.role)) {
    throw new CbcsError("You cannot drop student registrations.", 403);
  }

  const removed = await cbcsStore().drop(registrationId);
  if (!removed) throw new CbcsError("Registration record not found.", 404);
  const course = await cbcsStore().course(removed.courseId);

  await getStore().audit.add({
    actor: session.name,
    action: `Dropped elective registration for ${removed.studentName} in ${course?.code ?? "a course"}`,
    target: "cbcs-electives",
    collegeId: auditCollege(session),
    actorSub: session.sub,
  });
  return { ok: true };
}

export async function updateCbcsWindow(
  session: SessionPayload,
  input: UpdateCbcsWindowInput,
): Promise<{ ok: boolean; registrationWindowOpen: boolean; registrationDeadline: string }> {
  const collegeId = await collegeOf(session);
  const deadline = input.registrationDeadline.trim();
  if (deadline && deadlineInstant(deadline) === undefined) {
    throw new CbcsError("Enter the deadline as a date and time, e.g. 2026-10-24 17:00 IST.");
  }
  const current = await readWindow(collegeId);
  const policies = input.policies ?? current.policies;
  await getStore().settings.save(collegeId, SETTINGS_SLUG, {
    open: input.registrationWindowOpen,
    deadline,
    policies: policies.join("\n"),
  });

  await getStore().audit.add({
    actor: session.name,
    action: `Updated CBCS registration window: ${input.registrationWindowOpen ? "OPEN" : "CLOSED"}, deadline: ${deadline || "none"}`,
    target: "cbcs-electives",
    collegeId: auditCollege(session),
    actorSub: session.sub,
  });
  return { ok: true, registrationWindowOpen: input.registrationWindowOpen, registrationDeadline: deadline };
}

/** ListData for the generic list template (the module-data fallback), from the same college records. */
export async function dynamicCbcsElectivesData(collegeScope = "all", stream?: string | null): Promise<ListData> {
  const college = collegeScope && collegeScope !== "all" ? collegeScope : ((await listColleges())[0]?.id ?? "");
  const courses: CbcsCourse[] = college ? (await loadBasket(college, stream || (await streamOf(college)))).courses : [];

  return {
    template: "list",
    columns: [
      { key: "code", label: "Course Code", kind: "text" },
      { key: "title", label: "Elective Course", kind: "text" },
      { key: "category", label: "CBCS Category", kind: "badge" },
      { key: "credits", label: "Credits", kind: "number" },
      { key: "seatsTotal", label: "Capacity", kind: "number" },
      { key: "seatsFilled", label: "Filled", kind: "number" },
      { key: "status", label: "Status", kind: "badge" },
    ],
    rows: courses.map((c) => ({
      code: c.code,
      title: c.title,
      category: c.category,
      credits: c.credits,
      seatsTotal: c.seatsTotal,
      seatsFilled: c.seatsFilled,
      status: c.status,
    })),
    filterKey: "category",
    primaryAction: "Choose electives",
  };
}
