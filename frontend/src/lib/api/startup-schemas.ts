import { z } from "zod";

export const STARTUP_DOMAINS = [
  "AgriTech",
  "HealthTech",
  "CleanTech & IoT",
  "AI & DeepTech",
  "EdTech",
  "FinTech & Web3",
  "Robotics & Hardware",
] as const;

export type StartupDomain = (typeof STARTUP_DOMAINS)[number];

export const STARTUP_STAGES = [
  "Ideation",
  "Early Prototype",
  "MVP Live",
  "Commercial Pilot",
  "Growth & Scaling",
] as const;

export type StartupStage = (typeof STARTUP_STAGES)[number];

export const INCORPORATION_STATUSES = [
  "Registered Private Limited",
  "LLP",
  "DPIIT Recognized",
  "Student Pre-Incubation",
  "Campus IP Spin-off",
] as const;

export type IncorporationStatus = (typeof INCORPORATION_STATUSES)[number];

export const PATENT_STATUSES = [
  "Not Applicable",
  "In Drafting",
  "Filed (Provisional)",
  "Published",
  "Granted",
] as const;

export type PatentStatus = (typeof PATENT_STATUSES)[number];

export const StartupFounder = z.object({
  name: z.string(),
  role: z.string(),
  email: z.string().optional(),
  rollNo: z.string().optional(),
});

export type StartupFounder = z.infer<typeof StartupFounder>;

export const StartupItem = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  registrationNumber: z.string().default("Incorporation in progress"),
  domain: z.enum(STARTUP_DOMAINS),
  incorporationStatus: z.enum(INCORPORATION_STATUSES),
  stage: z.enum(STARTUP_STAGES),
  founders: z.array(StartupFounder),
  leadFounder: z.string(),
  leadEmail: z.string(),
  department: z.string(),
  cohort: z.string(),
  assignedMentor: z.string().default("Unassigned"),
  readinessScore: z.number().default(60),
  fundingRaised: z.string().default("Bootstrapped"),
  revenue: z.string().default("Pre-revenue"),
  activePilotsCount: z.number().default(0),
  patentStatus: z.enum(PATENT_STATUSES).default("Not Applicable"),
  websiteUrl: z.string().default(""),
  pitchDeckUrl: z.string().default(""),
  demoUrl: z.string().default(""),
  campusIncubatedAt: z.string(),
  status: z.enum(["Active", "Graduated", "On Hold"]).default("Active"),
});

export type StartupItem = z.infer<typeof StartupItem>;

export const StartupPortfolioOverview = z.object({
  totalStartups: z.number(),
  dpiitRecognizedCount: z.number(),
  totalFundingMobilized: z.string(),
  activeCommercialPilots: z.number(),
  patentsCount: z.number(),
  startups: z.array(StartupItem),
});

export type StartupPortfolioOverview = z.infer<typeof StartupPortfolioOverview>;

export const CreateStartupInput = z.object({
  name: z.string().min(2, "Startup name required"),
  tagline: z.string().min(5, "Tagline required"),
  registrationNumber: z.string().default("Incorporation in progress"),
  domain: z.enum(STARTUP_DOMAINS),
  incorporationStatus: z.enum(INCORPORATION_STATUSES).default("Student Pre-Incubation"),
  stage: z.enum(STARTUP_STAGES).default("MVP Live"),
  leadFounder: z.string().min(2, "Lead founder required"),
  leadEmail: z.string().email("Valid email required"),
  founders: z.array(StartupFounder).default([]),
  department: z.string().min(2, "Department required"),
  cohort: z.string().default("2026 Innovation Cohort"),
  assignedMentor: z.string().default("Unassigned"),
  readinessScore: z.number().default(70),
  fundingRaised: z.string().default("Bootstrapped"),
  revenue: z.string().default("Pre-revenue"),
  activePilotsCount: z.number().default(0),
  patentStatus: z.enum(PATENT_STATUSES).default("Not Applicable"),
  websiteUrl: z.string().default(""),
  pitchDeckUrl: z.string().default(""),
  demoUrl: z.string().default(""),
});

export type CreateStartupInput = z.infer<typeof CreateStartupInput>;

export const UpdateStartupInput = z.object({
  stage: z.enum(STARTUP_STAGES).optional(),
  incorporationStatus: z.enum(INCORPORATION_STATUSES).optional(),
  assignedMentor: z.string().optional(),
  readinessScore: z.number().optional(),
  fundingRaised: z.string().optional(),
  revenue: z.string().optional(),
  activePilotsCount: z.number().optional(),
  patentStatus: z.enum(PATENT_STATUSES).optional(),
  status: z.enum(["Active", "Graduated", "On Hold"]).optional(),
});

export type UpdateStartupInput = z.infer<typeof UpdateStartupInput>;
