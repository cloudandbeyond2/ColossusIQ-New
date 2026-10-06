import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { STREAM_DEFS } from "@/config/streams";
import type { SessionPayload } from "@/lib/auth/session";
import {
  ActivityCard,
  BreathingBody,
  MAX_MEMORY_LEVEL,
  MemoryBody,
  StartBody,
  StoredRefresh,
  SubmitBody,
  type ActivityId,
  type PlayResult,
  type QuizActivity,
  type RefreshOverview,
  type Round,
  type RoundResult,
  type Stat,
  type StoredRefresh as State,
} from "@/lib/api/refresh-zone-schemas";
import { aptitudeRound, shuffled, vocabularyRound, type Q } from "./refresh-zone-content";
import { bankFor } from "./learning-content";
import { collegeStream } from "./records";
import { getStudentAcademicProfile } from "./student-profile";
import { studentStateStore } from "./student-state-store";
import type { MockResult } from "./router";

/*
 * Refresh Zone: short brain breaks with saved scores. Quiz games hand the student questions without the answers; the
 * answer key waits in the student's own saved state until they submit, so scores cannot be forged from the browser.
 * Memory Matrix and the breathing break run in the browser and report only what they finished.
 */

const STATE_KEY = "refresh-zone";
const ROUND_LENGTH = 10;
const DAILY_GOAL = 3;
const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string): MockResult => ({ status, body: { error: { code, message } } });
const invalid = (e: z.ZodError): MockResult => err(422, "validation", e.issues[0]?.message ?? "Check what you sent.");

const IST_MS = 5.5 * 3_600_000;
const dayOf = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/* ───────────────────────────── saved state ───────────────────────────── */
const blank = (): State => ({ stats: {}, days: {}, pending: null, updatedAt: new Date().toISOString() });
async function load(session: SessionPayload): Promise<State> {
  const p = StoredRefresh.safeParse(await studentStateStore().get(session.sub, STATE_KEY));
  return p.success ? p.data : blank();
}
async function save(session: SessionPayload, st: State): Promise<void> {
  st.updatedAt = new Date().toISOString();
  const cutoff = addDays(dayOf(Date.now()), -20);
  for (const d of Object.keys(st.days)) if (d < cutoff) delete st.days[d];
  await studentStateStore().save(session.college, session.sub, STATE_KEY, st);
}
const emptyStat = (): Stat => ({ plays: 0, best: 0, last: 0, correct: 0, answered: 0, seconds: 0 });

function record(st: State, id: ActivityId, v: { score: number; correct?: number; answered?: number; seconds?: number }): { newBest: boolean; stat: Stat } {
  const s = st.stats[id] ?? emptyStat();
  const newBest = v.score > s.best;
  const next: Stat = { plays: s.plays + 1, best: Math.max(s.best, v.score), last: v.score, correct: s.correct + (v.correct ?? 0), answered: s.answered + (v.answered ?? 0), seconds: s.seconds + (v.seconds ?? 0) };
  st.stats[id] = next;
  const today = dayOf(Date.now());
  st.days[today] = (st.days[today] ?? 0) + 1;
  return { newBest, stat: next };
}

/* ───────────────────────────── question sources ───────────────────────── */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, " ").trim();

/** The student's own department bank when there is one; otherwise a mix of the banks of their college's stream. */
async function subjectPool(session: SessionPayload): Promise<{ pool: Q[]; note: string }> {
  const stream = await collegeStream(session.college);
  if (!stream) return { pool: [], note: "Switch into a college to play." };
  const departments = STREAM_DEFS[stream].departments;
  let mine: string[] = [];
  try {
    const dept = norm((await getStudentAcademicProfile(session)).department ?? "");
    if (dept) mine = departments.filter((d) => bankFor(d).length && (dept.includes(norm(d)) || norm(d).includes(dept)));
  } catch {
    mine = [];
  }
  const names = mine.length ? mine : departments.filter((d) => bankFor(d).length);
  const pool = names.flatMap((d) => bankFor(d));
  const note = !pool.length ? "No question bank for your college yet." : mine.length ? `From the ${mine.join(" and ")} question bank.` : `A mix of ${STREAM_DEFS[stream].label} questions.`;
  return { pool, note };
}

const ACTIVITIES: Array<Omit<ActivityCard, "available" | "note" | "plays" | "best" | "last">> = [
  { id: "subject", title: "Subject quiz battle", description: "Ten rapid-fire questions from your own subject area, scored with explanations.", tag: "Quiz battle", tone: "rose", kind: "quiz" },
  { id: "aptitude", title: "Aptitude sprint", description: "Percentages, time and work, ratios and number series, built fresh every round for placement tests.", tag: "Logic & aptitude", tone: "brand", kind: "quiz" },
  { id: "vocabulary", title: "Vocabulary power", description: "Ten GRE and CAT level words. Pick the right meaning before the clock runs out.", tag: "Language", tone: "gold", kind: "quiz" },
  { id: "memory", title: "Memory matrix", description: "Watch the pattern, then repeat it. Every level adds one more square.", tag: "Brain fitness", tone: "teal", kind: "memory" },
  { id: "breathing", title: "Breathing break", description: "A guided breathing circle to settle your mind between study blocks.", tag: "Reset", tone: "sky", kind: "breathing" },
];
const SECONDS: Record<QuizActivity, number> = { subject: 40, aptitude: 45, vocabulary: 20 };
const TITLES: Record<QuizActivity, string> = { subject: "Subject quiz battle", aptitude: "Aptitude sprint", vocabulary: "Vocabulary power" };

function streakOf(days: Record<string, number>): { current: number; longest: number } {
  const set = new Set(Object.entries(days).filter(([, n]) => n > 0).map(([d]) => d));
  const today = dayOf(Date.now());
  let longest = 0;
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue;
    let n = 0;
    for (let c = d; set.has(c); c = addDays(c, 1)) n++;
    longest = Math.max(longest, n);
  }
  let current = 0;
  for (let c = set.has(today) ? today : addDays(today, -1); set.has(c); c = addDays(c, -1)) current++;
  return { current, longest };
}

async function overview(session: SessionPayload): Promise<RefreshOverview> {
  const st = await load(session);
  const subject = await subjectPool(session);
  const today = dayOf(Date.now());
  const stat = (id: string) => st.stats[id];
  const cards = ACTIVITIES.map((a) => {
    const s = stat(a.id);
    const base = { ...a, plays: s?.plays ?? 0, best: s ? (a.id === "breathing" ? Math.round(s.seconds / 60) : s.best) : null, last: s ? s.last : null };
    if (a.id === "subject") return { ...base, available: subject.pool.length >= 5, note: subject.note };
    if (a.id === "aptitude") return { ...base, available: true, note: "Questions are generated from formulas, so every answer is exact." };
    if (a.id === "vocabulary") return { ...base, available: true, note: "" };
    if (a.id === "memory") return { ...base, available: true, note: "Best is the highest level you cleared." };
    return { ...base, available: true, note: "Best shows your total minutes of calm." };
  });
  const week = [6, 5, 4, 3, 2, 1, 0].map((n) => {
    const day = addDays(today, -n);
    return { day, label: new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }), plays: st.days[day] ?? 0 };
  });
  const all = Object.values(st.stats);
  return {
    activities: cards,
    today: { plays: st.days[today] ?? 0, goal: DAILY_GOAL },
    streak: streakOf(st.days),
    week,
    totals: { plays: all.reduce((n, s) => n + s.plays, 0), answered: all.reduce((n, s) => n + s.answered, 0), correct: all.reduce((n, s) => n + s.correct, 0), minutes: Math.round((st.stats.breathing?.seconds ?? 0) / 60) },
  };
}

/* ───────────────────────────── rounds ───────────────────────────── */
function arrange(q: Q): Q {
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = randomInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return { ...q, options: order.map((k) => q.options[k]!) as Q["options"], answer: order.indexOf(q.answer) };
}

async function startRound(session: SessionPayload, activity: QuizActivity): Promise<MockResult> {
  let qs: Q[];
  if (activity === "subject") {
    const { pool, note } = await subjectPool(session);
    if (pool.length < 5) return err(409, "no_questions", note);
    qs = shuffled(Math.random, pool).slice(0, ROUND_LENGTH).map(arrange);
  } else if (activity === "aptitude") qs = aptitudeRound(ROUND_LENGTH);
  else qs = vocabularyRound(ROUND_LENGTH);
  const st = await load(session);
  const id = `RZ-${randomBytes(4).toString("hex").toUpperCase()}`;
  st.pending = { id, activity, questions: qs.map((q) => ({ prompt: q.prompt, options: [...q.options], answer: q.answer, explanation: q.explanation })), startedAt: Date.now() };
  await save(session, st);
  const round: Round = { id, activity, title: TITLES[activity], secondsPerQuestion: SECONDS[activity], questions: qs.map((q, i) => ({ id: `q${i + 1}`, prompt: q.prompt, options: [...q.options] })) };
  return ok(round, 201);
}

async function submitRound(session: SessionPayload, id: string, raw: unknown): Promise<MockResult> {
  const p = SubmitBody.safeParse(raw);
  if (!p.success) return invalid(p.error);
  const st = await load(session);
  const round = st.pending;
  if (!round || round.id !== id) return err(404, "round_expired", "That round has ended. Start a new one.");
  let score = 0;
  const review = round.questions.map((q, i) => {
    const given = p.data.answers[`q${i + 1}`] ?? null;
    const correct = given === q.answer;
    if (correct) score++;
    return { id: `q${i + 1}`, prompt: q.prompt, options: q.options, given, answer: q.answer, correct, explanation: q.explanation };
  });
  const total = round.questions.length;
  const percentage = Math.round((score / total) * 100);
  const seconds = Math.max(0, Math.round((Date.now() - round.startedAt) / 1000));
  st.pending = null;
  const { newBest, stat } = record(st, round.activity, { score: percentage, correct: score, answered: total, seconds: Math.min(seconds, 3600) });
  await save(session, st);
  const result: RoundResult = { score, total, percentage, newBest, best: stat.best, review };
  return ok(result);
}

/* ───────────────────────────── dispatcher ───────────────────────────── */
export async function dispatchRefreshZone(method: string, segs: string[], rawBody: unknown, session: SessionPayload): Promise<MockResult> {
  if (session.role !== "student") return err(403, "forbidden", "The Refresh Zone is for students.");
  const [, a1, a2, a3] = segs;
  if (segs.length === 1 && method === "GET") return ok(await overview(session));
  if (a1 === "rounds" && segs.length === 2 && method === "POST") {
    const p = StartBody.safeParse(rawBody);
    return p.success ? startRound(session, p.data.activity) : invalid(p.error);
  }
  if (a1 === "rounds" && a2 && a3 === "submit" && segs.length === 4 && method === "POST") return submitRound(session, a2, rawBody);
  if (a1 === "memory" && segs.length === 2 && method === "POST") {
    const p = MemoryBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const st = await load(session);
    const { newBest, stat } = record(st, "memory", { score: Math.min(p.data.level, MAX_MEMORY_LEVEL) });
    await save(session, st);
    const r: PlayResult = { best: stat.best, newBest, plays: stat.plays };
    return ok(r);
  }
  if (a1 === "breathing" && segs.length === 2 && method === "POST") {
    const p = BreathingBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const st = await load(session);
    const { newBest, stat } = record(st, "breathing", { score: Math.round(p.data.seconds / 60), seconds: p.data.seconds });
    await save(session, st);
    const r: PlayResult = { best: Math.round(stat.seconds / 60), newBest, plays: stat.plays };
    return ok(r);
  }
  return err(404, "not_found", "Not found.");
}
