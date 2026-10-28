import "server-only";
import { randomUUID } from "node:crypto";
import { EventPlanBody, type SavedEventPlan } from "@/lib/api/event-plan-schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { dataBackend, getStore } from "@/lib/data";
import { postgresEventPlans } from "@/lib/data/postgres/event-plans";
import { resolveCollegeId } from "./early-warning";
import { sharedState } from "./global-state";

export interface PlanRow {
  id: string;
  plan: Record<string, unknown>;
  createdBySub: string;
  createdByName: string;
  updatedAt: string;
}

export interface PlanData {
  list(college: string): Promise<PlanRow[]>;
  get(college: string, id: string): Promise<PlanRow | null>;
  add(college: string, plan: Record<string, unknown>, by: { sub: string; name: string }): Promise<PlanRow>;
  update(college: string, id: string, plan: Record<string, unknown>): Promise<PlanRow | null>;
  remove(college: string, id: string): Promise<boolean>;
}

const mem = sharedState("event-plans", () => new Map<string, Map<string, PlanRow>>());
export function resetEventPlansMemory() {
  mem.clear();
}
const bucket = (college: string) => {
  let b = mem.get(college);
  if (!b) {
    b = new Map();
    mem.set(college, b);
  }
  return b;
};

const memoryPlans: PlanData = {
  async list(college) {
    return structuredClone([...bucket(college).values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  },
  async get(college, id) {
    const r = bucket(college).get(id);
    return r ? structuredClone(r) : null;
  },
  async add(college, plan, by) {
    const id = randomUUID();
    const row: PlanRow = { id, plan: { ...plan, id }, createdBySub: by.sub, createdByName: by.name, updatedAt: new Date().toISOString() };
    bucket(college).set(id, row);
    return structuredClone(row);
  },
  async update(college, id, plan) {
    const row = bucket(college).get(id);
    if (!row) return null;
    row.plan = { ...plan, id };
    row.updatedAt = new Date().toISOString();
    return structuredClone(row);
  },
  async remove(college, id) {
    return bucket(college).delete(id);
  },
};

const data = (): PlanData => (dataBackend() === "postgres" ? postgresEventPlans : memoryPlans);

class PlanError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400,
  ) {
    super(message);
  }
}

const STAFF = new Set(["faculty", "hod", "institution", "admin"]);
const MAX_PLAN_BYTES = 250_000;

const canEditRow = (s: SessionPayload, r: PlanRow) => s.role === "institution" || s.role === "admin" || r.createdBySub === s.sub;
const toSaved = (s: SessionPayload, r: PlanRow): SavedEventPlan => ({
  id: r.id,
  plan: { ...r.plan, id: r.id },
  createdByName: r.createdByName,
  updatedAt: r.updatedAt,
  canEdit: canEditRow(s, r),
});

function parsePlan(body: unknown): Record<string, unknown> {
  const parsed = EventPlanBody.safeParse(body);
  if (!parsed.success) throw new PlanError(parsed.error.issues[0]?.message ?? "The event plan is not valid.");
  if (JSON.stringify(parsed.data.plan).length > MAX_PLAN_BYTES) throw new PlanError("The event plan is too large to save.");
  return parsed.data.plan;
}

async function audit(s: SessionPayload, college: string, action: string, target: string) {
  await getStore().audit.add({ actor: s.name, action, target, collegeId: college, actorSub: s.sub });
}

type Result = { status: number; body: unknown };
const json = (status: number, body: unknown): Result => ({ status, body });
const fail = (status: number, code: string, message: string): Result => json(status, { error: { code, message } });

/** GET/POST event-plans and PUT/DELETE event-plans/:id, for the staff who use the Event Generator. */
export async function dispatchEventPlans(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<Result> {
  if (!STAFF.has(s.role)) return fail(403, "forbidden", "You do not have permission to perform this action.");
  let body: unknown = rawBody;
  if (typeof rawBody === "string" && rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail(400, "bad_request", "The request body is not valid JSON.");
    }
  }
  try {
    const college = await resolveCollegeId(s.college);
    const id = segs[1];
    if (!id && method === "GET") return json(200, { plans: (await data().list(college)).map((r) => toSaved(s, r)) });
    if (!id && method === "POST") {
      const plan = parsePlan(body);
      const row = await data().add(college, plan, { sub: s.sub, name: s.name || "Staff" });
      await audit(s, college, "Saved event plan", String(plan.title));
      return json(201, toSaved(s, row));
    }
    if (id && (method === "PUT" || method === "DELETE")) {
      const existing = await data().get(college, id);
      if (!existing) throw new PlanError("Event plan not found.", 404);
      if (!canEditRow(s, existing)) throw new PlanError("Only the author or the Principal can change this plan.", 403);
      if (method === "DELETE") {
        await data().remove(college, id);
        await audit(s, college, "Deleted event plan", String(existing.plan.title ?? id));
        return json(200, { ok: true });
      }
      const plan = parsePlan(body);
      const row = await data().update(college, id, plan);
      if (!row) throw new PlanError("Event plan not found.", 404);
      await audit(s, college, "Updated event plan", String(plan.title));
      return json(200, toSaved(s, row));
    }
    return fail(404, "not_found", "Not found.");
  } catch (e) {
    if (e instanceof PlanError) {
      if (e.status === 403) return fail(403, "forbidden", e.message);
      if (e.status === 404) return fail(404, "not_found", e.message);
      return fail(400, "invalid", e.message);
    }
    throw e;
  }
}
