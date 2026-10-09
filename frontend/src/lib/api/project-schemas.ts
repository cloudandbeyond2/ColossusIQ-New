import { z } from "zod";

export const STAGE_TITLES = [
  "Idea",
  "Team Formation",
  "Architecture",
  "Milestones",
  "Implementation",
  "Testing",
  "AI Review",
  "Faculty Review",
  "Demo",
  "Portfolio",
] as const;

export type StageTitle = (typeof STAGE_TITLES)[number];

export const ProjectStageSchema = z.object({
  title: z.string(),
  status: z.enum(["done", "active", "todo"]),
});
export type ProjectStage = z.infer<typeof ProjectStageSchema>;

export const ProjectReviewSchema = z.object({
  architecture: z.number().min(0).max(100).default(0),
  documentation: z.number().min(0).max(100).default(0),
  codeQuality: z.number().min(0).max(100).default(0),
  testing: z.number().min(0).max(100).default(0),
  innovation: z.number().min(0).max(100).default(0),
  facultyFeedback: z.string().optional(),
  facultyApproved: z.boolean().optional(),
});
export type ProjectReview = z.infer<typeof ProjectReviewSchema>;

export const ProjectItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  domain: z.string(),
  team: z.array(z.string()),
  mentor: z.string(),
  stage: z.string(),
  progress: z.number(),
  stages: z.array(ProjectStageSchema),
  review: ProjectReviewSchema,
  repoUrl: z.string().optional(),
  docUrl: z.string().optional(),
  demoUrl: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
});
export type ProjectItem = z.infer<typeof ProjectItemSchema>;

export const CreateProjectInput = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(150),
  domain: z.string().min(2, "Domain must be at least 2 characters").max(100),
  mentor: z.string().max(100).optional().default("Dr. Meena Raghavan"),
  team: z.array(z.string()).min(1, "At least one team member required"),
  description: z.string().max(1000).optional().default(""),
  repoUrl: z.string().max(300).optional().default(""),
  docUrl: z.string().max(300).optional().default(""),
  demoUrl: z.string().max(300).optional().default(""),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectStageInput = z.object({
  stage: z.enum(STAGE_TITLES),
  status: z.enum(["done", "active", "todo"]).optional(),
  repoUrl: z.string().max(300).optional(),
  docUrl: z.string().max(300).optional(),
  demoUrl: z.string().max(300).optional(),
});
export type UpdateProjectStageInput = z.infer<typeof UpdateProjectStageInput>;

export const FacultyReviewInput = z.object({
  architecture: z.number().min(0).max(100).optional(),
  documentation: z.number().min(0).max(100).optional(),
  codeQuality: z.number().min(0).max(100).optional(),
  testing: z.number().min(0).max(100).optional(),
  innovation: z.number().min(0).max(100).optional(),
  facultyFeedback: z.string().max(1000).optional(),
  approve: z.boolean().default(true),
});
export type FacultyReviewInput = z.infer<typeof FacultyReviewInput>;
