import { z } from "zod";

/** "Not Assessed" means the college has not recorded the data that norm is measured from. */
export const NmcStatusSchema = z.enum(["Compliant", "Needs Attention", "Deficient", "Not Assessed"]);

export const NmcNormItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum([
    "Faculty & AEBAS",
    "Hospital & Wards",
    "Clinical Material",
    "Infrastructure & Labs",
    "Academic & CBME",
    "Statutory Governance",
  ]),
  current: z.string(),
  norm: z.string(),
  score: z.number(),
  target: z.number(),
  status: NmcStatusSchema,
  remediation: z.string().optional(),
});
export type NmcNormItem = z.infer<typeof NmcNormItemSchema>;

export const NmcDepartmentComplianceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["Pre-clinical", "Para-clinical", "Clinical"]),
  professors: z.number(),
  assocProfessors: z.number(),
  asstProfessors: z.number(),
  seniorResidents: z.number(),
  /** null until the college sets the required strength for this department. */
  requiredFaculty: z.number().nullable(),
  actualFaculty: z.number(),
  /** null until the college records this department's biometric attendance. */
  aebasAttendance: z.number().nullable(),
  status: z.enum(["Compliant", "Needs Attention", "Deficient", "Not Set"]),
  deficiencyDetails: z.string().optional(),
});
export type NmcDepartmentCompliance = z.infer<typeof NmcDepartmentComplianceSchema>;

export const NmcCommitteeStatusSchema = z.enum(["Not Constituted", "Constituted & Active", "Pending Reconstitution", "In Review"]);

export const NmcCommitteeSchema = z.object({
  id: z.string(),
  name: z.string(),
  mandate: z.string(),
  chairperson: z.string(),
  convener: z.string(),
  membersCount: z.number(),
  meetingFrequency: z.string(),
  lastMeetingDate: z.string(),
  status: NmcCommitteeStatusSchema,
  momUploaded: z.boolean(),
  notes: z.string().optional(),
});
export type NmcCommittee = z.infer<typeof NmcCommitteeSchema>;

export const NmcActionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  priority: z.enum(["High", "Medium", "Low"]),
  status: z.enum(["Pending", "In Progress", "Resolved"]),
  assignee: z.string(),
  dueDate: z.string(),
  notes: z.string().optional(),
  resolvedAt: z.string().optional(),
});
export type NmcActionItem = z.infer<typeof NmcActionItemSchema>;

/** Empty string / 0 means "not recorded yet". */
export const NmcProfileSchema = z.object({
  nmcCode: z.string(),
  mbbsSeats: z.number(),
  lopStatus: z.string(),
  affiliationYear: z.number(),
  cctvStreamsOnline: z.number(),
  cctvStreamsTotal: z.number(),
  aebasPortalActive: z.boolean(),
  meuCertified: z.boolean(),
  ethicsCommitteeRegNo: z.string(),
  lastInspectionDate: z.string(),
  nextInspectionWindow: z.string(),
});
export type NmcProfile = z.infer<typeof NmcProfileSchema>;

export const NmcComplianceDataSchema = z.object({
  collegeId: z.string(),
  collegeName: z.string(),
  stream: z.string(),
  /** null until at least one norm can be assessed. */
  overallScore: z.number().nullable(),
  overallGrade: z.string(),
  overallStatus: z.string(),
  kpis: z.object({
    overallCompliance: z.number().nullable(),
    facultyAdequacy: z.number().nullable(),
    aebasAverage: z.number().nullable(),
    bedOccupancy: z.number().nullable(),
    openActions: z.number(),
  }),
  norms: z.array(NmcNormItemSchema),
  departments: z.array(NmcDepartmentComplianceSchema),
  committees: z.array(NmcCommitteeSchema),
  actions: z.array(NmcActionItemSchema),
  profile: NmcProfileSchema,
  strengths: z.array(z.string()),
  deficiencies: z.array(z.string()),
  /** What the signed-in user may do, decided by the server. */
  permissions: z.object({ manage: z.boolean() }),
});
export type NmcComplianceData = z.infer<typeof NmcComplianceDataSchema>;

// Inputs
export const CreateNmcActionInput = z.object({
  title: z.string().trim().min(3).max(200),
  category: z.string().min(2).max(100),
  priority: z.enum(["High", "Medium", "Low"]).default("High"),
  assignee: z.string().trim().min(2).max(100),
  dueDate: z.string().min(8).max(20),
  notes: z.string().max(500).optional(),
});
export type CreateNmcActionInput = z.infer<typeof CreateNmcActionInput>;

export const UpdateNmcActionStatusInput = z.object({
  status: z.enum(["Pending", "In Progress", "Resolved"]),
  notes: z.string().max(500).optional(),
});
export type UpdateNmcActionStatusInput = z.infer<typeof UpdateNmcActionStatusInput>;

export const UpdateNmcCommitteeInput = z.object({
  chairperson: z.string().trim().max(100).default(""),
  convener: z.string().trim().max(100).default(""),
  membersCount: z.number().int().min(0).max(50).default(0),
  status: NmcCommitteeStatusSchema,
  lastMeetingDate: z.string().max(20).default(""),
  momUploaded: z.boolean().default(false),
  meetingFrequency: z.string().max(60).optional(),
  notes: z.string().max(500).optional(),
});
export type UpdateNmcCommitteeInput = z.infer<typeof UpdateNmcCommitteeInput>;

export const UpdateNmcProfileInput = z.object({
  nmcCode: z.string().trim().max(50).default(""),
  mbbsSeats: z.number().int().min(0).max(500).default(0),
  ethicsCommitteeRegNo: z.string().trim().max(100).default(""),
  cctvStreamsOnline: z.number().int().min(0).max(1000).optional(),
  cctvStreamsTotal: z.number().int().min(0).max(1000).optional(),
  aebasPortalActive: z.boolean().optional(),
  meuCertified: z.boolean().optional(),
  lopStatus: z.string().trim().max(120).optional(),
  affiliationYear: z.number().int().min(0).max(2200).optional(),
  lastInspectionDate: z.string().max(20).optional(),
  nextInspectionWindow: z.string().trim().max(80).optional(),
});
export type UpdateNmcProfileInput = z.infer<typeof UpdateNmcProfileInput>;

export const UpdateNmcDepartmentNormInput = z.object({
  department: z.string().min(2).max(100),
  requiredFaculty: z.number().int().min(0).max(200).nullable(),
  aebasAttendance: z.number().min(0).max(100).nullable(),
});
export type UpdateNmcDepartmentNormInput = z.infer<typeof UpdateNmcDepartmentNormInput>;
