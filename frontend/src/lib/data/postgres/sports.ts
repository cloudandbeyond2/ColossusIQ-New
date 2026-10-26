import "server-only";
import type { SportRow, SportsData } from "@/lib/api/mock/sports-data";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * Campus sports on PostgreSQL: sports and sport_registrations (prisma/migrations/20261029000000_campus_sports).
 * Row-level security keeps each college to its own rows. Plain SQL, so it works before `prisma generate` is re-run.
 */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

const SPORT = `s.id, s.college_id as "collegeId", s.sport, s.team, s.coach, s.captain, s.event, s.venue, s.status,
  s.created_by_sub as "createdBySub", s.created_at as "createdAt",
  (SELECT count(*)::int FROM sport_registrations r WHERE r.sport_id = s.id) as "squadSize"`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

async function toSport(r: Raw): Promise<SportRow> {
  return {
    id: r.id,
    college: (await collegePublic(r.collegeId)) ?? "",
    sport: r.sport,
    team: r.team,
    coach: r.coach,
    captain: r.captain,
    event: r.event,
    venue: r.venue,
    status: r.status,
    createdBySub: r.createdBySub,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
    squadSize: Number(r.squadSize),
  };
}

const COLUMN: Record<string, string> = {
  sport: "sport",
  team: "team",
  coach: "coach",
  captain: "captain",
  event: "event",
  venue: "venue",
  status: "status",
};

async function byId(id: string): Promise<SportRow | undefined> {
  if (!isUuid(id)) return undefined;
  const rows = await q<Raw>(`SELECT ${SPORT} FROM sports s WHERE s.id = $1::uuid;`, id);
  return rows[0] ? toSport(rows[0]) : undefined;
}

export const postgresSports: SportsData = {
  async sports(college) {
    const id = await collegeUuid(college);
    if (!id) return [];
    return Promise.all((await q<Raw>(`SELECT ${SPORT} FROM sports s WHERE s.college_id = $1::uuid ORDER BY s.created_at DESC LIMIT 1000;`, id)).map(toSport));
  },
  sport: byId,
  async create(d) {
    const cid = await collegeUuid(d.college);
    if (!cid) return undefined;
    const rows = await q<Raw>(
      `INSERT INTO sports (college_id, sport, team, coach, captain, event, venue, status, created_by_sub)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING RETURNING id;`,
      cid, d.sport, d.team, d.coach, d.captain, d.event, d.venue, d.status, d.createdBySub,
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
      await q(`UPDATE sports SET ${sets.join(", ")}, updated_at = now() WHERE id = $1::uuid;`, ...args);
    } catch (e) {
      if (String(e).includes("sports_team_key")) return "duplicate";
      throw e;
    }
    return byId(id);
  },
  async remove(id) {
    if (!isUuid(id)) return false;
    return (await q<Raw>(`DELETE FROM sports WHERE id = $1::uuid RETURNING id;`, id)).length > 0;
  },
  async registered(college, sub) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return (await q<Raw>(`SELECT sport_id::text as id FROM sport_registrations WHERE college_id = $1::uuid AND user_sub = $2;`, cid, sub)).map((r) => r.id);
  },
  async register(sport, sub, d) {
    const cid = await collegeUuid(sport.college);
    if (!cid) return;
    await q(
      `INSERT INTO sport_registrations (college_id, sport_id, user_sub, member_name, position, experience)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6) ON CONFLICT DO NOTHING;`,
      cid, sport.id, sub, d.name, d.position, d.experience,
    );
  },
  async withdraw(sport, sub) {
    await q(`DELETE FROM sport_registrations WHERE sport_id = $1::uuid AND user_sub = $2;`, sport.id, sub);
  },
};
