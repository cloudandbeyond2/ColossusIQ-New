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

export const CbcsOverviewSchema = z.object({
  collegeId: z.string(),
  collegeName: z.string(),
  stream: z.string(),
  kpis: CbcsKpisSchema,
  courses: z.array(CbcsCourseSchema),
  studentRegistrations: z.array(CbcsStudentChoiceSchema),
  categorySummaries: z.array(CbcsCategorySummarySchema),
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
  seatsTotal: z.number().int().min(10).max(500),
  instructor: z.string().min(2).max(100),
  schedule: z.string().min(3).max(100),
  syllabusSummary: z.string().max(500),
});
export type CreateCbcsCourseInput = z.infer<typeof CreateCbcsCourseInput>;

export const UpdateCbcsSeatsInput = z.object({
  courseId: z.string().min(1),
  seatsTotal: z.number().int().min(10).max(1000),
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
  registrationDeadline: z.string().min(8).max(30),
});
export type UpdateCbcsWindowInput = z.infer<typeof UpdateCbcsWindowInput>;
