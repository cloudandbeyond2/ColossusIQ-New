import { z } from "zod";
import { Unit } from "@/lib/api/curriculum-schemas";

/* Course Roadmap: a teacher's dated, session-by-session plan for one course and section, and what has been covered. */

export const METHODS = ["Lecture", "Tutorial", "Lab", "Activity", "Assessment", "Revision"] as const;
export const SESSION_STATUSES = ["Planned", "Done", "Skipped"] as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-02-14");

export const Session = z.object({
  id: z.string(),
  date: day,
  unit: z.number().int().min(0).max(8),
  unitTitle: z.string().max(120),
  topic: z.string().max(300),
  method: z.enum(METHODS),
  status: z.enum(SESSION_STATUSES),
  note: z.string().max(300),
});
export type Session = z.infer<typeof Session>;

export const Roadmap = z.object({
  id: z.string(),
  title: z.string().max(140),
  courseCode: z.string().max(12),
  curriculumId: z.string().nullable(),
  programme: z.string().max(130),
  section: z.string().max(40),
  startDate: day,
  weekdays: z.array(z.number().int().min(1).max(6)).min(1).max(6),
  sessions: z.array(Session).max(240),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Roadmap = z.infer<typeof Roadmap>;
export const StoredRoadmaps = z.object({ roadmaps: z.array(Roadmap).max(12) });

export const RoadmapSummary = z.object({
  id: z.string(),
  title: z.string(),
  courseCode: z.string(),
  section: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  total: z.number(),
  done: z.number(),
  overdue: z.number(),
  next: Session.nullable(),
});
export type RoadmapSummary = z.infer<typeof RoadmapSummary>;

export const RoadmapBoard = z.object({
  roadmaps: z.array(RoadmapSummary),
  sources: z.array(
    z.object({
      curriculumId: z.string(),
      programme: z.string(),
      regulation: z.string(),
      courses: z.array(z.object({ code: z.string(), title: z.string(), semester: z.number(), units: z.number(), hours: z.number() })),
    }),
  ),
  max: z.number(),
});
export type RoadmapBoard = z.infer<typeof RoadmapBoard>;

export const CreateRoadmap = z
  .object({
    curriculumId: z.string().max(60).nullable().default(null),
    courseCode: z.string().max(12).default(""),
    /** For a course that is not in a published curriculum. */
    custom: z.object({ title: z.string().trim().min(3, "Name the course").max(120), units: z.array(Unit).min(1, "Add at least one unit").max(8) }).nullable().default(null),
    section: z.string().trim().max(40).default(""),
    startDate: day,
    weekdays: z.array(z.number().int().min(1).max(6)).min(1, "Pick at least one teaching day").max(6),
    withAssessments: z.boolean().default(true),
  })
  .refine((b) => (b.curriculumId && b.courseCode) || b.custom, { message: "Pick a course from a curriculum, or enter your own", path: ["courseCode"] });
export type CreateRoadmap = z.infer<typeof CreateRoadmap>;

export const SessionUpdate = z.object({
  status: z.enum(SESSION_STATUSES).optional(),
  note: z.string().trim().max(300).optional(),
  topic: z.string().trim().min(2).max(300).optional(),
  method: z.enum(METHODS).optional(),
  date: day.optional(),
});
export const Reschedule = z.object({ from: day });

/** Splits each unit's topics across its hours (one session per hour), with tutorials, internal assessments and revision. */
export function planSessions(units: Array<z.infer<typeof Unit>>, withAssessments: boolean): Array<Omit<Session, "id" | "date" | "status" | "note">> {
  const out: Array<Omit<Session, "id" | "date" | "status" | "note">> = [];
  units.forEach((u, ui) => {
    const n = Math.max(1, Math.min(30, u.hours || 1));
    const topics = u.topics.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
    const tutorial = n >= 5;
    const teach = tutorial ? n - 1 : n;
    for (let k = 0; k < teach; k++) {
      let topic: string;
      if (!topics.length) topic = `${u.title} (part ${k + 1})`;
      else if (topics.length >= teach) topic = topics.slice(Math.floor((k * topics.length) / teach), Math.floor(((k + 1) * topics.length) / teach)).join(", ");
      else topic = topics[Math.min(topics.length - 1, Math.floor((k * topics.length) / teach))]! + (k >= topics.length ? " (continued)" : "");
      out.push({ unit: ui + 1, unitTitle: u.title, topic: topic.slice(0, 300), method: "Lecture" });
    }
    if (tutorial) out.push({ unit: ui + 1, unitTitle: u.title, topic: `Problem solving and recap: ${u.title}`.slice(0, 300), method: "Tutorial" });
    if (withAssessments && units.length >= 4 && (ui === 1 || ui === 3)) out.push({ unit: 0, unitTitle: "Assessment", topic: `Internal assessment ${ui === 1 ? "I (Units 1–2)" : "II (Units 3–4)"}`, method: "Assessment" });
  });
  out.push({ unit: 0, unitTitle: "Revision", topic: "Revision and previous question papers", method: "Revision" });
  return out.slice(0, 240);
}

/** The next `n` teaching dates on or after `from`, on the given weekdays (1 = Monday … 6 = Saturday). */
export function teachingDates(from: string, weekdays: number[], n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  for (let guard = 0; out.length < n && guard < 2000; guard++) {
    const wd = d.getUTCDay();
    if (weekdays.includes(wd)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
