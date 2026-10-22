import { z } from "zod";

export const CbcsCategorySchema = z.enum([
  "Discipline-Specific Elective (DSE)",
  "Generic Elective (GE)",
  "Skill Enhancement Course (SEC)",
  "Ability Enhancement (AECC)",
  "Value-Added Course (VAC)",
]);
export type CbcsCategory = z.infer<typeof CbcsCategorySchema>;

export const CbcsCourseSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  offeringDepartment: z.string(),
  semester: z.number(),
  category: CbcsCategorySchema,
  credits: z.number(),
  seatsTotal: z.number(),
  seatsFilled: z.number(),
  instructor: z.string(),
  schedule: z.string(),
  syllabusSummary: z.string(),
  status: z.enum(["Open", "Waitlisted", "Full", "Closed"]),
});
export type CbcsCourse = z.infer<typeof CbcsCourseSchema>;

export const CbcsStudentChoiceSchema = z.object({
  id: z.string(),
  studentName: z.string(),
  regNo: z.string(),
  department: z.string(),
  semester: z.number(),
  courseId: z.string(),
  courseCode: z.string(),
  courseTitle: z.string(),
  category: CbcsCategorySchema,
  credits: z.number(),
  registeredAt: z.string(),
  status: z.enum(["Confirmed", "Waitlisted", "Pending Approval"]),
});
export type CbcsStudentChoice = z.infer<typeof CbcsStudentChoiceSchema>;

export const CbcsKpisSchema = z.object({
  totalCourses: z.number(),
  totalCapacity: z.number(),
  totalEnrolled: z.number(),
  seatUtilizationPercent: z.number(),
  fullCoursesCount: z.number(),
  registrationWindowOpen: z.boolean(),
  registrationDeadline: z.string(),
  totalCreditsOffered: z.number(),
});
export type CbcsKpis = z.infer<typeof CbcsKpisSchema>;

export const CbcsCategorySummarySchema = z.object({
  category: z.string(),
  count: z.number(),
  enrolled: z.number(),
  capacity: z.number(),
  utilization: z.number(),
});
export type CbcsCategorySummary = z.infer<typeof CbcsCategorySummarySchema>;

export const CbcsCategoryRuleSchema = z.object({
  category: CbcsCategorySchema,
  credits: z.string(),
  objective: z.string(),
  requirement: z.string(),
  mandatory: z.boolean(),
});
export type CbcsCategoryRule = z.infer<typeof CbcsCategoryRuleSchema>;

export const CbcsPermissionsSchema = z.object({
  /** Add courses and change seat capacity. */
  manageCourses: z.boolean(),
  /** Open/close the registration window and edit the policy text. */
  manageWindow: z.boolean(),
  /** Register (and drop) any student of the college. */
  enrollOthers: z.boolean(),
  /** A student registering themselves. */
  selfEnroll: z.boolean(),
});
export type CbcsPermissions = z.infer<typeof CbcsPermissionsSchema>;

export const CbcsOverviewSchema = z.object({
  collegeId: z.string(),
  collegeName: z.string(),
  stream: z.string(),
  kpis: CbcsKpisSchema,
  courses: z.array(CbcsCourseSchema),
  studentRegistrations: z.array(CbcsStudentChoiceSchema),
  categorySummaries: z.array(CbcsCategorySummarySchema),
  /** The college's own departments (for the offering-department list). */
  departments: z.array(z.string()),
  /** The UGC credit rule for each course category. */
  categoryRules: z.array(CbcsCategoryRuleSchema),
  /** Policy lines the institution has written (editable). */
  policies: z.array(z.string()),
  allocationRule: z.string(),
  /** Is registration possible right now (window open and the deadline not passed)? */
  registrationOpenNow: z.boolean(),
  registrationClosedReason: z.string(),
  permissions: CbcsPermissionsSchema,
  /** Course ids the signed-in student is registered in. */
  myCourseIds: z.array(z.string()),
  /** The signed-in student, for self-registration. */
  viewer: z
    .object({ name: z.string(), regNo: z.string(), department: z.string(), semester: z.number() })
    .nullable(),
});
export type CbcsOverview = z.infer<typeof CbcsOverviewSchema>;

// Inputs
export const CreateCbcsCourseInput = z.object({
  code: z.string().min(2).max(20),
  title: z.string().min(3).max(120),
  offeringDepartment: z.string().min(2).max(100),
  semester: z.number().int().min(1).max(8),
  category: CbcsCategorySchema,
  credits: z.number().int().min(1).max(6),
  seatsTotal: z.number().int().min(1).max(1000),
  instructor: z.string().min(2).max(100),
  schedule: z.string().min(3).max(100),
  syllabusSummary: z.string().max(500),
});
export type CreateCbcsCourseInput = z.infer<typeof CreateCbcsCourseInput>;

export const UpdateCbcsSeatsInput = z.object({
  courseId: z.string().min(1),
  seatsTotal: z.number().int().min(1).max(1000),
});
export type UpdateCbcsSeatsInput = z.infer<typeof UpdateCbcsSeatsInput>;

export const EnrollStudentElectiveInput = z.object({
  courseId: z.string().min(1),
  studentName: z.string().min(2).max(100).optional(),
  regNo: z.string().min(2).max(30).optional(),
  department: z.string().min(2).max(100).optional(),
  semester: z.number().int().min(1).max(8).optional(),
});
export type EnrollStudentElectiveInput = z.infer<typeof EnrollStudentElectiveInput>;

export const UpdateCbcsWindowInput = z.object({
  registrationWindowOpen: z.boolean(),
  /** "2026-10-24 17:00 IST" (IST wall-clock time), or empty for no deadline. */
  registrationDeadline: z.string().max(30),
  /** The institution's own enrolment policy lines; omit to keep the saved ones. */
  policies: z.array(z.string().trim().min(3).max(240)).max(10).optional(),
});
export type UpdateCbcsWindowInput = z.infer<typeof UpdateCbcsWindowInput>;
