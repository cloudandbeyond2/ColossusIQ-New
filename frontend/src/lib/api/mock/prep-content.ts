import "server-only";
import type { z } from "zod";
import { ALL_COLLEGES } from "@/config/tenancy";
import { geminiEnabled } from "@/lib/ai/gemini";
import { can } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { cleanText } from "@/lib/security/sanitize";
import { GenerateBody, GenerateResult, NoteBody, NoteContent, SetBody, StudioNote, StudioOverview, StudioSet, type SetQuestion } from "@/lib/api/exam-prep-schemas";
import { audit } from "./audit";
import { EXAMS, TOPICS } from "./exam-catalogue";
import { takeParked } from "./exam-prep-ai";
import { prepContentStore, type ContentInput, type ContentRow } from "./prep-content-store";
import { allTopics, builtInNotes, collegePool, titleOf, topicExists, topicQuestions } from "./prep-pool";
import type { MockResult } from "./router";

/*
 * Exam Prep Studio: a college's staff add their own question sets (for any syllabus topic, or a new college topic
 * attached to an exam section) and topic study notes, by hand or from an AI draft they review first. Published content
 * flows straight into the students' Prep Hub: drills, mocks, notes and the syllabus tracker.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
const invalid = (e: z.ZodError): MockResult => {
  const fields: Record<string, string> = {};
  for (const i of e.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
  return err(422, "validation", "Please correct the highlighted fields.", fields);
};

export const MAX_SETS = 300;
const c = (v: string, n: number) => cleanText(v, n);
const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

const setView = (r: ContentRow): StudioSet => {
  const qs = ((r.body as { questions?: SetQuestion[] }).questions ?? []).map((q) => ({ prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation }));
  return { id: r.id, title: r.title, topicId: r.topicId, topicTitle: r.topicTitle, examIds: r.examIds, section: r.section, status: r.status, questions: qs, author: r.author, updatedAt: r.updatedAt };
};
const noteView = (r: ContentRow): StudioNote | null => {
  const p = NoteContent.safeParse(r.body);
  return p.success ? { ...p.data, id: r.id, topicId: r.topicId, topicTitle: r.topicTitle, source: r.source, status: r.status, author: r.author, updatedAt: r.updatedAt } : null;
};

function cleanQuestions(qs: SetQuestion[]): SetQuestion[] {
  return qs.map((q) => ({ prompt: c(q.prompt, 600), options: q.options.map((o) => c(o, 300)), answer: q.answer, explanation: c(q.explanation, 600) }));
}
function cleanNote(n: NoteContent): NoteContent {
  const list = (xs: string[], m: number) => xs.map((x) => c(x, m)).filter(Boolean);
  return { summary: c(n.summary, 1200), keyPoints: list(n.keyPoints, 300), formulas: list(n.formulas, 200), example: n.example ? { problem: c(n.example.problem, 600), solution: c(n.example.solution, 1200) } : null, mistakes: list(n.mistakes, 300), tips: list(n.tips, 300) };
}

export async function dispatchPrepContent(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (!can(s.role, "prep:publish")) return err(403, "forbidden", "The Exam Prep Studio is for teaching staff.");
  const store = prepContentStore();
  const canEdit = s.mfa && s.college !== ALL_COLLEGES;
  const [, a1, a2] = segs;

  if (method === "GET" && segs.length === 1) {
    if (s.college === ALL_COLLEGES) return ok(StudioOverview.parse({ sets: [], notes: [], topics: [], exams: [], aiAvailable: false, canEdit: false }));
    const [rows, pool] = await Promise.all([store.list(s), collegePool(s)]);
    const body: StudioOverview = {
      sets: rows.filter((r) => r.kind === "set").map(setView),
      notes: rows.filter((r) => r.kind === "note").map(noteView).filter((x): x is StudioNote => !!x),
      topics: allTopics(pool).map(({ id, title, family }) => ({ id, title, family })),
      exams: EXAMS.filter((e) => e.sections.length).map((e) => ({ id: e.id, name: e.name, sections: e.sections.map((x) => x.name) })),
      aiAvailable: geminiEnabled(),
      canEdit,
    };
    return ok(StudioOverview.parse(body));
  }

  if (!s.mfa) return err(403, "mfa_required", "Confirm your sign-in code first.");
  if (s.college === ALL_COLLEGES) return err(409, "choose_college", "Switch into a college to manage its exam-prep content.");

  /* ── AI or built-in drafts (nothing is saved) ── */
  if (method === "POST" && a1 === "generate" && segs.length === 2) {
    const p = GenerateBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const b = p.data;
    const pool = await collegePool(s);
    const parked = takeParked(s, b);
    if (b.kind === "notes") {
      if (!topicExists(pool, b.topicId)) return err(404, "not_found", "Topic not found.");
      if (parked?.notes) return ok(GenerateResult.parse({ source: "ai", notes: parked.notes, questions: null, message: "AI draft. Check every fact before you publish." }));
      return ok(GenerateResult.parse({ source: "built-in", notes: builtInNotes(pool, b.topicId), questions: null, message: geminiEnabled() ? "The AI could not draft notes just now, so these are the built-in notes to edit." : "AI drafting is off, so these are the built-in notes to edit." }));
    }
    if (parked?.questions) return ok(GenerateResult.parse({ source: "ai", questions: parked.questions, notes: null, message: "AI draft. Check every question and answer before you publish." }));
    if (b.topicId && TOPICS.has(b.topicId)) {
      const qs = topicQuestions(pool, b.topicId, b.count, Math.random).map(({ prompt, options, answer, explanation }) => ({ prompt, options, answer, explanation }));
      return ok(GenerateResult.parse({ source: "built-in", questions: qs, notes: null, message: "These come from the built-in question bank. Edit them or add your own." }));
    }
    return err(409, "ai_unavailable", geminiEnabled() ? "The AI could not draft questions just now. Try again or write them by hand." : "AI drafting is off. Write the questions by hand, or pick a built-in topic to start from its question bank.");
  }

  /* ── question sets ── */
  if (a1 === "sets" && ((method === "POST" && segs.length === 2) || (method === "PUT" && a2 && segs.length === 3))) {
    const p = SetBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const b = p.data;
    const pool = await collegePool(s);
    const examIds = [...new Set(b.examIds)].filter((id) => EXAMS.some((e) => e.id === id));
    let topicId: string;
    let topicTitle: string;
    if (b.topicId) {
      // A draft set may name a college topic that is not published yet; it must at least look like one.
      if (!topicExists(pool, b.topicId) && !b.topicId.startsWith("c-")) return err(422, "validation", "Please correct the highlighted fields.", { topicId: "Pick a topic from the list" });
      topicId = b.topicId;
      topicTitle = topicExists(pool, b.topicId) ? titleOf(pool, b.topicId) : c(b.newTopic, 80) || b.topicId;
    } else {
      topicTitle = c(b.newTopic, 80);
      const s2 = slug(topicTitle);
      if (s2.length < 2) return err(422, "validation", "Please correct the highlighted fields.", { newTopic: "Use letters or numbers in the topic name" });
      const clash = [...TOPICS.values()].find((t) => t.title.toLowerCase() === topicTitle.toLowerCase());
      topicId = clash ? clash.id : `c-${s2}`;
      if (clash) topicTitle = clash.title;
    }
    const section = c(b.section, 120);
    if (section && !examIds.some((id) => EXAMS.find((e) => e.id === id)!.sections.some((x) => x.name === section))) return err(422, "validation", "Please correct the highlighted fields.", { section: "Pick a section of one of the chosen exams" });
    if (!TOPICS.has(topicId) && b.status === "Published" && (!examIds.length || !section)) return err(422, "validation", "Please correct the highlighted fields.", { section: "A new topic needs an exam and a section to appear in the syllabus" });
    const input: ContentInput = { kind: "set", topicId, topicTitle, examIds, section, title: c(b.title, 120), body: { questions: cleanQuestions(b.questions) }, source: "faculty", status: b.status };
    if (method === "POST") {
      if ((await store.list(s, "set")).length >= MAX_SETS) return err(409, "limit", `A college can keep up to ${MAX_SETS} question sets.`);
      const row = await store.create(s, input, s.name);
      if (row.status === "Published") await audit(s.name, "exam-prep.set.publish", row.id, { collegeId: s.college, actorSub: s.sub });
      return ok(StudioSet.parse(setView(row)), 201);
    }
    const before = await store.get(s, a2!);
    if (!before || before.kind !== "set") return err(404, "not_found", "Question set not found.");
    const row = await store.update(s, a2!, input, s.name);
    if (!row) return err(404, "not_found", "Question set not found.");
    if (before.status !== row.status) await audit(s.name, row.status === "Published" ? "exam-prep.set.publish" : "exam-prep.set.unpublish", row.id, { collegeId: s.college, actorSub: s.sub });
    return ok(StudioSet.parse(setView(row)));
  }

  /* ── study notes (one per topic: saving replaces any earlier note, including a cached AI note) ── */
  if (a1 === "notes" && method === "POST" && segs.length === 2) {
    const p = NoteBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const { topicId, status, ...content } = p.data;
    const pool = await collegePool(s);
    if (!topicExists(pool, topicId)) return err(422, "validation", "Please correct the highlighted fields.", { topicId: "Pick a topic from the list" });
    const input: ContentInput = { kind: "note", topicId, topicTitle: titleOf(pool, topicId), examIds: [], section: "", title: `Notes: ${titleOf(pool, topicId)}`, body: cleanNote(content), source: "faculty", status };
    const existing = (await store.list(s, "note")).filter((r) => r.topicId === topicId);
    let row: ContentRow | undefined;
    if (existing.length) {
      row = await store.update(s, existing[0]!.id, input, s.name);
      for (const extra of existing.slice(1)) await store.remove(s, extra.id);
    } else row = await store.create(s, input, s.name);
    if (!row) return err(404, "not_found", "Notes not found.");
    if (row.status === "Published") await audit(s.name, "exam-prep.notes.publish", row.id, { collegeId: s.college, actorSub: s.sub });
    return ok(StudioNote.parse(noteView(row)), existing.length ? 200 : 201);
  }

  if ((a1 === "sets" || a1 === "notes") && method === "DELETE" && a2 && segs.length === 3) {
    const row = await store.get(s, a2);
    if (!row || row.kind !== (a1 === "sets" ? "set" : "note")) return err(404, "not_found", "Not found.");
    await store.remove(s, a2);
    await audit(s.name, `exam-prep.${row.kind}.delete`, a2, { collegeId: s.college, actorSub: s.sub });
    return ok({ ok: true });
  }

  return err(404, "not_found", "Not found.");
}
