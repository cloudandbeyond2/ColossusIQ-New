import { z } from "zod";

export const INCUBATION_STAGES = [
  "Idea",
  "Validation",
  "Business Model & MVP",
  "Prototyping & Mentorship",
  "Incubation Review",
  "Incubated",
] as const;

export type IncubationStage = (typeof INCUBATION_STAGES)[number];

export const INCUBATION_DOMAINS = [
  "AgriTech",
  "HealthTech",
  "CleanTech & IoT",
  "AI & DeepTech",
  "EdTech",
  "FinTech & Web3",
  "Robotics & Hardware",
] as const;

export type IncubationDomain = (typeof INCUBATION_DOMAINS)[number];

export const PipelineVenture = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  domain: z.string(),
  cohort: z.string(),
  stage: z.enum(INCUBATION_STAGES),
  founders: z.array(z.string()),
  leadFounder: z.string(),
  leadEmail: z.string(),
  department: z.string(),
  readinessScore: z.number(),
  mentorName: z.string(),
  grantAmount: z.string(),
  pitchDeckUrl: z.string().default(""),
  demoUrl: z.string().default(""),
  reviewVerdict: z.string().optional(),
  reviewNotes: z.string().optional(),
  reviewScore: z.number().optional(),
  submittedAt: z.string(),
  updatedAt: z.string(),
});

export type PipelineVenture = z.infer<typeof PipelineVenture>;

export const PipelineStageSummary = z.object({
  stage: z.enum(INCUBATION_STAGES),
  label: z.string(),
  count: z.number(),
  description: z.string(),
});

export type PipelineStageSummary = z.infer<typeof PipelineStageSummary>;

export const IncubationPipelineOverview = z.object({
  cohort: z.string(),
  availableCohorts: z.array(z.string()),
  totalVentures: z.number(),
  inReviewCount: z.number(),
  incubatedCount: z.number(),
  seedGrantsTotal: z.string(),
  totalMentors: z.number(),
  stages: z.array(PipelineStageSummary),
  ventures: z.array(PipelineVenture),
});

export type IncubationPipelineOverview = z.infer<typeof IncubationPipelineOverview>;

export const CreateVentureInput = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  tagline: z.string().min(5, "Tagline must be at least 5 characters"),
  domain: z.string(),
  cohort: z.string(),
  stage: z.enum(INCUBATION_STAGES).default("Idea"),
  leadFounder: z.string().min(2, "Founder name required"),
  leadEmail: z.string().email("Valid email required"),
  founders: z.array(z.string()).default([]),
  department: z.string().min(2, "Department required"),
  mentorName: z.string().default("Unassigned"),
  pitchDeckUrl: z.string().default(""),
  demoUrl: z.string().default(""),
});

export type CreateVentureInput = z.infer<typeof CreateVentureInput>;

export const UpdateVentureStageInput = z.object({
  stage: z.enum(INCUBATION_STAGES),
});

export type UpdateVentureStageInput = z.infer<typeof UpdateVentureStageInput>;

export const ReviewVentureInput = z.object({
  verdict: z.string(),
  score: z.number().min(0).max(100),
  notes: z.string(),
  grantAmount: z.string().optional(),
  mentorName: z.string().optional(),
});

export type ReviewVentureInput = z.infer<typeof ReviewVentureInput>;
