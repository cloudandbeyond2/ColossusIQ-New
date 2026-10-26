import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { OsceChecklistItem, OsceSession, OsceStation, SkillsLabBooking, SkillsLabEquipment, StudentOsceResult } from "@/lib/api/osce-schemas";
import { postgresOsce } from "@/lib/data/postgres/osce";
import { sharedState } from "./global-state";
import { DEFAULT_BOOKINGS, DEFAULT_EQUIPMENT, DEFAULT_RESULTS, DEFAULT_SESSIONS, DEFAULT_STATIONS } from "./osce-demo-seed";

/*
 * OSCE & Skills Simulation Lab records. In memory for the demo backend (seeded once per college), PostgreSQL
 * otherwise (data/postgres/osce.ts). `college` is the college's public id. Pass rates, average scores and
 * "candidates evaluated" are not stored: osce-store.ts works them out from the graded results.
 */

export type StationRow = Omit<OsceStation, "averageScore" | "passRate" | "checklistCount"> & { college: string; createdBySub: string };
export type StationDraft = Omit<StationRow, "id" | "number" | "status">;

export type SessionRow = Omit<OsceSession, "evaluatedCount" | "stationsAssigned"> & { college: string; createdBySub: string };
export type SessionDraft = Omit<SessionRow, "id" | "status">;

export type BookingRow = SkillsLabBooking & { college: string; requestedBySub: string };
export type BookingDraft = Omit<BookingRow, "id" | "status">;

export type ResultRow = Omit<StudentOsceResult, "stationName" | "scorePercent" | "date"> & { college: string; examinerSub: string; gradedAt: string };
export type ResultDraft = Omit<ResultRow, "id" | "gradedAt">;

export type EquipmentRow = Omit<SkillsLabEquipment, "nmcComplianceStatus"> & { college: string };
export type EquipmentDraft = Omit<EquipmentRow, "id">;

export interface OsceData {
  /** Memory backend only: put the sample circuit in the first time a demo college is read. */
  prepare(college: string): Promise<void>;

  stations(college: string): Promise<StationRow[]>;
  station(id: string): Promise<StationRow | undefined>;
  createStation(draft: StationDraft): Promise<StationRow>;
  setStationStatus(id: string, status: StationRow["status"]): Promise<StationRow | undefined>;

  sessions(college: string): Promise<SessionRow[]>;
  session(id: string): Promise<SessionRow | undefined>;
  createSession(draft: SessionDraft): Promise<SessionRow>;
  setSessionStatus(id: string, status: SessionRow["status"]): Promise<SessionRow | undefined>;

  bookings(college: string): Promise<BookingRow[]>;
  booking(id: string): Promise<BookingRow | undefined>;
  createBooking(draft: BookingDraft): Promise<BookingRow>;
  setBookingStatus(id: string, status: BookingRow["status"]): Promise<BookingRow | undefined>;

  results(college: string): Promise<ResultRow[]>;
  addResult(draft: ResultDraft): Promise<ResultRow>;

  equipment(college: string): Promise<EquipmentRow[]>;
  equipmentItem(id: string): Promise<EquipmentRow | undefined>;
  /** `undefined` when the serial number is already in this college's inventory. */
  createEquipment(draft: EquipmentDraft): Promise<EquipmentRow | undefined>;
  updateEquipment(id: string, patch: Partial<Pick<EquipmentRow, "status" | "room" | "lastInspection" | "nextMaintenance" | "utilizationHoursWeek">>): Promise<EquipmentRow | undefined>;
}

const stations = sharedState("osce.stations", () => new Map<string, StationRow>());
const sessions = sharedState("osce.sessions", () => new Map<string, SessionRow>());
const bookings = sharedState("osce.bookings", () => new Map<string, BookingRow>());
const results = sharedState("osce.results", () => new Map<string, ResultRow>());
const equipment = sharedState("osce.equipment", () => new Map<string, EquipmentRow>());
const seeded = sharedState("osce.seeded", () => new Set<string>());

const copy = <T>(v: T): T => structuredClone(v);
const mine = <T extends { college: string }>(m: Map<string, T>, college: string) => [...m.values()].filter((r) => r.college === college);
const scoped = (id: string, college: string) => `${id}:${college}`;

const memoryOsce: OsceData = {
  async prepare(college) {
    if (seeded.has(college)) return;
    seeded.add(college);
    for (const s of DEFAULT_STATIONS) {
      const id = scoped(s.id, college);
      const { averageScore: _a, passRate: _p, checklistCount: _c, ...rest } = s;
      void _a; void _p; void _c;
      stations.set(id, { ...copy(rest), id, college, createdBySub: "" });
    }
    for (const s of DEFAULT_SESSIONS) {
      const id = scoped(s.id, college);
      const { evaluatedCount: _e, stationsAssigned: _s, ...rest } = s;
      void _e; void _s;
      sessions.set(id, { ...copy(rest), id, college, createdBySub: "" });
    }
    for (const b of DEFAULT_BOOKINGS) {
      const id = scoped(b.id, college);
      bookings.set(id, { ...copy(b), id, college, requestedBySub: "" });
    }
    for (const r of DEFAULT_RESULTS) {
      const id = scoped(r.id, college);
      const { stationName: _n, scorePercent: _sp, date, ...rest } = r;
      void _n; void _sp;
      results.set(id, { ...copy(rest), id, college, stationId: scoped(r.stationId, college), sessionId: "", examinerSub: "", gradedAt: `${date}T09:00:00Z` });
    }
    for (const e of DEFAULT_EQUIPMENT) {
      const id = scoped(e.id, college);
      const { nmcComplianceStatus: _n, ...rest } = e;
      void _n;
      equipment.set(id, { ...copy(rest), id, college });
    }
  },

  async stations(college) {
    return mine(stations, college).map(copy).sort((a, b) => a.number - b.number);
  },
  async station(id) {
    const r = stations.get(id);
    return r ? copy(r) : undefined;
  },
  async createStation(draft) {
    const number = Math.max(0, ...mine(stations, draft.college).map((s) => s.number)) + 1;
    const row: StationRow = { ...copy(draft), id: randomUUID(), number, status: "Active" };
    stations.set(row.id, row);
    return copy(row);
  },
  async setStationStatus(id, status) {
    const r = stations.get(id);
    if (!r) return undefined;
    r.status = status;
    return copy(r);
  },

  async sessions(college) {
    return mine(sessions, college).map(copy).sort((a, b) => b.date.localeCompare(a.date));
  },
  async session(id) {
    const r = sessions.get(id);
    return r ? copy(r) : undefined;
  },
  async createSession(draft) {
    const row: SessionRow = { ...copy(draft), id: randomUUID(), status: "Scheduled" };
    sessions.set(row.id, row);
    return copy(row);
  },
  async setSessionStatus(id, status) {
    const r = sessions.get(id);
    if (!r) return undefined;
    r.status = status;
    return copy(r);
  },

  async bookings(college) {
    return mine(bookings, college).map(copy).sort((a, b) => b.date.localeCompare(a.date));
  },
  async booking(id) {
    const r = bookings.get(id);
    return r ? copy(r) : undefined;
  },
  async createBooking(draft) {
    const row: BookingRow = { ...copy(draft), id: randomUUID(), status: "Pending Review" };
    bookings.set(row.id, row);
    return copy(row);
  },
  async setBookingStatus(id, status) {
    const r = bookings.get(id);
    if (!r) return undefined;
    r.status = status;
    return copy(r);
  },

  async results(college) {
    return mine(results, college).map(copy).sort((a, b) => b.gradedAt.localeCompare(a.gradedAt));
  },
  async addResult(draft) {
    const row: ResultRow = { ...copy(draft), id: randomUUID(), gradedAt: new Date().toISOString() };
    results.set(row.id, row);
    return copy(row);
  },

  async equipment(college) {
    return mine(equipment, college).map(copy).sort((a, b) => a.name.localeCompare(b.name));
  },
  async equipmentItem(id) {
    const r = equipment.get(id);
    return r ? copy(r) : undefined;
  },
  async createEquipment(draft) {
    const serial = draft.serialNo.toUpperCase();
    if (mine(equipment, draft.college).some((e) => e.serialNo.toUpperCase() === serial)) return undefined;
    const row: EquipmentRow = { ...copy(draft), id: randomUUID() };
    equipment.set(row.id, row);
    return copy(row);
  },
  async updateEquipment(id, patch) {
    const r = equipment.get(id);
    if (!r) return undefined;
    Object.assign(r, copy(patch));
    return copy(r);
  },
};

/** Test helper (memory backend only). */
export function resetOsceMemory() {
  for (const m of [stations, sessions, bookings, results, equipment] as Array<Map<string, unknown>>) m.clear();
  seeded.clear();
}

export function osceData(): OsceData {
  return dataBackend() === "postgres" ? postgresOsce : memoryOsce;
}

export type { OsceChecklistItem };
