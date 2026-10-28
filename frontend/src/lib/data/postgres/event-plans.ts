import "server-only";
import type { PlanData, PlanRow } from "@/lib/api/mock/event-plans";
import { db, isUuid } from "./db";
import { collegeUuid } from "./lookups";

/* Event Generator blueprints on PostgreSQL (prisma/migrations/20261107000000_event_plans). */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const COLS = `id, plan, created_by_sub as "createdBySub", created_by_name as "createdByName", updated_at as "updatedAt"`;
const toRow = (r: Raw): PlanRow => ({
  id: r.id,
  plan: r.plan,
  createdBySub: r.createdBySub,
  createdByName: r.createdByName,
  updatedAt: (r.updatedAt instanceof Date ? r.updatedAt : new Date(String(r.updatedAt))).toISOString(),
});

export const postgresEventPlans: PlanData = {
  async list(college) {
    const rows = await q<Raw>(`SELECT ${COLS} FROM event_plans WHERE college_id = $1::uuid ORDER BY updated_at DESC`, await collegeUuid(college));
    return rows.map(toRow);
  },
  async get(college, id) {
    if (!isUuid(id)) return null;
    const rows = await q<Raw>(`SELECT ${COLS} FROM event_plans WHERE college_id = $1::uuid AND id = $2::uuid`, await collegeUuid(college), id);
    return rows[0] ? toRow(rows[0]) : null;
  },
  async add(college, plan, by) {
    const rows = await q<Raw>(
      `INSERT INTO event_plans (college_id, title, category, status, plan, created_by_sub, created_by_name)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7) RETURNING ${COLS}`,
      await collegeUuid(college), String(plan.title), String(plan.category), String(plan.status), JSON.stringify(plan), by.sub, by.name,
    );
    const row = rows[0];
    if (!row) throw new Error("Insert failed");
    return toRow(row);
  },
  async update(college, id, plan) {
    if (!isUuid(id)) return null;
    const rows = await q<Raw>(
      `UPDATE event_plans SET title = $3, category = $4, status = $5, plan = $6::jsonb, updated_at = now()
       WHERE college_id = $1::uuid AND id = $2::uuid RETURNING ${COLS}`,
      await collegeUuid(college), id, String(plan.title), String(plan.category), String(plan.status), JSON.stringify(plan),
    );
    return rows[0] ? toRow(rows[0]) : null;
  },
  async remove(college, id) {
    if (!isUuid(id)) return false;
    const rows = await q<{ id: string }>(`DELETE FROM event_plans WHERE college_id = $1::uuid AND id = $2::uuid RETURNING id`, await collegeUuid(college), id);
    return rows.length > 0;
  },
};
