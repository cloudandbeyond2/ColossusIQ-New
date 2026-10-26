import { z } from "zod";

export const LogbookLevel = z.enum(["K", "KH", "SH", "P"]);
export type LogbookLevel = z.infer<typeof LogbookLevel>;

export const LogbookStatus = z.enum(["Not attempted", "Pending review", "Certified", "Returned"]);
export type LogbookStatus = z.infer<typeof LogbookStatus>;

export const LogbookCompetency = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string(),
  department: z.string(),
  level: LogbookLevel,
});
export type LogbookCompetency = z.infer<typeof LogbookCompetency>;

/** One competency as seen by one student. `entryId` is empty until the student first asks for sign-off. */
export const LogbookRow = z.object({
  competencyId: z.string(),
  entryId: z.string(),
  code: z.string(),
  description: z.string(),
  department: z.string(),
  level: LogbookLevel,
  studentSub: z.string(),
  studentName: z.string(),
  rollNo: z.string(),
  attempts: z.number(),
  status: LogbookStatus,
  notes: z.string(),
  remarks: z.string(),
  certifiedBy: z.string(),
  certifiedAt: z.string(),
});
export type LogbookRow = z.infer<typeof LogbookRow>;

export const LogbookOverview = z.object({
  mode: z.enum(["student", "reviewer"]),
  competencies: z.array(LogbookCompetency),
  rows: z.array(LogbookRow),
  summary: z.object({
    total: z.number(),
    certified: z.number(),
    pending: z.number(),
    returned: z.number(),
    notAttempted: z.number(),
  }),
  departments: z.array(z.string()),
  permissions: z.object({ request: z.boolean(), certify: z.boolean(), manage: z.boolean() }),
});
export type LogbookOverview = z.infer<typeof LogbookOverview>;

export const CompetencyDraft = z.object({
  code: z.string().trim().min(2).max(30),
  description: z.string().trim().min(3).max(300),
  department: z.string().trim().min(2).max(120),
  level: LogbookLevel,
});
export type CompetencyDraft = z.infer<typeof CompetencyDraft>;

export const CreateCompetenciesInput = z.object({
  items: z.array(CompetencyDraft).min(1, "Add at least one competency").max(200),
});
export type CreateCompetenciesInput = z.infer<typeof CreateCompetenciesInput>;

export const RequestSignoffInput = z.object({
  competencyId: z.string().min(1, "Choose a competency"),
  notes: z.string().trim().max(500).default(""),
});
export type RequestSignoffInput = z.infer<typeof RequestSignoffInput>;

export const ReviewEntryInput = z.object({
  decision: z.enum(["Certified", "Returned"]),
  remarks: z.string().trim().max(500).default(""),
});
export type ReviewEntryInput = z.infer<typeof ReviewEntryInput>;
