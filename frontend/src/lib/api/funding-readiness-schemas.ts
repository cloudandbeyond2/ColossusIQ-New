import { z } from "zod";

export const READINESS_TIERS = [
  "Early Stage / Grant Ready",
  "Incubation Seed Ready",
  "Angel / Pre-Series A Ready",
  "Institutional VC Ready",
] as const;

export type ReadinessTier = (typeof READINESS_TIERS)[number];

export const ScoreDimension = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  score: z.number().min(0).max(100),
  benchmark: z.number().default(75),
  weight: z.number().default(1),
  status: z.enum(["Below Benchmark", "On Target", "Exceeds Benchmark"]).default("On Target"),
});

export type ScoreDimension = z.infer<typeof ScoreDimension>;

export const DiligenceCheckItem = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(["Legal & Corporate", "Financials", "Product & IP", "Commercial Traction"]),
  verified: z.boolean(),
  notes: z.string().default(""),
});

export type DiligenceCheckItem = z.infer<typeof DiligenceCheckItem>;

export const VentureFundingReadiness = z.object({
  ventureId: z.string(),
  ventureName: z.string(),
  domain: z.string(),
  stage: z.string(),
  leadFounder: z.string(),
  department: z.string(),
  fundingTarget: z.string().default("Not set"),
  currentFunding: z.string().default("Bootstrapped"),
  readinessScore: z.number(),
  readinessTier: z.enum(READINESS_TIERS),
  dimensions: z.array(ScoreDimension),
  strengths: z.array(z.string()),
  investorGaps: z.array(z.string()),
  actionPlan: z.array(z.string()),
  diligenceChecklist: z.array(DiligenceCheckItem),
  lastEvaluatedAt: z.string(),
  evaluatorNotes: z.string().default(""),
});

export type VentureFundingReadiness = z.infer<typeof VentureFundingReadiness>;

export const FundingReadinessOverview = z.object({
  averageReadinessScore: z.number(),
  angelReadyCount: z.number(),
  totalFundingTarget: z.string(),
  criticalGapsCount: z.number(),
  selectedVentureId: z.string(),
  allVentures: z.array(
    z.object({
      ventureId: z.string(),
      ventureName: z.string(),
      domain: z.string(),
      stage: z.string(),
      readinessScore: z.number(),
      readinessTier: z.enum(READINESS_TIERS),
    })
  ),
  currentEvaluation: VentureFundingReadiness.nullable(),
});

export type FundingReadinessOverview = z.infer<typeof FundingReadinessOverview>;

export const UpdateReadinessInput = z.object({
  dimensions: z
    .array(
      z.object({
        id: z.string(),
        score: z.number().min(0).max(100),
      })
    )
    .optional(),
  fundingTarget: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  investorGaps: z.array(z.string()).optional(),
  actionPlan: z.array(z.string()).optional(),
  diligenceChecklist: z
    .array(
      z.object({
        id: z.string(),
        verified: z.boolean(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  evaluatorNotes: z.string().optional(),
});

export type UpdateReadinessInput = z.infer<typeof UpdateReadinessInput>;
