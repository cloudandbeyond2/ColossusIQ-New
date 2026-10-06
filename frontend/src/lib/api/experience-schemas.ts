import { z } from "zod";

/** Shared by the browser and the server: a student's Experience Passport and how faculty verify it. */

export const EXPERIENCE_CATEGORIES = [
  "Volunteering",
  "Leadership",
  "Competition",
  "Conference or workshop",
  "Social service",
  "Club or society",
  "Sports or cultural",
  "Internship or work",
  "Other",
] as const;
export const ExperienceCategory = z.enum(EXPERIENCE_CATEGORIES);
export type ExperienceCategory = z.infer<typeof ExperienceCategory>;

export const EXPERIENCE_STATUSES = ["Pending", "Verified", "Rejected"] as const;
export const ExperienceStatus = z.enum(EXPERIENCE_STATUSES);
export type ExperienceStatus = z.infer<typeof ExperienceStatus>;

export const MAX_ACTIVITIES = 100;

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month");
const shape = {
  title: z.string().trim().min(2, "Name the activity (at least 2 characters)").max(120),
  category: ExperienceCategory,
  organisation: z.string().trim().max(120),
  role: z.string().trim().max(100),
  startMonth: month,
  /** null while the activity is still going on. */
  endMonth: month.nullable(),
  description: z.string().trim().max(1000),
  /** Evidence a verifier can open: a certificate, a post, an event page. */
  link: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Use a full link starting with http:// or https://"),
};

const ordered = (v: { startMonth?: string; endMonth?: string | null }) => !v.startMonth || !v.endMonth || v.endMonth >= v.startMonth;
const orderedMsg = { message: "The end month cannot be before the start month", path: ["endMonth"] };

export const ExperienceInput = z
  .object({ ...shape, organisation: shape.organisation.default(""), role: shape.role.default(""), endMonth: shape.endMonth.default(null), description: shape.description.default(""), link: shape.link.default("") })
  .strict()
  .refine(ordered, orderedMsg);
export type ExperienceInput = z.infer<typeof ExperienceInput>;

export const ExperiencePatch = z.object(shape).partial().strict().refine(ordered, orderedMsg);
export type ExperiencePatch = z.infer<typeof ExperiencePatch>;

export const ReviewBody = z
  .object({ decision: z.enum(["Verified", "Rejected"]), note: z.string().trim().max(500).default("") })
  .strict()
  .refine((v) => v.decision === "Verified" || v.note !== "", { message: "Tell the student what to fix", path: ["note"] });
export type ReviewBody = z.infer<typeof ReviewBody>;

export const ExperienceItem = z.object({
  id: z.string(),
  title: z.string(),
  category: ExperienceCategory,
  organisation: z.string(),
  role: z.string(),
  startMonth: z.string(),
  endMonth: z.string().nullable(),
  /** "Jun 2025 – Present" */
  period: z.string(),
  description: z.string(),
  link: z.string(),
  status: ExperienceStatus,
  reviewNote: z.string(),
  reviewerName: z.string(),
  reviewerRole: z.string(),
  reviewedAt: z.string().nullable(),
  studentName: z.string(),
  rollNo: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Written by the signed-in person (students edit and delete only their own). */
  mine: z.boolean(),
});
export type ExperienceItem = z.infer<typeof ExperienceItem>;

export const ExperienceOverview = z.object({
  /** Students: their own activities. Faculty and HODs: every activity in the college. */
  items: z.array(ExperienceItem),
  canReview: z.boolean(),
  summary: z.object({ total: z.number(), verified: z.number(), pending: z.number(), rejected: z.number() }),
  categories: z.array(z.string()),
});
export type ExperienceOverview = z.infer<typeof ExperienceOverview>;
