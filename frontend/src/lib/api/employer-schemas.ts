import { z } from "zod";

/*
 * Employer schemas: recruiter relationships, partnership tiers, contact profiles,
 * MoU statuses, and 3-year hiring outcomes.
 */

export const EMPLOYER_SECTORS = [
  "IT & Software",
  "Product & Tech",
  "BFSI & Fintech",
  "Consulting & Services",
  "Core Engineering",
  "Healthcare & Biotech",
  "Manufacturing & Automotive",
] as const;
export type EmployerSector = (typeof EMPLOYER_SECTORS)[number];

export const EMPLOYER_TIERS = [
  "Tier-1 Partner",
  "Preferred Recruiter",
  "Active",
  "Prospect",
  "Inactive",
] as const;
export type EmployerTier = (typeof EMPLOYER_TIERS)[number];

export const MOU_STATUSES = [
  "Active MoU",
  "Under Renewal",
  "In Discussion",
  "None",
] as const;
export type MouStatus = (typeof MOU_STATUSES)[number];

const text = (min: number, max: number, what: string) =>
  z.string().trim().min(min, `Enter ${what}`).max(max, `Keep ${what} under ${max} characters`);

const optionalText = (max: number) => z.string().trim().max(max).default("");

const isDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

const optionalDate = z
  .string()
  .refine((v) => v === "" || isDate(v), "Pick a valid date")
  .default("");

export const EmployerBody = z
  .object({
    company: text(2, 100, "the company name"),
    sector: z.enum(EMPLOYER_SECTORS),
    tier: z.enum(EMPLOYER_TIERS).default("Active"),
    website: optionalText(200),
    location: text(2, 100, "the location or headquarters"),
    contactName: text(2, 100, "the primary contact person"),
    contactDesignation: text(2, 100, "the contact designation"),
    contactEmail: z.string().trim().email("Enter a valid email address").max(120),
    contactPhone: optionalText(25),
    contactLinkedin: optionalText(200),
    mouStatus: z.enum(MOU_STATUSES).default("None"),
    mouValidUntil: optionalDate,
    totalHires: z.number().int().min(0).max(50000).default(0),
    averagePackage: z.number().min(0).max(500).default(0),
    highestPackage: z.number().min(0).max(500).default(0),
    lastDriveDate: optionalDate,
    nextDriveDate: optionalDate,
    notes: optionalText(1500),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.highestPackage < v.averagePackage && v.highestPackage > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["highestPackage"],
        message: "Highest package cannot be less than average package",
      });
    }
  });

export type EmployerBody = z.infer<typeof EmployerBody>;

export const EmployerItem = z.object({
  id: z.string(),
  collegeId: z.string(),
  company: z.string(),
  sector: z.enum(EMPLOYER_SECTORS),
  tier: z.enum(EMPLOYER_TIERS),
  website: z.string(),
  location: z.string(),
  contactName: z.string(),
  contactDesignation: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  contactLinkedin: z.string(),
  mouStatus: z.enum(MOU_STATUSES),
  mouValidUntil: z.string(),
  totalHires: z.number(),
  averagePackage: z.number(),
  highestPackage: z.number(),
  lastDriveDate: z.string(),
  nextDriveDate: z.string(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type EmployerItem = z.infer<typeof EmployerItem>;

export const EmployerOverview = z.object({
  items: z.array(EmployerItem),
  summary: z.object({
    totalEmployers: z.number(),
    activePartners: z.number(),
    tier1Count: z.number(),
    totalHires3Yr: z.number(),
    averagePackage: z.number().nullable(),
    activeMous: z.number(),
  }),
  sectors: z.array(z.string()),
  canEdit: z.boolean(),
});

export type EmployerOverview = z.infer<typeof EmployerOverview>;
