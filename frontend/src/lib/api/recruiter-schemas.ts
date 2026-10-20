import { z } from "zod";

export const RECRUITER_STAGES = [
  "Shortlisted",
  "Technical Assessment",
  "Technical Interview",
  "HR Round",
  "Offer Extended",
  "Hired",
  "Rejected",
] as const;

export type RecruiterStage = (typeof RECRUITER_STAGES)[number];

export const RECRUITER_ROLES = [
  "SDE-1 (Full Stack)",
  "Frontend Engineer",
  "Backend & Cloud Engineer",
  "Data Analyst",
  "AI / ML Engineer",
  "DevOps & SRE",
  "Product Specialist",
] as const;

export type RecruiterRole = (typeof RECRUITER_ROLES)[number];

export const INTERVIEW_ROUNDS = [
  "Technical Round 1",
  "System Design & Coding",
  "Technical Round 2",
  "HR & Culture",
  "Leadership & Offer Discussion",
] as const;

export type InterviewRound = (typeof INTERVIEW_ROUNDS)[number];

export const INTERVIEW_STATUSES = [
  "Scheduled",
  "In Progress",
  "Completed",
  "Rescheduled",
  "Cancelled",
] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_RECOMMENDATIONS = [
  "Strong Hire",
  "Hire",
  "Hold",
  "No Hire",
  "Pending Evaluation",
] as const;

export type InterviewRecommendation = (typeof INTERVIEW_RECOMMENDATIONS)[number];

export const CandidateProfile = z.object({
  id: z.string(),
  name: z.string(),
  roll: z.string(),
  department: z.string(),
  college: z.string(),
  cgpa: z.number(),
  readiness: z.number(),
  graduationYear: z.number().default(2026),
  skills: z.array(z.string()),
  projectTitle: z.string(),
  projectDomain: z.string(),
  email: z.string(),
  githubUrl: z.string().default(""),
  linkedinUrl: z.string().default(""),
  status: z.enum(["Available", "Shortlisted"]).default("Available"),
  activeShortlistCount: z.number().default(0),
});

export type CandidateProfile = z.infer<typeof CandidateProfile>;

export const TalentSearchOverview = z.object({
  totalCandidates: z.number(),
  highReadinessCount: z.number(),
  availableForHireCount: z.number(),
  shortlistedCount: z.number(),
  candidates: z.array(CandidateProfile),
});

export type TalentSearchOverview = z.infer<typeof TalentSearchOverview>;

export const ShortlistCandidate = z.object({
  id: z.string(),
  candidateId: z.string(),
  candidateName: z.string(),
  roll: z.string(),
  department: z.string(),
  college: z.string(),
  roleRequisition: z.string(),
  stage: z.enum(RECRUITER_STAGES),
  assessmentScore: z.number().default(0),
  readiness: z.number(),
  notes: z.string().default(""),
  shortlistedAt: z.string(),
  updatedAt: z.string(),
  interviewsCount: z.number().default(0),
});

export type ShortlistCandidate = z.infer<typeof ShortlistCandidate>;

export const ShortlistsOverview = z.object({
  totalShortlisted: z.number(),
  inAssessmentCount: z.number(),
  inInterviewCount: z.number(),
  offersExtendedCount: z.number(),
  shortlists: z.array(ShortlistCandidate),
});

export type ShortlistsOverview = z.infer<typeof ShortlistsOverview>;

export const InterviewScheduleItem = z.object({
  id: z.string(),
  shortlistId: z.string(),
  candidateId: z.string(),
  candidateName: z.string(),
  roll: z.string(),
  roleRequisition: z.string(),
  round: z.enum(INTERVIEW_ROUNDS),
  dateTime: z.string(),
  durationMinutes: z.number().default(45),
  panelists: z.string(),
  meetingLink: z.string().default(""),
  location: z.string().default("Placement Interview Room 204"),
  status: z.enum(INTERVIEW_STATUSES).default("Scheduled"),
  feedbackScore: z.number().default(0),
  recommendation: z.enum(INTERVIEW_RECOMMENDATIONS).default("Pending Evaluation"),
  feedbackNotes: z.string().default(""),
});

export type InterviewScheduleItem = z.infer<typeof InterviewScheduleItem>;

export const InterviewsOverview = z.object({
  upcomingTodayCount: z.number(),
  thisWeekCount: z.number(),
  completedCount: z.number(),
  pendingFeedbackCount: z.number(),
  interviews: z.array(InterviewScheduleItem),
});

export type InterviewsOverview = z.infer<typeof InterviewsOverview>;

export const CreateShortlistInput = z.object({
  candidateId: z.string(),
  roleRequisition: z.string().min(2, "Role requisition required"),
  notes: z.string().default(""),
});

export type CreateShortlistInput = z.infer<typeof CreateShortlistInput>;

export const UpdateShortlistStageInput = z.object({
  stage: z.enum(RECRUITER_STAGES),
  assessmentScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export type UpdateShortlistStageInput = z.infer<typeof UpdateShortlistStageInput>;

export const ScheduleInterviewInput = z.object({
  shortlistId: z.string(),
  round: z.enum(INTERVIEW_ROUNDS),
  dateTime: z.string().min(5, "Date & time required"),
  durationMinutes: z.number().default(45),
  panelists: z.string().min(2, "Panelist names required"),
  meetingLink: z.string().default(""),
  location: z.string().default("Placement Interview Room 204"),
});

export type ScheduleInterviewInput = z.infer<typeof ScheduleInterviewInput>;

export const SubmitInterviewFeedbackInput = z.object({
  feedbackScore: z.number().min(0).max(100),
  recommendation: z.enum(["Strong Hire", "Hire", "Hold", "No Hire"]),
  feedbackNotes: z.string().min(2, "Feedback notes required"),
  status: z.enum(INTERVIEW_STATUSES).optional(),
});

export type SubmitInterviewFeedbackInput = z.infer<typeof SubmitInterviewFeedbackInput>;
