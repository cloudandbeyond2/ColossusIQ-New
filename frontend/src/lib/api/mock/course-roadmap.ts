import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { ALL_COLLEGES } from "@/config/tenancy";
import type { SessionPayload } from "@/lib/auth/session";
import { CreateRoadmap, Reschedule, RoadmapBoard, SessionUpdate, StoredRoadmaps, planSessions, teachingDates, type Roadmap, type RoadmapSummary } from "@/lib/api/roadmap-schemas";
import { cleanText } from "@/lib/security/sanitize";
import { publishedCurricula } from "./curriculum";
import type { MockResult } from "./router";
import { studentStateStore } from "./student-state-store";

/*
 * Course Roadmap (faculty, HODs). A teacher picks a course from a published curriculum (or enters their own units),
 * a section, a start date and the weekdays they teach it; the roadmap spreads the syllabus over dated sessions, with
 * tutorials, internal assessments and a revision class. They tick sessions off as they teach, add notes, and
 * reschedule the rest after a holiday. Saved per teacher (student-state store, key "course-roadmaps").
 */

const KEY = "course-roadmaps";
const MAX = 12;
const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
const invalid = (e: z.ZodError): MockResult => {
  const fields: Record<string, string> = {};
  for (const i of e.issues) fields[i.path.map(String).join(".") || "_"] ??= i.message;
  return err(422, "validation", "Please correct the highlighted fields.", fields);
};
const STAFF = new Set(["faculty", "hod", "admin"]);
const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

async function load(s: SessionPayload): Promise<Roadmap[]> {
  const p = StoredRoadmaps.safeParse(await studentStateStore().get(s.sub, KEY));
  return p.success ? p.data.roadmaps : [];
}
async function save(s: SessionPayload, roadmaps: Roadmap[]) {
  await studentStateStore().save(s.college, s.sub, KEY, { roadmaps });
}

function summarise(r: Roadmap): RoadmapSummary {
  const t = today();
  const planned = r.sessions.filter((x) => x.status === "Planned");
  return {
    id: r.id,
    title: r.title,
    courseCode: r.courseCode,
    section: r.section,
    startDate: r.startDate,
    endDate: r.sessions.at(-1)?.date ?? r.startDate,
    total: r.sessions.length,
    done: r.sessions.filter((x) => x.status === "Done").length,
    overdue: planned.filter((x) => x.date < t).length,
    next: planned.find((x) => x.date >= t) ?? planned[0] ?? null,
  };
}

async function board(s: SessionPayload): Promise<RoadmapBoard> {
  const sources = (await publishedCurricula()).map((c) => ({
    curriculumId: c.id,
    programme: c.programme,
    regulation: c.regulation,
    courses: c.data.courses.filter((x) => x.units.length).map((x) => ({ code: x.code, title: x.title, semester: x.semester, units: x.units.length, hours: x.units.reduce((a, u) => a + u.hours, 0) })),
  }));
  return RoadmapBoard.parse({ roadmaps: (await load(s)).map(summarise), sources: sources.filter((x) => x.courses.length), max: MAX });
}

export async function dispatchCourseRoadmap(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (!STAFF.has(s.role)) return err(403, "forbidden", "Course roadmaps are for teaching staff.");
  if (s.college === ALL_COLLEGES) return err(409, "choose_college", "Switch into a college to plan teaching: roadmaps are saved with your college.");
  const [, id, a2, a3] = segs;

  if (method === "GET" && segs.length === 1) return ok(await board(s));
  const all = await load(s);

  if (method === "GET" && id && segs.length === 2) {
    const r = all.find((x) => x.id === id);
    return r ? ok(r) : err(404, "not_found", "That roadmap no longer exists.");
  }

  if (method === "POST" && segs.length === 1) {
    if (all.length >= MAX) return err(409, "limit", `You can keep up to ${MAX} roadmaps. Delete an old one first.`);
    const p = CreateRoadmap.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const b = p.data;
    let title: string;
    let code = "";
    let programme = "";
    let units;
    if (b.curriculumId && b.courseCode) {
      const cur = (await publishedCurricula()).find((c) => c.id === b.curriculumId);
      const course = cur?.data.courses.find((c) => c.code === b.courseCode);
      if (!cur || !course) return err(422, "validation", "Please correct the highlighted fields.", { courseCode: "That course is not in a published curriculum" });
      if (!course.units.length) return err(422, "validation", "Please correct the highlighted fields.", { courseCode: "This course has no syllabus units yet" });
      title = course.title;
      code = course.code;
      programme = `${cur.programme} (${cur.regulation})`;
      units = course.units;
    } else {
      title = cleanText(b.custom!.title, 120);
      units = b.custom!.units;
    }
    const plan = planSessions(units, b.withAssessments);
    const dates = teachingDates(b.startDate, b.weekdays, plan.length);
    const now = new Date().toISOString();
    const r: Roadmap = {
      id: randomUUID().slice(0, 12),
      title,
      courseCode: code,
      curriculumId: b.curriculumId,
      programme,
      section: cleanText(b.section, 40),
      startDate: b.startDate,
      weekdays: [...new Set(b.weekdays)].sort(),
      sessions: plan.map((x, i) => ({ ...x, id: `s${i + 1}`, date: dates[i]!, status: "Planned", note: "" })),
      createdAt: now,
      updatedAt: now,
    };
    await save(s, [r, ...all]);
    return ok(r, 201);
  }

  const idx = all.findIndex((x) => x.id === id);
  if (idx < 0) return err(404, "not_found", "That roadmap no longer exists.");
  const r = all[idx]!;

  // PATCH course-roadmap/:id/sessions/:sid
  if (method === "PATCH" && a2 === "sessions" && a3 && segs.length === 4) {
    const p = SessionUpdate.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const si = r.sessions.findIndex((x) => x.id === a3);
    if (si < 0) return err(404, "not_found", "That session no longer exists.");
    const u = p.data;
    r.sessions[si] = { ...r.sessions[si]!, ...u, ...(u.note !== undefined ? { note: cleanText(u.note, 300) } : {}), ...(u.topic !== undefined ? { topic: cleanText(u.topic, 300) } : {}) };
    if (u.date) r.sessions.sort((x, y) => x.date.localeCompare(y.date));
    r.updatedAt = new Date().toISOString();
    all[idx] = r;
    await save(s, all);
    return ok(r);
  }

  // POST course-roadmap/:id/reschedule { from }: re-dates every planned session from that date (after a holiday or leave).
  if (method === "POST" && a2 === "reschedule" && segs.length === 3) {
    const p = Reschedule.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const planned = r.sessions.filter((x) => x.status === "Planned");
    const dates = teachingDates(p.data.from, r.weekdays, planned.length);
    planned.forEach((x, i) => (x.date = dates[i]!));
    r.sessions.sort((x, y) => x.date.localeCompare(y.date));
    r.updatedAt = new Date().toISOString();
    all[idx] = r;
    await save(s, all);
    return ok(r);
  }

  if (method === "DELETE" && segs.length === 2) {
    await save(
      s,
      all.filter((x) => x.id !== id),
    );
    return ok(await board(s));
  }

  return err(404, "not_found", "Not found.");
}
