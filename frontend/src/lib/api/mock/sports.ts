import "server-only";
import { sharedState } from "./global-state";
import type { SessionPayload } from "@/lib/auth/session";
import type { CreateSportInput, SportItem, SportsOverview } from "@/lib/api/schemas";
import { getStore } from "@/lib/data";

const sportsStore = sharedState("campus.sports.map.v2", () => new Map<string, SportItem[]>());
// Ensure old in-memory mock cache is purged
sportsStore.clear();
const registeredSportsByUser = sharedState("campus.sports.userRegistrations", () => new Map<string, Set<string>>());

function defaultSports(_collegeId: string): SportItem[] {
  return [];
}

export function getCollegeSports(collegeId: string): SportItem[] {
  const effectiveCollege = collegeId === "all" ? "COL-1001" : collegeId;
  if (!sportsStore.has(effectiveCollege)) {
    sportsStore.set(effectiveCollege, defaultSports(effectiveCollege));
  }
  return sportsStore.get(effectiveCollege)!;
}

export async function getSportsOverview(session: SessionPayload): Promise<SportsOverview> {
  const collegeId = session.college === "all" ? "COL-1001" : session.college;
  const items = getCollegeSports(collegeId);
  const userRegistered = registeredSportsByUser.get(session.sub) ?? new Set<string>();

  const sportsWithUserStatus = items.map((s) => ({
    ...s,
    isRegistered: userRegistered.has(s.id),
  }));

  const totalAthletes = items.reduce((sum, s) => sum + s.squadSize, 0);
  const openTrials = items.filter((s) => s.status === "Trials open").length;
  const upcomingMeets = items.filter((s) => Boolean(s.event)).length;

  return {
    collegeId,
    kpis: {
      totalTeams: items.length,
      totalAthletes,
      openTrials,
      upcomingMeets,
    },
    sports: sportsWithUserStatus,
  };
}

export async function createSport(session: SessionPayload, input: CreateSportInput): Promise<SportItem> {
  const collegeId = session.college === "all" ? "COL-1001" : session.college;
  const items = getCollegeSports(collegeId);

  const newSport: SportItem = {
    id: `sport-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    sport: input.sport.trim(),
    team: input.team.trim(),
    coach: input.coach.trim(),
    captain: input.captain?.trim() || "Team Captain",
    event: input.event.trim(),
    venue: input.venue?.trim() || "Campus Sports Complex",
    squadSize: input.squadSize || 15,
    status: input.status || "Trials open",
    isRegistered: false,
    createdAt: new Date().toISOString(),
  };

  items.unshift(newSport);
  sportsStore.set(collegeId, items);

  await getStore().audit.add({
    actor: session.name,
    action: `Registered new sport/team "${newSport.sport} - ${newSport.team}"`,
    target: newSport.id,
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return newSport;
}

export async function updateSport(
  session: SessionPayload,
  sportId: string,
  patch: Partial<CreateSportInput & { status: SportItem["status"] }>,
): Promise<SportItem | undefined> {
  const collegeId = session.college === "all" ? "COL-1001" : session.college;
  const items = getCollegeSports(collegeId);
  const idx = items.findIndex((s) => s.id === sportId);
  if (idx === -1) return undefined;

  const current = items[idx]!;
  const updated: SportItem = {
    ...current,
    sport: patch.sport !== undefined ? patch.sport.trim() : current.sport,
    team: patch.team !== undefined ? patch.team.trim() : current.team,
    coach: patch.coach !== undefined ? patch.coach.trim() : current.coach,
    captain: patch.captain !== undefined ? patch.captain.trim() : current.captain,
    event: patch.event !== undefined ? patch.event.trim() : current.event,
    venue: patch.venue !== undefined ? patch.venue.trim() : current.venue,
    squadSize: patch.squadSize !== undefined ? patch.squadSize : current.squadSize,
    status: patch.status ?? current.status,
  };

  items[idx] = updated;
  sportsStore.set(collegeId, items);

  await getStore().audit.add({
    actor: session.name,
    action: `Updated sport details for "${updated.team}" (${updated.sport})`,
    target: updated.id,
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return updated;
}

export async function deleteSport(session: SessionPayload, sportId: string): Promise<boolean> {
  const collegeId = session.college === "all" ? "COL-1001" : session.college;
  const items = getCollegeSports(collegeId);
  const target = items.find((s) => s.id === sportId);
  if (!target) return false;

  const remaining = items.filter((s) => s.id !== sportId);
  sportsStore.set(collegeId, remaining);

  await getStore().audit.add({
    actor: session.name,
    action: `Removed sport/team "${target.sport} - ${target.team}"`,
    target: target.id,
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return true;
}

export async function toggleRegisterTrial(
  session: SessionPayload,
  sportId: string,
): Promise<{ isRegistered: boolean; squadSize: number } | undefined> {
  const collegeId = session.college === "all" ? "COL-1001" : session.college;
  const items = getCollegeSports(collegeId);
  const target = items.find((s) => s.id === sportId);
  if (!target) return undefined;

  let userReg = registeredSportsByUser.get(session.sub);
  if (!userReg) {
    userReg = new Set<string>();
    registeredSportsByUser.set(session.sub, userReg);
  }

  const isCurrentlyReg = userReg.has(sportId);
  let newStatus: boolean;

  if (isCurrentlyReg) {
    userReg.delete(sportId);
    target.squadSize = Math.max(1, target.squadSize - 1);
    newStatus = false;
  } else {
    userReg.add(sportId);
    target.squadSize += 1;
    newStatus = true;
  }

  return { isRegistered: newStatus, squadSize: target.squadSize };
}
