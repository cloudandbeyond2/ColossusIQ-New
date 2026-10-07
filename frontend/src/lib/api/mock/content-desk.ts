import "server-only";
import type { z } from "zod";
import { RESOURCES } from "@/config/resources";
import { ALL_COLLEGES } from "@/config/tenancy";
import { geminiEnabled } from "@/lib/ai/gemini";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import {
  DATA_SCHEMA,
  DeskOverview,
  GenerateBody,
  NoteBody,
  PublishBody,
  SaveBody,
  UpdateBody,
  type ContentItem,
  type CurrentAffairData,
  type EventData,
  type QuestionSetData,
  type Targets,
} from "@/lib/api/content-desk-schemas";
import { cleanText } from "@/lib/security/sanitize";
import { audit } from "./audit";
import { draftContent, draftKey, draftLimit, takeDrafts } from "./content-desk-ai";
import { contentStore, type ContentRow } from "./content-store";
import { currentAffairsStore } from "./current-affairs-store";
import { listColleges } from "./records";
import type { MockResult } from "./router";

/*
 * University Content Desk (Super Admin, "All colleges"). Draft current affairs, question sets and university events,
 * by AI or by hand; verify; publish to every college or chosen ones. Publishing copies the content into each college's
 * Current Affairs feed (published), Question Bank (approved questions, Active) or Campus Events (Published).
 * Withdrawing removes exactly those copies. Every publish, withdrawal and rejection is audit-logged.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
const invalid = (e: z.ZodError): MockResult => {
  const fields: Record<string, string> = {};
  for (const i of e.issues) fields[i.path.map(String).join(".") || "_"] ??= i.message;
  return err(422, "validation", "Please correct the highlighted fields.", fields);
};

const titleOf = (kind: ContentRow["kind"], data: Record<string, unknown>): string => {
  const t = kind === "current-affair" ? data.headline : kind === "event" ? data.title : data.subject;
  return cleanText(String(t ?? "Untitled"), 160) || "Untitled";
};

function view(r: ContentRow): ContentItem {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    source: r.source,
    title: r.title,
    data: r.data,
    targets: r.targets,
    reach: Object.keys(r.copies).length,
    createdBy: r.createdBy,
    verifiedBy: r.verifiedBy,
    reviewNote: r.reviewNote,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    publishedAt: r.publishedAt,
  };
}

async function colleges() {
  return (await listColleges()).map((c) => ({ id: c.id, name: String(c.name ?? c.id), status: String(c.status ?? "Active") })).sort((a, b) => a.name.localeCompare(b.name));
}

async function overview(s: SessionPayload): Promise<DeskOverview> {
  return DeskOverview.parse({ items: (await contentStore().list()).map(view), colleges: await colleges(), aiReady: geminiEnabled(), canEdit: s.mfa });
}

/** Validates content data for its kind (and returns it cleaned by the schema). */
function checkData(kind: ContentRow["kind"], data: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; res: MockResult } {
  const p = DATA_SCHEMA[kind].safeParse(data);
  return p.success ? { ok: true, data: p.data as Record<string, unknown> } : { ok: false, res: invalid(p.error) };
}

async function resolveTargets(t: Targets): Promise<string[] | null> {
  const all = await colleges();
  if (t === "all") return all.filter((c) => c.status !== "Suspended").map((c) => c.id);
  const known = new Set(all.map((c) => c.id));
  return t.every((id) => known.has(id)) ? [...new Set(t)] : null;
}

/* ── copying into colleges ── */
async function copyInto(s: SessionPayload, college: string, r: ContentRow): Promise<string[]> {
  const as = { ...s, college };
  if (r.kind === "current-affair") {
    const d = r.data as CurrentAffairData;
    const row = await currentAffairsStore().create(as, { date: d.date, category: d.category, headline: d.headline, summary: d.summary, sourceName: d.sourceName, sourceUrl: d.sourceUrl, tags: [], status: "Published", mcq: d.mcq });
    return [row.id];
  }
  if (r.kind === "event") {
    const d = r.data as EventData;
    const rec = await getStore().records.create(RESOURCES.events!, { ...d, organiser: d.organiser, status: "Published" }, college);
    return [rec.id];
  }
  const d = r.data as QuestionSetData;
  const ids: string[] = [];
  for (const q of d.items.filter((x) => x.approved)) {
    const rec = await getStore().records.create(RESOURCES.questions!, { question: q.question, topic: q.topic, difficulty: q.difficulty, bloom: q.bloom, co: q.co, marks: q.marks, status: "Active", explanation: q.explanation }, college);
    ids.push(rec.id);
  }
  return ids;
}

async function removeCopies(s: SessionPayload, r: ContentRow): Promise<void> {
  for (const [college, ids] of Object.entries(r.copies)) {
    for (const id of ids) {
      if (r.kind === "current-affair") await currentAffairsStore().remove({ ...s, college }, id);
      else await getStore().records.delete(r.kind === "event" ? RESOURCES.events! : RESOURCES.questions!, id);
    }
  }
}

export async function dispatchContentDesk(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (s.role !== "admin") return err(403, "forbidden", "The University Content Desk is for the University Super Admin.");
  if (s.college !== ALL_COLLEGES) return err(409, "choose_college", "Switch to “All colleges” to prepare university content.");
  const store = contentStore();
  const [, a1, a2] = segs;

  if (method === "GET" && segs.length === 1) return ok(await overview(s));
  if (!s.mfa) return err(403, "mfa_required", "Confirm your sign-in code first.");

  // POST content-desk/generate: AI drafts, saved "In review".
  if (method === "POST" && a1 === "generate" && segs.length === 2) {
    const p = GenerateBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    if (!geminiEnabled()) return err(503, "ai_unavailable", "No AI provider is switched on. Add a key in AI Providers, or create the content by hand.");
    let parked = takeDrafts(draftKey(s.sub, p.data));
    if (!parked) {
      const rl = draftLimit(s.sub);
      if (!rl.ok) return err(429, "rate_limited", `You generated many drafts recently. Try again in ${Math.ceil(rl.retryAfter / 60)} minute(s).`);
      parked = { at: Date.now(), drafts: await draftContent(p.data) };
    }
    if (!parked.drafts?.length) return err(502, "ai_failed", "The AI could not prepare usable drafts this time. Try again, or add more detail.");
    for (const d of parked.drafts) await store.create({ kind: p.data.kind, status: "In review", source: "AI", title: d.title.slice(0, 160), data: d.data, targets: "all", copies: {}, createdBy: s.name, verifiedBy: "", reviewNote: "", publishedAt: null });
    await audit(s.name, `content-desk.ai-draft:${p.data.kind}`, `${parked.drafts.length} draft(s)`, { collegeId: null, actorSub: s.sub });
    return ok(await overview(s), 201);
  }

  // POST content-desk: a hand-written draft.
  if (method === "POST" && segs.length === 1) {
    const p = SaveBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const c = checkData(p.data.kind, p.data.data);
    if (!c.ok) return c.res;
    if (!(await resolveTargets(p.data.targets))) return err(422, "validation", "Please correct the highlighted fields.", { targets: "Pick colleges of this university" });
    await store.create({ kind: p.data.kind, status: "Draft", source: "Manual", title: titleOf(p.data.kind, c.data), data: c.data, targets: p.data.targets, copies: {}, createdBy: s.name, verifiedBy: "", reviewNote: "", publishedAt: null });
    return ok(await overview(s), 201);
  }

  const row = a1 ? await store.get(a1) : undefined;
  if (!row) return err(404, "not_found", "That item no longer exists.");

  // PUT content-desk/:id: edit while not published.
  if (method === "PUT" && segs.length === 2) {
    if (row.status === "Published") return err(409, "published", "Withdraw this item before editing it.");
    const p = UpdateBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const c = checkData(row.kind, p.data.data);
    if (!c.ok) return c.res;
    if (!(await resolveTargets(p.data.targets))) return err(422, "validation", "Please correct the highlighted fields.", { targets: "Pick colleges of this university" });
    await store.update({ ...row, data: c.data, title: titleOf(row.kind, c.data), targets: p.data.targets, status: row.status === "Rejected" || row.status === "Withdrawn" ? "Draft" : row.status });
    return ok(await overview(s));
  }

  // POST content-desk/:id/publish { verified: true, targets }
  if (method === "POST" && a2 === "publish" && segs.length === 3) {
    if (row.status === "Published") return err(409, "published", "This item is already published. Withdraw it first to publish again.");
    const p = PublishBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const c = checkData(row.kind, row.data);
    if (!c.ok) return c.res;
    if (row.kind === "question-set" && !(c.data as QuestionSetData).items.some((q) => q.approved)) return err(422, "validation", "Approve at least one question before publishing.", { items: "Approve the questions you have checked" });
    const targets = await resolveTargets(p.data.targets);
    if (!targets?.length) return err(422, "validation", "Please correct the highlighted fields.", { targets: "Pick at least one active college" });
    const copies: Record<string, string[]> = {};
    for (const college of targets) copies[college] = await copyInto(s, college, { ...row, data: c.data });
    const saved = await store.update({ ...row, data: c.data, status: "Published", targets: p.data.targets, copies, verifiedBy: s.name, reviewNote: "", publishedAt: new Date().toISOString() });
    await audit(s.name, `content-desk.publish:${row.kind}`, `${saved.title} → ${targets.length} college(s)`, { collegeId: null, actorSub: s.sub });
    return ok(await overview(s));
  }

  // POST content-desk/:id/withdraw
  if (method === "POST" && a2 === "withdraw" && segs.length === 3) {
    if (row.status !== "Published") return err(409, "not_published", "Only published items can be withdrawn.");
    await removeCopies(s, row);
    await store.update({ ...row, status: "Withdrawn", copies: {} });
    await audit(s.name, `content-desk.withdraw:${row.kind}`, row.title, { collegeId: null, actorSub: s.sub });
    return ok(await overview(s));
  }

  // POST content-desk/:id/reject { note }
  if (method === "POST" && a2 === "reject" && segs.length === 3) {
    if (row.status === "Published") return err(409, "published", "Withdraw this item instead.");
    const p = NoteBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    await store.update({ ...row, status: "Rejected", reviewNote: cleanText(p.data.note, 500) });
    await audit(s.name, `content-desk.reject:${row.kind}`, row.title, { collegeId: null, actorSub: s.sub });
    return ok(await overview(s));
  }

  // DELETE content-desk/:id (never while published)
  if (method === "DELETE" && segs.length === 2) {
    if (row.status === "Published") return err(409, "published", "Withdraw this item before deleting it.");
    await store.remove(row.id);
    return ok(await overview(s));
  }

  return err(404, "not_found", "Not found.");
}
