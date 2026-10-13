import "server-only";
import type { CalendarDraft, CalendarRow, CalendarStore } from "@/lib/api/mock/calendar-store";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * Academic Calendar on PostgreSQL: `calendar_entries` (prisma/migrations/20261022000000_academic_calendar).
 * Row-level security keeps each college to its own entries.
 */

interface Row {
  id: string;
  collegeId: string;
  title: string;
  date: string;
  endDate: string | null;
  timeLabel: string;
  tag: string;
  department: string;
  venue: string;
  description: string;
  audience: string;
  source: string;
  notify: boolean;
  createdBySub: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const entries = () => (db() as any).calendarEntry;

async function toRow(r: Row): Promise<CalendarRow> {
  return {
    id: r.id,
    college: (await collegePublic(r.collegeId)) ?? "",
    title: r.title,
    date: r.date,
    endDate: r.endDate ?? undefined,
    time: r.timeLabel,
    tag: r.tag as CalendarRow["tag"],
    department: r.department,
    venue: r.venue,
    description: r.description,
    audience: r.audience as CalendarRow["audience"],
    source: r.source as CalendarRow["source"],
    notify: r.notify,
    createdBySub: r.createdBySub,
    createdByName: r.createdByName,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
    updatedAt: (r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)).toISOString(),
  };
}

function toColumns(p: Partial<CalendarDraft>) {
  const d: Record<string, unknown> = {};
  if (p.title !== undefined) d.title = p.title;
  if (p.date !== undefined) d.date = p.date;
  if ("endDate" in p) d.endDate = p.endDate ?? null;
  if (p.time !== undefined) d.timeLabel = p.time;
  if (p.tag !== undefined) d.tag = p.tag;
  if (p.department !== undefined) d.department = p.department;
  if (p.venue !== undefined) d.venue = p.venue;
  if (p.description !== undefined) d.description = p.description;
  if (p.audience !== undefined) d.audience = p.audience;
  if (p.source !== undefined) d.source = p.source;
  if (p.notify !== undefined) d.notify = p.notify;
  return d;
}

export const postgresCalendar: CalendarStore = {
  async list(college) {
    const id = await collegeUuid(college);
    if (!id) return [];
    const client = entries();
    if (client) {
      const rows = (await client.findMany({ where: { collegeId: id }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 2000 })) as Row[];
      return Promise.all(rows.map(toRow));
    }
    const rows = await db().$queryRawUnsafe<Row[]>(
      `SELECT id, college_id as "collegeId", title, date, end_date as "endDate", time_label as "timeLabel",
              tag, department, venue, description, audience, source, notify,
              created_by_sub as "createdBySub", created_by_name as "createdByName",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM calendar_entries
       WHERE college_id = $1::uuid
       ORDER BY date ASC, created_at ASC
       LIMIT 2000;`,
      id,
    );
    return Promise.all(rows.map(toRow));
  },
  async get(id) {
    if (!isUuid(id)) return undefined;
    const client = entries();
    if (client) {
      const r = (await client.findUnique({ where: { id } })) as Row | null;
      return r ? toRow(r) : undefined;
    }
    const rows = await db().$queryRawUnsafe<Row[]>(
      `SELECT id, college_id as "collegeId", title, date, end_date as "endDate", time_label as "timeLabel",
              tag, department, venue, description, audience, source, notify,
              created_by_sub as "createdBySub", created_by_name as "createdByName",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM calendar_entries
       WHERE id = $1::uuid
       LIMIT 1;`,
      id,
    );
    return rows[0] ? toRow(rows[0]) : undefined;
  },
  async create(draft) {
    const collegeId = await collegeUuid(draft.college);
    if (!collegeId) throw new Error("Unknown college");
    const client = entries();
    if (client) {
      const created = (await client.create({
        data: {
          ...toColumns(draft),
          collegeId,
          createdBySub: draft.createdBySub,
          createdByName: draft.createdByName,
        },
      })) as Row;
      return toRow(created);
    }
    const cols = toColumns(draft);
    const rows = await db().$queryRawUnsafe<Row[]>(
      `INSERT INTO calendar_entries (
        college_id, title, date, end_date, time_label, tag, department, venue, description, audience, source, notify, created_by_sub, created_by_name
       ) VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
       )
       RETURNING id, college_id as "collegeId", title, date, end_date as "endDate", time_label as "timeLabel",
                 tag, department, venue, description, audience, source, notify,
                 created_by_sub as "createdBySub", created_by_name as "createdByName",
                 created_at as "createdAt", updated_at as "updatedAt";`,
      collegeId,
      String(cols.title ?? ""),
      String(cols.date ?? ""),
      cols.endDate ? String(cols.endDate) : null,
      String(cols.timeLabel ?? "Full day"),
      String(cols.tag ?? "Event"),
      String(cols.department ?? "All Departments"),
      String(cols.venue ?? ""),
      String(cols.description ?? ""),
      String(cols.audience ?? "All"),
      String(cols.source ?? "academic"),
      cols.notify !== false,
      draft.createdBySub,
      draft.createdByName,
    );
    return toRow(rows[0]!);
  },
  async update(id, patch) {
    if (!isUuid(id)) return undefined;
    const client = entries();
    if (client) {
      const done = (await client.updateMany({ where: { id }, data: { ...toColumns(patch), updatedAt: new Date() } })) as { count: number };
      if (!done.count) return undefined;
      const r = (await client.findUnique({ where: { id } })) as Row | null;
      return r ? toRow(r) : undefined;
    }
    const cols = toColumns(patch);
    const sets: string[] = ["updated_at = now()"];
    const vals: unknown[] = [id];
    let idx = 2;
    for (const [k, v] of Object.entries(cols)) {
      const colName = k === "timeLabel" ? "time_label" : k === "endDate" ? "end_date" : k;
      sets.push(`${colName} = $${idx++}`);
      vals.push(v);
    }
    const query = `UPDATE calendar_entries SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING id, college_id as "collegeId", title, date, end_date as "endDate", time_label as "timeLabel", tag, department, venue, description, audience, source, notify, created_by_sub as "createdBySub", created_by_name as "createdByName", created_at as "createdAt", updated_at as "updatedAt";`;
    const rows = await db().$queryRawUnsafe<Row[]>(query, ...vals);
    return rows[0] ? toRow(rows[0]) : undefined;
  },
  async remove(id) {
    if (!isUuid(id)) return false;
    const client = entries();
    if (client) {
      return ((await client.deleteMany({ where: { id } })) as { count: number }).count > 0;
    }
    const count = await db().$executeRawUnsafe(`DELETE FROM calendar_entries WHERE id = $1::uuid;`, id);
    return count > 0;
  },
};
