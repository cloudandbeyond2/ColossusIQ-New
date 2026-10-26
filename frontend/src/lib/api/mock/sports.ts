import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import type { CreateSportInput, SportItem, SportRegisterInput, SportsOverview } from "@/lib/api/schemas";
import { getStore } from "@/lib/data";
import { sportsData, type SportRow } from "./sports-data";
import { listColleges } from "./records";

/*
 * Campus sports. Teams and trial registrations are the college's own records (sports-data.ts). A squad's size is the
 * number of people who actually registered, and "is registered" is per signed-in user.
 */

export class SportError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const MANAGE_ROLES = new Set(["institution", "admin"]);
const REGISTER_BLOCKED = new Set(["recruiter"]);

export const canManageSports = (role: string) => MANAGE_ROLES.has(role);

async function collegeOf(session: SessionPayload): Promise<string> {
  if (session.college && session.college !== "all") return session.college;
  const first = (await listColleges())[0];
  if (!first) throw new SportError("There is no college to run sports for yet.", 404);
  return first.id;
}

async function audit(session: SessionPayload, action: string, target: string) {
  await getStore().audit.add({
    actor: session.name,
    action,
    target,
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });
}

function view(s: SportRow, registered: boolean): SportItem {
  const { college: _c, createdBySub: _s, ...rest } = s;
  void _c;
  void _s;
  return { ...rest, isRegistered: registered };
}

async function ownSport(session: SessionPayload, sportId: string): Promise<SportRow> {
  const college = await collegeOf(session);
  const sport = await sportsData().sport(sportId);
  if (!sport || sport.college !== college) throw new SportError("Sports team not found.", 404);
  return sport;
}

function requireManage(session: SessionPayload) {
  if (!canManageSports(session.role)) throw new SportError("Only institution staff can manage sports teams.", 403);
}

export async function getSportsOverview(session: SessionPayload): Promise<SportsOverview> {
  const college = await collegeOf(session);
  const [sports, mine] = await Promise.all([sportsData().sports(college), sportsData().registered(college, session.sub)]);
  const registered = new Set(mine);
  return {
    collegeId: college,
    kpis: {
      totalTeams: sports.length,
      totalAthletes: sports.reduce((sum, s) => sum + s.squadSize, 0),
      openTrials: sports.filter((s) => s.status === "Trials open").length,
      upcomingMeets: sports.filter((s) => s.event.trim() !== "").length,
    },
    sports: sports.map((s) => view(s, registered.has(s.id))),
    permissions: { manage: canManageSports(session.role), register: !REGISTER_BLOCKED.has(session.role) },
  };
}

export async function createSport(session: SessionPayload, input: CreateSportInput): Promise<SportItem> {
  requireManage(session);
  const college = await collegeOf(session);
  const created = await sportsData().create({
    college,
    sport: input.sport.trim(),
    team: input.team.trim(),
    coach: input.coach.trim(),
    captain: input.captain.trim(),
    event: input.event.trim(),
    venue: input.venue.trim(),
    status: input.status,
    createdBySub: session.sub,
  });
  if (!created) throw new SportError(`"${input.team.trim()}" is already a ${input.sport.trim()} team here.`, 409);
  await audit(session, `Registered new sport/team "${created.sport} - ${created.team}"`, created.id);
  return view(created, false);
}

export async function updateSport(
  session: SessionPayload,
  sportId: string,
  patch: Partial<CreateSportInput>,
): Promise<SportItem> {
  requireManage(session);
  const sport = await ownSport(session, sportId);
  const clean: Record<string, string> = {};
  for (const key of ["sport", "team", "coach", "captain", "event", "venue"] as const) {
    const v = patch[key];
    if (v !== undefined) clean[key] = v.trim();
  }
  if (patch.status) clean.status = patch.status;
  const updated = await sportsData().update(sport.id, clean);
  if (updated === "duplicate") throw new SportError("That sport already has a team with that name.", 409);
  if (!updated) throw new SportError("Sports team not found.", 404);
  await audit(session, `Updated sport details for "${updated.team}" (${updated.sport})`, updated.id);
  const mine = await sportsData().registered(sport.college, session.sub);
  return view(updated, mine.includes(updated.id));
}

export async function deleteSport(session: SessionPayload, sportId: string): Promise<void> {
  requireManage(session);
  const sport = await ownSport(session, sportId);
  await sportsData().remove(sport.id);
  await audit(session, `Removed sport/team "${sport.sport} - ${sport.team}"`, sport.id);
}

export async function toggleRegisterTrial(
  session: SessionPayload,
  sportId: string,
  details: SportRegisterInput = { position: "", experience: "" },
): Promise<{ isRegistered: boolean; squadSize: number }> {
  if (REGISTER_BLOCKED.has(session.role)) throw new SportError("Your account can't register for sports trials.", 403);
  const sport = await ownSport(session, sportId);
  const data = sportsData();
  const already = (await data.registered(sport.college, session.sub)).includes(sport.id);
  if (!already && sport.status === "Off-season") throw new SportError("This team is off-season and isn't taking registrations.", 409);
  if (already) await data.withdraw(sport, session.sub);
  else await data.register(sport, session.sub, { name: session.name, position: details.position.trim(), experience: details.experience.trim() });
  const after = await data.sport(sport.id);
  return { isRegistered: !already, squadSize: after?.squadSize ?? 0 };
}
