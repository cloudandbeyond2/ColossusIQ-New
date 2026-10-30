import { z } from "zod";
import { DRIVE_TYPES } from "./drive-schemas";

export const JOB_TYPES = [
  "On-campus",
  "Off-campus",
  "Virtual",
  "Pool campus",
  "Full Time",
  "Internship",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const APPLICATION_STATUSES = [
  "Applied",
  "Under Review",
  "Shortlisted",
  "Interview Scheduled",
  "Offered",
  "Rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const JobItem = z.object({
  id: z.string(),
  company: z.string(),
  companyLogo: z.string().optional(),
  role: z.string(),
  type: z.string(),
  category: z.enum(["campus-drive", "industry-job", "internship"]),
  location: z.string(),
  venue: z.string().default(""),
  packageMin: z.number().default(0),
  packageMax: z.number().default(0),
  packageText: z.string(),
  openings: z.number().default(0),
  departments: z.array(z.string()).default([]),
  minReadiness: z.number().default(0),
  minCgpa: z.number().default(0),
  date: z.string().default(""),
  deadline: z.string().default(""),
  description: z.string(),
  responsibilities: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  rounds: z.array(z.string()).default([]),
  status: z.enum(["Open", "Upcoming", "Closing Soon", "Closed"]).default("Open"),
  isDrive: z.boolean().default(false),
  driveId: z.string().optional(),
  matchScore: z.number().min(0).max(100).default(70),
  matchedSkills: z.array(z.string()).default([]),
  missingSkills: z.array(z.string()).default([]),
  isEligible: z.boolean().default(true),
  eligibilityReasons: z.array(z.string()).default([]),
  eligibilityGaps: z.array(z.string()).default([]),
});
export type JobItem = z.infer<typeof JobItem>;

export const JobApplication = z.object({
  id: z.string(),
  jobId: z.string(),
  company: z.string(),
  role: z.string(),
  type: z.string(),
  appliedAt: z.string(),
  status: z.enum(APPLICATION_STATUSES).default("Applied"),
  stage: z.number().int().min(1).max(5).default(1),
  nextStep: z.string(),
  resumeName: z.string(),
  notes: z.string().optional(),
});
export type JobApplication = z.infer<typeof JobApplication>;

export const StudentJobsOverview = z.object({
  student: z.object({
    sub: z.string(),
    name: z.string(),
    rollNo: z.string(),
    department: z.string(),
    semester: z.number(),
    cgpa: z.number(),
  }),
  readiness: z.object({
    total: z.number(),
    quizAverage: z.number(),
    certificates: z.number(),
    aptitude: z.number(),
    interview: z.number(),
    resume: z.number(),
    status: z.enum(["Placement ready", "Almost ready", "Needs work"]),
    gaps: z.array(z.string()),
  }),
  summary: z.object({
    totalOpportunities: z.number(),
    eligibleCount: z.number(),
    campusDrivesCount: z.number(),
    applicationsCount: z.number(),
    shortlistedCount: z.number(),
    savedCount: z.number(),
    highestPackageLpa: z.number(),
    averagePackageLpa: z.number(),
  }),
  jobs: z.array(JobItem),
  applications: z.array(JobApplication),
  savedIds: z.array(z.string()),
});
export type StudentJobsOverview = z.infer<typeof StudentJobsOverview>;

export const ApplyJobBody = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  resumeName: z.string().trim().min(1).default("Primary ATS Resume"),
  notes: z.string().trim().max(500).default(""),
});
export type ApplyJobBody = z.infer<typeof ApplyJobBody>;

export const WithdrawJobBody = z.object({
  jobId: z.string().min(1, "Job ID is required"),
});
export type WithdrawJobBody = z.infer<typeof WithdrawJobBody>;

export const ToggleSaveJobBody = z.object({
  jobId: z.string().min(1, "Job ID is required"),
});
export type ToggleSaveJobBody = z.infer<typeof ToggleSaveJobBody>;

export const MatchedCandidate = z.object({
  id: z.string(),
  name: z.string(),
  rollNo: z.string(),
  department: z.string(),
  semester: z.number().default(8),
  cgpa: z.number().default(7.5),
  readinessTotal: z.number(),
  resumeScore: z.number().default(0),
  interviewScore: z.number().default(0),
  status: z.string(),
  collegeName: z.string().optional(),
});
export type MatchedCandidate = z.infer<typeof MatchedCandidate>;

export const PlacementJobItem = z.object({
  id: z.string(),
  company: z.string(),
  companyLogo: z.string().optional(),
  role: z.string(),
  type: z.string(),
  category: z.enum(["campus-drive", "industry-job", "internship"]),
  location: z.string(),
  venue: z.string().optional(),
  packageMin: z.number().default(0),
  packageMax: z.number().default(0),
  packageText: z.string(),
  openings: z.number().default(0),
  departments: z.array(z.string()).default([]),
  minReadiness: z.number().default(0),
  minCgpa: z.number().default(0),
  date: z.string().default(""),
  deadline: z.string().default(""),
  description: z.string(),
  responsibilities: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  status: z.enum(["Open", "Upcoming", "Closing Soon", "Closed"]).default("Open"),
  isDrive: z.boolean().default(false),
  driveId: z.string().optional(),
  eligibleCount: z.number(),
  candidates: z.array(MatchedCandidate).default([]),
});
export type PlacementJobItem = z.infer<typeof PlacementJobItem>;

export const PlacementJobsOverview = z.object({
  summary: z.object({
    totalJobs: z.number(),
    corporateOpenings: z.number(),
    campusDrives: z.number(),
    totalMatches: z.number(),
    partnerCompanies: z.number(),
    highestPackageLpa: z.number(),
    averagePackageLpa: z.number(),
  }),
  jobs: z.array(PlacementJobItem),
  employers: z
    .array(
      z.object({
        id: z.string(),
        company: z.string(),
        sector: z.string().optional(),
        tier: z.string().optional(),
      })
    )
    .default([]),
  departments: z.array(z.string()).default([]),
});
export type PlacementJobsOverview = z.infer<typeof PlacementJobsOverview>;

export const CreateJobBody = z.object({
  company: z.string().trim().min(2, "Company name is required"),
  role: z.string().trim().min(2, "Role is required"),
  type: z.string().default("On-campus"),
  category: z.enum(["campus-drive", "industry-job", "internship"]).default("industry-job"),
  location: z.string().trim().min(2, "Location is required"),
  packageMin: z.number().min(0).default(5),
  packageMax: z.number().min(0).default(8),
  openings: z.number().min(1).default(10),
  departments: z.array(z.string()).min(1, "Select at least one department"),
  minReadiness: z.number().min(0).max(100).default(65),
  minCgpa: z.number().min(0).max(10).default(6.0),
  deadline: z.string().min(4, "Deadline is required"),
  description: z.string().trim().min(10, "Description is required"),
  skills: z.array(z.string()).default([]),
});
export type CreateJobBody = z.infer<typeof CreateJobBody>;

