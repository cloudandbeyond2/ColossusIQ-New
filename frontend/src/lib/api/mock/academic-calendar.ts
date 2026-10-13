import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/roles";
import type {
  AcademicCalendarItem,
  AcademicCalendarOverview,
  CreateCalendarItemInput,
  Notification,
} from "@/lib/api/schemas";
import { getStore } from "@/lib/data";
import { RESOURCES } from "@/config/resources";
import { ALL_COLLEGES } from "@/config/tenancy";
import { calendarStore, type CalendarRow } from "./calendar-store";
import { noticeStore } from "./notice-store";
import { getStudentAcademicProfile } from "./student-profile";

/*
 * Academic Calendar. Entries are stored with their real category (Assessment, Holiday, Exam cell, Event, Milestone),
 * audience (everyone, students, faculty, staff) and department. Each person sees what is meant for them, and an entry
 * that asks to notify is posted to the Notice Board for exactly those people (and so reaches their bell), and anything
 * of theirs starting today or tomorrow is a reminder in the bell (calendarNotifications). Published Campus Events
 * appear alongside, read-only, until they are imported with "Sync Events".
 */

type Tag = AcademicCalendarItem["tag"];
type Audience = AcademicCalendarItem["audience"];

/** Raised for a request the caller can correct; the router turns it into a 400. */
export class CalendarError extends Error {}

const MANAGERS = new Set<Role>(["institution", "admin", "hod", "faculty"]);
export const canManageCalendar = (role: Role) => MANAGERS.has(role);

const ALL_DEPARTMENTS = "All Departments";
const DAY = 86_400_000;

/** Today in India (the platform's timezone), YYYY-MM-DD. */
const todayIST = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/** The calendar of the college in the session; the University Super Admin works in the first college. */
const collegeOf = (s: SessionPayload) => (s.college === ALL_COLLEGES ? "COL-1001" : s.college);

function tagToTone(tag: Tag): AcademicCalendarItem["tone"] {
  switch (tag) {
    case "Assessment":
      return "rose";
    case "Holiday":
      return "teal";
    case "Exam cell":
      return "brand";
    case "Milestone":
      return "sky";
    case "Event":
    default:
      return "gold";
  }
}

function toItem(r: CalendarRow): AcademicCalendarItem {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    endDate: r.endDate || undefined,
    time: r.time,
    tag: r.tag,
    tone: tagToTone(r.tag),
    department: r.department,
    venue: r.venue || undefined,
    description: r.description || undefined,
    audience: r.audience,
    source: r.source,
    notify: r.notify,
    readOnly: false,
    createdByName: r.createdByName,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/* ── who is an entry for ─────────────────────────────────────────────────────────────────────── */

interface Viewer {
  kind: Exclude<Audience, "All">;
  /** A student's department; empty for staff, whose department is not part of their session. */
  department: string;
}

const kindOf = (role: Role): Viewer["kind"] => (role === "student" ? "Students" : role === "faculty" || role === "hod" ? "Faculty" : "Staff");

async function viewerOf(s: SessionPayload): Promise<Viewer> {
  const kind = kindOf(s.role);
  if (kind !== "Students") return { kind, department: "" };
  try {
    return { kind, department: (await getStudentAcademicProfile(s)).department };
  } catch {
    return { kind, department: "" };
  }
}

const norm = (v: string) => v.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim();
function sameDepartment(entry: string, mine: string): boolean {
  if (!entry || entry === ALL_DEPARTMENTS || !mine) return true;
  const a = norm(entry);
  const b = norm(mine);
  return a === b || a.includes(b) || b.includes(a);
}

/** Is this entry meant for the viewer? Those who manage the calendar see every entry, unless `strict` (notifications). */
function meantFor(r: Pick<CalendarRow, "audience" | "department">, s: SessionPayload, v: Viewer, strict = false): boolean {
  if (!strict && canManageCalendar(s.role)) return true;
  if (r.audience !== "All" && r.audience !== v.kind) return false;
  return sameDepartment(r.department, v.department);
}

/* ── Campus Events, shown until imported ─────────────────────────────────────────────────────── */

async function campusEvents(college: string): Promise<CalendarRow[]> {
  try {
    const events = await getStore().records.all(RESOURCES.events!, college);
    return events
      .filter((e) => String(e.title ?? "").trim() && /^\d{4}-\d{2}-\d{2}$/.test(String(e.date ?? "")) && String(e.status ?? "") !== "Cancelled")
      .map((e) => ({
        id: `evt:${e.id}`,
        college,
        title: String(e.title).trim().slice(0, 120),
        date: String(e.date),
        endDate: undefined,
        time: String(e.startTime || "Full day"),
        tag: "Event" as const,
        department: ALL_DEPARTMENTS,
        venue: e.venue ? String(e.venue).slice(0, 100) : "",
        description: e.description ? String(e.description).slice(0, 500) : "",
        audience: "All" as const,
        source: "campus_event" as const,
        notify: false,
        createdBySub: "",
        createdByName: String(e.organiser ?? "Campus Events"),
        createdAt: e.createdAt || new Date().toISOString(),
        updatedAt: e.createdAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

const sameSlot = (a: { title: string; date: string }, b: { title: string; date: string }) => a.date === b.date && a.title.trim().toLowerCase() === b.title.trim().toLowerCase();

/* ── the term ────────────────────────────────────────────────────────────────────────────────── */

function semesterFor(today: string): AcademicCalendarOverview["semester"] {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const odd = m >= 7;
  const startYear = m >= 6 ? y : y - 1; // an even semester belongs to the academic year that began last June
  const startDate = odd ? `${y}-08-01` : `${y}-01-05`;
  const endDate = odd ? `${y}-12-20` : `${y}-05-20`;
  const name = `${odd ? "Odd" : "Even"} Semester ${startYear}–${String(startYear + 1).slice(2)}`;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const totalWeeks = Math.max(1, Math.ceil((end - start) / (7 * DAY)));
  const week = Math.floor((Date.parse(`${today}T00:00:00Z`) - start) / (7 * DAY)) + 1;
  return { name, startDate, endDate, currentWeek: Math.min(totalWeeks, Math.max(0, week)), totalWeeks };
}

async function departmentsOf(college: string, rows: CalendarRow[]): Promise<string[]> {
  const names = new Set<string>();
  try {
    for (const r of await getStore().records.all(RESOURCES.departments!, college)) {
      const n = String(r.department ?? "").trim();
      if (n) names.add(n);
    }
  } catch {
    // fall back to what the calendar already uses
  }
  for (const r of rows) if (r.department && r.department !== ALL_DEPARTMENTS) names.add(r.department);
  return [ALL_DEPARTMENTS, ...[...names].sort()];
}

/* ── reads ───────────────────────────────────────────────────────────────────────────────────── */

export async function getCalendarOverview(session: SessionPayload): Promise<AcademicCalendarOverview> {
  const college = collegeOf(session);
  const viewer = await viewerOf(session);
  const stored = await calendarStore().list(college);
  const events = (await campusEvents(college)).filter((e) => !stored.some((r) => sameSlot(r, e)));

  const visible = [...stored, ...events].filter((r) => meantFor(r, session, viewer));
  const items = visible
    .map((r) => (r.id.startsWith("evt:") ? { ...toItem(r), readOnly: true } : toItem(r)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  const count = (...tags: Tag[]) => items.filter((i) => tags.includes(i.tag)).length;
  const today = todayIST();
  return {
    collegeId: college,
    semester: semesterFor(today),
    kpis: {
      totalEvents: items.length,
      assessmentsCount: count("Assessment"),
      holidaysCount: count("Holiday"),
      eventsCount: count("Event"),
      milestonesCount: count("Milestone", "Exam cell"),
    },
    items,
    canManage: canManageCalendar(session.role),
    today,
    departments: await departmentsOf(college, stored),
  };
}

/** The entries one person can see, for pages that summarise the calendar (e.g. the module overview). */
export async function visibleCalendarItems(session: SessionPayload): Promise<AcademicCalendarItem[]> {
  return (await getCalendarOverview(session)).items;
}

/* ── writes ──────────────────────────────────────────────────────────────────────────────────── */

function checkDates(date: string, endDate?: string) {
  if (endDate && endDate < date) throw new CalendarError("The end date cannot be before the start date.");
}

const audit = (s: SessionPayload, action: string, target: string) =>
  getStore().audit.add({ actor: s.name, action, target, collegeId: s.college === ALL_COLLEGES ? null : s.college, actorSub: s.sub });

function describeReach(r: Pick<CalendarRow, "audience" | "department">): string {
  const who = r.audience === "All" ? "everyone" : r.audience.toLowerCase();
  return r.department && r.department !== ALL_DEPARTMENTS ? `${who} in ${r.department}` : who;
}

/** Posts the entry to the Notice Board for the audience (and department) it is meant for. */
async function announce(session: SessionPayload, row: CalendarRow, changed: boolean): Promise<void> {
  const audience = row.audience === "All" ? "everyone" : row.audience === "Students" ? "students" : "staff";
  const category = row.tag === "Holiday" ? "Holiday" : row.tag === "Event" ? "Event" : row.tag === "Assessment" || row.tag === "Exam cell" ? "Examination" : "Academic";
  const narrowed = row.department !== ALL_DEPARTMENTS && audience !== "staff";
  const details = [`${row.tag} · ${span(row)} · ${row.time}`, row.venue ? `Venue: ${row.venue}` : "", row.description].filter(Boolean).join("\n");
  try {
    await noticeStore().create({
      title: `${changed ? "Updated: " : ""}${row.title}`.slice(0, 140),
      body: details,
      category,
      priority: row.tag === "Assessment" || row.tag === "Exam cell" ? "Important" : "Normal",
      audience,
      department: narrowed ? row.department : "",
      year: 0,
      pinned: false,
      requiresAck: false,
      linkUrl: "",
      expiresOn: row.endDate ?? row.date,
      college: session.college === ALL_COLLEGES ? null : session.college,
      authorSub: session.sub,
      authorName: session.name,
      authorRole: session.role,
    });
  } catch (e) {
    console.error("calendar: could not post the notice", e);
  }
}

export async function createCalendarItem(session: SessionPayload, input: CreateCalendarItemInput): Promise<AcademicCalendarItem> {
  const endDate = input.endDate?.trim() || undefined;
  checkDates(input.date, endDate);
  const row = await calendarStore().create({
    college: collegeOf(session),
    title: input.title.trim(),
    date: input.date,
    endDate,
    time: input.time.trim() || "Full day",
    tag: input.tag,
    department: input.department.trim() || ALL_DEPARTMENTS,
    venue: input.venue?.trim() ?? "",
    description: input.description?.trim() ?? "",
    audience: input.audience,
    source: "academic",
    notify: input.notify,
    createdBySub: session.sub,
    createdByName: session.name,
  });
  if (row.notify) await announce(session, row, false);
  await audit(session, `Added calendar entry "${row.title}" (${row.tag}) for ${describeReach(row)}${row.notify ? ", notified" : ""}`, row.id);
  return toItem(row);
}

export async function updateCalendarItem(
  session: SessionPayload,
  id: string,
  patch: Partial<CreateCalendarItemInput>,
): Promise<AcademicCalendarItem | undefined> {
  const store = calendarStore();
  const current = await store.get(id);
  if (!current || current.college !== collegeOf(session)) return undefined;

  const date = patch.date ?? current.date;
  const endDate = patch.endDate !== undefined ? patch.endDate.trim() || undefined : current.endDate;
  checkDates(date, endDate);

  const row = await store.update(id, {
    title: patch.title?.trim() ?? current.title,
    date,
    endDate,
    time: patch.time !== undefined ? patch.time.trim() || "Full day" : current.time,
    tag: patch.tag ?? current.tag,
    department: patch.department !== undefined ? patch.department.trim() || ALL_DEPARTMENTS : current.department,
    venue: patch.venue !== undefined ? patch.venue.trim() : current.venue,
    description: patch.description !== undefined ? patch.description.trim() : current.description,
    audience: patch.audience ?? current.audience,
    notify: patch.notify ?? current.notify,
  });
  if (!row) return undefined;
  if (patch.notify) await announce(session, row, true);
  await audit(session, `Updated calendar entry "${row.title}" (${row.tag}) for ${describeReach(row)}`, row.id);
  return toItem(row);
}

export async function deleteCalendarItem(session: SessionPayload, id: string): Promise<boolean> {
  const store = calendarStore();
  const current = await store.get(id);
  if (!current || current.college !== collegeOf(session)) return false;
  if (!(await store.remove(id))) return false;
  await audit(session, `Deleted calendar entry "${current.title}"`, id);
  return true;
}

/** Copies published Campus Events into the calendar so they can be edited, categorised and notified like any entry. */
export async function syncCampusEvents(session: SessionPayload): Promise<{ syncedCount: number }> {
  const college = collegeOf(session);
  const store = calendarStore();
  const existing = await store.list(college);
  let syncedCount = 0;
  for (const e of await campusEvents(college)) {
    if (existing.some((r) => sameSlot(r, e))) continue;
    await store.create({
      college,
      title: e.title,
      date: e.date,
      endDate: undefined,
      time: e.time,
      tag: "Event",
      department: ALL_DEPARTMENTS,
      venue: e.venue,
      description: e.description,
      audience: "All",
      source: "campus_event",
      notify: false,
      createdBySub: session.sub,
      createdByName: e.createdByName,
    });
    syncedCount++;
  }
  if (syncedCount > 0) await audit(session, `Synced ${syncedCount} campus event(s) into Academic Calendar`, "academic-calendar");
  return { syncedCount };
}

/* ── notifications ───────────────────────────────────────────────────────────────────────────── */

function span(r: CalendarRow): string {
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return r.endDate && r.endDate !== r.date ? `${fmt(r.date)} – ${fmt(r.endDate)}` : fmt(r.date);
}

/**
 * Bell reminders for anything meant for this person that starts today or tomorrow. New and changed entries reach
 * people through the Notice Board (see announce), and the Notice Board feeds the bell.
 */
export async function calendarNotifications(session: SessionPayload): Promise<Notification[]> {
  try {
    const viewer = await viewerOf(session);
    const today = todayIST();
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
    const rows = (await calendarStore().list(collegeOf(session))).filter((r) => (r.endDate ?? r.date) >= today && meantFor(r, session, viewer, true));

    const out: Array<Notification & { at: number }> = [];
    for (const r of rows) {
      const where = r.venue ? ` · ${r.venue}` : "";
      const base = `${span(r)} · ${r.time}${where}`;
      if (r.date === today || r.date === tomorrow) {
        out.push({
          id: `cal-soon-${r.id}-${r.date}`,
          title: `${r.date === today ? "Today" : "Tomorrow"}: ${r.title}`,
          body: base,
          when: r.date === today ? "today" : "tomorrow",
          unread: true,
          tone: r.tag === "Assessment" || r.tag === "Exam cell" ? "amber" : tagToTone(r.tag),
          at: Date.now(),
        });
      }
    }
    return out
      .sort((a, b) => b.at - a.at)
      .slice(0, 6)
      .map(({ at, ...n }) => {
        void at;
        return n;
      });
  } catch {
    return [];
  }
}
