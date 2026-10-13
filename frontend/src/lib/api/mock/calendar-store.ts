import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { AcademicCalendarItem } from "@/lib/api/schemas";
import { postgresCalendar } from "@/lib/data/postgres/calendar";
import { sharedState } from "./global-state";

/*
 * Academic Calendar entries. In memory for the demo backend (seeded once per college), PostgreSQL otherwise
 * (data/postgres/calendar.ts, table calendar_entries). `college` is the college's public id.
 */

export type CalendarTag = AcademicCalendarItem["tag"];
export type CalendarAudience = AcademicCalendarItem["audience"];

export interface CalendarRow {
  id: string;
  college: string;
  title: string;
  date: string;
  endDate?: string;
  time: string;
  tag: CalendarTag;
  department: string;
  venue: string;
  description: string;
  audience: CalendarAudience;
  source: AcademicCalendarItem["source"];
  notify: boolean;
  createdBySub: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type CalendarDraft = Omit<CalendarRow, "id" | "createdAt" | "updatedAt">;

export interface CalendarStore {
  /** Every entry of one college, earliest first. */
  list(college: string): Promise<CalendarRow[]>;
  get(id: string): Promise<CalendarRow | undefined>;
  create(row: CalendarDraft): Promise<CalendarRow>;
  update(id: string, patch: Partial<CalendarDraft>): Promise<CalendarRow | undefined>;
  remove(id: string): Promise<boolean>;
}

const rows = sharedState("calendar.rows", () => new Map<string, CalendarRow>());
const seeded = sharedState("calendar.seeded", () => new Set<string>());

const byDate = (a: CalendarRow, b: CalendarRow) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

type Seed = Pick<CalendarRow, "id" | "title" | "date" | "time" | "tag" | "department" | "venue" | "description" | "audience" | "createdAt"> & { endDate?: string };

/** Sample term for the demo backend only; a real (PostgreSQL) college starts with an empty calendar. */
const DEMO: Seed[] = [
  { id: "cal-ia2-timetable", title: "IA-II Timetable Published", date: "2026-09-29", time: "10:00 AM", tag: "Exam cell", department: "All Departments", venue: "Central Exam Cell / Portal", description: "Official schedule for Internal Assessment II released for all UG and PG programs.", audience: "All", createdAt: "2026-09-20T09:00:00Z" },
  { id: "cal-gandhi-jayanti", title: "Gandhi Jayanti", date: "2026-10-02", time: "Full day", tag: "Holiday", department: "All Departments", venue: "Campus Closed", description: "National Holiday on account of Mahatma Gandhi Jayanti.", audience: "All", createdAt: "2026-08-01T00:00:00Z" },
  { id: "cal-genai-workshop", title: "Workshop: GenAI for Engineers", date: "2026-10-04", time: "09:30 AM - 04:30 PM", tag: "Event", department: "Computer Science", venue: "Seminar Hall 2 & AI Lab", description: "Hands-on session on LLM application engineering, prompt design, and retrieval systems.", audience: "Students", createdAt: "2026-09-15T11:00:00Z" },
  { id: "cal-dbms-ia2", title: "DBMS Internal Assessment II", date: "2026-10-09", time: "10:00 AM - 12:00 PM", tag: "Assessment", department: "Computer Science", venue: "Exam Hall A & B", description: "Assessment covering indexing, query optimization, concurrency control, and transactions.", audience: "Students", createdAt: "2026-09-22T08:30:00Z" },
  { id: "cal-techno-fest", title: "Techno Fest 2026", date: "2026-10-10", endDate: "2026-10-11", time: "09:00 AM - 06:00 PM", tag: "Event", department: "All Departments", venue: "Main Auditorium & Tech Expo Quad", description: "Annual national tech symposium featuring 24-hr hackathon, robotics arena, and paper presentations.", audience: "All", createdAt: "2026-09-01T10:00:00Z" },
  { id: "cal-diwali-break", title: "Diwali Vacation", date: "2026-10-20", endDate: "2026-10-25", time: "Full day", tag: "Holiday", department: "All Departments", venue: "Campus Closed", description: "College closed for Diwali break. Administrative offices and classes resume on Monday 26 Oct.", audience: "All", createdAt: "2026-08-01T00:00:00Z" },
  { id: "cal-model-exams", title: "Model Examinations Commencement", date: "2026-11-03", endDate: "2026-11-10", time: "09:30 AM - 12:30 PM", tag: "Assessment", department: "All Departments", venue: "Assigned Exam Halls", description: "Comprehensive model theory examinations covering complete university syllabi.", audience: "Students", createdAt: "2026-09-10T10:00:00Z" },
  { id: "cal-last-working-day", title: "Last Working Day (Odd Semester)", date: "2026-11-20", time: "Full day", tag: "Milestone", department: "All Departments", venue: "All Departments", description: "Official conclusion of instruction, practical logbook verification, and attendance consolidation.", audience: "All", createdAt: "2026-08-01T00:00:00Z" },
  { id: "cal-univ-exams", title: "University End-Semester Theory Exams", date: "2026-11-30", endDate: "2026-12-18", time: "10:00 AM - 01:00 PM", tag: "Assessment", department: "All Departments", venue: "Designated University Exam Centers", description: "Controller of Examinations centralized university semester examinations.", audience: "Students", createdAt: "2026-08-01T00:00:00Z" },
];

function seedMemory(college: string) {
  if (seeded.has(college)) return;
  seeded.add(college);
  for (const s of DEMO) {
    const id = `${s.id}:${college}`;
    rows.set(id, {
      id,
      college,
      title: s.title,
      date: s.date,
      endDate: s.endDate,
      time: s.time,
      tag: s.tag,
      department: s.department,
      venue: s.venue,
      description: s.description,
      audience: s.audience,
      source: "academic",
      notify: false, // sample data: do not flood the bell
      createdBySub: "",
      createdByName: "Academic Affairs",
      createdAt: s.createdAt,
      updatedAt: s.createdAt,
    });
  }
}

const memoryCalendar: CalendarStore = {
  async list(college) {
    seedMemory(college);
    return [...rows.values()].filter((r) => r.college === college).map((r) => structuredClone(r)).sort(byDate);
  },
  async get(id) {
    const r = rows.get(id);
    return r ? structuredClone(r) : undefined;
  },
  async create(draft) {
    const now = new Date().toISOString();
    const r: CalendarRow = { ...structuredClone(draft), id: randomUUID(), createdAt: now, updatedAt: now };
    rows.set(r.id, r);
    return structuredClone(r);
  },
  async update(id, patch) {
    const cur = rows.get(id);
    if (!cur) return undefined;
    const next: CalendarRow = { ...cur, ...structuredClone(patch), id: cur.id, college: cur.college, createdAt: cur.createdAt, updatedAt: new Date().toISOString() };
    rows.set(id, next);
    return structuredClone(next);
  },
  async remove(id) {
    return rows.delete(id);
  },
};

/** Test helper (memory backend only). */
export function resetCalendarMemory() {
  rows.clear();
  seeded.clear();
}

export function calendarStore(): CalendarStore {
  return dataBackend() === "postgres" ? postgresCalendar : memoryCalendar;
}
