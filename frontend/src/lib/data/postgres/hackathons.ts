import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import type {
  HackathonItem,
  HackathonTeamItem,
  HackathonsOverview,
  RegisterHackathonTeamInput,
} from "@/lib/api/hackathon-schemas";
import { db, isUuid, requestUser } from "./db";
import { collegeUuid } from "./lookups";

export interface HackathonTeamDbRow {
  id: string;
  college_id: string;
  user_id: string;
  hackathon_id: string;
  hackathon_name: string;
  team_name: string;
  team_lead_name: string;
  team_lead_email: string;
  roll_no: string;
  members_count: number;
  member_names: string;
  problem_statement: string;
  domain: string;
  repo_url: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

const DEFAULT_HACKATHONS: Omit<HackathonItem, "teamsCount" | "isRegistered">[] = [
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

function toTeamItem(r: HackathonTeamDbRow, currentUserId?: string): HackathonTeamItem {
  return {
    id: r.id,
    hackathonId: r.hackathon_id,
    hackathonName: r.hackathon_name,
    teamName: r.team_name,
    teamLeadName: r.team_lead_name,
    teamLeadEmail: r.team_lead_email || "",
    rollNo: r.roll_no || "",
    membersCount: r.members_count,
    memberNames: r.member_names || "",
    problemStatement: r.problem_statement,
    domain: r.domain || "AI & Machine Learning",
    repoUrl: r.repo_url || "",
    status: (r.status as HackathonTeamItem["status"]) || "Registered",
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    isMine: Boolean(currentUserId && r.user_id === currentUserId),
  };
}

async function resolveCollegeId(scope: string): Promise<string | null> {
  if (scope === "all") return null;
  if (isUuid(scope)) return scope;
  try {
    return await collegeUuid(scope);
  } catch {
    return null;
  }
}

export async function postgresListHackathonTeams(
  session: SessionPayload,
): Promise<HackathonTeamItem[]> {
  const t = db();
  const cId = await resolveCollegeId(session.college);
  const userSub = requestUser() || session.sub;

  let rows: HackathonTeamDbRow[];
  if (cId) {
    rows = await t.$queryRaw<HackathonTeamDbRow[]>`
      SELECT *
      FROM hackathon_teams
      WHERE college_id = ${cId}::uuid
      ORDER BY created_at DESC
    `;
  } else {
    rows = await t.$queryRaw<HackathonTeamDbRow[]>`
      SELECT *
      FROM hackathon_teams
      ORDER BY created_at DESC
    `;
  }

  return rows.map((r) => toTeamItem(r, userSub));
}

export async function postgresCreateHackathonTeam(
  session: SessionPayload,
  input: RegisterHackathonTeamInput,
): Promise<HackathonTeamItem> {
  const t = db();
  const cId = await resolveCollegeId(session.college);
  if (!cId) throw new Error("A valid college scope is required to register a hackathon team.");

  const userSub = requestUser() || (isUuid(session.sub) ? session.sub : "00000000-0000-0000-0000-000000000001");

  const rows = await t.$queryRaw<HackathonTeamDbRow[]>`
    INSERT INTO hackathon_teams (
      college_id,
      user_id,
      hackathon_id,
      hackathon_name,
      team_name,
      team_lead_name,
      team_lead_email,
      roll_no,
      members_count,
      member_names,
      problem_statement,
      domain,
      repo_url,
      status
    ) VALUES (
      ${cId}::uuid,
      ${userSub}::uuid,
      ${input.hackathonId},
      ${input.hackathonName},
      ${input.teamName.trim()},
      ${input.teamLeadName.trim()},
      ${input.teamLeadEmail?.trim() || ""},
      ${input.rollNo?.trim() || ""},
      ${input.membersCount || 4},
      ${input.memberNames?.trim() || ""},
      ${input.problemStatement.trim()},
      ${input.domain || "AI & Machine Learning"},
      ${input.repoUrl?.trim() || ""},
      'Registered'
    )
    RETURNING *
  `;

  return toTeamItem(rows[0]!, userSub);
}

export async function postgresGetHackathonsOverview(
  session: SessionPayload,
): Promise<HackathonsOverview> {
  const teams = await postgresListHackathonTeams(session);
  const userSub = requestUser() || session.sub;

  const myTeams = teams.filter((t) => t.isMine || t.teamLeadName === session.name);
  const myRegisteredHackathonIds = new Set(myTeams.map((t) => t.hackathonId));

  // Count teams per hackathon
  const teamCountByHackathon = new Map<string, number>();
  for (const t of teams) {
    teamCountByHackathon.set(t.hackathonId, (teamCountByHackathon.get(t.hackathonId) || 0) + 1);
  }

  // Base hackathons with registered counts and status
  const baseHackathons: HackathonItem[] = [
    {
      ...DEFAULT_HACKATHONS[0]!,
      teamsCount: 24 + (teamCountByHackathon.get("hack-sih-2026") || 0),
      isRegistered: myRegisteredHackathonIds.has("hack-sih-2026"),
    },
    {
      ...DEFAULT_HACKATHONS[1]!,
      teamsCount: 18 + (teamCountByHackathon.get("hack-campus-ai") || 0),
      isRegistered: myRegisteredHackathonIds.has("hack-campus-ai"),
    },
    {
      ...DEFAULT_HACKATHONS[2]!,
      teamsCount: 42 + (teamCountByHackathon.get("hack-tansim-2026") || 0),
      isRegistered: myRegisteredHackathonIds.has("hack-tansim-2026"),
    },
  ];

  const totalRegistered = baseHackathons.reduce((acc, h) => acc + h.teamsCount, 0);

  return {
    collegeId: session.college,
    kpis: {
      totalHackathons: baseHackathons.length,
      registeredTeams: totalRegistered,
      myTeams: myTeams.length,
      openRegistrations: baseHackathons.filter((h) => h.status === "Open" || h.status === "Active").length,
    },
    hackathons: baseHackathons,
    myTeams,
  };
}
