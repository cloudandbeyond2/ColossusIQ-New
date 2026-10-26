import { z } from "zod";

export const OsceChecklistItemSchema = z.object({
  id: z.string(),
  step: z.string(),
  maxMarks: z.number(),
  isCritical: z.boolean(),
  category: z.enum(["Preparation", "Execution", "Patient Safety", "Communication"]),
});
export type OsceChecklistItem = z.infer<typeof OsceChecklistItemSchema>;

export const OsceStationSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  department: z.string(),
  domain: z.enum(["Procedure", "Communication", "Emergency", "Data interpretation", "Physical Exam"]),
  durationMinutes: z.number(),
  totalMarks: z.number(),
  passMarks: z.number(),
  nmcCompetencyCode: z.string(),
  room: z.string(),
  manikinEquipment: z.string(),
  examiner: z.string(),
  status: z.enum(["Active", "Maintenance", "Under Review"]),
  checklistCount: z.number(),
  averageScore: z.number(),
  passRate: z.number(),
  criticalStepRequired: z.boolean(),
  criticalStepDescription: z.string(),
  checklist: z.array(OsceChecklistItemSchema),
});
export type OsceStation = z.infer<typeof OsceStationSchema>;

export const OsceSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  batch: z.string(),
  department: z.string(),
  date: z.string(),
  timeSlot: z.string(),
  venue: z.string(),
  totalCandidates: z.number(),
  evaluatedCount: z.number(),
  stationsAssigned: z.number(),
  leadExaminer: z.string(),
  status: z.enum(["Scheduled", "In Progress", "Completed", "Results Published"]),
});
export type OsceSession = z.infer<typeof OsceSessionSchema>;

export const SkillsLabBookingSchema = z.object({
  id: z.string(),
  applicantName: z.string(),
  applicantRole: z.enum(["Student", "Resident", "Faculty"]),
  stationOrRoom: z.string(),
  equipment: z.string(),
  date: z.string(),
  timeSlot: z.string(),
  purpose: z.enum(["Independent Practice", "Faculty-Guided Demo", "Remediation Training"]),
  status: z.enum(["Approved", "Pending Review", "Completed", "Rejected"]),
  notes: z.string(),
});
export type SkillsLabBooking = z.infer<typeof SkillsLabBookingSchema>;

export const StudentOsceResultSchema = z.object({
  id: z.string(),
  rollNo: z.string(),
  studentName: z.string(),
  batch: z.string(),
  stationId: z.string(),
  /** The exam session this grade belongs to ("" when graded outside a scheduled session). */
  sessionId: z.string(),
  stationName: z.string(),
  score: z.number(),
  total: z.number(),
  scorePercent: z.number(),
  grade: z.enum(["Distinction", "Pass", "Remediation Needed"]),
  criticalStepMet: z.boolean(),
  examiner: z.string(),
  date: z.string(),
  evaluatorRemarks: z.string(),
  cbmeCertified: z.boolean(),
});
export type StudentOsceResult = z.infer<typeof StudentOsceResultSchema>;

export const SkillsLabEquipmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  serialNo: z.string(),
  category: z.string(),
  room: z.string(),
  status: z.enum(["Operational", "Calibration Due", "Maintenance"]),
  lastInspection: z.string(),
  nextMaintenance: z.string(),
  utilizationHoursWeek: z.number(),
  nmcComplianceStatus: z.enum(["Fully Compliant", "Action Needed"]),
});
export type SkillsLabEquipment = z.infer<typeof SkillsLabEquipmentSchema>;

export const OsceKpisSchema = z.object({
  activeStations: z.number(),
  skillsLabStations: z.number(),
  upcomingSessions: z.number(),
  certifiedCompetencies: z.number(),
  averagePassRate: z.number(),
  pendingBookings: z.number(),
  highFidelitySimulators: z.number(),
  nmcSkillsNormMet: z.boolean(),
});
export type OsceKpis = z.infer<typeof OsceKpisSchema>;

export const OsceOverviewSchema = z.object({
  kpis: OsceKpisSchema,
  stations: z.array(OsceStationSchema),
  sessions: z.array(OsceSessionSchema),
  bookings: z.array(SkillsLabBookingSchema),
  results: z.array(StudentOsceResultSchema),
  equipment: z.array(SkillsLabEquipmentSchema),
  departments: z.array(z.string()),
  /** Batches already used by sessions and results, offered as suggestions when typing a batch. */
  batches: z.array(z.string()),
  /** What the signed-in user may do, decided by the server. */
  permissions: z.object({ manage: z.boolean() }),
  /** The signed-in user, to prefill their own booking. */
  viewer: z.object({ name: z.string(), role: z.enum(["Student", "Resident", "Faculty"]), rollNo: z.string() }),
});
export type OsceOverview = z.infer<typeof OsceOverviewSchema>;

/* ---------------- Inputs for mutations ---------------- */

export const CreateOsceStationInput = z.object({
  title: z.string().min(3, "Station title must be at least 3 characters"),
  department: z.string().min(2, "Department is required"),
  domain: z.enum(["Procedure", "Communication", "Emergency", "Data interpretation", "Physical Exam"]),
  durationMinutes: z.number().min(3).max(30),
  totalMarks: z.number().min(10).max(100),
  passMarks: z.number().min(5).max(100),
  nmcCompetencyCode: z.string().min(2, "NMC competency code required"),
  room: z.string().min(2, "Room/Cubicle required"),
  manikinEquipment: z.string().min(2, "Manikin or equipment required"),
  criticalStepRequired: z.boolean(),
  criticalStepDescription: z.string(),
  checklist: z.array(
    z.object({
      step: z.string().min(3),
      maxMarks: z.number().min(1),
      isCritical: z.boolean(),
      category: z.enum(["Preparation", "Execution", "Patient Safety", "Communication"]),
    })
  ).min(1, "At least one checklist step is required"),
});
export type CreateOsceStationInput = z.infer<typeof CreateOsceStationInput>;

export const CreateOsceSessionInput = z.object({
  title: z.string().min(3, "Session title is required"),
  batch: z.string().min(2, "Batch is required"),
  department: z.string().min(2, "Department is required"),
  date: z.string().min(4, "Date is required"),
  timeSlot: z.string().min(3, "Time slot is required"),
  venue: z.string().min(2, "Venue is required"),
  totalCandidates: z.number().min(1),
  leadExaminer: z.string().min(2, "Lead examiner is required"),
});
export type CreateOsceSessionInput = z.infer<typeof CreateOsceSessionInput>;

export const CreateSkillsLabBookingInput = z.object({
  applicantName: z.string().min(2, "Applicant name required"),
  applicantRole: z.enum(["Student", "Resident", "Faculty"]),
  stationOrRoom: z.string().min(2, "Station or room required"),
  equipment: z.string().min(2, "Equipment required"),
  date: z.string().min(4, "Date required"),
  timeSlot: z.string().min(3, "Time slot required"),
  purpose: z.enum(["Independent Practice", "Faculty-Guided Demo", "Remediation Training"]),
  notes: z.string().optional().default(""),
});
export type CreateSkillsLabBookingInput = z.infer<typeof CreateSkillsLabBookingInput>;

export const UpdateBookingStatusInput = z.object({
  status: z.enum(["Approved", "Pending Review", "Completed", "Rejected"]),
});
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusInput>;

export const GradeStudentOsceInput = z.object({
  studentName: z.string().min(2, "Student name required"),
  rollNo: z.string().min(2, "Roll number required"),
  batch: z.string().min(2, "Batch required"),
  stationId: z.string().min(1, "Station ID required"),
  /** The exam session being graded (optional). */
  sessionId: z.string().optional().default(""),
  score: z.number().min(0),
  criticalStepMet: z.boolean(),
  evaluatorRemarks: z.string().optional().default(""),
  cbmeCertified: z.boolean().default(true),
});
export type GradeStudentOsceInput = z.infer<typeof GradeStudentOsceInput>;


export const UpdateSessionStatusInput = z.object({
  status: z.enum(["Scheduled", "In Progress", "Completed", "Results Published"]),
});
export type UpdateSessionStatusInput = z.infer<typeof UpdateSessionStatusInput>;

const IsoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-20");

export const CreateOsceEquipmentInput = z.object({
  name: z.string().min(2, "Equipment name is required").max(160),
  serialNo: z.string().min(1, "Serial number is required").max(60),
  category: z.string().min(2, "Category is required").max(120),
  room: z.string().min(2, "Room is required").max(120),
  status: z.enum(["Operational", "Calibration Due", "Maintenance"]).default("Operational"),
  lastInspection: IsoDay.or(z.literal("")).default(""),
  nextMaintenance: IsoDay.or(z.literal("")).default(""),
  utilizationHoursWeek: z.number().min(0).max(168).default(0),
});
export type CreateOsceEquipmentInput = z.infer<typeof CreateOsceEquipmentInput>;

export const UpdateOsceEquipmentInput = z.object({
  status: z.enum(["Operational", "Calibration Due", "Maintenance"]).optional(),
  room: z.string().min(2).max(120).optional(),
  lastInspection: IsoDay.or(z.literal("")).optional(),
  nextMaintenance: IsoDay.or(z.literal("")).optional(),
  utilizationHoursWeek: z.number().min(0).max(168).optional(),
});
export type UpdateOsceEquipmentInput = z.infer<typeof UpdateOsceEquipmentInput>;
