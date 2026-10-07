import { z } from "zod";

/*
 * Curriculum Studio: the university's programme curricula (semesters, courses, credits, L-T-P, syllabus units and
 * course outcomes). The Super Admin prepares and publishes them; staff in every college read them and plan their
 * teaching from them (Course Roadmap).
 */

export const COURSE_CATEGORIES = ["HS", "BS", "ES", "PC", "PE", "OE", "EEC", "MC"] as const;
export const CATEGORY_LABEL: Record<(typeof COURSE_CATEGORIES)[number], string> = {
  HS: "Humanities & social sciences",
  BS: "Basic sciences",
  ES: "Engineering sciences",
  PC: "Professional core",
  PE: "Professional elective",
  OE: "Open elective",
  EEC: "Employability enhancement",
  MC: "Mandatory (non-credit)",
};
export const CURRICULUM_STATUSES = ["Draft", "Published", "Archived"] as const;

export const Unit = z.object({
  title: z.string().trim().min(2, "Name the unit").max(120),
  topics: z.string().trim().max(1200).default(""),
  hours: z.number().int().min(0).max(40),
});
export type Unit = z.infer<typeof Unit>;

export const Course = z.object({
  code: z.string().trim().min(3, "Course code").max(12).regex(/^[A-Z0-9]+$/, "Capital letters and digits only"),
  title: z.string().trim().min(3, "Course title").max(120),
  semester: z.number().int().min(1).max(12),
  category: z.enum(COURSE_CATEGORIES),
  l: z.number().int().min(0).max(6),
  t: z.number().int().min(0).max(4),
  p: z.number().int().min(0).max(12),
  credits: z.number().min(0).max(12),
  units: z.array(Unit).max(8).default([]),
  outcomes: z.array(z.string().trim().min(3).max(240)).max(8).default([]),
  textbooks: z.array(z.string().trim().min(3).max(200)).max(6).default([]),
});
export type Course = z.infer<typeof Course>;

export const CurriculumData = z.object({
  degree: z.string().trim().min(2).max(30),
  discipline: z.string().trim().min(2).max(90),
  semesters: z.number().int().min(1).max(12),
  description: z.string().trim().max(1500).default(""),
  programmeOutcomes: z.array(z.string().trim().min(3).max(300)).max(15).default([]),
  courses: z.array(Course).max(120),
});
export type CurriculumData = z.infer<typeof CurriculumData>;

export const CurriculumSummary = z.object({
  id: z.string(),
  programme: z.string(),
  regulation: z.string(),
  status: z.enum(CURRICULUM_STATUSES),
  version: z.number(),
  semesters: z.number(),
  courses: z.number(),
  credits: z.number(),
  withSyllabus: z.number(),
  updatedBy: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
});
export type CurriculumSummary = z.infer<typeof CurriculumSummary>;

export const CurriculumList = z.object({ curricula: z.array(CurriculumSummary), canEdit: z.boolean(), aiReady: z.boolean() });
export type CurriculumList = z.infer<typeof CurriculumList>;

export const CurriculumDoc = CurriculumSummary.extend({ data: CurriculumData, warnings: z.array(z.string()), canEdit: z.boolean(), aiReady: z.boolean() });
export type CurriculumDoc = z.infer<typeof CurriculumDoc>;

export const CreateCurriculum = z.object({
  degree: z.string().trim().min(2, "e.g. B.E.").max(30),
  discipline: z.string().trim().min(2, "e.g. Computer Science and Engineering").max(90),
  regulation: z.string().trim().min(2, "e.g. R2026").max(40),
  semesters: z.number().int().min(1).max(12),
  /** "ai" drafts every semester's courses; "blank" starts empty. */
  start: z.enum(["ai", "blank"]),
  focus: z.string().trim().max(600).default(""),
});
export type CreateCurriculum = z.infer<typeof CreateCurriculum>;

export const SaveCurriculum = z.object({ data: CurriculumData });
export const SyllabusRequest = z.object({
  code: z.string().regex(/^[A-Z0-9]{3,12}$/),
  title: z.string().trim().min(3).max(120),
  programme: z.string().trim().min(3).max(130),
  hours: z.number().int().min(15).max(90).default(45),
  notes: z.string().trim().max(1500).default(""),
});
export type SyllabusRequest = z.infer<typeof SyllabusRequest>;
export const Syllabus = z.object({ units: z.array(Unit).min(1).max(8), outcomes: z.array(z.string()).max(8), textbooks: z.array(z.string()).max(6) });
export type Syllabus = z.infer<typeof Syllabus>;

/** Problems worth fixing before publishing (shown, never blocking). */
export function curriculumWarnings(d: CurriculumData): string[] {
  const out: string[] = [];
  const codes = new Map<string, number>();
  for (const c of d.courses) codes.set(c.code, (codes.get(c.code) ?? 0) + 1);
  for (const [code, n] of codes) if (n > 1) out.push(`Course code ${code} is used ${n} times.`);
  for (let s = 1; s <= d.semesters; s++) {
    const cs = d.courses.filter((c) => c.semester === s);
    const credits = cs.reduce((a, c) => a + c.credits, 0);
    if (!cs.length) out.push(`Semester ${s} has no courses.`);
    else if (credits < 16 || credits > 28) out.push(`Semester ${s} carries ${credits} credits (usually 16–28).`);
  }
  for (const c of d.courses) {
    if (c.semester > d.semesters) out.push(`${c.code} is in semester ${c.semester}, beyond the programme's ${d.semesters}.`);
    if (c.category !== "MC" && Math.abs(c.l + c.t + c.p / 2 - c.credits) > 1) out.push(`${c.code}: ${c.credits} credits does not match L-T-P ${c.l}-${c.t}-${c.p}.`);
  }
  const missing = d.courses.filter((c) => !c.units.length && c.category !== "MC").length;
  if (missing) out.push(`${missing} course${missing === 1 ? " has" : "s have"} no syllabus units yet.`);
  return out.slice(0, 30);
}

export const totalCredits = (d: CurriculumData) => Math.round(d.courses.reduce((a, c) => a + c.credits, 0) * 10) / 10;
