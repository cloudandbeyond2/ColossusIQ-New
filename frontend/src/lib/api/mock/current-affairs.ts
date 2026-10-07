import "server-only";
import type { z } from "zod";
import { ALL_COLLEGES } from "@/config/tenancy";
import { can } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { cleanText } from "@/lib/security/sanitize";
import { CaBody, CaFeed, CaItem, isAllowedSource } from "@/lib/api/exam-prep-schemas";
import { audit } from "./audit";
import { currentAffairsStore, type CaRow } from "./current-affairs-store";
import { EXAMS } from "./exam-catalogue";
import { isoWeek, todayIst } from "./exam-prep";
import { prepAttemptStore } from "./prep-attempt-store";
import type { MockResult } from "./router";

/*
 * Current Affairs. A college's staff curate short daily items (with an optional question) for competitive-exam
 * preparation; students read the published feed and take a weekly quiz built from it (exam-prep.ts). Items are plain
 * text; source links must be https and on the allow-list in exam-prep-schemas.ts.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
const invalid = (e: z.ZodError): MockResult => {
  const fields: Record<string, string> = {};
  for (const i of e.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
  return err(422, "validation", "Please correct the highlighted fields.", fields);
};

const READERS = ["student", "faculty", "hod", "institution", "admin"];
export const MAX_ITEMS = 1500;

function clean(b: CaBody): CaBody {
  const c = (v: string, n: number) => cleanText(v, n);
  return {
    ...b,
    headline: c(b.headline, 140),
    summary: c(b.summary, 600),
    sourceName: c(b.sourceName, 80),
    sourceUrl: b.sourceUrl.trim(),
    tags: [...new Set(b.tags)].filter((t) => EXAMS.some((e) => e.id === t)),
    mcq: b.mcq ? { question: c(b.mcq.question, 300), options: b.mcq.options.map((o) => c(o, 120)), answer: b.mcq.answer, explanation: c(b.mcq.explanation, 300) } : null,
  };
}

const view = (r: CaRow, staff: boolean): CaItem => ({
  id: r.id,
  date: r.date,
  category: r.category,
  headline: r.headline,
  summary: r.summary,
  sourceName: r.sourceName,
  sourceUrl: r.sourceUrl && isAllowedSource(r.sourceUrl) ? r.sourceUrl : "",
  tags: r.tags,
  status: r.status,
  mcq: r.mcq ? { question: r.mcq.question, options: r.mcq.options, answer: staff ? r.mcq.answer : null, explanation: staff ? r.mcq.explanation : "" } : null,
  author: staff ? r.author : "",
  updatedAt: r.updatedAt,
});

export async function dispatchCurrentAffairs(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (!READERS.includes(s.role)) return err(403, "forbidden", "Current affairs are for students and teaching staff.");
  const staff = can(s.role, "prep:publish");
  const store = currentAffairsStore();
  const today = todayIst();
  const id = segs[1];

  if (method === "GET" && segs.length === 1) {
    if (s.college === ALL_COLLEGES) return ok(CaFeed.parse({ items: [], canEdit: false, weekly: { week: isoWeek(today), questions: 0, done: false, last: null }, exams: [] }));
    const rows = await store.list(s);
    const visible = staff ? rows : rows.filter((r) => r.status === "Published" && r.date <= today);
    const week = isoWeek(today);
    const from = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
    const weekQuestions = rows.filter((r) => r.status === "Published" && r.mcq && r.date >= from && r.date <= today).length;
    let done = false;
    let last: number | null = null;
    if (s.role === "student") {
      const mine = (await prepAttemptStore().mine(s)).find((m) => m.ref === `ca:${week}`);
      done = !!mine;
      last = mine ? mine.percent : null;
    }
    const body: CaFeed = {
      items: visible.slice(0, 300).map((r) => view(r, staff)),
      canEdit: staff && s.mfa,
      weekly: { week, questions: weekQuestions, done, last },
      exams: EXAMS.map((e) => ({ id: e.id, name: e.name })),
    };
    return ok(CaFeed.parse(body));
  }

  // Everything below changes data: staff only, signed in with MFA, inside one college.
  if (!staff) return err(403, "forbidden", "Only teaching staff can manage current affairs.");
  if (!s.mfa) return err(403, "mfa_required", "Confirm your sign-in code first.");
  if (s.college === ALL_COLLEGES) return err(409, "choose_college", "Switch into a college to manage its current affairs.");

  if (method === "POST" && segs.length === 1) {
    const p = CaBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const b = clean(p.data);
    if ((await store.list(s)).length >= MAX_ITEMS) return err(409, "limit", `A college can keep up to ${MAX_ITEMS} items. Delete old ones to add more.`);
    const row = await store.create(s, b);
    await audit(s.name, b.status === "Published" ? "current-affairs.publish" : "current-affairs.draft", row.id, { collegeId: s.college, actorSub: s.sub });
    return ok(view(row, true), 201);
  }

  if (!id) return err(404, "not_found", "Not found.");

  if (method === "PUT" && segs.length === 2) {
    const p = CaBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const before = await store.get(s, id);
    if (!before) return err(404, "not_found", "Item not found.");
    const row = await store.update(s, id, clean(p.data));
    if (!row) return err(404, "not_found", "Item not found.");
    if (before.status !== row.status) await audit(s.name, row.status === "Published" ? "current-affairs.publish" : "current-affairs.unpublish", row.id, { collegeId: s.college, actorSub: s.sub });
    return ok(view(row, true));
  }

  if (method === "DELETE" && segs.length === 2) {
    if (!(await store.remove(s, id))) return err(404, "not_found", "Item not found.");
    await audit(s.name, "current-affairs.delete", id, { collegeId: s.college, actorSub: s.sub });
    return ok({ ok: true });
  }

  return err(404, "not_found", "Not found.");
}
