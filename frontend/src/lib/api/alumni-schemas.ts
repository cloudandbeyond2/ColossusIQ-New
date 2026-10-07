import { z } from "zod";

export const MENTORSHIP_TOPICS = [
  "Placement Prep",
  "Mock Interviews & System Design",
  "Resume Review & Startups",
  "ML & Analytics Career Guidance",
  "Core Engineering & Higher Studies",
] as const;
export type MentorshipTopic = (typeof MENTORSHIP_TOPICS)[number];

export const PREFERRED_MODES = ["Virtual Call", "Async Review", "Email Q&A"] as const;
export type PreferredMode = (typeof PREFERRED_MODES)[number];

export const REQUEST_STATUSES = ["Pending", "Accepted", "Declined", "Completed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const AlumniMemberItem = z.object({
  id: z.string(),
  collegeId: z.string(),
  name: z.string(),
  batch: z.string(),
  currentPosition: z.string(),
  company: z.string(),
  location: z.string().default(""),
  degree: z.string().default(""),
  department: z.string().default(""),
  mentorshipTopics: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  linkedinUrl: z.string().default(""),
  email: z.string().default(""),
  bio: z.string().default(""),
  isAvailable: z.boolean().default(true),
  activeMentees: z.number().default(0),
  maxMentees: z.number().default(5),
  matchScore: z.number().min(0).max(100).default(85),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AlumniMemberItem = z.infer<typeof AlumniMemberItem>;

export const MentorshipRequestItem = z.object({
  id: z.string(),
  collegeId: z.string(),
  alumniId: z.string(),
  alumniName: z.string().optional(),
  alumniCompany: z.string().optional(),
  alumniPosition: z.string().optional(),
  studentId: z.string(),
  studentName: z.string(),
  studentRollNo: z.string().default(""),
  studentDept: z.string().default(""),
  topic: z.string(),
  preferredMode: z.string(),
  message: z.string(),
  status: z.enum(REQUEST_STATUSES).default("Pending"),
  responseNote: z.string().default(""),
  meetingLink: z.string().default(""),
  scheduledAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MentorshipRequestItem = z.infer<typeof MentorshipRequestItem>;

export const AlumniNetworkOverview = z.object({
  items: z.array(AlumniMemberItem),
  requests: z.array(MentorshipRequestItem),
  summary: z.object({
    totalAlumni: z.number(),
    availableMentors: z.number(),
    activeRequests: z.number(),
    acceptedRequests: z.number(),
    topCompanies: z.array(z.string()),
    topics: z.array(z.string()),
  }),
  canManage: z.boolean().default(false),
});
export type AlumniNetworkOverview = z.infer<typeof AlumniNetworkOverview>;

export const RequestMentorshipBody = z.object({
  alumniId: z.string().min(1, "Alumnus is required"),
  topic: z.string().trim().min(2, "Select or enter a mentorship topic").max(150),
  preferredMode: z.enum(PREFERRED_MODES).default("Virtual Call"),
  message: z.string().trim().max(1000).default(""),
});
export type RequestMentorshipBody = z.infer<typeof RequestMentorshipBody>;

export const CreateAlumniBody = z.object({
  name: z.string().trim().min(2).max(120),
  batch: z.string().trim().min(2).max(50),
  currentPosition: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(120),
  location: z.string().trim().max(120).default(""),
  degree: z.string().trim().max(150).default("B.E. Computer Science & Engineering"),
  department: z.string().trim().max(120).default("Computer Science & Engineering"),
  mentorshipTopics: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  linkedinUrl: z.string().trim().max(300).default(""),
  email: z.string().trim().max(150).default(""),
  bio: z.string().trim().max(1500).default(""),
  isAvailable: z.boolean().default(true),
  maxMentees: z.number().int().min(1).max(20).default(5),
});
export type CreateAlumniBody = z.infer<typeof CreateAlumniBody>;

export const UpdateMentorshipRequestBody = z.object({
  status: z.enum(REQUEST_STATUSES),
  responseNote: z.string().trim().max(1000).optional(),
  meetingLink: z.string().trim().max(500).optional(),
  scheduledAt: z.string().optional(),
});
export type UpdateMentorshipRequestBody = z.infer<typeof UpdateMentorshipRequestBody>;
