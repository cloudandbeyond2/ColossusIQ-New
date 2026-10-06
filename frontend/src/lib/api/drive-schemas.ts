import { z } from "zod";

/* Placement Drives: what the placement officer enters, what is stored, and how eligibility is worked out. */

export const DRIVE_TYPES = ["On-campus", "Off-campus", "Virtual", "Pool campus"] as const;
export const DRIVE_STATUSES = ["Draft", "Open", "Closed", "Completed", "Cancelled"] as const;
export type DriveStatus = (typeof DRIVE_STATUSES)[number];
export const MAX_DRIVES = 300;

const text = (min: number, max: number, what: string) => z.string().trim().min(min, `Enter ${what}`).max(max, `Keep ${what} under ${max} characters`);
const optional = (max: number) => z.string().trim().max(max).default("");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
const date = z.string().refine(isDate, "Pick a valid date");
const optionalDate = z.string().refine((v) => v === "" || isDate(v), "Pick a valid date").default("");
const count = z.number().int().min(0).max(100000).default(0);

export const DriveBody = z
  .object({
    company: text(2, 100, "the company name"),
    role: text(2, 100, "the job role"),
    type: z.enum(DRIVE_TYPES),
    date,
    time: z.string().refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Use a time like 09:30").default(""),
    venue: optional(150),
    packageMin: z.number().min(0).max(500).default(0),
    packageMax: z.number().min(0).max(500).default(0),
    openings: z.number().int().min(0).max(5000).default(0),
    departments: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    minReadiness: z.number().int().min(0).max(100).default(0),
    deadline: optionalDate,
    description: optional(1500),
    rounds: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
    status: z.enum(DRIVE_STATUSES).default("Draft"),
    registered: count,
    shortlisted: count,
    offers: count,
  })
  .strict()
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.packageMax < v.packageMin) bad("packageMax", "The highest package cannot be below the lowest");
    if (v.deadline && v.deadline > v.date) bad("deadline", "Registration must close on or before the drive date");
    if (v.shortlisted > v.registered) bad("shortlisted", "Shortlisted cannot be more than registered");
    if (v.offers > v.registered) bad("offers", "Offers cannot be more than registered");
  });
export type DriveBody = z.infer<typeof DriveBody>;

export const DriveItem = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  type: z.enum(DRIVE_TYPES),
  date: z.string(),
  time: z.string(),
  venue: z.string(),
  packageMin: z.number(),
  packageMax: z.number(),
  openings: z.number(),
  departments: z.array(z.string()),
  minReadiness: z.number(),
  deadline: z.string(),
  description: z.string(),
  rounds: z.array(z.string()),
  status: z.enum(DRIVE_STATUSES),
  registered: z.number(),
  shortlisted: z.number(),
  offers: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Students who meet this drive's department and readiness rules right now. */
  eligible: z.number(),
  /** Where the drive date is compared with today (India time). */
  phase: z.enum(["upcoming", "today", "past"]),
});
export type DriveItem = z.infer<typeof DriveItem>;

export const DriveOverview = z.object({
  items: z.array(DriveItem),
  /** The college's own departments, from its student records. */
  departments: z.array(z.string()),
  students: z.number(),
  summary: z.object({
    total: z.number(),
    open: z.number(),
    upcoming: z.number(),
    completed: z.number(),
    offers: z.number(),
    /** Mean of (lowest + highest) / 2 over completed drives that state a package, in LPA. */
    averagePackage: z.number().nullable(),
  }),
  canEdit: z.boolean(),
});
export type DriveOverview = z.infer<typeof DriveOverview>;

export const EligibleStudent = z.object({
  name: z.string(),
  rollNo: z.string(),
  department: z.string(),
  total: z.number(),
  status: z.string(),
});
export type EligibleStudent = z.infer<typeof EligibleStudent>;

export const DriveDetail = z.object({ drive: DriveItem, students: z.array(EligibleStudent) });
export type DriveDetail = z.infer<typeof DriveDetail>;

/** The rule behind every "eligible" number: an empty department list means every department. */
export function meetsDrive(d: { departments: string[]; minReadiness: number }, s: { department: string; total: number }): boolean {
  return (d.departments.length === 0 || d.departments.includes(s.department)) && s.total >= d.minReadiness;
}

/** "₹6–8 LPA", "₹6 LPA" or "Not stated". */
export function packageText(min: number, max: number): string {
  const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (!min && !max) return "Not stated";
  if (!max || min === max) return `₹${f(max || min)} LPA`;
  return `₹${f(min)}–${f(max)} LPA`;
}
