import "server-only";

import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { RESOURCES } from "@/config/resources";
import type {
  OsceOverview,
  OsceStation,
  OsceSession,
  SkillsLabBooking,
  StudentOsceResult,
  SkillsLabEquipment,
  CreateOsceStationInput,
  CreateOsceSessionInput,
  CreateSkillsLabBookingInput,
  CreateOsceEquipmentInput,
  UpdateBookingStatusInput,
  UpdateOsceEquipmentInput,
  UpdateSessionStatusInput,
  GradeStudentOsceInput,
} from "../osce-schemas";
import { osceData, type BookingRow, type EquipmentRow, type ResultRow, type SessionRow, type StationRow } from "./osce-data";
import { listColleges } from "./records";
import { getStudentAcademicProfile } from "./student-profile";

/*
 * OSCE & Skills Simulation Lab. Stations, sessions, bookings, grades and the simulator inventory are the college's own
 * records (osce-data.ts). Everything a reader sees that is a number about them is worked out here from those records:
 * a station's average score and pass rate come from its graded results, a session's "evaluated" count from the
 * candidates graded in it, and an item's NMC status from its condition and maintenance date.
 */

export class OsceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const MANAGE_ROLES = new Set(["hod", "faculty", "admin", "institution"]);
export const canManageOsce = (role: string) => MANAGE_ROLES.has(role);

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const todayIst = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const istDay = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3_600_000).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The college a request works on. The university-wide admin scope has none, so it works on the first college. */
async function collegeOf(session: SessionPayload): Promise<string> {
  if (session.college && session.college !== "all") return session.college;
  const first = (await listColleges())[0];
  if (!first) throw new OsceError("There is no college to run an OSCE for yet.", 404);
  return first.id;
}

const auditCollege = (session: SessionPayload) => (session.college === "all" ? null : session.college);

async function audit(session: SessionPayload, action: string) {
  await getStore().audit.add({ actor: session.name, action, target: "osce", collegeId: auditCollege(session), actorSub: session.sub });
}

function requireDay(value: string, what: string) {
  if (!ISO_DAY.test(value)) throw new OsceError(`${what} must be a date like 2026-11-20.`);
}

/* ── converting rows to what the page shows ─────────────────────────────────────────────────────────────── */

function stationView(s: StationRow, results: ResultRow[]): OsceStation {
  const mine = results.filter((r) => r.stationId === s.id);
  const avg = mine.length ? mine.reduce((sum, r) => sum + (r.total > 0 ? (r.score / r.total) * 100 : 0), 0) / mine.length : 0;
  const passed = mine.filter((r) => r.grade !== "Remediation Needed").length;
  const { college: _c, createdBySub: _b, ...rest } = s;
  void _c;
  void _b;
  return { ...rest, checklistCount: s.checklist.length, averageScore: round1(avg), passRate: mine.length ? round1((passed / mine.length) * 100) : 0 };
}

function sessionView(s: SessionRow, results: ResultRow[], activeStations: number): OsceSession {
  const evaluated = new Set(results.filter((r) => r.sessionId === s.id).map((r) => r.rollNo.toUpperCase())).size;
  const { college: _c, createdBySub: _b, ...rest } = s;
  void _c;
  void _b;
  return { ...rest, evaluatedCount: evaluated, stationsAssigned: activeStations };
}

function bookingView(b: BookingRow): SkillsLabBooking {
  const { college: _c, requestedBySub: _r, ...rest } = b;
  void _c;
  void _r;
  return rest;
}

function resultView(r: ResultRow, stationName: string): StudentOsceResult {
  const { college: _c, examinerSub: _e, gradedAt, ...rest } = r;
  void _c;
  void _e;
  return { ...rest, stationName, scorePercent: r.total > 0 ? round1((r.score / r.total) * 100) : 0, date: istDay(gradedAt) };
}

function equipmentView(e: EquipmentRow): SkillsLabEquipment {
  const { college: _c, ...rest } = e;
  void _c;
  const overdue = e.nextMaintenance !== "" && e.nextMaintenance < todayIst();
  return { ...rest, nmcComplianceStatus: e.status === "Operational" && !overdue ? "Fully Compliant" : "Action Needed" };
}

async function departmentsOf(college: string, stations: StationRow[], sessions: SessionRow[]): Promise<string[]> {
  const names = new Set<string>();
  try {
    for (const r of await getStore().records.all(RESOURCES.departments!, college)) {
      const n = String(r.department ?? "").trim();
      if (n) names.add(n);
    }
  } catch {
    // fall back to the departments the stations already use
  }
  for (const s of stations) names.add(s.department);
  for (const s of sessions) names.add(s.department);
  return [...names].sort();
}

/* ── reading ────────────────────────────────────────────────────────────────────────────────────────────── */

export async function getOsceOverview(session: SessionPayload): Promise<OsceOverview> {
  const college = await collegeOf(session);
  const data = osceData();
  await data.prepare(college);
  const [stations, sessions, bookings, results, equipment] = await Promise.all([
    data.stations(college),
    data.sessions(college),
    data.bookings(college),
    data.results(college),
    data.equipment(college),
  ]);

  const stationName = new Map(stations.map((s) => [s.id, s.title]));
  const activeStations = stations.filter((s) => s.status === "Active");
  const equipmentViews = equipment.map(equipmentView);
  const highFidelity = equipmentViews.filter((e) => e.category.includes("High Fidelity") || e.category.includes("Birthing")).length;
  const passed = results.filter((r) => r.grade !== "Remediation Needed").length;

  // A student sees their own bookings and grades, not the whole college's.
  const isStudent = session.role === "student";
  let viewer = { name: session.name, role: "Faculty" as "Student" | "Resident" | "Faculty", rollNo: "" };
  if (isStudent) {
    const p = await getStudentAcademicProfile(session).catch(() => null);
    viewer = { name: p?.name || session.name, role: "Student", rollNo: p?.rollNo ?? "" };
  }
  const visibleBookings = isStudent ? bookings.filter((b) => b.requestedBySub === session.sub) : bookings;
  const visibleResults = isStudent ? results.filter((r) => viewer.rollNo !== "" && r.rollNo.toUpperCase() === viewer.rollNo.toUpperCase()) : results;

  return {
    kpis: {
      activeStations: activeStations.length,
      skillsLabStations: stations.length,
      upcomingSessions: sessions.filter((s) => s.status === "Scheduled" || s.status === "In Progress").length,
      certifiedCompetencies: results.filter((r) => r.cbmeCertified).length,
      averagePassRate: results.length ? round1((passed / results.length) * 100) : 0,
      pendingBookings: bookings.filter((b) => b.status === "Pending Review").length,
      highFidelitySimulators: highFidelity,
      nmcSkillsNormMet: stations.length >= 6 && highFidelity >= 2,
    },
    stations: stations.map((s) => stationView(s, results)),
    sessions: sessions.map((s) => sessionView(s, results, activeStations.length)),
    bookings: visibleBookings.map(bookingView),
    results: visibleResults.map((r) => resultView(r, stationName.get(r.stationId) ?? "OSCE station")),
    equipment: equipmentViews,
    departments: await departmentsOf(college, stations, sessions),
    batches: [...new Set([...sessions.map((s) => s.batch), ...results.map((r) => r.batch)])].sort(),
    permissions: { manage: canManageOsce(session.role) },
    viewer,
  };
}

/* ── writing ────────────────────────────────────────────────────────────────────────────────────────────── */

export async function createOsceStation(session: SessionPayload, input: CreateOsceStationInput): Promise<OsceStation> {
  const college = await collegeOf(session);
  if (input.passMarks > input.totalMarks) throw new OsceError("Pass marks can't be more than the total marks.");
  const marks = input.checklist.reduce((sum, c) => sum + c.maxMarks, 0);
  if (marks > input.totalMarks) throw new OsceError(`The checklist adds up to ${marks} marks, more than the station's ${input.totalMarks}.`);

  const created = await osceData().createStation({
    college,
    title: input.title.trim(),
    department: input.department.trim(),
    domain: input.domain,
    durationMinutes: input.durationMinutes,
    totalMarks: input.totalMarks,
    passMarks: input.passMarks,
    nmcCompetencyCode: input.nmcCompetencyCode.trim(),
    room: input.room.trim(),
    manikinEquipment: input.manikinEquipment.trim(),
    examiner: session.name,
    criticalStepRequired: input.criticalStepRequired,
    criticalStepDescription: input.criticalStepDescription.trim(),
    checklist: input.checklist.map((item, idx) => ({ id: `cl-${idx + 1}`, step: item.step.trim(), maxMarks: item.maxMarks, isCritical: item.isCritical, category: item.category })),
    createdBySub: session.sub,
  });
  await audit(session, `Added OSCE station ${created.number}: ${created.title}`);
  return stationView(created, []);
}

export async function toggleStationStatus(session: SessionPayload, stationId: string): Promise<OsceStation> {
  const college = await collegeOf(session);
  const station = await osceData().station(stationId);
  if (!station || station.college !== college) throw new OsceError("Station not found.", 404);
  const next = station.status === "Active" ? "Maintenance" : "Active";
  const updated = await osceData().setStationStatus(stationId, next);
  if (!updated) throw new OsceError("Station not found.", 404);
  await audit(session, `Set OSCE station ${updated.number} to ${next}`);
  return stationView(updated, await osceData().results(college));
}

export async function createOsceSession(session: SessionPayload, input: CreateOsceSessionInput): Promise<OsceSession> {
  const college = await collegeOf(session);
  requireDay(input.date, "The exam date");
  const created = await osceData().createSession({
    college,
    title: input.title.trim(),
    batch: input.batch.trim(),
    department: input.department.trim(),
    date: input.date,
    timeSlot: input.timeSlot.trim(),
    venue: input.venue.trim(),
    totalCandidates: input.totalCandidates,
    leadExaminer: input.leadExaminer.trim(),
    createdBySub: session.sub,
  });
  const active = (await osceData().stations(college)).filter((s) => s.status === "Active").length;
  await audit(session, `Scheduled OSCE session: ${created.title} on ${created.date}`);
  return sessionView(created, [], active);
}

export async function updateSessionStatus(session: SessionPayload, sessionId: string, input: UpdateSessionStatusInput): Promise<OsceSession> {
  const college = await collegeOf(session);
  const found = await osceData().session(sessionId);
  if (!found || found.college !== college) throw new OsceError("Exam session not found.", 404);
  const updated = await osceData().setSessionStatus(sessionId, input.status);
  if (!updated) throw new OsceError("Exam session not found.", 404);
  const [results, stations] = await Promise.all([osceData().results(college), osceData().stations(college)]);
  await audit(session, `Set OSCE session "${updated.title}" to ${input.status}`);
  return sessionView(updated, results, stations.filter((s) => s.status === "Active").length);
}

export async function createSkillsLabBooking(session: SessionPayload, input: CreateSkillsLabBookingInput): Promise<SkillsLabBooking> {
  const college = await collegeOf(session);
  requireDay(input.date, "The booking date");
  if (input.date < todayIst()) throw new OsceError("Choose today or a later date for the booking.");

  // A student books as themselves; staff can book for a resident or a colleague.
  const isStudent = session.role === "student";
  const created = await osceData().createBooking({
    college,
    applicantName: isStudent ? session.name : input.applicantName.trim(),
    applicantRole: isStudent ? "Student" : input.applicantRole,
    stationOrRoom: input.stationOrRoom.trim(),
    equipment: input.equipment.trim(),
    date: input.date,
    timeSlot: input.timeSlot.trim(),
    purpose: input.purpose,
    notes: (input.notes ?? "").trim(),
    requestedBySub: session.sub,
  });
  await audit(session, `Requested skills lab slot on ${created.date} (${created.timeSlot})`);
  return bookingView(created);
}

export async function updateBookingStatus(session: SessionPayload, bookingId: string, input: UpdateBookingStatusInput): Promise<SkillsLabBooking> {
  const college = await collegeOf(session);
  const found = await osceData().booking(bookingId);
  if (!found || found.college !== college) throw new OsceError("Booking not found.", 404);
  const updated = await osceData().setBookingStatus(bookingId, input.status);
  if (!updated) throw new OsceError("Booking not found.", 404);
  await audit(session, `Set skills lab booking for ${updated.applicantName} to ${input.status}`);
  return bookingView(updated);
}

export async function gradeStudentOsce(session: SessionPayload, input: GradeStudentOsceInput): Promise<StudentOsceResult> {
  const college = await collegeOf(session);
  const station = await osceData().station(input.stationId);
  if (!station || station.college !== college) throw new OsceError("Station not found.", 404);
  if (input.score > station.totalMarks) throw new OsceError(`The score can't be more than the station's ${station.totalMarks} marks.`);
  if (input.sessionId) {
    const exam = await osceData().session(input.sessionId);
    if (!exam || exam.college !== college) throw new OsceError("Exam session not found.", 404);
  }

  const scorePercent = (input.score / station.totalMarks) * 100;
  let grade: StudentOsceResult["grade"] = "Pass";
  if (!input.criticalStepMet || scorePercent < (station.passMarks / station.totalMarks) * 100) grade = "Remediation Needed";
  else if (scorePercent >= 85) grade = "Distinction";

  const created = await osceData().addResult({
    college,
    stationId: station.id,
    sessionId: input.sessionId ?? "",
    rollNo: input.rollNo.trim(),
    studentName: input.studentName.trim(),
    batch: input.batch.trim(),
    score: input.score,
    total: station.totalMarks,
    grade,
    criticalStepMet: input.criticalStepMet,
    examiner: session.name,
    examinerSub: session.sub,
    evaluatorRemarks: (input.evaluatorRemarks ?? "").trim(),
    // a candidate who must remediate isn't certified for the competency
    cbmeCertified: grade === "Remediation Needed" ? false : input.cbmeCertified,
  });
  await audit(session, `Graded ${created.studentName} (${created.rollNo}) at OSCE station ${station.number}: ${grade}`);
  return resultView(created, station.title);
}

export async function createOsceEquipment(session: SessionPayload, input: CreateOsceEquipmentInput): Promise<SkillsLabEquipment> {
  const college = await collegeOf(session);
  const created = await osceData().createEquipment({
    college,
    name: input.name.trim(),
    serialNo: input.serialNo.trim(),
    category: input.category.trim(),
    room: input.room.trim(),
    status: input.status,
    lastInspection: input.lastInspection,
    nextMaintenance: input.nextMaintenance,
    utilizationHoursWeek: input.utilizationHoursWeek,
  });
  if (!created) throw new OsceError(`Equipment with serial number ${input.serialNo.trim()} is already in the inventory.`, 409);
  await audit(session, `Added skills lab equipment: ${created.name} (${created.serialNo})`);
  return equipmentView(created);
}

export async function updateOsceEquipment(session: SessionPayload, equipmentId: string, input: UpdateOsceEquipmentInput): Promise<SkillsLabEquipment> {
  const college = await collegeOf(session);
  const found = await osceData().equipmentItem(equipmentId);
  if (!found || found.college !== college) throw new OsceError("Equipment not found.", 404);
  const updated = await osceData().updateEquipment(equipmentId, input);
  if (!updated) throw new OsceError("Equipment not found.", 404);
  await audit(session, `Updated skills lab equipment: ${updated.name} (${updated.serialNo})`);
  return equipmentView(updated);
}
