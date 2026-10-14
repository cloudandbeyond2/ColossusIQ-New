import { z } from "zod";

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
  status: z.enum(["Compliant", "Needs Attention", "Deficient"]),
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
  requiredFaculty: z.number(),
  actualFaculty: z.number(),
  aebasAttendance: z.number(),
  status: z.enum(["Compliant", "Needs Attention", "Deficient"]),
  deficiencyDetails: z.string().optional(),
});
export type NmcDepartmentCompliance = z.infer<typeof NmcDepartmentComplianceSchema>;

export const NmcCommitteeSchema = z.object({
  id: z.string(),
  name: z.string(),
  mandate: z.string(),
  chairperson: z.string(),
  convener: z.string(),
  membersCount: z.number(),
  meetingFrequency: z.string(),
  lastMeetingDate: z.string(),
  status: z.enum(["Constituted & Active", "Pending Reconstitution", "In Review"]),
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
  lastInspectionDate: z.string().optional(),
  nextInspectionWindow: z.string().optional(),
});
export type NmcProfile = z.infer<typeof NmcProfileSchema>;

export const NmcComplianceDataSchema = z.object({
  collegeId: z.string(),
  collegeName: z.string(),
  stream: z.string(),
  overallScore: z.number(),
  overallGrade: z.string(),
  overallStatus: z.string(),
  kpis: z.object({
    overallCompliance: z.number(),
    facultyAdequacy: z.number(),
    aebasAverage: z.number(),
    bedOccupancy: z.number(),
    cbmeCompletion: z.number(),
    openActions: z.number(),
  }),
  norms: z.array(NmcNormItemSchema),
  departments: z.array(NmcDepartmentComplianceSchema),
  committees: z.array(NmcCommitteeSchema),
  actions: z.array(NmcActionItemSchema),
  profile: NmcProfileSchema,
  strengths: z.array(z.string()),
  deficiencies: z.array(z.string()),
});
export type NmcComplianceData = z.infer<typeof NmcComplianceDataSchema>;

// Inputs
export const CreateNmcActionInput = z.object({
  title: z.string().min(3).max(200),
  category: z.string().min(2).max(100),
  priority: z.enum(["High", "Medium", "Low"]).default("High"),
  assignee: z.string().min(2).max(100),
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
  chairperson: z.string().min(2).max(100),
  convener: z.string().min(2).max(100),
  membersCount: z.number().int().min(1).max(50),
  status: z.enum(["Constituted & Active", "Pending Reconstitution", "In Review"]),
  lastMeetingDate: z.string().min(8).max(20),
  momUploaded: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});
export type UpdateNmcCommitteeInput = z.infer<typeof UpdateNmcCommitteeInput>;

export const UpdateNmcProfileInput = z.object({
  nmcCode: z.string().min(2).max(50),
  mbbsSeats: z.number().int().min(50).max(500),
  ethicsCommitteeRegNo: z.string().min(2).max(100),
  cctvStreamsOnline: z.number().int().min(0).max(100).optional(),
  aebasPortalActive: z.boolean().optional(),
  meuCertified: z.boolean().optional(),
});
export type UpdateNmcProfileInput = z.infer<typeof UpdateNmcProfileInput>;
