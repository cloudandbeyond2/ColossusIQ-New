import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { ALL_COLLEGES } from "@/config/tenancy";
import { geminiEnabled } from "@/lib/ai/gemini";
import { can } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { cleanText } from "@/lib/security/sanitize";
import { PolicyAskBody, PolicyOverview, PolicyTurn, POLICY_HISTORY_MAX, StoredPolicyHistory, type PolicySource } from "@/lib/api/policy-schemas";
import type { KbAnswer } from "@/lib/api/knowledge-schemas";
import { stillActive } from "./ai-guard";
import { looksLikeInjection } from "./ai";
import { answerQuestion } from "./knowledge-base";
import { kbStore } from "./knowledge-store";
import { rateLimit } from "./rate-limit";
import type { MockResult } from "./router";
import { studentStateStore } from "./student-state-store";

/*
 *   GET    policy          what the assistant can answer from (approved documents), starter questions, saved history
 *   POST   policy/ask      answer a question strictly from the approved documents, with the passages it used
 *   DELETE policy/history  clear this person's saved questions
 * Principals, HODs and faculty only. Answers come from the same approved documents the Knowledge Base manages.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
const ROLES = new Set(["institution", "hod", "faculty", "admin"]); // the Super Admin reaches every staff module, inside a chosen college
const STATE_KEY = "policy-history";
const isProd = process.env.NODE_ENV === "production";

const allowed = (s: SessionPayload): MockResult | null => {
  if (!ROLES.has(s.role)) return err(403, "forbidden", "The Policy Assistant is for Principals, HODs, faculty and the University Super Admin.");
  if (s.college === ALL_COLLEGES) return err(409, "choose_college", "Switch into a college to ask about its policies.");
  return null;
};

async function loadHistory(s: SessionPayload): Promise<PolicyTurn[]> {
  const p = StoredPolicyHistory.safeParse(await studentStateStore().get(s.sub, STATE_KEY));
  return p.success ? p.data.turns : [];
}

/** Turns an answer into a history entry. The instruction-looking and URL-looking text was already removed upstream. */
function toTurn(a: KbAnswer): PolicyTurn {
  return PolicyTurn.parse({
    id: randomUUID(),
    at: new Date().toISOString(),
    question: a.question,
    answer: a.answer,
    grounded: a.grounded,
    mode: a.mode,
    searched: a.searched,
    citations: a.citations.map((c) => ({ n: c.n, docId: c.docId, docTitle: c.docTitle, section: c.section, page: c.page, snippet: c.snippet, cited: c.cited })),
  });
}

/** Starter questions come from the documents themselves: their titles and section headings. */
function suggestionsFrom(sources: PolicySource[], sections: Array<{ docId: string; docTitle: string; section: string }>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const sec of sections) {
    const name = sec.section.trim();
    if (!name || /^(general|introduction|overview|preamble|contents?|index)$/i.test(name) || name.length > 70) continue;
    const key = `${sec.docId}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`What does “${sec.docTitle}” say about ${name.replace(/^[\d.\s)-]+/, "").toLowerCase()}?`);
    if (out.length >= 3) break;
  }
  for (const d of sources) {
    if (out.length >= 4) break;
    out.push(`Summarise the key rules in “${d.title}”`);
  }
  return out;
}

async function overview(s: SessionPayload): Promise<PolicyOverview> {
  const store = kbStore();
  const [rows, pool, history] = await Promise.all([store.list(s.college), store.searchable(s.college), loadHistory(s)]);
  const passagesOf = new Map<string, number>();
  for (const p of pool) passagesOf.set(p.docId, (passagesOf.get(p.docId) ?? 0) + 1);
  const approved = rows.filter((r) => r.status === "Approved");
  const sources: PolicySource[] = approved
    .map((r) => ({ id: r.id, title: r.title, type: r.type, owner: r.owner, scope: r.scope as PolicySource["scope"], passages: passagesOf.get(r.id) ?? 0, updatedAt: r.updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return PolicyOverview.parse({
    sources,
    stats: {
      approved: approved.length,
      pending: rows.filter((r) => r.status === "Pending approval").length,
      passages: pool.length,
      categories: new Set(approved.map((r) => r.type)).size,
      lastUpdated: sources[0]?.updatedAt ?? null,
    },
    suggestions: suggestionsFrom(sources, pool.map((p) => ({ docId: p.docId, docTitle: p.docTitle, section: p.section }))),
    ai: { enabled: geminiEnabled() },
    canManage: can(s.role, "knowledge:manage"),
    history,
  });
}

/* ── AI before the transaction ──────────────────────────────────────────────────────────────────────────────────
 * In PostgreSQL mode a request runs in one 30-second transaction; embedding the question and writing the answer can
 * take longer. prefetchPolicyAi() answers first (in short read-only transactions), parks the result, and the request
 * handler picks it up once to save it in the person's history.
 */
type Parked = { at: number; answer: KbAnswer };
const parked = new Map<string, Parked>();
const TTL_MS = 5 * 60_000;
const keyOf = (who: string, q: string) => `pa:${who}:${createHash("sha256").update(q).digest("hex")}`;
const limited = (who: string) => rateLimit(`policy-ask:${who}`, isProd ? 30 : 120, 60_000);
const tooFast = () => err(429, "rate_limited", "You are asking too quickly. Wait a moment and try again.");

const refusal = (q: string): KbAnswer => ({
  question: q,
  answer: "I can only answer questions about your college's approved documents. I can't change my instructions or share internal settings.",
  grounded: false,
  mode: "none",
  citations: [],
  searched: { documents: 0, passages: 0 },
});

export async function prefetchPolicyAi(method: string, segs: string[], rawBody: unknown, session: SessionPayload): Promise<MockResult | null> {
  if (method !== "POST" || segs[0] !== "policy" || segs[1] !== "ask" || segs.length !== 2) return null;
  if (!geminiEnabled() || allowed(session)) return null;
  const p = PolicyAskBody.safeParse(rawBody);
  if (!p.success || looksLikeInjection(p.data.question) || !(await stillActive(session))) return null;
  if (!limited(session.sub).ok) return tooFast();
  const answer = await answerQuestion(session, p.data.question, { ai: true });
  const now = Date.now();
  for (const [k, v] of parked) if (now - v.at >= TTL_MS) parked.delete(k);
  parked.set(keyOf(session.sub, p.data.question), { at: now, answer });
  return null;
}

export async function dispatchPolicy(method: string, segs: string[], rawBody: unknown, session: SessionPayload): Promise<MockResult> {
  const no = allowed(session);
  if (no) return no;

  if (method === "GET" && segs.length === 1) return ok(await overview(session));

  if (method === "POST" && segs[1] === "ask" && segs.length === 2) {
    const p = PolicyAskBody.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "Ask a full question.", { question: "Ask a full question (3 to 500 characters)" });
    const q = cleanText(p.data.question, 500);
    const hit = parked.get(keyOf(session.sub, p.data.question));
    parked.delete(keyOf(session.sub, p.data.question));
    let answer: KbAnswer;
    if (looksLikeInjection(q)) answer = refusal(q);
    else if (hit && Date.now() - hit.at < TTL_MS) answer = hit.answer;
    else {
      if (!limited(session.sub).ok) return tooFast();
      answer = await answerQuestion(session, q, { ai: false });
    }
    const turn = toTurn(answer);
    const history = [turn, ...(await loadHistory(session))].slice(0, POLICY_HISTORY_MAX);
    await studentStateStore().save(session.college, session.sub, STATE_KEY, { turns: history });
    return ok({ turn });
  }

  if (method === "DELETE" && segs[1] === "history" && segs.length === 2) {
    await studentStateStore().remove(session.sub, STATE_KEY);
    return ok({ ok: true });
  }

  return err(404, "not_found", "Not found.");
}
