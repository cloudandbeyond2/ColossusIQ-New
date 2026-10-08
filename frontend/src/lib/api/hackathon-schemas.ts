import { z } from "zod";

export const HackathonItem = z.object({
  id: z.string(),
  name: z.string(),
  host: z.string(),
  date: z.string(),
  teamsCount: z.number().int().nonnegative(),
  status: z.enum(["Open", "Active", "Upcoming", "Closed"]),
  domain: z.string().default("General"),
  description: z.string().default(""),
  venue: z.string().default("Hybrid / Virtual"),
  prizePool: z.string().default("₹1,00,000+"),
  isRegistered: z.boolean().default(false),
});
export type HackathonItem = z.infer<typeof HackathonItem>;

export const HackathonTeamItem = z.object({
  id: z.string(),
  hackathonId: z.string(),
  hackathonName: z.string(),
  teamName: z.string(),
  teamLeadName: z.string(),
  teamLeadEmail: z.string().default(""),
  rollNo: z.string().default(""),
  membersCount: z.number().int().min(1).max(10),
  memberNames: z.string().default(""),
  problemStatement: z.string(),
  domain: z.string().default("AI & Machine Learning"),
  repoUrl: z.string().default(""),
  status: z.enum(["Registered", "Shortlisted", "Finalist", "Winner", "Withdrawn"]).default("Registered"),
  createdAt: z.string(),
  isMine: z.boolean().default(true),
});
export type HackathonTeamItem = z.infer<typeof HackathonTeamItem>;

export const RegisterHackathonTeamInput = z.object({
  hackathonId: z.string().min(1, "Please select a hackathon"),
  hackathonName: z.string().min(1, "Hackathon name is required"),
  teamName: z.string().min(2, "Team name must be at least 2 characters").max(100),
  teamLeadName: z.string().min(2, "Team lead name is required").max(100),
  teamLeadEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  rollNo: z.string().max(50).optional().default(""),
  membersCount: z.number().int().min(1, "Minimum 1 member").max(10, "Maximum 10 members").default(4),
  memberNames: z.string().max(300).optional().default(""),
  problemStatement: z.string().min(2, "Problem statement or project idea is required").max(250),
  domain: z.string().max(100).default("AI & Machine Learning"),
  repoUrl: z.string().max(300).optional().default(""),
});
export type RegisterHackathonTeamInput = z.infer<typeof RegisterHackathonTeamInput>;

export const HackathonsOverview = z.object({
  collegeId: z.string(),
  kpis: z.object({
    totalHackathons: z.number(),
    registeredTeams: z.number(),
    myTeams: z.number(),
    openRegistrations: z.number(),
  }),
  hackathons: z.array(HackathonItem),
  myTeams: z.array(HackathonTeamItem),
});
export type HackathonsOverview = z.infer<typeof HackathonsOverview>;
