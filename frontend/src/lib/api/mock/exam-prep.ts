import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { STREAM_DEFS, type Stream } from "@/config/streams";
import type { SessionPayload } from "@/lib/auth/session";
import {
  Catalogue,
  DailyStatus,
  EnglishBody,
  EnglishHome,
  ENGLISH_KINDS,
  ExamDetail,
  GROUP_LABEL,
  EXAM_GROUPS,
  MAX_TARGETS,
  MockList,
  MockStartBody,
  NoteContent,
  Syllabus,
  TopicNotes,
  type TopicStatus,
  PracticeBody,
  PrepOverview,
  RoundResult,
  StoredPrep,
  SubmitBody,
  TargetBody,
  TopicList,
  TOPIC_FAMILIES,
  type Eligibility,
  type EnglishKind,
  type ExamCard,
  type Round,
  type RoundKind,
  type Target,
} from "@/lib/api/exam-prep-schemas";
import { computeStreak } from "./achievements";
import { currentAffairsStore } from "./current-affairs-store";
import { ENGLISH_INFO, ENGLISH_ITEMS, englishRound, wordOfDay } from "./exam-bank-english";
import { QUANT, QUANT_TOPICS } from "./exam-bank-quant";
import { REASONING, REASONING_TOPICS } from "./exam-bank-reasoning";
import { DISCLAIMER, EXAMS, examById, mockPlan, TOPICS, topicTitle, type ExamDef, type SectionDef } from "./exam-catalogue";
import { takeParkedNotes } from "./exam-prep-ai";
import { prepContentStore } from "./prep-content-store";
import { allTopics, builtInNotes, collegePool, familyOf, notesSource, sectionQuestionsFrom, sectionsFor, titleOf, topicExists, topicQuestions, type CollegePool } from "./prep-pool";
import { percentileOf, prepAttemptStore, type PrepAttemptRow } from "./prep-attempt-store";
import { shuffled, type Q, type Rng } from "./refresh-zone-content";
import { getStudentAcademicProfile, type StudentAcademicProfile } from "./student-profile";
import { studentStateStore } from "./student-state-store";
import type { MockResult } from "./router";

/*
 * Competitive Exam Prep Hub: a personal guide for Indian competitive, eligibility and entrance exams. Students pick
 * target exams, see whether they are eligible, and practise through a daily aptitude test, topic drills, English rounds,
 * pattern-based practice mocks and a weekly current-affairs quiz. Answer keys wait in the student's own saved state
 * until they submit, so marks cannot be forged from the browser.
 */

const STATE_KEY = "exam-prep-hub";
const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string): MockResult => ({ status, body: { error: { code, message } } });
const invalid = (e: z.ZodError): MockResult => err(422, "validation", e.issues[0]?.message ?? "Check what you sent.");

/* ───────────────────────────── days & weeks (India time) ───────────────────────────── */
const IST_MS = 5.5 * 3_600_000;
export const todayIst = (now = Date.now()) => new Date(now + IST_MS).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
/** ISO week of an India-time day, e.g. "2026-W41". */
export function isoWeek(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/* ───────────────────────────── seeded randomness ───────────────────────────── */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** mulberry32: the same seed always gives the same questions, so a college's daily test is shared. */
export function seeded(seed: string): Rng {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────────────────────── saved state ───────────────────────────── */
type State = StoredPrep;
const blank = (): State => ({ targets: [], topics: {}, english: {}, studied: {}, days: {}, pending: null, updatedAt: new Date().toISOString() });
async function load(s: SessionPayload): Promise<State> {
  const p = StoredPrep.safeParse(await studentStateStore().get(s.sub, STATE_KEY));
  return p.success ? p.data : blank();
}
async function save(s: SessionPayload, st: State): Promise<void> {
  st.updatedAt = new Date().toISOString();
  const cutoff = addDays(todayIst(), -35);
  for (const d of Object.keys(st.days)) if (d < cutoff) delete st.days[d];
  await studentStateStore().save(s.college, s.sub, STATE_KEY, st);
}
const acc = (x: { answered: number; correct: number } | undefined) => (x && x.answered ? Math.round((x.correct / x.answered) * 100) : null);

/* ───────────────────────────── eligibility ───────────────────────────── */
interface Standing {
  level: "Diploma" | "UG" | "PG" | "MBBS";
  stream: Stream;
  year: number;
  finalYear: boolean;
  degree: string;
}
function standingOf(p: StudentAcademicProfile): Standing {
  const degree = p.degree;
  const pg = /^(M\.|MBA|MCA|MD|MS\b|M\.?Sc|M\.?Com|M\.?A\b|M\.?E\b|M\.?Tech|M\.?Phil)/i.test(degree);
  const level: Standing["level"] = p.stream === "polytechnic" || /diploma/i.test(degree) ? "Diploma" : pg ? "PG" : /MBBS/i.test(degree) ? "MBBS" : "UG";
  const terms = level === "PG" ? 4 : p.stream === "engineering" ? 8 : p.stream === "medical" ? 9 : 6;
  const sem = Math.max(1, Math.min(terms, p.semester || 1));
  return { level, stream: p.stream, year: Math.ceil(sem / 2), finalYear: sem >= terms - 1, degree };
}

export function eligibilityFor(st: Standing, e: ExamDef): { eligibility: Eligibility; note: string } {
  const r = (eligibility: Eligibility, note: string) => ({ eligibility, note });
  let out: { eligibility: Eligibility; note: string };
  switch (e.level) {
    case "10th":
      out = r("eligible", "You meet the education requirement (10th pass).");
      break;
    case "12th":
      out = st.level === "Diploma" ? r("check-notification", "Some boards accept a diploma as equal to 12th for this exam. Check the notification.") : r("eligible", "You meet the education requirement (12th pass). Check any subject requirements.");
      break;
    case "UG":
      if (st.level === "PG") out = r("eligible", "You already hold a degree.");
      else if (st.level === "Diploma") out = r("not-yet", "This exam needs a bachelor's degree.");
      else if (e.finalYear === "third-year" && st.year >= 3) out = r("eligible-final-year", "You can apply from the third year of your degree.");
      else if (e.finalYear && st.finalYear) out = r("eligible-final-year", "Final-year students may apply, provided they graduate by the notified date.");
      else if (e.finalYear === "third-year") out = r("not-yet", `You can apply from your third year (you are in year ${st.year}).`);
      else out = r("not-yet", e.finalYear ? `You can apply in your final year (you are in year ${st.year}).` : "You can apply once you hold your degree.");
      break;
    case "PG":
      if (st.level === "PG") out = st.finalYear && e.finalYear ? r("eligible-final-year", "Final-year PG students may apply.") : r("not-yet", "You can apply in the final year of your master's degree.");
      else out = r("not-yet", "This exam needs a master's degree.");
      break;
    case "MBBS":
      out = st.level === "MBBS" ? r("check-notification", "You need to finish MBBS and the internship by the notified date.") : r("not-yet", "This exam is only for MBBS graduates.");
      break;
    case "Teacher":
      out = r("check-notification", "You need a teacher-education qualification (B.Ed or D.El.Ed) as listed in the notification.");
      break;
  }
  if (e.streams && !e.streams.includes(st.stream) && (out.eligibility === "eligible" || out.eligibility === "eligible-final-year")) {
    out = r("check-notification", `Only some degree subjects qualify; check whether ${st.degree} is accepted.`);
  }
  return out;
}

async function standing(s: SessionPayload): Promise<{ profile: StudentAcademicProfile; st: Standing }> {
  const profile = await getStudentAcademicProfile(s);
  return { profile, st: standingOf(profile) };
}

const sumQuestions = (e: ExamDef) => e.sections.reduce((n, x) => n + x.questions, 0);
function card(e: ExamDef, st: Standing, targets: Target[]): ExamCard {
  const el = eligibilityFor(st, e);
  return {
    id: e.id,
    name: e.name,
    fullName: e.fullName,
    conductedBy: e.conductedBy,
    group: e.group,
    qualification: e.qualification,
    summary: e.summary,
    officialSite: e.officialSite,
    totalQuestions: sumQuestions(e),
    durationMin: e.durationMin,
    negativeMarking: e.sections.some((x) => x.negative > 0),
    hasTest: e.hasTest !== false,
    eligibility: el.eligibility,
    eligibilityNote: el.note,
    isTarget: targets.some((t) => t.examId === e.id),
  };
}

/* ───────────────────────────── overview (My Plan) ───────────────────────────── */
const statOf = (st: State, t: string) => (t.startsWith("e-") ? st.english[t.slice(2)] : st.topics[t]);
function sectionStats(sections: SectionDef[], st: State) {
  return sections.map((x) => {
    let answered = 0;
    let correct = 0;
    for (const t of x.topics) {
      const s = t.startsWith("e-") ? st.english[t.slice(2)] : st.topics[t];
      if (s) {
        answered += s.answered;
        correct += s.correct;
      }
    }
    return { name: x.name, answered, correct, practised: x.topics.filter((t) => (t.startsWith("e-") ? st.english[t.slice(2)] : st.topics[t])?.answered).length, total: x.topics.length };
  });
}

function readinessOf(e: ExamDef, sections: SectionDef[], st: State, mocks: PrepAttemptRow[]): number | null {
  const secs = sectionStats(sections, st);
  const answered = secs.reduce((n, x) => n + x.answered, 0);
  const myMocks = mocks.filter((m) => m.kind === "mock" && m.key === e.id);
  if (!answered && !myMocks.length) return null;
  const accuracy = answered ? secs.reduce((n, x) => n + x.correct, 0) / answered : 0;
  const coverage = secs.reduce((n, x) => n + x.practised, 0) / Math.max(1, secs.reduce((n, x) => n + x.total, 0));
  const mock = myMocks.length ? Math.max(0, Math.min(100, Math.max(...myMocks.map((m) => m.percent)))) / 100 : accuracy;
  return Math.round(100 * (0.55 * accuracy + 0.25 * coverage + 0.2 * mock));
}

function allTopicStats(st: State, title: (id: string) => string = topicTitle): Array<{ id: string; title: string; answered: number; correct: number }> {
  return [
    ...Object.entries(st.topics).map(([id, s]) => ({ id, title: title(id), answered: s.answered, correct: s.correct })),
    ...Object.entries(st.english).map(([k, s]) => ({ id: `e-${k}`, title: title(`e-${k}`), answered: s.answered, correct: s.correct })),
  ];
}

async function overview(s: SessionPayload): Promise<PrepOverview> {
  const [st, { profile, st: me }, mine, pool] = await Promise.all([load(s), standing(s), prepAttemptStore().mine(s), collegePool(s)]);
  const today = todayIst();
  const title = (id: string) => titleOf(pool, id);
  const targets = st.targets
    .map((t) => ({ t, e: examById(t.examId) }))
    .filter((x): x is { t: Target; e: ExamDef } => !!x.e)
    .map(({ t, e }) => {
      const el = eligibilityFor(me, e);
      return {
        examId: e.id,
        name: e.name,
        date: t.date,
        daysLeft: t.date ? daysBetween(today, t.date) : null,
        eligibility: el.eligibility,
        eligibilityNote: el.note,
        readiness: readinessOf(e, sectionsFor(pool, e), st, mine),
        sections: sectionStats(sectionsFor(pool, e), st).map((x) => ({ name: x.name, accuracy: x.answered ? Math.round((x.correct / x.answered) * 100) : null, answered: x.answered })),
      };
    });

  const stats = allTopicStats(st, title);
  const weak = stats.filter((x) => x.answered >= 5).map((x) => ({ id: x.id, title: x.title, answered: x.answered, accuracy: Math.round((x.correct / x.answered) * 100) })).filter((x) => x.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);

  // The topics the plan works through: weak ones first, then the target exams' topics not yet practised.
  const targetTopics = [...new Set(targets.flatMap((t) => sectionsFor(pool, examById(t.examId)!).flatMap((x) => x.topics)))].filter((id) => topicExists(pool, id));
  const unpractised = targetTopics.filter((id) => !stats.some((x) => x.id === id && x.answered > 0));
  const queue = [...weak.map((w) => w.id), ...unpractised, ...targetTopics, "q-percentage", "r-coding", "e-error-spotting", "g-polity"];
  const focus = [...new Set(queue)];
  const nextTopic = focus.find((id) => !id.startsWith("e-")) ?? "q-percentage";

  const todayRec = st.days[today];
  const practisedToday = Object.values(st.topics).some((x) => x.last === today);
  const englishToday = Object.values(st.english).some((x) => x.last === today);
  const week = isoWeek(today);
  const caDone = mine.some((m) => m.ref === `ca:${week}`);
  const mockToday = mine.some((m) => m.kind === "mock" && todayIst(Date.parse(m.at)) === today);
  const soon = targets.find((t) => t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 60);
  const tasks: PrepOverview["tasks"] = [
    { id: "daily", title: "Daily aptitude test", detail: "10 questions, 10 minutes. The same test for everyone in your college today.", done: todayRec?.daily !== null && todayRec?.daily !== undefined, tab: "daily", topicId: null },
    { id: "drill", title: `Topic drill: ${title(nextTopic)}`, detail: weak.some((w) => w.id === nextTopic) ? "Your weakest topic right now." : targets.length ? "A topic from your target exams you have not practised yet." : "A good starting topic. Add target exams to get a plan built around them.", done: practisedToday, tab: "practice", topicId: nextTopic },
    { id: "english", title: `Word of the day: ${wordOfDay(today).word}`, detail: "Learn it, then play one English round.", done: englishToday, tab: "english", topicId: null },
    { id: "current-affairs", title: "This week's current-affairs quiz", detail: "Read the week's items from your college, then take the quiz.", done: caDone, tab: "current-affairs", topicId: null },
  ];
  if (soon) tasks.push({ id: "mock", title: `Practice mock: ${soon.name}`, detail: `${soon.daysLeft} days to go. A timed mock in the real pattern.`, done: mockToday, tab: "mocks", topicId: null });

  const activeDays = Object.entries(st.days).filter(([, v]) => v.daily !== null || v.rounds > 0).map(([d]) => d);
  const streak = computeStreak(activeDays, today);
  const all = [...stats];
  const answered = all.reduce((n, x) => n + x.answered, 0);
  const correct = all.reduce((n, x) => n + x.correct, 0);
  const rounds = Object.values(st.topics).reduce((n, x) => n + x.rounds, 0) + Object.values(st.english).reduce((n, x) => n + x.rounds, 0);

  const plan = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const day = addDays(today, i);
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    const topic = focus[i % focus.length]!;
    const text = dow === 0 ? (targets.length ? `Practice mock (${targets[0]!.name}) and the weekly current-affairs quiz` : "Weekly current-affairs quiz and a revision of weak topics") : `Daily test · ${title(topic)} drill · one English round`;
    return { day, label: i === 0 ? "Today" : dayLabel(day), focus: text };
  });

  const yr = profile.stream === "medical" ? `${STREAM_DEFS.medical.terms[Math.max(0, Math.min(profile.semester - 1, 4))] ?? `Term ${profile.semester}`}` : `Semester ${profile.semester} · year ${me.year}`;
  return {
    profile: { name: profile.name, degree: profile.degree, year: yr },
    targets,
    tasks,
    streak: { current: streak.current, longest: streak.longest },
    week: [6, 5, 4, 3, 2, 1, 0].map((n) => {
      const d = addDays(today, -n);
      const v = st.days[d];
      return { day: d, label: dayLabel(d), daily: v?.daily !== null && v?.daily !== undefined, rounds: v?.rounds ?? 0 };
    }),
    weakTopics: weak,
    totals: { dailyTests: mine.filter((m) => m.kind === "daily").length, mocks: mine.filter((m) => m.kind === "mock").length, rounds, answered, accuracy: answered ? Math.round((correct / answered) * 100) : null },
    plan,
  };
}

/* ───────────────────────────── rounds ───────────────────────────── */
interface Spec {
  kind: RoundKind;
  title: string;
  examId: string | null;
  ref: string | null;
  durationSec: number;
  questions: Array<Q & { topic: string | null }>;
  sections: Array<{ name: string; from: number; to: number; marks: number; negative: number }> | null;
  note: string;
}

async function begin(s: SessionPayload, spec: Spec): Promise<MockResult> {
  if (!spec.questions.length) return err(409, "no_questions", "There are no questions for this yet.");
  const st = await load(s);
  const id = `XP-${randomBytes(5).toString("hex").toUpperCase()}`;
  st.pending = {
    id,
    kind: spec.kind,
    title: spec.title,
    examId: spec.examId,
    ref: spec.ref,
    startedAt: Date.now(),
    durationSec: spec.durationSec,
    sections: spec.sections,
    questions: spec.questions.map((q) => ({ prompt: q.prompt, options: [...q.options], answer: q.answer, explanation: q.explanation, topic: q.topic })),
  };
  await save(s, st);
  const round: Round = {
    id,
    kind: spec.kind,
    title: spec.title,
    durationSec: spec.durationSec,
    questions: spec.questions.map((q, i) => ({ id: `q${i + 1}`, prompt: q.prompt, options: [...q.options] })),
    sections: spec.sections,
    note: spec.note,
  };
  return ok(round, 201);
}

const XP_FOR: Record<RoundKind, number> = { daily: 15, mock: 30, practice: 5, english: 5, "ca-quiz": 15 };
const GRACE_SEC = 60;
const round2 = (n: number) => Math.round(n * 100) / 100;

async function submit(s: SessionPayload, id: string, raw: unknown): Promise<MockResult> {
  const p = SubmitBody.safeParse(raw);
  if (!p.success) return invalid(p.error);
  const st = await load(s);
  const r = st.pending;
  if (!r || r.id !== id) return err(404, "round_expired", "That test has ended. Start a new one.");
  const elapsed = Math.max(0, Math.round((Date.now() - r.startedAt) / 1000));
  const timedOut = elapsed > r.durationSec + GRACE_SEC;
  const sectionOf = (i: number) => r.sections?.find((x) => i >= x.from && i <= x.to) ?? null;

  let score = 0;
  let max = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const secAgg = new Map<string, { score: number; max: number; correct: number; wrong: number; skipped: number }>();
  const today = todayIst();
  const review = r.questions.map((q, i) => {
    const sec = sectionOf(i);
    const marks = sec?.marks ?? 1;
    const negative = sec?.negative ?? 0;
    const given = p.data.answers[`q${i + 1}`] ?? null;
    const isRight = given === q.answer;
    const agg = sec ? (secAgg.get(sec.name) ?? { score: 0, max: 0, correct: 0, wrong: 0, skipped: 0 }) : null;
    max += marks;
    if (agg) agg.max += marks;
    if (given === null) {
      skipped++;
      if (agg) agg.skipped++;
    } else if (isRight) {
      correct++;
      score += marks;
      if (agg) {
        agg.correct++;
        agg.score += marks;
      }
    } else {
      wrong++;
      score -= negative;
      if (agg) {
        agg.wrong++;
        agg.score -= negative;
      }
    }
    if (agg && sec) secAgg.set(sec.name, agg);
    // Topic statistics: only answered questions count towards accuracy.
    if (q.topic && given !== null) {
      const book = q.topic.startsWith("e-") ? st.english : st.topics;
      const key = q.topic.startsWith("e-") ? q.topic.slice(2) : q.topic;
      const t = book[key] ?? { answered: 0, correct: 0, rounds: 0, last: today };
      book[key] = { answered: t.answered + 1, correct: t.correct + (isRight ? 1 : 0), rounds: t.rounds, last: today };
    }
    return { id: `q${i + 1}`, prompt: q.prompt, options: q.options, given, answer: q.answer, correct: isRight, explanation: q.explanation, section: sec?.name ?? null };
  });
  score = round2(score);
  const percentage = max ? Math.max(-100, Math.min(100, Math.round((score / max) * 100))) : 0;

  // Count the round once per topic it drew on (practice and English rounds are single-topic).
  if (r.kind === "practice" || r.kind === "english") {
    const t0 = r.questions[0]?.topic;
    if (t0) {
      const book = t0.startsWith("e-") ? st.english : st.topics;
      const key = t0.startsWith("e-") ? t0.slice(2) : t0;
      const t = book[key] ?? { answered: 0, correct: 0, rounds: 0, last: today };
      book[key] = { ...t, rounds: t.rounds + 1, last: today };
    }
  }

  let percentile: number | null = null;
  let peers = 0;
  if (r.kind === "daily" || r.kind === "mock" || r.kind === "ca-quiz") {
    const key = r.kind === "mock" ? (r.examId ?? "") : r.kind === "daily" ? today : isoWeek(today);
    const ref = r.ref ?? `${r.kind}:${r.id}`;
    const added = await prepAttemptStore().add(s, { kind: r.kind, key, ref, score, max, percent: percentage, seconds: Math.min(elapsed, 86_400) });
    if (!added) {
      st.pending = null;
      await save(s, st);
      return err(409, "already_done", r.kind === "daily" ? "You have already taken today's test. Come back tomorrow." : "You have already taken this quiz.");
    }
    const all = await prepAttemptStore().peers(s, r.kind, key);
    peers = all.length;
    percentile = percentileOf(percentage, all);
  }
  const rec = st.days[today] ?? { daily: null, rounds: 0 };
  st.days[today] = r.kind === "daily" ? { ...rec, daily: percentage } : { ...rec, rounds: rec.rounds + 1 };
  st.pending = null;
  await save(s, st);

  const result: RoundResult = {
    kind: r.kind,
    title: r.title,
    score,
    max,
    correct,
    wrong,
    skipped,
    percentage,
    seconds: elapsed,
    timedOut,
    sections: r.sections ? r.sections.map((x) => {
      const a = secAgg.get(x.name) ?? { score: 0, max: 0, correct: 0, wrong: 0, skipped: 0 };
      return { name: x.name, score: round2(a.score), max: a.max, correct: a.correct, wrong: a.wrong, skipped: a.skipped, accuracy: a.correct + a.wrong ? Math.round((a.correct / (a.correct + a.wrong)) * 100) : null };
    }) : null,
    percentile,
    peers,
    review,
    xp: XP_FOR[r.kind],
  };
  return ok(RoundResult.parse(result));
}

/* ───────────────────────────── daily aptitude test ───────────────────────────── */
export const DAILY_QUESTIONS = 10;
export const DAILY_MINUTES = 10;
const DAILY_QUANT = Object.keys(QUANT);
const DAILY_REASONING = Object.keys(REASONING);

/** Today's test for a college: 4 quant, 4 reasoning and 2 English questions, the same for every student. */
export function dailyQuestions(college: string, day: string): Array<Q & { topic: string }> {
  const rng = seeded(`daily:${college}:${day}`);
  const topicOfQuant = (kind: string) => Object.entries(TOPICS_BY_KIND.quant).find(([, ks]) => ks.includes(kind))?.[0] ?? "q-percentage";
  const topicOfReasoning = (kind: string) => Object.entries(TOPICS_BY_KIND.reasoning).find(([, ks]) => ks.includes(kind))?.[0] ?? "r-series";
  const out: Array<Q & { topic: string }> = [];
  const seen = new Set<string>();
  const add = (q: Q, topic: string) => {
    if (seen.has(q.prompt)) return false;
    seen.add(q.prompt);
    out.push({ ...q, topic });
    return true;
  };
  const quantKinds = shuffled(rng, DAILY_QUANT);
  for (let i = 0, n = 0; n < 4 && i < 40; i++) if (add(QUANT[quantKinds[i % quantKinds.length]!]!(rng), topicOfQuant(quantKinds[i % quantKinds.length]!))) n++;
  const reasonKinds = shuffled(rng, DAILY_REASONING);
  for (let i = 0, n = 0; n < 4 && i < 40; i++) if (add(REASONING[reasonKinds[i % reasonKinds.length]!]!(rng), topicOfReasoning(reasonKinds[i % reasonKinds.length]!))) n++;
  const kinds: EnglishKind[] = shuffled(rng, ["synonyms", "antonyms", "fill-blanks", "one-word", "idioms"] as EnglishKind[]).slice(0, 2);
  for (const k of kinds) for (const q of englishRound(k, 1, rng)) add(q, `e-${k}`);
  return out;
}
const TOPICS_BY_KIND = {
  quant: Object.fromEntries(Object.entries(QUANT_TOPICS).map(([id, t]) => [id, t.kinds])),
  reasoning: Object.fromEntries(Object.entries(REASONING_TOPICS).map(([id, t]) => [id, t.kinds])),
};

async function dailyStatus(s: SessionPayload): Promise<DailyStatus> {
  const [st, mine] = await Promise.all([load(s), prepAttemptStore().mine(s)]);
  const today = todayIst();
  const todays = mine.find((m) => m.ref === `daily:${today}`);
  let last: DailyStatus["last"] = null;
  if (todays) last = { score: todays.score, max: todays.max, percentage: todays.percent, percentile: percentileOf(todays.percent, await prepAttemptStore().peers(s, "daily", today)) };
  const activeDays = Object.entries(st.days).filter(([, v]) => v.daily !== null).map(([d]) => d);
  const streak = computeStreak(activeDays, today);
  return {
    date: today,
    done: !!todays || (st.days[today]?.daily ?? null) !== null,
    questions: DAILY_QUESTIONS,
    minutes: DAILY_MINUTES,
    last,
    streak: { current: streak.current, longest: streak.longest },
    history: [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((n) => {
      const d = addDays(today, -n);
      return { day: d, label: dayLabel(d), percentage: st.days[d]?.daily ?? null };
    }),
  };
}

/* ───────────────────────────── catalogue, topics, English, mocks ───────────────────────────── */
async function catalogue(s: SessionPayload): Promise<Catalogue> {
  const [st, { st: me }] = await Promise.all([load(s), standing(s)]);
  return { groups: EXAM_GROUPS.map((id) => ({ id, label: GROUP_LABEL[id] })), exams: EXAMS.map((e) => card(e, me, st.targets)), disclaimer: DISCLAIMER };
}

async function examDetail(s: SessionPayload, id: string): Promise<MockResult> {
  const e = examById(id);
  if (!e) return err(404, "not_found", "Exam not found.");
  const [st, { st: me }, pool] = await Promise.all([load(s), standing(s), collegePool(s)]);
  const plan = mockPlan(e);
  const full = mockPlan(e, "full");
  const body: ExamDetail = {
    ...card(e, me, st.targets),
    sections: sectionsFor(pool, e).map((x) => ({ name: x.name, questions: x.questions, marks: x.marks, negative: x.negative, topics: x.topics.map((t) => ({ id: t, title: titleOf(pool, t) })) })),
    ageNote: e.ageNote,
    patternNote: e.patternNote ?? "",
    mock: plan && full ? { questions: plan.questions, minutes: plan.minutes, scaled: plan.scaled, full: { questions: full.questions, minutes: full.minutes } } : null,
  };
  return ok(ExamDetail.parse(body));
}

async function setTargets(s: SessionPayload, raw: unknown): Promise<MockResult> {
  const p = TargetBody.safeParse(raw);
  if (!p.success) return invalid(p.error);
  const today = todayIst();
  const limit = addDays(today, 3 * 366);
  const ids = new Set<string>();
  for (const t of p.data.targets) {
    if (!examById(t.examId)) return err(422, "validation", "Pick exams from the catalogue.");
    if (ids.has(t.examId)) return err(422, "validation", "Each exam can be a target only once.");
    ids.add(t.examId);
    if (t.date && (t.date < today || t.date > limit)) return err(422, "validation", "Pick an exam date between today and three years from now.");
  }
  if (ids.size > MAX_TARGETS) return err(422, "validation", `Pick up to ${MAX_TARGETS} exams.`);
  const st = await load(s);
  st.targets = p.data.targets;
  await save(s, st);
  return ok(await overview(s));
}

async function topicList(s: SessionPayload): Promise<TopicList> {
  const [st, pool] = await Promise.all([load(s), collegePool(s)]);
  const topics = allTopics(pool);
  return {
    families: TOPIC_FAMILIES.map((family) => ({
      family,
      topics: topics
        .filter((t) => t.family === family)
        .map((t) => {
          const stat = statOf(st, t.id);
          return { id: t.id, title: t.title, items: t.items, answered: stat?.answered ?? 0, accuracy: acc(stat) };
        }),
    })).filter((f) => f.topics.length),
  };
}

async function englishHome(s: SessionPayload): Promise<EnglishHome> {
  const st = await load(s);
  return {
    word: wordOfDay(todayIst()),
    kinds: ENGLISH_KINDS.map((k) => ({ id: k, title: ENGLISH_INFO[k].title, description: `${ENGLISH_INFO[k].description} (${ENGLISH_ITEMS[k]})`, answered: st.english[k]?.answered ?? 0, accuracy: acc(st.english[k]) })),
  };
}

async function mockList(s: SessionPayload): Promise<MockList> {
  const [st, mine] = await Promise.all([load(s), prepAttemptStore().mine(s)]);
  const mocks = mine.filter((m) => m.kind === "mock");
  return {
    mocks: EXAMS.flatMap((e) => {
      const plan = mockPlan(e);
      const full = mockPlan(e, "full");
      if (!plan || !full) return [];
      const mineFor = mocks.filter((m) => m.key === e.id);
      return [{ examId: e.id, name: e.name, group: e.group, questions: plan.questions, minutes: plan.minutes, negative: e.sections.some((x) => x.negative > 0), scaled: plan.scaled, full: { questions: full.questions, minutes: full.minutes }, isTarget: st.targets.some((t) => t.examId === e.id), attempts: mineFor.length, best: mineFor.length ? Math.max(...mineFor.map((m) => m.percent)) : null }];
    }),
    history: mocks.slice(0, 20).map((m) => ({ at: m.at, examId: m.key, name: examById(m.key)?.name ?? m.key, score: m.score, max: m.max, percentage: m.percent })),
  };
}

async function startMock(s: SessionPayload, examId: string, raw: unknown): Promise<MockResult> {
  const p = MockStartBody.safeParse(raw ?? {});
  if (!p.success) return invalid(p.error);
  const length = p.data.length;
  const e = examById(examId);
  const plan = e ? mockPlan(e, length) : null;
  if (!e || !plan) return err(404, "not_found", "There is no practice mock for this exam.");
  const pool = await collegePool(s);
  const withCollege = sectionsFor(pool, e);
  const rng: Rng = Math.random;
  const questions: Array<Q & { topic: string | null }> = [];
  const sections: NonNullable<Spec["sections"]> = [];
  for (const [i, sec] of plan.sections.entries()) {
    const qs = sectionQuestionsFrom(pool, withCollege.at(i)?.topics ?? sec.topics, sec.count, rng);
    if (!qs.length) continue;
    sections.push({ name: sec.name, from: questions.length, to: questions.length + qs.length - 1, marks: sec.marks, negative: sec.negative });
    questions.push(...qs);
  }
  const minutes = Math.max(5, Math.round((plan.minutes * questions.length) / plan.questions));
  const neg = e.sections.some((x) => x.negative > 0) ? "Wrong answers lose marks as in the real exam; leave a question blank if you are unsure." : "There is no negative marking.";
  const short = questions.length < plan.questions ? ` The question bank had ${questions.length} of the ${plan.questions} questions this paper needs; faculty question sets add more.` : "";
  const size = length === "full" ? `Full-length mock: ${questions.length} questions in ${minutes} minutes${plan.scaled ? ` (the real paper has ${sumQuestions(e)}; scaled to fit)` : ", as in the real paper"}.` : plan.scaled ? `A shorter practice mock: ${questions.length} of ${sumQuestions(e)} questions, with the time scaled to ${minutes} minutes.` : `${questions.length} questions in ${minutes} minutes.`;
  const note = `${size}${short} ${neg}`;
  return begin(s, { kind: "mock", title: `${e.name} ${length === "full" ? "full-length" : "practice"} mock`, examId: e.id, ref: `mock:${randomBytes(6).toString("hex")}`, durationSec: minutes * 60, questions, sections, note });
}

async function startCaQuiz(s: SessionPayload): Promise<MockResult> {
  const today = todayIst();
  const week = isoWeek(today);
  const from = addDays(today, -6);
  const items = (await currentAffairsStore().list(s)).filter((x) => x.status === "Published" && x.mcq && x.date >= from && x.date <= today);
  if (items.length < 3) return err(409, "not_enough", "Your college has not published enough current-affairs questions this week yet (at least 3 are needed).");
  const mine = await prepAttemptStore().mine(s);
  if (mine.some((m) => m.ref === `ca:${week}`)) return err(409, "already_done", "You have already taken this week's quiz.");
  const questions = shuffled(Math.random, items).slice(0, 15).map((x) => {
    const m = x.mcq!;
    const order = shuffled(Math.random, [0, 1, 2, 3]);
    return { prompt: m.question, options: order.map((k) => m.options[k]!) as Q["options"], answer: order.indexOf(m.answer), explanation: m.explanation || x.headline, topic: null };
  });
  return begin(s, { kind: "ca-quiz", title: `Current-affairs quiz, week ${week.slice(-2)}`, examId: null, ref: `ca:${week}`, durationSec: questions.length * 45, questions, sections: null, note: `${questions.length} questions from items your college published in the last 7 days.` });
}

/* ───────────────────────────── for the AI Mentor ───────────────────────────── */
/** One line for the mentor's student record: target exams, days left and weakest prep topics (catalogue names only). */
export async function prepSummaryFor(s: SessionPayload): Promise<string | null> {
  const st = await load(s);
  const today = todayIst();
  const targets = st.targets.map((t) => ({ e: examById(t.examId), date: t.date })).filter((x) => x.e);
  const weak = allTopicStats(st)
    .filter((x) => x.answered >= 5)
    .map((x) => ({ title: x.title, pct: Math.round((x.correct / x.answered) * 100), n: x.answered }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);
  if (!targets.length && !weak.length) return null;
  const t = targets.map((x) => `${x.e!.name}${x.date ? ` (in ${daysBetween(today, x.date)} days)` : " (no date set)"}`).join(", ");
  const w = weak.map((x) => `${x.title} ${x.pct}% of ${x.n}`).join("; ");
  return `Competitive exam prep: targets ${t || "none chosen"}. Weakest practice topics: ${w || "not enough practice yet"}.`;
}

/* ───────────────────────────── study notes & syllabus ───────────────────────────── */
async function notesFor(s: SessionPayload, pool: CollegePool, topicId: string): Promise<{ content: NoteContent; source: "faculty" | "ai" | "built-in"; author: string; updatedAt: string | null }> {
  const row = pool.notes.get(topicId);
  if (row) {
    const p = NoteContent.safeParse(row.body);
    if (p.success) return { content: p.data, source: row.source === "faculty" ? "faculty" : "ai", author: row.source === "faculty" ? row.author : "", updatedAt: row.updatedAt };
  }
  const ai = takeParkedNotes(s, topicId);
  if (ai) {
    // Cache the AI notes for the whole college, unless someone saved notes for this topic meanwhile.
    const store = prepContentStore();
    const again = (await store.list(s, "note")).find((r) => r.topicId === topicId);
    if (!again) {
      const saved = await store.create(s, { kind: "note", topicId, topicTitle: titleOf(pool, topicId), examIds: [], section: "", title: `Notes: ${titleOf(pool, topicId)}`, body: ai, source: "ai", status: "Published" }, "AI (not yet reviewed)");
      return { content: ai, source: "ai", author: "", updatedAt: saved.updatedAt };
    }
  }
  return { content: builtInNotes(pool, topicId), source: "built-in", author: "", updatedAt: null };
}

async function topicNotes(s: SessionPayload, topicId: string): Promise<MockResult> {
  const [pool, st] = await Promise.all([collegePool(s), load(s)]);
  if (!topicExists(pool, topicId)) return err(404, "not_found", "Topic not found.");
  const n = await notesFor(s, pool, topicId);
  const stat = statOf(st, topicId);
  const body: TopicNotes = { ...n.content, topicId, title: titleOf(pool, topicId), family: familyOf(pool, topicId), source: n.source, author: n.author, updatedAt: n.updatedAt, studied: !!st.studied[topicId], answered: stat?.answered ?? 0, accuracy: acc(stat) };
  return ok(TopicNotes.parse(body));
}

const StudiedBody = z.object({ studied: z.boolean() }).strict();
async function markStudied(s: SessionPayload, topicId: string, raw: unknown): Promise<MockResult> {
  const p = StudiedBody.safeParse(raw);
  if (!p.success) return invalid(p.error);
  const [pool, st] = await Promise.all([collegePool(s), load(s)]);
  if (!topicExists(pool, topicId)) return err(404, "not_found", "Topic not found.");
  if (p.data.studied) st.studied[topicId] = todayIst();
  else delete st.studied[topicId];
  await save(s, st);
  return ok({ studied: p.data.studied });
}

export function topicStatus(answered: number, accuracy: number | null, studied: boolean): TopicStatus {
  if (answered >= 10 && accuracy !== null && accuracy >= 75) return "strong";
  if (answered > 0) return "practised";
  return studied ? "studied" : "not-started";
}

async function syllabus(s: SessionPayload, examId: string): Promise<MockResult> {
  const e = examById(examId);
  if (!e || !e.sections.length) return err(404, "not_found", "There is no syllabus for this exam.");
  const [pool, st] = await Promise.all([collegePool(s), load(s)]);
  const sections = sectionsFor(pool, e).map((sec) => ({
    name: sec.name,
    questions: sec.questions,
    topics: sec.topics.map((t) => {
      const stat = statOf(st, t);
      const answered = stat?.answered ?? 0;
      const accuracy = acc(stat);
      return { id: t, title: titleOf(pool, t), status: topicStatus(answered, accuracy, !!st.studied[t]), answered, accuracy, notes: notesSource(pool, t), custom: !TOPICS.has(t) };
    }),
  }));
  const unique = new Map(sections.flatMap((x) => x.topics).map((t) => [t.id, t.status]));
  const counts = { "not-started": 0, studied: 0, practised: 0, strong: 0 };
  for (const v of unique.values()) counts[v]++;
  const total = Math.max(1, unique.size);
  const body: Syllabus = {
    examId: e.id,
    name: e.name,
    coverage: Math.round((100 * (total - counts["not-started"])) / total),
    mastery: Math.round((100 * counts.strong) / total),
    counts,
    sections,
    exams: EXAMS.filter((x) => x.sections.length).map((x) => ({ id: x.id, name: x.name, isTarget: st.targets.some((t) => t.examId === x.id) })),
  };
  return ok(Syllabus.parse(body));
}

/* ───────────────────────────── dispatcher ───────────────────────────── */
export async function dispatchExamPrep(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (s.role !== "student") return err(403, "forbidden", "The Competitive Exam Prep Hub is for students.");
  const [, a1, a2, a3] = segs;
  const n = segs.length;
  if (n === 1 && method === "GET") return ok(PrepOverview.parse(await overview(s)));
  if (a1 === "catalogue" && n === 2 && method === "GET") return ok(Catalogue.parse(await catalogue(s)));
  if (a1 === "exams" && a2 && n === 3 && method === "GET") return examDetail(s, a2);
  if (a1 === "targets" && n === 2 && method === "PUT") return setTargets(s, rawBody);
  if (a1 === "topics" && n === 2 && method === "GET") return ok(TopicList.parse(await topicList(s)));

  if (a1 === "daily" && n === 2 && method === "GET") return ok(DailyStatus.parse(await dailyStatus(s)));
  if (a1 === "daily" && a2 === "start" && n === 3 && method === "POST") {
    const today = todayIst();
    const status = await dailyStatus(s);
    if (status.done) return err(409, "already_done", "You have already taken today's test. Come back tomorrow.");
    return begin(s, { kind: "daily", title: `Daily aptitude test · ${today}`, examId: null, ref: `daily:${today}`, durationSec: DAILY_MINUTES * 60, questions: dailyQuestions(s.college, today), sections: null, note: "Everyone in your college gets the same 10 questions today. One attempt a day; there is no negative marking." });
  }

  if (a1 === "practice" && n === 2 && method === "POST") {
    const p = PracticeBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const pool = await collegePool(s);
    const id = p.data.topicId;
    if (!topicExists(pool, id)) return err(404, "not_found", "Topic not found.");
    const qs = topicQuestions(pool, id, 10, Math.random);
    return begin(s, { kind: familyOf(pool, id) === "English" ? "english" : "practice", title: titleOf(pool, id), examId: null, ref: null, durationSec: qs.length * 60, questions: qs, sections: null, note: "10 questions with explanations at the end. No negative marking in practice." });
  }

  if (a1 === "english" && n === 2 && method === "GET") return ok(EnglishHome.parse(await englishHome(s)));
  if (a1 === "english" && a2 === "rounds" && n === 3 && method === "POST") {
    const p = EnglishBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const qs = englishRound(p.data.kind, 10, Math.random).map((q) => ({ ...q, topic: `e-${p.data.kind}` }));
    return begin(s, { kind: "english", title: ENGLISH_INFO[p.data.kind].title, examId: null, ref: null, durationSec: qs.length * 45, questions: qs, sections: null, note: ENGLISH_INFO[p.data.kind].description });
  }

  if (a1 === "mocks" && n === 2 && method === "GET") return ok(MockList.parse(await mockList(s)));
  if (a1 === "mocks" && a2 && a3 === "start" && n === 4 && method === "POST") return startMock(s, a2, rawBody);
  if (a1 === "topics" && a2 && a3 === "notes" && n === 4 && method === "GET") return topicNotes(s, a2);
  if (a1 === "topics" && a2 && a3 === "studied" && n === 4 && method === "POST") return markStudied(s, a2, rawBody);
  if (a1 === "syllabus" && a2 && n === 3 && method === "GET") return syllabus(s, a2);

  if (a1 === "ca-quiz" && a2 === "start" && n === 3 && method === "POST") return startCaQuiz(s);

  if (a1 === "rounds" && a2 && a3 === "submit" && n === 4 && method === "POST") return submit(s, a2, rawBody);
  return err(404, "not_found", "Not found.");
}
