import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import type { ClubItem, ClubsOverview, CreateClubInput } from "@/lib/api/schemas";
import { getStore } from "@/lib/data";
import { clubsData, type ClubRow } from "./clubs-data";
import { listColleges } from "./records";

/*
 * Campus clubs. Clubs and memberships are the college's own records (clubs-data.ts). Member counts are the number of
 * people who actually joined, and "is joined" is per signed-in user.
 */

export class ClubError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const MANAGE_ROLES = new Set(["institution", "admin", "hod", "faculty"]);
const REMOVE_ROLES = new Set(["institution", "admin"]);
const JOIN_BLOCKED = new Set(["recruiter"]);

export const canManageClubs = (role: string) => MANAGE_ROLES.has(role);
/** Anyone on campus except outside recruiters may start a club; staff and the club's founder can then run it. */
export const canCreateClubs = (role: string) => !JOIN_BLOCKED.has(role);
export const canRemoveClubs = (role: string) => REMOVE_ROLES.has(role);

async function collegeOf(session: SessionPayload): Promise<string> {
  if (session.college && session.college !== "all") return session.college;
  const first = (await listColleges())[0];
  if (!first) throw new ClubError("There is no college to run clubs for yet.", 404);
  return first.id;
}

const auditCollege = (session: SessionPayload) => (session.college === "all" ? null : session.college);

async function audit(session: SessionPayload, action: string, target: string) {
  await getStore().audit.add({ actor: session.name, action, target, collegeId: auditCollege(session), actorSub: session.sub });
}

function view(c: ClubRow, joined: boolean, session: SessionPayload): ClubItem {
  const { college: _c, createdBySub, ...rest } = c;
  void _c;
  return { ...rest, isJoined: joined, canEdit: canManageClubs(session.role) || (createdBySub !== "" && createdBySub === session.sub) };
}

async function ownClub(session: SessionPayload, clubId: string): Promise<ClubRow> {
  const college = await collegeOf(session);
  const club = await clubsData().club(clubId);
  if (!club || club.college !== college) throw new ClubError("Club not found.", 404);
  return club;
}

export async function getClubsOverview(session: SessionPayload): Promise<ClubsOverview> {
  const college = await collegeOf(session);
  const [clubs, joined] = await Promise.all([clubsData().clubs(college), clubsData().joined(college, session.sub)]);
  const mine = new Set(joined);
  const open = clubs.filter((c) => c.status !== "Inactive");
  return {
    collegeId: college,
    kpis: {
      totalClubs: clubs.length,
      totalMembers: clubs.reduce((sum, c) => sum + c.membersCount, 0),
      activeCategories: new Set(clubs.map((c) => c.category)).size,
      upcomingActivities: open.filter((c) => c.meetingSchedule.trim() !== "").length,
    },
    clubs: clubs.map((c) => view(c, mine.has(c.id), session)),
    permissions: { create: canCreateClubs(session.role), manage: canManageClubs(session.role), remove: canRemoveClubs(session.role) },
  };
}

export async function createClub(session: SessionPayload, input: CreateClubInput): Promise<ClubItem> {
  const college = await collegeOf(session);
  const created = await clubsData().create({
    college,
    name: input.name.trim(),
    category: input.category,
    description: input.description.trim(),
    lead: input.lead.trim(),
    facultyAdvisor: input.facultyAdvisor.trim(),
    meetingSchedule: input.meetingSchedule.trim(),
    venue: input.venue.trim(),
    createdBySub: session.sub,
  });
  if (!created) throw new ClubError(`There is already a club called "${input.name.trim()}".`, 409);
  // the founder is its first member
  await clubsData().join(created, session.sub, session.name);
  await audit(session, `Created campus club "${created.name}" (${created.category})`, created.id);
  return view((await clubsData().club(created.id)) ?? created, true, session);
}

export async function updateClub(
  session: SessionPayload,
  clubId: string,
  patch: Partial<CreateClubInput & { status: ClubItem["status"] }>,
): Promise<ClubItem> {
  const club = await ownClub(session, clubId);
  if (!canManageClubs(session.role) && !(club.createdBySub !== "" && club.createdBySub === session.sub)) {
    throw new ClubError("Only staff or the person who started this club can change it.", 403);
  }
  const clean: Record<string, string> = {};
  for (const key of ["name", "description", "lead", "facultyAdvisor", "meetingSchedule", "venue"] as const) {
    const v = patch[key];
    if (v !== undefined) clean[key] = v.trim();
  }
  if (patch.category) clean.category = patch.category;
  if (patch.status) clean.status = patch.status;
  const updated = await clubsData().update(club.id, clean);
  if (updated === "duplicate") throw new ClubError(`There is already a club called "${clean.name}".`, 409);
  if (!updated) throw new ClubError("Club not found.", 404);
  await audit(session, `Updated campus club "${updated.name}"`, updated.id);
  const joined = await clubsData().joined(club.college, session.sub);
  return view(updated, joined.includes(updated.id), session);
}

export async function deleteClub(session: SessionPayload, clubId: string): Promise<void> {
  const club = await ownClub(session, clubId);
  await clubsData().remove(club.id);
  await audit(session, `Disbanded campus club "${club.name}"`, club.id);
}

export async function toggleJoinClub(session: SessionPayload, clubId: string): Promise<{ isJoined: boolean; membersCount: number }> {
  if (JOIN_BLOCKED.has(session.role)) throw new ClubError("Your account can't join campus clubs.", 403);
  const club = await ownClub(session, clubId);
  const data = clubsData();
  const already = (await data.joined(club.college, session.sub)).includes(club.id);
  if (!already && club.status === "Inactive") throw new ClubError("This club isn't accepting members right now.", 409);
  if (already) await data.leave(club, session.sub);
  else await data.join(club, session.sub, session.name);
  const after = await data.club(club.id);
  return { isJoined: !already, membersCount: after?.membersCount ?? 0 };
}
