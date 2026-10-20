import { z } from "zod";

export const SalaryTierItem = z.object({
  tier: z.string(),
  minCtc: z.number(),
  maxCtc: z.number(),
  offersCount: z.number(),
  percentage: z.number(),
  color: z.string(),
});
export type SalaryTierItem = z.infer<typeof SalaryTierItem>;

export const HiringFunnelStage = z.object({
  stage: z.string(),
  count: z.number(),
  dropRate: z.number(),
  conversionRate: z.number(),
});
export type HiringFunnelStage = z.infer<typeof HiringFunnelStage>;

export const DepartmentPlacementMetric = z.object({
  department: z.string(),
  code: z.string(),
  totalStudents: z.number(),
  eligible: z.number(),
  placed: z.number(),
  placementRate: z.number(),
  avgPackageLpa: z.number(),
  highestPackageLpa: z.number(),
  readinessScore: z.number(),
  mockInterviewAvg: z.number(),
  topRecruiter: z.string(),
});
export type DepartmentPlacementMetric = z.infer<typeof DepartmentPlacementMetric>;

export const DriveAnalyticsItem = z.object({
  driveId: z.string(),
  company: z.string(),
  role: z.string(),
  sector: z.string(),
  tier: z.enum(["Super Dream", "Dream", "Core", "Mass"]),
  ctcLpa: z.number(),
  date: z.string(),
  registeredCount: z.number(),
  shortlistedCount: z.number(),
  offersCount: z.number(),
  status: z.enum(["Completed", "Active", "Upcoming"]),
});
export type DriveAnalyticsItem = z.infer<typeof DriveAnalyticsItem>;

export const CompetencyGapItem = z.object({
  competency: z.string(),
  avgScore: z.number(),
  proficientCount: z.number(),
  criticalCount: z.number(),
  recommendation: z.string(),
  status: z.enum(["Healthy", "Attention", "Critical"]),
});
export type CompetencyGapItem = z.infer<typeof CompetencyGapItem>;

export const StudentPlacementRecord = z.object({
  roll: z.string(),
  name: z.string(),
  department: z.string(),
  cgpa: z.number(),
  readinessScore: z.number(),
  company: z.string(),
  role: z.string(),
  packageLpa: z.number(),
  tier: z.string(),
  status: z.enum(["Placed", "In Process", "Seeking Placement"]),
  offerDate: z.string(),
});
export type StudentPlacementRecord = z.infer<typeof StudentPlacementRecord>;

export const InstitutionalPlacementTargets = z.object({
  targetPlacementPct: z.number(),
  minAverageLpaTarget: z.number(),
  mockInterviewCompletionTarget: z.number(),
  targetCompaniesCount: z.number(),
  updatedAt: z.string(),
  updatedBy: z.string(),
});
export type InstitutionalPlacementTargets = z.infer<typeof InstitutionalPlacementTargets>;

export const PlacementAnalyticsOverview = z.object({
  collegeName: z.string(),
  collegeId: z.string(),
  academicYear: z.string(),
  lastRefreshed: z.string(),
  executiveSummary: z.object({
    totalEligibleStudents: z.number(),
    placedStudentsCount: z.number(),
    placementPercentage: z.number(),
    targetPlacementPercentage: z.number(),
    totalOffers: z.number(),
    multipleOffersCount: z.number(),
    averagePackageLpa: z.number(),
    medianPackageLpa: z.number(),
    highestPackageLpa: z.number(),
    totalParticipatingRecruiters: z.number(),
    superDreamOffers: z.number(),
    dreamOffers: z.number(),
    coreOffers: z.number(),
    massOffers: z.number(),
  }),
  salaryTierDistribution: z.array(SalaryTierItem),
  hiringFunnel: z.array(HiringFunnelStage),
  departmentBreakdown: z.array(DepartmentPlacementMetric),
  recruiterDrives: z.array(DriveAnalyticsItem),
  readinessGaps: z.array(CompetencyGapItem),
  placedStudents: z.array(StudentPlacementRecord),
  institutionalTargets: InstitutionalPlacementTargets,
});
export type PlacementAnalyticsOverview = z.infer<typeof PlacementAnalyticsOverview>;

export const UpdatePlacementTargetsInput = z.object({
  targetPlacementPct: z.number().min(50).max(100),
  minAverageLpaTarget: z.number().min(2).max(50),
  mockInterviewCompletionTarget: z.number().min(50).max(100),
  targetCompaniesCount: z.number().min(1).max(500),
});
export type UpdatePlacementTargetsInput = z.infer<typeof UpdatePlacementTargetsInput>;
