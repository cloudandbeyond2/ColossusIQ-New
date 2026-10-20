import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import type {
  HackathonItem,
  HackathonTeamItem,
  HackathonsOverview,
  RegisterHackathonTeamInput,
} from "@/lib/api/hackathon-schemas";
import { dataBackend, getStore } from "@/lib/data";
import {
  postgresCreateHackathonTeam,
  postgresDeleteHackathonTeam,
  postgresGetHackathonsOverview,
  postgresListHackathonTeams,
} from "@/lib/data/postgres/hackathons";
import { sharedState } from "./global-state";

const inMemoryTeams = sharedState("campus.hackathon.teams.v1", () => new Map<string, HackathonTeamItem[]>());

const DEFAULT_SAMPLE_TEAMS: HackathonTeamItem[] = [
  {
    id: "team-sih-alpha",
    hackathonId: "hack-sih-2026",
    hackathonName: "Smart India Hackathon 2026",
    teamName: "NeuralSentinels",
    teamLeadName: "Karthik Iyer",
    teamLeadEmail: "karthik.iyer@ait.edu.in",
    rollNo: "2022-CSE-045",
    membersCount: 6,
    memberNames: "Karthik Iyer, Sneha Varma, Rohan Das, Priya K., Anish M., Kavya S.",
    problemStatement: "AI-powered drone surveillance and anomaly detection for disaster management pipelines.",
    domain: "National Innovation",
    repoUrl: "https://github.com/ait-chennai/neural-sentinels-sih",
    status: "Registered",
    createdAt: "2026-10-14T09:30:00.000Z",
    isMine: true,
  },
  {
    id: "team-campus-ai-beta",
    hackathonId: "hack-campus-ai",
    hackathonName: "Campus AI Buildathon",
    teamName: "AgentCraft Labs",
    teamLeadName: "Kavya Krishnan",
    teamLeadEmail: "kavya.k@ait.edu.in",
    rollNo: "2023-AIDS-012",
    membersCount: 4,
    memberNames: "Kavya Krishnan, Rahul Nair, Swetha R., Bhuvanesh P.",
    problemStatement: "Multi-agent autonomous diagnostic copilots for clinical triage and OPD patient workflow routing.",
    domain: "AI & Machine Learning",
    repoUrl: "https://github.com/ait-chennai/agentcraft-clinical-ai",
    status: "Shortlisted",
    createdAt: "2026-10-18T14:15:00.000Z",
    isMine: true,
  },
];

const MEMORY_DEFAULT_HACKATHONS: Omit<HackathonItem, "teamsCount" | "isRegistered">[] = [
  {
    id: "hack-sih-2026",
    name: "Smart India Hackathon 2026",
    host: "AICTE & MoE",
    date: "Nov 15–16",
    status: "Open",
    domain: "National Innovation",
    description: "Nationwide innovation challenge tackling public & private sector problem statements.",
    venue: "Nodal Centers Nationwide (Hybrid)",
    prizePool: "₹1,00,000 / Problem Statement",
  },
  {
    id: "hack-campus-ai",
    name: "Campus AI Buildathon",
    host: "Computer Science & Engineering & Incubation Cell",
    date: "Oct 28",
    status: "Active",
    domain: "AI & Machine Learning",
    description: "24-hour sprint to build and deploy generative AI agents, LLM integrations, and edge AI apps.",
    venue: "Main Campus CSE Lab Block & Incubation Hub",
    prizePool: "₹75,000 + Incubation Grant",
  },
  {
    id: "hack-tansim-2026",
    name: "Tamil Nadu State Student Innovation Challenge",
    host: "TANSIM",
    date: "Dec 05",
    status: "Upcoming",
    domain: "Startup & GovTech",
    description: "Flagship state innovation competition solving societal challenges across Tamil Nadu.",
    venue: "Chennai Trade Centre",
    prizePool: "₹5,00,000 Total Pool",
  },
];

export async function getHackathonsOverview(session: SessionPayload): Promise<HackathonsOverview> {
  if (dataBackend() === "postgres") {
    try {
      return await postgresGetHackathonsOverview(session);
    } catch (e) {
      console.warn("[hackathons] postgres overview fallback to memory:", e);
    }
  }

  const collegeId = session.college === "all" ? "COL-1001" : session.college;
  let teams = inMemoryTeams.get(collegeId);
  if (!teams) {
    teams = JSON.parse(JSON.stringify(DEFAULT_SAMPLE_TEAMS)) as HackathonTeamItem[];
    inMemoryTeams.set(collegeId, teams);
  }
  const currentTeams = teams;

  const isStaff = ["incubation", "admin", "institution", "hod"].includes(session.role);
  const myTeams = currentTeams.filter((t) => isStaff || t.isMine || t.teamLeadName === session.name);
  const myRegisteredIds = new Set(myTeams.map((t) => t.hackathonId));

  const teamCounts = new Map<string, number>();
  for (const t of currentTeams) {
    teamCounts.set(t.hackathonId, (teamCounts.get(t.hackathonId) || 0) + 1);
  }

  const hackathons: HackathonItem[] = [
    {
      ...MEMORY_DEFAULT_HACKATHONS[0]!,
      teamsCount: 24 + (teamCounts.get("hack-sih-2026") || 0),
      isRegistered: myRegisteredIds.has("hack-sih-2026"),
    },
    {
      ...MEMORY_DEFAULT_HACKATHONS[1]!,
      teamsCount: 18 + (teamCounts.get("hack-campus-ai") || 0),
      isRegistered: myRegisteredIds.has("hack-campus-ai"),
    },
    {
      ...MEMORY_DEFAULT_HACKATHONS[2]!,
      teamsCount: 42 + (teamCounts.get("hack-tansim-2026") || 0),
      isRegistered: myRegisteredIds.has("hack-tansim-2026"),
    },
  ];

  const totalRegistered = hackathons.reduce((acc, h) => acc + h.teamsCount, 0);

  return {
    collegeId,
    kpis: {
      totalHackathons: hackathons.length,
      registeredTeams: totalRegistered,
      myTeams: myTeams.length,
      openRegistrations: hackathons.filter((h) => h.status === "Open" || h.status === "Active").length,
    },
    hackathons,
    myTeams,
  };
}

export async function registerHackathonTeam(
  session: SessionPayload,
  input: RegisterHackathonTeamInput,
): Promise<HackathonTeamItem> {
  let createdTeam: HackathonTeamItem;

  if (dataBackend() === "postgres") {
    try {
      createdTeam = await postgresCreateHackathonTeam(session, input);
    } catch (e) {
      console.warn("[hackathons] postgres create fallback to memory:", e);
      createdTeam = createMemoryTeam(session, input);
    }
  } else {
    createdTeam = createMemoryTeam(session, input);
  }

  try {
    await getStore().audit.add({
      actor: session.name,
      action: `Registered team "${createdTeam.teamName}" for hackathon "${createdTeam.hackathonName}"`,
      target: createdTeam.id,
      collegeId: session.college === "all" ? null : session.college,
      actorSub: session.sub,
    });
  } catch {
    // Audit log optional
  }

  return createdTeam;
}

function createMemoryTeam(
  session: SessionPayload,
  input: RegisterHackathonTeamInput,
): HackathonTeamItem {
  const collegeId = session.college === "all" ? "COL-1001" : session.college;
  const list = inMemoryTeams.get(collegeId) || [];

  const newTeam: HackathonTeamItem = {
    id: `team-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    hackathonId: input.hackathonId,
    hackathonName: input.hackathonName,
    teamName: input.teamName.trim(),
    teamLeadName: input.teamLeadName.trim(),
    teamLeadEmail: input.teamLeadEmail?.trim() || "",
    rollNo: input.rollNo?.trim() || "",
    membersCount: input.membersCount || 4,
    memberNames: input.memberNames?.trim() || "",
    problemStatement: input.problemStatement.trim(),
    domain: input.domain || "AI & Machine Learning",
    repoUrl: input.repoUrl?.trim() || "",
    status: "Registered",
    createdAt: new Date().toISOString(),
    isMine: true,
  };

  list.unshift(newTeam);
  inMemoryTeams.set(collegeId, list);

  return newTeam;
}

export async function listHackathonTeams(session: SessionPayload): Promise<HackathonTeamItem[]> {
  if (dataBackend() === "postgres") {
    try {
      return await postgresListHackathonTeams(session);
    } catch (e) {
      console.warn("[hackathons] postgres list fallback to memory:", e);
    }
  }

  const collegeId = session.college === "all" ? "COL-1001" : session.college;
  return inMemoryTeams.get(collegeId) || [];
}

export async function deleteHackathonTeam(
  session: SessionPayload,
  teamId: string,
): Promise<boolean> {
  if (dataBackend() === "postgres") {
    try {
      return await postgresDeleteHackathonTeam(session, teamId);
    } catch (e) {
      console.warn("[hackathons] postgres delete fallback to memory:", e);
    }
  }

  const collegeId = session.college === "all" ? "COL-1001" : session.college;
  const list = inMemoryTeams.get(collegeId) || [];
  const index = list.findIndex((t) => t.id === teamId);
  if (index !== -1) {
    const removed = list.splice(index, 1)[0];
    inMemoryTeams.set(collegeId, list);
    try {
      await getStore().audit.add({
        actor: session.name,
        action: `Removed registration for team "${removed?.teamName}" from hackathon "${removed?.hackathonName}"`,
        target: teamId,
        collegeId: session.college === "all" ? null : session.college,
        actorSub: session.sub,
      });
    } catch {
      // Audit log optional
    }
    return true;
  }
  return false;
}
