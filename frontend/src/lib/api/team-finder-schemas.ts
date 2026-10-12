import { z } from "zod";

export const TeamCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  dept: z.string(),
  skills: z.array(z.string()),
  looking: z.string(),
  match: z.number(),
  bio: z.string().optional(),
  cgpa: z.string().optional(),
});
export type TeamCandidate = z.infer<typeof TeamCandidateSchema>;

export const TeamRequestItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectTitle: z.string(),
  roleNeeded: z.string(),
  skillsRequired: z.array(z.string()),
  slots: z.number(),
  department: z.string(),
  description: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  applicantsCount: z.number().default(0),
});
export type TeamRequestItem = z.infer<typeof TeamRequestItemSchema>;

export const CreateTeamRequestInput = z.object({
  projectId: z.string().min(1, "Please select or enter a project"),
  projectTitle: z.string().min(2, "Project title is required"),
  roleNeeded: z.string().min(2, "Role needed is required"),
  skillsRequired: z.array(z.string()).min(1, "At least one skill is required"),
  slots: z.number().int().min(1).max(10).default(1),
  department: z.string().default("Any"),
  description: z.string().max(500).default(""),
});
export type CreateTeamRequestInput = z.infer<typeof CreateTeamRequestInput>;

export const AddTeammateInput = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  studentName: z.string().min(2, "Student name is required"),
});
export type AddTeammateInput = z.infer<typeof AddTeammateInput>;

export const TeamFinderOverviewSchema = z.object({
  myDepartment: z.string().default("Computer Science & Engineering"),
  candidates: z.array(TeamCandidateSchema),
  requests: z.array(TeamRequestItemSchema),
  myProjects: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      domain: z.string(),
      team: z.array(z.string()),
    })
  ),
});
export type TeamFinderOverview = z.infer<typeof TeamFinderOverviewSchema>;
