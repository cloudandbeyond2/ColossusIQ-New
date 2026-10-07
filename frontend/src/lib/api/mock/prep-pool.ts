import "server-only";
import { z } from "zod";
import type { SessionPayload } from "@/lib/auth/session";
import { NoteContent, SetQuestion, type NoteSource } from "@/lib/api/exam-prep-schemas";
import { BUILT_IN_NOTES, factNotes } from "./exam-notes";
import { gaQuestions, GA_TOPICS } from "./exam-bank-ga";
import { reorder } from "./exam-bank-english";
import { TOPICS, type ExamDef, type SectionDef } from "./exam-catalogue";
import { prepContentStore, type ContentRow } from "./prep-content-store";
import { shuffled, type Q, type Rng } from "./refresh-zone-content";

/*
 * The college's own exam-prep content, merged into the built-in syllabus. Published question sets add questions to a
 * topic everywhere it is used (drills, mocks) and can add new college topics to an exam section; published notes
 * replace the built-in notes for their topic. One pool is loaded per request.
 */

export interface CustomTopic {
  id: string;
  title: string;
  /** Exam sections the topic belongs to. */
  places: Array<{ examId: string; section: string }>;
}
export interface CollegePool {
  setQuestions: Map<string, Q[]>;
  custom: Map<string, CustomTopic>;
  notes: Map<string, ContentRow>;
}

const SetBodyJson = z.object({ questions: z.array(SetQuestion) });

export async function collegePool(s: SessionPayload): Promise<CollegePool> {
  const rows = (await prepContentStore().list(s)).filter((r) => r.status === "Published");
  const setQuestions = new Map<string, Q[]>();
  const custom = new Map<string, CustomTopic>();
  const notes = new Map<string, ContentRow>();
  for (const r of rows) {
    if (r.kind === "set") {
      const p = SetBodyJson.safeParse(r.body);
      if (!p.success) continue;
      const qs = p.data.questions.map((q) => ({ prompt: q.prompt, options: q.options as Q["options"], answer: q.answer, explanation: q.explanation }));
      setQuestions.set(r.topicId, [...(setQuestions.get(r.topicId) ?? []), ...qs]);
      if (!TOPICS.has(r.topicId)) {
        const t = custom.get(r.topicId) ?? { id: r.topicId, title: r.topicTitle, places: [] };
        for (const examId of r.examIds) if (r.section && !t.places.some((p) => p.examId === examId && p.section === r.section)) t.places.push({ examId, section: r.section });
        custom.set(r.topicId, t);
      }
    } else if (NoteContent.safeParse(r.body).success) {
      const prev = notes.get(r.topicId);
      // Faculty notes win over cached AI notes; otherwise the newest wins (rows come newest first).
      if (!prev || (prev.source === "ai" && r.source === "faculty")) notes.set(r.topicId, r);
    }
  }
  return { setQuestions, custom, notes };
}

export const topicExists = (pool: CollegePool, id: string) => TOPICS.has(id) || pool.custom.has(id);
export const titleOf = (pool: CollegePool, id: string) => TOPICS.get(id)?.title ?? pool.custom.get(id)?.title ?? id;
export const familyOf = (pool: CollegePool, id: string) => TOPICS.get(id)?.family ?? (pool.custom.has(id) ? "College topics" : "Subjects");

/** Questions for a topic: the built-in source plus the college's published sets, mixed together. */
export function topicQuestions(pool: CollegePool, topicId: string, n: number, rng: Rng): Array<Q & { topic: string }> {
  const builtIn = TOPICS.get(topicId)?.build(n, rng) ?? [];
  const college = (pool.setQuestions.get(topicId) ?? []).map((q) => reorder(rng, q));
  const seen = new Set<string>();
  const out: Array<Q & { topic: string }> = [];
  for (const q of shuffled(rng, [...builtIn, ...college])) {
    const k = q.prompt.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...q, topic: topicId });
    if (out.length >= n) break;
  }
  return out;
}

/** An exam's sections with the college's own topics added to the sections they were attached to. */
export function sectionsFor(pool: CollegePool, e: ExamDef): SectionDef[] {
  return e.sections.map((sec) => {
    const extra = [...pool.custom.values()].filter((t) => t.places.some((p) => p.examId === e.id && p.section === sec.name)).map((t) => t.id);
    return { ...sec, topics: [...sec.topics.filter((t) => TOPICS.has(t)), ...extra] };
  });
}

/** Questions for one section of a mock: spread evenly across its topics, no repeats. */
export function sectionQuestionsFrom(pool: CollegePool, topics: string[], n: number, rng: Rng): Array<Q & { topic: string }> {
  const order = shuffled(rng, topics.filter((t) => topicExists(pool, t)));
  const pools = new Map(order.map((t) => [t, topicQuestions(pool, t, n, rng)]));
  const out: Array<Q & { topic: string }> = [];
  const seen = new Set<string>();
  for (let round = 0; out.length < n && round < n; round++) {
    let added = false;
    for (const t of order) {
      const q = pools.get(t)?.[round];
      if (!q || seen.has(q.prompt)) continue;
      seen.add(q.prompt);
      out.push(q);
      added = true;
      if (out.length >= n) break;
    }
    if (!added) break;
  }
  return out;
}

/** Every topic a student can study: built-in topics, then the college's own. */
export function allTopics(pool: CollegePool): Array<{ id: string; title: string; family: string; items: string }> {
  return [
    ...[...TOPICS.values()].map((t) => {
      const extra = pool.setQuestions.get(t.id)?.length ?? 0;
      return { id: t.id, title: t.title, family: t.family as string, items: extra ? `${t.items} + ${extra} from your college` : t.items };
    }),
    ...[...pool.custom.values()].map((t) => ({ id: t.id, title: t.title, family: "College topics", items: `${pool.setQuestions.get(t.id)?.length ?? 0} questions from your college` })),
  ];
}

/** Built-in notes for any topic: hand-written for skill topics, key facts for fact-based ones. */
export function builtInNotes(pool: CollegePool, topicId: string): NoteContent {
  const hand = BUILT_IN_NOTES[topicId];
  if (hand) return hand;
  const title = titleOf(pool, topicId);
  if (GA_TOPICS[topicId]) return factNotes(title, gaQuestions(topicId));
  const college = pool.setQuestions.get(topicId) ?? [];
  let seed = 7;
  const steady: Rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const builtIn = TOPICS.get(topicId)?.build(15, steady) ?? [];
  return factNotes(title, [...college, ...builtIn], pool.custom.has(topicId) ? `Your faculty added ${title} to the syllabus. These key facts come from their questions.` : undefined);
}

/** Where a topic's notes would come from right now (without generating anything). */
export function notesSource(pool: CollegePool, topicId: string): NoteSource {
  const row = pool.notes.get(topicId);
  return row ? (row.source === "faculty" ? "faculty" : "ai") : "built-in";
}
