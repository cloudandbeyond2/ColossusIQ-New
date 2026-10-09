import "server-only";
import { z } from "zod";
import { MODULES } from "@/config/modules";
import { findResource, recordSchema, type RecordValue, type ResourceDef, type ResourceRecord } from "@/config/resources";
import { ALL_COLLEGES, COLLEGE_ID_RE, TOGGLEABLE_GROUPS } from "@/config/tenancy";
import { can } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { cleanText, mask, maskEmail } from "@/lib/security/sanitize";
import { audit } from "./audit";
import { collegeIndex, collegeStream, createRecord, enabledGroups, getCollege, recordsInCollege } from "./records";
import { getStore } from "@/lib/data";
import { streamRuleErrors } from "@/config/resources";
import type { MockResult } from "./router";

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({
  status,
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
});
const notFound = () => err(404, "not_found", "Record not found.");

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const WriteBody = z
  .object({ data: z.record(z.string(), z.unknown()), version: z.number().int().positive().optional(), collegeId: z.string().regex(COLLEGE_ID_RE).optional() })
  .strict();

/** A role may read a resource only if one of its modules exposes it — and, per college, that module area is enabled. */
export async function accessCheck(res: ResourceDef, session: SessionPayload): Promise<MockResult | null> {
  const mods = MODULES.filter((m) => m.resource === res.key && m.roles.includes(session.role));
  if (mods.length === 0) return err(403, "forbidden", "You do not have access to this resource.");
  const groups = await enabledGroups(session.college);
  const stream = session.college === ALL_COLLEGES ? null : await collegeStream(session.college);
  const enabled = mods.some(
    (m) =>
      (!m.streams || !stream || m.streams.includes(stream)) &&
      (groups === "all" || !(TOGGLEABLE_GROUPS as readonly string[]).includes(m.group) || groups.includes(m.group)),
  );
  if (!enabled) return err(403, "module_disabled", "This module is not enabled for your college.");
  return null;
}

/** Tenant isolation: a record outside the caller's college scope does not exist for them. */
function inScope(res: ResourceDef, rec: ResourceRecord, session: SessionPayload): boolean {
  if (!res.scoped) return true;
  return session.college === ALL_COLLEGES || rec.collegeId === session.college;
}

/** Data minimisation: contact details are masked for people who can view but not manage. */
function present(res: ResourceDef, rec: ResourceRecord, full: boolean, colleges: Map<string, ResourceRecord>): ResourceRecord {
  const out: ResourceRecord = { ...rec };
  if (res.scoped) {
    const c = rec.collegeId ? colleges.get(rec.collegeId) : undefined;
    out.collegeName = String(c?.name ?? "Unknown college");
    out.collegeType = String(c?.type ?? "");
  }
  if (full) return out;
  for (const f of res.fields) {
    const v = out[f.name];
    if (f.sensitive && typeof v === "string" && v) out[f.name] = f.type === "email" ? maskEmail(v) : mask(v);
  }
  return out;
}

/** Adds the resource's computed figures (department student counts …) to records about to be returned. */
async function withStats(res: ResourceDef, records: ResourceRecord[]): Promise<ResourceRecord[]> {
  if (!res.stats?.length || records.length === 0) return records;
  const figures = await getStore().records.stats(res, records);
  return records.map((r) => ({ ...r, ...(figures.get(r.id) ?? {}) }));
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (issue.code === "unrecognized_keys") out._ = "Unexpected fields were submitted.";
    else out[key] ??= issue.message;
  }
  return out;
}

/** Business rules beyond field validation (uniqueness, privilege boundaries). */
async function businessRules(
  res: ResourceDef,
  data: Record<string, RecordValue>,
  session: SessionPayload,
  collegeId: string | null,
  selfId?: string,
): Promise<Record<string, string> | null> {
  const clash = (field: string, sameCollegeOnly: boolean) =>
    getStore().records.taken(res, field, String(data[field] ?? ""), sameCollegeOnly ? collegeId : null, selfId);
  if (res.key === "users") {
    // Privilege-escalation guard: only the University Super Admin can grant that role.
    if (data.role === "University Super Admin" && session.role !== "admin") return { role: "Only the University Super Admin can grant this role." };
    if (await clash("email", false)) return { email: "A user with this email already exists in the university." };
  }
  if (res.key === "staff" && (await clash("email", false))) return { email: "A staff member with this email already exists." };
  if (res.key === "courses" && (await clash("code", true))) return { code: "This course code is already used in this college." };
  if (res.key === "departments" && (await clash("department", true))) return { department: "This department is already listed for the college." };
  // Stream rules: programmes, departments, terms and entrance scores must fit the college's stream.
  const stream = collegeId ? await collegeStream(collegeId) : null;
  if (stream) {
    const s = streamRuleErrors(res, data, stream);
    if (Object.keys(s).length) return s;
  }
  if (res.key === "rotations" && typeof data.startDate === "string" && typeof data.endDate === "string" && data.endDate < data.startDate) {
    return { endDate: "Posting cannot end before it starts" };
  }
  if (stream && res.key === "rotations" && stream !== "medical") return { _: "Clinical rotations are only available for medical colleges." };
  if (res.key === "colleges") {
    if (await clash("code", false)) return { code: "Another college already uses this affiliation code." };
    if (await clash("name", false)) return { name: "A college with this name already exists." };
  }
  return null;
}

function normalise(res: ResourceDef, data: Record<string, RecordValue>): Record<string, RecordValue> {
  const out = { ...data };
  for (const f of res.fields) {
    const v = out[f.name];
    if (typeof v === "string" && (f.type === "text" || f.type === "textarea")) out[f.name] = cleanText(v, f.maxLength ?? 120);
  }
  return out;
}

export async function dispatchRecords(method: string, segs: string[], rawBody: unknown, session: SessionPayload, query: URLSearchParams): Promise<MockResult> {
  const [, key, id, extra] = segs;
  if (extra !== undefined) return err(404, "not_found", "Resource not found.");
  const res = findResource(key);
  if (!res) return err(404, "not_found", "Resource not found.");
  const denied = await accessCheck(res, session);
  if (denied) return denied;
  const canManage = can(session.role, res.managePermission);
  const store = getStore().records;
  const colleges = await collegeIndex();
  const auditOpts = (collegeId: string | null | undefined) => ({ collegeId: collegeId ?? null, actorSub: session.sub });

  // ── collection ─────────────────────────────────
  if (id === undefined) {
    if (method === "GET") {
      const q = cleanText(query.get("q") ?? "", 80).toLowerCase();
      const status = cleanText(query.get("status") ?? "", 40);
      const collegeFilter = query.get("college") ?? "";
      const page = Math.min(Math.max(parseInt(query.get("page") ?? "1", 10) || 1, 1), 1000);
      const pageSize = Math.min(Math.max(parseInt(query.get("pageSize") ?? "10", 10) || 10, 5), 50);
      // Dropdown filters (?filter.role=Faculty): only the resource's own filter fields, and only values it offers.
      const filters: Record<string, string> = {};
      for (const name of res.filterFields ?? []) {
        const v = cleanText(query.get(`filter.${name}`) ?? "", 80);
        const options = res.fields.find((f) => f.name === name)?.options ?? [];
        if (v && (options as readonly string[]).includes(v)) filters[name] = v;
      }
      const result = await store.list(res, { scope: session.college, college: COLLEGE_ID_RE.test(collegeFilter) ? collegeFilter : undefined, q, status, filters, page, pageSize });
      const items = await withStats(res, result.items.map((r) => present(res, r, canManage, colleges)));
      return ok({ items, total: result.total, page, pageSize, counts: result.counts, canManage });
    }
    if (method === "POST") {
      if (!canManage) return err(403, "forbidden", `You can view ${res.title.toLowerCase()} but not add to it.`);
      const body = WriteBody.safeParse(rawBody);
      if (!body.success) return err(400, "invalid_body", "Invalid request.");

      // Which college does the new record belong to? Never trusted from the client except for the Super Admin.
      let collegeId: string | null = null;
      if (res.scoped) {
        if (session.college === ALL_COLLEGES) {
          const target = await getCollege(body.data.collegeId);
          if (!target) return err(422, "validation", "Choose the college this record belongs to.", { collegeId: "Choose a college" });
          collegeId = target.id;
        } else {
          collegeId = session.college;
        }
      }

      const parsed = recordSchema(res).safeParse(body.data.data);
      if (!parsed.success) return err(422, "validation", "Please correct the highlighted fields.", fieldErrors(parsed.error));
      const data = normalise(res, parsed.data as Record<string, RecordValue>);
      const rule = await businessRules(res, data, session, collegeId);
      if (rule) return err(409, "conflict", "Please correct the highlighted fields.", rule);
      const rec = await createRecord(res, data, collegeId);
      const where = collegeId ? ` in ${String(colleges.get(collegeId)?.name ?? "Unknown college")}` : "";
      await audit(session.name, `${res.singular} created${where}`, rec.id, auditOpts(collegeId));
      return ok(present(res, rec, true, colleges), 201);
    }
    return err(405, "method_not_allowed", "Method not allowed.");
  }

  // ── single record ──────────────────────────────
  if (!ID.test(id)) return notFound();
  const existing = await store.get(res, id);
  if (!existing || !inScope(res, existing, session)) return notFound();

  if (method === "GET") return ok({ record: (await withStats(res, [present(res, existing, canManage, colleges)]))[0], canManage });

  if (!canManage) return err(403, "forbidden", `You can view ${res.title.toLowerCase()} but not change it.`);

  if (method === "PUT") {
    const body = WriteBody.safeParse(rawBody);
    if (!body.success || body.data.version === undefined) return err(400, "invalid_body", "Invalid request.");
    // Optimistic concurrency: reject writes based on a stale copy.
    if (body.data.version !== existing.version) {
      return err(409, "stale", "Someone else updated this record after you opened it. Reload to see the latest version.");
    }
    const parsed = recordSchema(res).safeParse(body.data.data);
    if (!parsed.success) return err(422, "validation", "Please correct the highlighted fields.", fieldErrors(parsed.error));
    const data = normalise(res, parsed.data as Record<string, RecordValue>);
    const rule = await businessRules(res, data, session, existing.collegeId ?? null, id);
    if (rule) return err(409, "conflict", "Please correct the highlighted fields.", rule);
    // collegeId is immutable through updates — records cannot be moved between colleges by editing.
    const updated = await store.update(res, id, data, existing.version);
    if (updated === "stale") return err(409, "stale", "Someone else updated this record after you opened it. Reload to see the latest version.");
    if (!updated) return notFound();
    const statusChanged = res.statusField && existing[res.statusField] !== updated[res.statusField];
    const verb = res.key === "colleges" && statusChanged ? `College ${String(updated.status).toLowerCase()}` : `${res.singular} updated${statusChanged ? ` (status → ${String(updated[res.statusField!])})` : ""}`;
    await audit(session.name, verb, id, auditOpts(existing.collegeId));
    return ok(present(res, updated, true, res.key === "colleges" ? await collegeIndex() : colleges));
  }

  if (method === "DELETE") {
    if (res.key === "users" && existing.role === "University Super Admin" && session.role !== "admin") {
      return err(403, "forbidden", "Only the University Super Admin can remove a Super Admin.");
    }
    if (res.key === "colleges") {
      const n = await recordsInCollege(id);
      if (n > 0) return err(409, "college_not_empty", `This college still has ${n} records. Suspend it instead, or remove its records first.`);
    }
    await store.delete(res, id);
    await audit(session.name, `${res.singular} deleted`, id, auditOpts(existing.collegeId));
    return ok({ ok: true });
  }

  return err(405, "method_not_allowed", "Method not allowed.");
}
