import "server-only";
import type { ClubRow, ClubsData } from "@/lib/api/mock/clubs-data";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * Campus clubs on PostgreSQL: clubs and club_members (prisma/migrations/20261027000000_campus_clubs).
 * Row-level security keeps each college to its own rows. Plain SQL, so it works before `prisma generate` is re-run.
 */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

const CLUB = `c.id, c.college_id as "collegeId", c.name, c.category, c.description, c.lead, c.faculty_advisor as "facultyAdvisor",
  c.meeting_schedule as "meetingSchedule", c.venue, c.status, c.created_by_sub as "createdBySub", c.created_at as "createdAt",
  (SELECT count(*)::int FROM club_members m WHERE m.club_id = c.id) as "membersCount"`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

async function toClub(r: Raw): Promise<ClubRow> {
  return {
    id: r.id,
    college: (await collegePublic(r.collegeId)) ?? "",
    name: r.name,
    category: r.category,
    description: r.description,
    lead: r.lead,
    facultyAdvisor: r.facultyAdvisor,
    meetingSchedule: r.meetingSchedule,
    venue: r.venue,
    status: r.status,
    createdBySub: r.createdBySub,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
    membersCount: Number(r.membersCount),
  };
}

const COLUMN: Record<string, string> = {
  name: "name",
  category: "category",
  description: "description",
  lead: "lead",
  facultyAdvisor: "faculty_advisor",
  meetingSchedule: "meeting_schedule",
  venue: "venue",
  status: "status",
};

async function byId(id: string): Promise<ClubRow | undefined> {
  if (!isUuid(id)) return undefined;
  const rows = await q<Raw>(`SELECT ${CLUB} FROM clubs c WHERE c.id = $1::uuid;`, id);
  return rows[0] ? toClub(rows[0]) : undefined;
}

export const postgresClubs: ClubsData = {
  async clubs(college) {
    const id = await collegeUuid(college);
    if (!id) return [];
    return Promise.all((await q<Raw>(`SELECT ${CLUB} FROM clubs c WHERE c.college_id = $1::uuid ORDER BY c.created_at DESC LIMIT 1000;`, id)).map(toClub));
  },
  club: byId,
  async create(d) {
    const cid = await collegeUuid(d.college);
    if (!cid) return undefined;
    const rows = await q<Raw>(
      `INSERT INTO clubs (college_id, name, category, description, lead, faculty_advisor, meeting_schedule, venue, status, created_by_sub)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT DO NOTHING RETURNING id;`,
      cid, d.name, d.category, d.description, d.lead, d.facultyAdvisor, d.meetingSchedule, d.venue, d.status ?? "Active", d.createdBySub,
    );
    return rows[0] ? byId(rows[0].id) : undefined;
  },
  async update(id, patch) {
    const current = await byId(id);
    if (!current) return undefined;
    const sets: string[] = [];
    const args: unknown[] = [id];
    for (const [k, v] of Object.entries(patch)) {
      const col = COLUMN[k];
      if (!col || v === undefined) continue;
      args.push(v);
      sets.push(`${col} = $${args.length}`);
    }
    if (sets.length === 0) return current;
    try {
      await q(`UPDATE clubs SET ${sets.join(", ")}, updated_at = now() WHERE id = $1::uuid;`, ...args);
    } catch (e) {
      if (String(e).includes("clubs_name_key")) return "duplicate";
      throw e;
    }
    return byId(id);
  },
  async remove(id) {
    if (!isUuid(id)) return false;
    return (await q<Raw>(`DELETE FROM clubs WHERE id = $1::uuid RETURNING id;`, id)).length > 0;
  },
  async joined(college, sub) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return (await q<Raw>(`SELECT club_id::text as id FROM club_members WHERE college_id = $1::uuid AND user_sub = $2;`, cid, sub)).map((r) => r.id);
  },
  async join(club, sub, name) {
    const cid = await collegeUuid(club.college);
    if (!cid) return;
    await q(`INSERT INTO club_members (college_id, club_id, user_sub, member_name) VALUES ($1::uuid, $2::uuid, $3, $4) ON CONFLICT DO NOTHING;`, cid, club.id, sub, name);
  },
  async leave(club, sub) {
    await q(`DELETE FROM club_members WHERE club_id = $1::uuid AND user_sub = $2;`, club.id, sub);
  },
};
