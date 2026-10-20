import { z } from "zod";

export const MENTOR_TYPES = [
  "Industry Founder",
  "Alumni Leader",
  "Faculty Specialist",
  "Investor / VC",
  "Legal & IP Expert",
] as const;

export type MentorType = (typeof MENTOR_TYPES)[number];

export const MENTOR_AVAILABILITY = [
  "Available",
  "Busy",
  "On Sabbatical",
] as const;

export type MentorAvailability = (typeof MENTOR_AVAILABILITY)[number];

export const VentureAssignment = z.object({
  ventureId: z.string(),
  ventureName: z.string(),
  stage: z.string(),
});

export type VentureAssignment = z.infer<typeof VentureAssignment>;

export const MentorItem = z.object({
  id: z.string(),
  name: z.string(),
  designation: z.string(),
  company: z.string(),
  type: z.enum(MENTOR_TYPES),
  expertise: z.array(z.string()),
  email: z.string(),
  phone: z.string(),
  linkedinUrl: z.string().default(""),
  availability: z.enum(MENTOR_AVAILABILITY),
  activeVenturesCount: z.number(),
  assignedVentures: z.array(VentureAssignment).default([]),
  sessionsCompleted: z.number().default(0),
  rating: z.number().default(5.0),
  joinedDate: z.string(),
  status: z.enum(["Active", "Pending Invitation", "Inactive"]).default("Active"),
});

export type MentorItem = z.infer<typeof MentorItem>;

export const MentorNetworkOverview = z.object({
  totalMentors: z.number(),
  availableCount: z.number(),
  activeAssignmentsCount: z.number(),
  totalSessionsConducted: z.number(),
  averageRating: z.number(),
  mentors: z.array(MentorItem),
});

export type MentorNetworkOverview = z.infer<typeof MentorNetworkOverview>;

export const InviteMentorInput = z.object({
  name: z.string().min(2, "Name is required"),
  designation: z.string().min(2, "Designation is required"),
  company: z.string().min(2, "Organization is required"),
  type: z.enum(MENTOR_TYPES),
  expertise: z.array(z.string()).min(1, "Select or enter at least one expertise"),
  email: z.string().email("Valid email required"),
  phone: z.string().default(""),
  linkedinUrl: z.string().default(""),
  availability: z.enum(MENTOR_AVAILABILITY).default("Available"),
});

export type InviteMentorInput = z.infer<typeof InviteMentorInput>;

export const AssignMentorInput = z.object({
  ventureId: z.string().min(1, "Venture ID required"),
  ventureName: z.string().min(1, "Venture name required"),
  stage: z.string().default("Idea"),
});

export type AssignMentorInput = z.infer<typeof AssignMentorInput>;

export const LogSessionInput = z.object({
  ventureName: z.string().min(1, "Venture name is required"),
  topic: z.string().min(3, "Topic is required"),
  notes: z.string().min(5, "Session notes are required"),
  durationMinutes: z.number().default(60),
});

export type LogSessionInput = z.infer<typeof LogSessionInput>;
