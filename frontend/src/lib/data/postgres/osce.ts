import "server-only";
import type { BookingRow, EquipmentRow, OsceData, ResultRow, SessionRow, StationRow } from "@/lib/api/mock/osce-data";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * OSCE & Skills Lab on PostgreSQL: osce_stations, osce_sessions, osce_bookings, osce_results, osce_equipment
 * (prisma/migrations/20261026000000_osce_skills_lab). Row-level security keeps each college to its own rows.
 * Plain SQL, so it works before `prisma generate` has been re-run.
 */

const iso = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toISOString();
const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

const STATION = `id, college_id as "collegeId", number, title, department, domain, duration_minutes as "durationMinutes",
  total_marks as "totalMarks", pass_marks as "passMarks", nmc_competency_code as "nmcCompetencyCode", room,
  manikin_equipment as "manikinEquipment", examiner, status, critical_step_required as "criticalStepRequired",
  critical_step_description as "criticalStepDescription", checklist, created_by_sub as "createdBySub"`;
const SESSION = `id, college_id as "collegeId", title, batch, department, date, time_slot as "timeSlot", venue,
  total_candidates as "totalCandidates", lead_examiner as "leadExaminer", status, created_by_sub as "createdBySub"`;
const BOOKING = `id, college_id as "collegeId", applicant_name as "applicantName", applicant_role as "applicantRole",
  station_or_room as "stationOrRoom", equipment, date, time_slot as "timeSlot", purpose, status, notes,
  requested_by_sub as "requestedBySub"`;
const RESULT = `id, college_id as "collegeId", station_id as "stationId", COALESCE(session_id::text, '') as "sessionId",
  roll_no as "rollNo", student_name as "studentName", batch, score::float8 as score, total, grade,
  critical_step_met as "criticalStepMet", examiner, examiner_sub as "examinerSub", evaluator_remarks as "evaluatorRemarks",
  cbme_certified as "cbmeCertified", graded_at as "gradedAt"`;
const EQUIPMENT = `id, college_id as "collegeId", name, serial_no as "serialNo", category, room, status,
  last_inspection as "lastInspection", next_maintenance as "nextMaintenance",
  utilization_hours_week::float8 as "utilizationHoursWeek"`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

async function college(r: Raw): Promise<string> {
  return (await collegePublic(r.collegeId)) ?? "";
}

async function toStation(r: Raw): Promise<StationRow> {
  return {
    id: r.id,
    college: await college(r),
    number: Number(r.number),
    title: r.title,
    department: r.department,
    domain: r.domain,
    durationMinutes: Number(r.durationMinutes),
    totalMarks: Number(r.totalMarks),
    passMarks: Number(r.passMarks),
    nmcCompetencyCode: r.nmcCompetencyCode,
    room: r.room,
    manikinEquipment: r.manikinEquipment,
    examiner: r.examiner,
    status: r.status,
    criticalStepRequired: r.criticalStepRequired,
    criticalStepDescription: r.criticalStepDescription,
    checklist: typeof r.checklist === "string" ? JSON.parse(r.checklist) : (r.checklist ?? []),
    createdBySub: r.createdBySub,
  };
}

async function toSession(r: Raw): Promise<SessionRow> {
  return {
    id: r.id,
    college: await college(r),
    title: r.title,
    batch: r.batch,
    department: r.department,
    date: r.date,
    timeSlot: r.timeSlot,
    venue: r.venue,
    totalCandidates: Number(r.totalCandidates),
    leadExaminer: r.leadExaminer,
    status: r.status,
    createdBySub: r.createdBySub,
  };
}

async function toBooking(r: Raw): Promise<BookingRow> {
  return {
    id: r.id,
    college: await college(r),
    applicantName: r.applicantName,
    applicantRole: r.applicantRole,
    stationOrRoom: r.stationOrRoom,
    equipment: r.equipment,
    date: r.date,
    timeSlot: r.timeSlot,
    purpose: r.purpose,
    status: r.status,
    notes: r.notes,
    requestedBySub: r.requestedBySub,
  };
}

async function toResult(r: Raw): Promise<ResultRow> {
  return {
    id: r.id,
    college: await college(r),
    stationId: r.stationId,
    sessionId: r.sessionId ?? "",
    rollNo: r.rollNo,
    studentName: r.studentName,
    batch: r.batch,
    score: Number(r.score),
    total: Number(r.total),
    grade: r.grade,
    criticalStepMet: r.criticalStepMet,
    examiner: r.examiner,
    examinerSub: r.examinerSub,
    evaluatorRemarks: r.evaluatorRemarks,
    cbmeCertified: r.cbmeCertified,
    gradedAt: iso(r.gradedAt),
  };
}

async function toEquipment(r: Raw): Promise<EquipmentRow> {
  return {
    id: r.id,
    college: await college(r),
    name: r.name,
    serialNo: r.serialNo,
    category: r.category,
    room: r.room,
    status: r.status,
    lastInspection: r.lastInspection,
    nextMaintenance: r.nextMaintenance,
    utilizationHoursWeek: Number(r.utilizationHoursWeek),
  };
}

const uuidOrNull = (v: string) => (isUuid(v) ? v : null);

export const postgresOsce: OsceData = {
  async prepare() {
    // nothing to seed: a real college starts empty
  },

  async stations(c) {
    const id = await collegeUuid(c);
    if (!id) return [];
    return Promise.all((await q<Raw>(`SELECT ${STATION} FROM osce_stations WHERE college_id = $1::uuid ORDER BY number ASC LIMIT 1000;`, id)).map(toStation));
  },
  async station(id) {
    if (!isUuid(id)) return undefined;
    const rows = await q<Raw>(`SELECT ${STATION} FROM osce_stations WHERE id = $1::uuid LIMIT 1;`, id);
    return rows[0] ? toStation(rows[0]) : undefined;
  },
  async createStation(d) {
    const collegeId = await collegeUuid(d.college);
    if (!collegeId) throw new Error("Unknown college");
    const rows = await q<Raw>(
      `INSERT INTO osce_stations (college_id, number, title, department, domain, duration_minutes, total_marks, pass_marks,
         nmc_competency_code, room, manikin_equipment, examiner, critical_step_required, critical_step_description, checklist, created_by_sub)
       VALUES ($1::uuid, (SELECT COALESCE(MAX(number), 0) + 1 FROM osce_stations WHERE college_id = $1::uuid),
         $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
       RETURNING ${STATION};`,
      collegeId, d.title, d.department, d.domain, d.durationMinutes, d.totalMarks, d.passMarks, d.nmcCompetencyCode, d.room,
      d.manikinEquipment, d.examiner, d.criticalStepRequired, d.criticalStepDescription, JSON.stringify(d.checklist), d.createdBySub,
    );
    return toStation(rows[0]!);
  },
  async setStationStatus(id, status) {
    if (!isUuid(id)) return undefined;
    const rows = await q<Raw>(`UPDATE osce_stations SET status = $2, updated_at = now() WHERE id = $1::uuid RETURNING ${STATION};`, id, status);
    return rows[0] ? toStation(rows[0]) : undefined;
  },

  async sessions(c) {
    const id = await collegeUuid(c);
    if (!id) return [];
    return Promise.all((await q<Raw>(`SELECT ${SESSION} FROM osce_sessions WHERE college_id = $1::uuid ORDER BY date DESC, created_at DESC LIMIT 1000;`, id)).map(toSession));
  },
  async session(id) {
    if (!isUuid(id)) return undefined;
    const rows = await q<Raw>(`SELECT ${SESSION} FROM osce_sessions WHERE id = $1::uuid LIMIT 1;`, id);
    return rows[0] ? toSession(rows[0]) : undefined;
  },
  async createSession(d) {
    const collegeId = await collegeUuid(d.college);
    if (!collegeId) throw new Error("Unknown college");
    const rows = await q<Raw>(
      `INSERT INTO osce_sessions (college_id, title, batch, department, date, time_slot, venue, total_candidates, lead_examiner, created_by_sub)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${SESSION};`,
      collegeId, d.title, d.batch, d.department, d.date, d.timeSlot, d.venue, d.totalCandidates, d.leadExaminer, d.createdBySub,
    );
    return toSession(rows[0]!);
  },
  async setSessionStatus(id, status) {
    if (!isUuid(id)) return undefined;
    const rows = await q<Raw>(`UPDATE osce_sessions SET status = $2, updated_at = now() WHERE id = $1::uuid RETURNING ${SESSION};`, id, status);
    return rows[0] ? toSession(rows[0]) : undefined;
  },

  async bookings(c) {
    const id = await collegeUuid(c);
    if (!id) return [];
    return Promise.all((await q<Raw>(`SELECT ${BOOKING} FROM osce_bookings WHERE college_id = $1::uuid ORDER BY date DESC, created_at DESC LIMIT 2000;`, id)).map(toBooking));
  },
  async booking(id) {
    if (!isUuid(id)) return undefined;
    const rows = await q<Raw>(`SELECT ${BOOKING} FROM osce_bookings WHERE id = $1::uuid LIMIT 1;`, id);
    return rows[0] ? toBooking(rows[0]) : undefined;
  },
  async createBooking(d) {
    const collegeId = await collegeUuid(d.college);
    if (!collegeId) throw new Error("Unknown college");
    const rows = await q<Raw>(
      `INSERT INTO osce_bookings (college_id, applicant_name, applicant_role, station_or_room, equipment, date, time_slot, purpose, notes, requested_by_sub)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${BOOKING};`,
      collegeId, d.applicantName, d.applicantRole, d.stationOrRoom, d.equipment, d.date, d.timeSlot, d.purpose, d.notes, d.requestedBySub,
    );
    return toBooking(rows[0]!);
  },
  async setBookingStatus(id, status) {
    if (!isUuid(id)) return undefined;
    const rows = await q<Raw>(`UPDATE osce_bookings SET status = $2, updated_at = now() WHERE id = $1::uuid RETURNING ${BOOKING};`, id, status);
    return rows[0] ? toBooking(rows[0]) : undefined;
  },

  async results(c) {
    const id = await collegeUuid(c);
    if (!id) return [];
    return Promise.all((await q<Raw>(`SELECT ${RESULT} FROM osce_results WHERE college_id = $1::uuid ORDER BY graded_at DESC LIMIT 5000;`, id)).map(toResult));
  },
  async addResult(d) {
    const collegeId = await collegeUuid(d.college);
    if (!collegeId) throw new Error("Unknown college");
    const rows = await q<Raw>(
      `INSERT INTO osce_results (college_id, station_id, session_id, roll_no, student_name, batch, score, total, grade,
         critical_step_met, examiner, examiner_sub, evaluator_remarks, cbme_certified)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING ${RESULT};`,
      collegeId, d.stationId, uuidOrNull(d.sessionId), d.rollNo, d.studentName, d.batch, d.score, d.total, d.grade,
      d.criticalStepMet, d.examiner, d.examinerSub, d.evaluatorRemarks, d.cbmeCertified,
    );
    return toResult(rows[0]!);
  },

  async equipment(c) {
    const id = await collegeUuid(c);
    if (!id) return [];
    return Promise.all((await q<Raw>(`SELECT ${EQUIPMENT} FROM osce_equipment WHERE college_id = $1::uuid ORDER BY name ASC LIMIT 1000;`, id)).map(toEquipment));
  },
  async equipmentItem(id) {
    if (!isUuid(id)) return undefined;
    const rows = await q<Raw>(`SELECT ${EQUIPMENT} FROM osce_equipment WHERE id = $1::uuid LIMIT 1;`, id);
    return rows[0] ? toEquipment(rows[0]) : undefined;
  },
  async createEquipment(d) {
    const collegeId = await collegeUuid(d.college);
    if (!collegeId) throw new Error("Unknown college");
    const rows = await q<Raw>(
      `INSERT INTO osce_equipment (college_id, name, serial_no, category, room, status, last_inspection, next_maintenance, utilization_hours_week)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING RETURNING ${EQUIPMENT};`,
      collegeId, d.name, d.serialNo, d.category, d.room, d.status, d.lastInspection, d.nextMaintenance, d.utilizationHoursWeek,
    );
    return rows[0] ? toEquipment(rows[0]) : undefined;
  },
  async updateEquipment(id, patch) {
    if (!isUuid(id)) return undefined;
    const cols: Record<string, string> = { status: "status", room: "room", lastInspection: "last_inspection", nextMaintenance: "next_maintenance", utilizationHoursWeek: "utilization_hours_week" };
    const sets = ["updated_at = now()"];
    const vals: unknown[] = [id];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || !cols[k]) continue;
      vals.push(v);
      sets.push(`${cols[k]} = $${vals.length}`);
    }
    const rows = await q<Raw>(`UPDATE osce_equipment SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING ${EQUIPMENT};`, ...vals);
    return rows[0] ? toEquipment(rows[0]) : undefined;
  },
};
