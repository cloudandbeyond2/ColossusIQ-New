import { z } from "zod";

export const HospitalDepartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["Medicine & Allied", "Surgery & Allied", "OBG & Paediatrics", "Emergency & Critical Care"]),
  hod: z.string(),
  teachingBeds: z.number(),
  icuBeds: z.number().default(0),
  icuOccupied: z.number().default(0),
  occupiedBeds: z.number(),
  occupancyPercent: z.number(),
  opdDaily: z.number(),
  ipdAdmissionsDaily: z.number(),
  surgeriesMonthly: z.number().optional(),
  deliveriesMonthly: z.number().optional(),
  studentCasesWeekly: z.number(),
  cbmeTargetCases: z.number(),
  units: z.array(z.string()),
  activeStudents: z.number(),
  status: z.enum(["Optimal", "Surplus", "Attention Required", "Awaiting Census"]),
  statusNotes: z.string().optional(),
  lastCensusAt: z.string().optional(),
});
export type HospitalDepartment = z.infer<typeof HospitalDepartmentSchema>;

export const HospitalKpisSchema = z.object({
  totalBeds: z.number(),
  occupiedBeds: z.number(),
  occupancyRate: z.number(),
  dailyOpd: z.number(),
  dailyIpdAdmissions: z.number(),
  dailyDischarges: z.number(),
  icuOccupiedBeds: z.number(),
  totalIcuBeds: z.number(),
  emergencyFootfall: z.number(),
  monthlySurgeries: z.number(),
  monthlyDeliveries: z.number(),
  clinicalMaterialAvg: z.number(),
  nmcComplianceScore: z.number(),
});
export type HospitalKpis = z.infer<typeof HospitalKpisSchema>;

export const HospitalNmcNormSchema = z.object({
  id: z.string(),
  title: z.string(),
  currentValue: z.string(),
  normRequirement: z.string(),
  compliant: z.boolean(),
  status: z.enum(["Pass", "Warning", "Deficiency"]),
  remediation: z.string().optional(),
});
export type HospitalNmcNorm = z.infer<typeof HospitalNmcNormSchema>;

export const HospitalCensusLogSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  department: z.string(),
  actor: z.string(),
  summary: z.string(),
  notes: z.string().optional(),
});
export type HospitalCensusLog = z.infer<typeof HospitalCensusLogSchema>;

export const HospitalRotationItemSchema = z.object({
  id: z.string(),
  student: z.string(),
  regNo: z.string(),
  phase: z.string(),
  department: z.string(),
  unit: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  supervisor: z.string(),
  attendance: z.number(),
  competenciesSigned: z.number(),
  status: z.string(),
  remarks: z.string().optional(),
});
export type HospitalRotationItem = z.infer<typeof HospitalRotationItemSchema>;

export const HospitalMonthlyTrendSchema = z.object({
  name: z.string(),
  opdDivided10: z.number(),
  ipd: z.number(),
  occupancy: z.number(),
});
export type HospitalMonthlyTrend = z.infer<typeof HospitalMonthlyTrendSchema>;

export const HospitalProfileSchema = z.object({
  hospitalName: z.string(),
  labTestsDaily: z.number().nullable(),
  bloodWholeUnits: z.number().nullable(),
  bloodComponentUnits: z.number().nullable(),
  bloodBankLicensed: z.boolean(),
});
export type HospitalProfile = z.infer<typeof HospitalProfileSchema>;

export const HospitalOverviewSchema = z.object({
  collegeId: z.string(),
  hospitalName: z.string(),
  stream: z.string(),
  kpis: HospitalKpisSchema,
  departments: z.array(HospitalDepartmentSchema),
  nmcNorms: z.array(HospitalNmcNormSchema),
  recentLogs: z.array(HospitalCensusLogSchema),
  activeRotations: z.array(HospitalRotationItemSchema),
  monthlyTrends: z.array(HospitalMonthlyTrendSchema),
  profile: HospitalProfileSchema,
  permissions: z.object({ manage: z.boolean(), certify: z.boolean() }),
});
export type HospitalOverview = z.infer<typeof HospitalOverviewSchema>;

export const UpdateHospitalCensusInput = z.object({
  department: z.string().min(2),
  opd: z.number().int().min(0).max(5000),
  ipdAdmissions: z.number().int().min(0).max(500),
  occupiedBeds: z.number().int().min(0).max(1000),
  surgeries: z.number().int().min(0).max(500).optional(),
  deliveries: z.number().int().min(0).max(300).optional(),
  icuOccupied: z.number().int().min(0).max(500).optional(),
  discharges: z.number().int().min(0).max(500).optional(),
  casesPerStudent: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
});
export type UpdateHospitalCensusInput = z.infer<typeof UpdateHospitalCensusInput>;

export const CertifyRotationInput = z.object({
  rotationId: z.string().min(1),
  competenciesSigned: z.number().int().min(0).max(200).optional(),
  attendance: z.number().int().min(0).max(100).optional(),
  remarks: z.string().max(500).optional(),
});
export type CertifyRotationInput = z.infer<typeof CertifyRotationInput>;

export const HospitalCategoryEnum = z.enum(["Medicine & Allied", "Surgery & Allied", "OBG & Paediatrics", "Emergency & Critical Care"]);

export const CreateHospitalDepartmentInput = z.object({
  name: z.string().trim().min(2, "Department name is required").max(120),
  category: HospitalCategoryEnum,
  hod: z.string().trim().max(120).default(""),
  teachingBeds: z.number().int().min(0).max(2000),
  icuBeds: z.number().int().min(0).max(500).default(0),
  cbmeTargetCases: z.number().min(0).max(100).default(0),
  units: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});
export type CreateHospitalDepartmentInput = z.infer<typeof CreateHospitalDepartmentInput>;

export const UpdateHospitalProfileInput = z.object({
  hospitalName: z.string().trim().max(160).default(""),
  labTestsDaily: z.number().int().min(0).max(100000).nullable().default(null),
  bloodWholeUnits: z.number().int().min(0).max(100000).nullable().default(null),
  bloodComponentUnits: z.number().int().min(0).max(100000).nullable().default(null),
  bloodBankLicensed: z.boolean().default(false),
});
export type UpdateHospitalProfileInput = z.infer<typeof UpdateHospitalProfileInput>;
