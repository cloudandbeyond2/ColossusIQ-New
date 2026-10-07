import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import type { Attempt } from "@/lib/data/store";
import { AchievementsOverview, type Badge } from "@/lib/api/achievements-schemas";
import { StoredPrep } from "@/lib/api/exam-prep-schemas";
import { assignmentStore } from "./assignment-store";
import { allLessons } from "./course-state";
import { prepAttemptStore } from "./prep-attempt-store";
import { studentStateStore } from "./student-state-store";
import type { Certificate } from "./learning";
import type { MockResult } from "./router";

/*
 * XP & Badges. Nothing is stored: every figure is worked out from what the student has really done (quiz attempts,
 * certificates, lessons read, assignments handed in), so it can never drift from the other pages. The class
 * leaderboard ranks learning XP only (quizzes, certificates, lessons), because those are the records that name the
 * student; it shows ranks and scores, never other students' names.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string): MockResult => ({ status, body: { error: { code, message } } });

export const XP = {
  attempt: 10,
  firstPass: 40,
  excellence: 20,
  certificate: 100,
  lesson: 5,
  course: 60,
  onTime: 20,
  late: 10,
  strong: 20,
  dailyTest: 15,
  mock: 30,
  caQuiz: 15,
  drill: 5,
} as const;

export const RULES = [
  { label: "Each quiz attempt", xp: XP.attempt },
  { label: "Passing a quiz for the first time", xp: XP.firstPass },
  { label: "Scoring 90% or more on a quiz", xp: XP.excellence },
  { label: "Each certificate earned", xp: XP.certificate },
  { label: "Each lesson you finish reading", xp: XP.lesson },
  { label: "Finishing every lesson of a course", xp: XP.course },
  { label: "Handing in an assignment on time", xp: XP.onTime },
  { label: "Handing in an assignment late", xp: XP.late },
  { label: "Scoring 80% or more on an assignment", xp: XP.strong },
  { label: "Each daily aptitude test (Exam Prep Hub)", xp: XP.dailyTest },
  { label: "Each practice mock", xp: XP.mock },
  { label: "Each weekly current-affairs quiz", xp: XP.caQuiz },
  { label: "Each topic drill or English round", xp: XP.drill },
];

const TITLES = ["Newcomer", "Explorer", "Learner", "Achiever", "Scholar", "Expert", "Master", "Legend"];
/** Level n starts at 50·(n−1)² XP: 50, 200, 450, 800, … */
export function levelOf(xp: number): { level: number; title: string; from: number; next: number } {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
  return { level, title: TITLES[Math.min(level, TITLES.length) - 1]!, from: 50 * (level - 1) ** 2, next: 50 * level ** 2 };
}

/* ───────────────────────────── streak ───────────────────────────── */
const IST_MS = 5.5 * 3_600_000;
export const istDay = (iso: string | number): string => new Date((typeof iso === "number" ? iso : Date.parse(iso)) + IST_MS).toISOString().slice(0, 10);
const prevDay = (d: string): string => new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Consecutive days with activity. The current streak is still alive if the last active day was yesterday. */
export function computeStreak(days: Iterable<string>, today: string): { current: number; longest: number; activeToday: boolean } {
  const set = new Set(days);
  let longest = 0;
  for (const d of set) {
    if (set.has(prevDay(d))) continue; // not the start of a run
    let n = 0;
    for (let c = d; set.has(c); c = new Date(Date.parse(`${c}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) n++;
    longest = Math.max(longest, n);
  }
  const activeToday = set.has(today);
  let current = 0;
  for (let c = activeToday ? today : prevDay(today); set.has(c); c = prevDay(c)) current++;
  return { current, longest, activeToday };
}

/* ───────────────────────────── learning XP ───────────────────────── */
interface Event {
  at: string;
  label: string;
  xp: number;
}
interface Learning {
  xp: number;
  quiz: { count: number; xp: number };
  cert: { count: number; xp: number };
  lesson: { count: number; xp: number };
  course: { count: number; xp: number };
  passed: number;
  perfect: boolean;
  events: Event[];
  days: string[];
}

export function learningFor(attempts: Attempt[], certs: Certificate[], lessons: number, coursesDone: number, quizOf: (id: string) => { title: string; passMark: number }): Learning {
  const events: Event[] = [];
  const days: string[] = [];
  const byQuiz = new Map<string, Attempt[]>();
  for (const a of attempts) byQuiz.set(a.quizId, [...(byQuiz.get(a.quizId) ?? []), a]);
  let quizXp = 0;
  let passed = 0;
  let perfect = false;
  for (const [id, list] of byQuiz) {
    const q = quizOf(id);
    list.sort((x, y) => x.at.localeCompare(y.at));
    for (const a of list) {
      quizXp += XP.attempt;
      days.push(istDay(a.at));
      events.push({ at: a.at, label: `Attempted ${q.title} (${a.percentage}%)`, xp: XP.attempt });
      if (a.percentage === 100) perfect = true;
    }
    const pass = list.find((a) => a.percentage >= q.passMark);
    if (pass) {
      passed++;
      quizXp += XP.firstPass;
      events.push({ at: pass.at, label: `Passed ${q.title}`, xp: XP.firstPass });
    }
    const top = list.find((a) => a.percentage >= 90);
    if (top) {
      quizXp += XP.excellence;
      events.push({ at: top.at, label: `Scored ${top.percentage}% on ${q.title}`, xp: XP.excellence });
    }
  }
  for (const c of certs) events.push({ at: c.issuedAt, label: `Certificate: ${c.title}`, xp: XP.certificate });
  const lessonXp = lessons * XP.lesson;
  const courseXp = coursesDone * XP.course;
  const certXp = certs.length * XP.certificate;
  return {
    xp: quizXp + certXp + lessonXp + courseXp,
    quiz: { count: attempts.length, xp: quizXp },
    cert: { count: certs.length, xp: certXp },
    lesson: { count: lessons, xp: lessonXp },
    course: { count: coursesDone, xp: courseXp },
    passed,
    perfect,
    events,
    days,
  };
}

/* ───────────────────────────── badges ───────────────────────────── */
export interface BadgeFacts {
  attempts: number;
  perfect: boolean;
  passed: number;
  certs: number;
  lessons: number;
  coursesDone: number;
  onTime: number;
  strong: number;
  longestStreak: number;
  level: number;
  /** Exam Prep Hub (optional so older callers keep working). */
  dailyStreak?: number;
  mocks?: number;
  caQuizzes?: number;
}
export function badgesFor(f: BadgeFacts): Badge[] {
  const b = (id: string, title: string, description: string, group: Badge["group"], tone: Badge["tone"], value: number, target: number): Badge => ({ id, title, description, group, tone, value: Math.min(value, target), target, earned: value >= target });
  return [
    b("first-attempt", "First steps", "Attempt your first quiz", "Quizzes", "sky", f.attempts, 1),
    b("quiz-regular", "Quiz regular", "Attempt 10 quizzes", "Quizzes", "sky", f.attempts, 10),
    b("quiz-marathon", "Quiz marathon", "Attempt 25 quizzes", "Quizzes", "brand", f.attempts, 25),
    b("first-pass", "Passed it", "Pass a quiz", "Quizzes", "teal", f.passed, 1),
    b("three-passes", "Hat-trick", "Pass 3 different quizzes", "Quizzes", "teal", f.passed, 3),
    b("perfect-score", "Perfect score", "Score 100% on a quiz", "Quizzes", "gold", f.perfect ? 1 : 0, 1),
    b("first-certificate", "Certified", "Earn your first certificate", "Courses", "gold", f.certs, 1),
    b("certificate-collector", "Certificate collector", "Earn 3 certificates", "Courses", "gold", f.certs, 3),
    b("lesson-reader", "Lesson reader", "Finish 20 lessons", "Courses", "teal", f.lessons, 20),
    b("course-finisher", "Course finisher", "Finish every lesson of a course", "Courses", "brand", f.coursesDone, 1),
    b("on-time", "Always on time", "Hand in 3 assignments before the deadline", "Assignments", "amber", f.onTime, 3),
    b("assignment-ace", "Assignment ace", "Score 80% or more on an assignment", "Assignments", "rose", f.strong, 1),
    b("daily-7", "Aptitude habit", "Take the daily aptitude test 7 days in a row", "Exam prep", "brand", f.dailyStreak ?? 0, 7),
    b("mock-5", "Mock marathon", "Finish 5 practice mocks", "Exam prep", "rose", f.mocks ?? 0, 5),
    b("ca-quiz", "News reader", "Take a weekly current-affairs quiz", "Exam prep", "teal", f.caQuizzes ?? 0, 1),
    b("streak-3", "3-day streak", "Be active 3 days in a row", "Consistency", "amber", f.longestStreak, 3),
    b("streak-7", "Week warrior", "Be active 7 days in a row", "Consistency", "amber", f.longestStreak, 7),
    b("streak-30", "Unstoppable", "Be active 30 days in a row", "Consistency", "rose", f.longestStreak, 30),
    b("level-3", "Rising star", "Reach level 3", "Progress", "brand", f.level, 3),
    b("level-5", "Scholar", "Reach level 5", "Progress", "brand", f.level, 5),
  ];
}

/* ───────────────────────────── exam prep XP ───────────────────────── */
/** XP from the Competitive Exam Prep Hub: finished tests from prep_attempts, drills from the student's saved prep state. */
async function prepFor(session: SessionPayload): Promise<{ xp: number; count: number; events: Event[]; days: string[]; dailyStreak: number; mocks: number; caQuizzes: number }> {
  try {
    const rows = await prepAttemptStore().mine(session);
    const st = StoredPrep.safeParse(await studentStateStore().get(session.sub, "exam-prep-hub"));
    const drills = st.success ? [...Object.values(st.data.topics), ...Object.values(st.data.english)].reduce((n, t) => n + t.rounds, 0) : 0;
    const events: Event[] = [];
    const days: string[] = [];
    let xp = drills * XP.drill;
    for (const r of rows) {
      const gain = r.kind === "daily" ? XP.dailyTest : r.kind === "mock" ? XP.mock : XP.caQuiz;
      xp += gain;
      days.push(istDay(r.at));
      events.push({ at: r.at, label: r.kind === "daily" ? `Daily aptitude test (${r.percent}%)` : r.kind === "mock" ? `Practice mock (${r.percent}%)` : `Weekly current-affairs quiz (${r.percent}%)`, xp: gain });
    }
    if (st.success) for (const [d, v] of Object.entries(st.data.days)) if (v.rounds > 0) days.push(d);
    const dailyDays = rows.filter((r) => r.kind === "daily").map((r) => r.key);
    return { xp, count: rows.length + drills, events, days, dailyStreak: computeStreak(dailyDays, istDay(Date.now())).longest, mocks: rows.filter((r) => r.kind === "mock").length, caQuizzes: rows.filter((r) => r.kind === "ca-quiz").length };
  } catch {
    // Exam prep never breaks the XP page.
    return { xp: 0, count: 0, events: [], days: [], dailyStreak: 0, mocks: 0, caQuizzes: 0 };
  }
}

/* ───────────────────────────── the page ───────────────────────────── */

async function lessonsOf(sub: string, courses: Array<{ id: string; lessonIds: string[] }>): Promise<{ lessons: number; coursesDone: number }> {
  let lessons = 0;
  let coursesDone = 0;
  for (const c of courses) {
    const done = new Set(await getStore().progress.get(sub, c.id));
    const n = c.lessonIds.filter((id) => done.has(id)).length;
    lessons += n;
    if (c.lessonIds.length > 0 && n === c.lessonIds.length) coursesDone++;
  }
  return { lessons, coursesDone };
}

export async function overview(session: SessionPayload): Promise<AchievementsOverview> {
  const store = getStore();
  const [quizzes, allAttempts, allCerts, courseList] = await Promise.all([
    store.quizzes.list(session.college, { includeCourseFinals: true }),
    store.attempts.list({ collegeId: session.college }),
    store.certificates.list({ scope: session.college }),
    store.courses.list(session.college),
  ]);
  const quizMap = new Map(quizzes.map((q) => [q.id, q]));
  const quizOf = (id: string) => ({ title: quizMap.get(id)?.title ?? "a quiz", passMark: quizMap.get(id)?.passMark ?? 50 });
  const courses = courseList.filter((c) => c.status === "Published").slice(0, 30).map((c) => ({ id: c.id, lessonIds: allLessons(c).map((l) => l.id) }));

  const attemptsBy = new Map<string, Attempt[]>();
  for (const a of allAttempts) attemptsBy.set(a.studentSub, [...(attemptsBy.get(a.studentSub) ?? []), a]);
  const certsBy = new Map<string, Certificate[]>();
  for (const c of allCerts) certsBy.set(c.studentSub, [...(certsBy.get(c.studentSub) ?? []), c]);
  const learners = new Set<string>([...attemptsBy.keys(), ...certsBy.keys(), session.sub]);
  for (const c of courses) for (const sub of (await store.progress.learners(c.id)).slice(0, 300)) learners.add(sub);

  const xpOf = new Map<string, number>();
  let mine!: Learning;
  for (const sub of learners) {
    const { lessons, coursesDone } = await lessonsOf(sub, courses);
    const l = learningFor(attemptsBy.get(sub) ?? [], certsBy.get(sub) ?? [], lessons, coursesDone, quizOf);
    xpOf.set(sub, l.xp);
    if (sub === session.sub) mine = l;
  }

  // Assignments the student handed in.
  const asg = assignmentStore();
  const rows = await asg.list(session, true);
  const subs = await asg.mine(session, rows.map((r) => r.id));
  const events: Event[] = [...mine.events];
  const days = [...mine.days];
  let onTime = 0;
  let late = 0;
  let strong = 0;
  let asgXp = 0;
  for (const r of rows) {
    const s = subs.get(r.id);
    if (!s) continue;
    days.push(istDay(s.submittedAt));
    if (s.late) {
      late++;
      asgXp += XP.late;
      events.push({ at: s.submittedAt, label: `Handed in ${r.title} (late)`, xp: XP.late });
    } else {
      onTime++;
      asgXp += XP.onTime;
      events.push({ at: s.submittedAt, label: `Handed in ${r.title}`, xp: XP.onTime });
    }
    if (s.marks !== null && r.maxMarks > 0 && s.marks / r.maxMarks >= 0.8) {
      strong++;
      asgXp += XP.strong;
      events.push({ at: s.gradedAt ?? s.submittedAt, label: `Scored ${s.marks}/${r.maxMarks} on ${r.title}`, xp: XP.strong });
    }
  }

  const prep = await prepFor(session);
  events.push(...prep.events);
  days.push(...prep.days);

  const xp = mine.xp + asgXp + prep.xp;
  const lv = levelOf(xp);
  const streak = computeStreak(days, istDay(Date.now()));
  const badges = badgesFor({ attempts: mine.quiz.count, perfect: mine.perfect, passed: mine.passed, certs: mine.cert.count, lessons: mine.lesson.count, coursesDone: mine.course.count, onTime, strong, longestStreak: streak.longest, level: lv.level, dailyStreak: prep.dailyStreak, mocks: prep.mocks, caQuizzes: prep.caQuizzes });

  const ranked = [...xpOf.entries()].filter(([sub, v]) => v > 0 || sub === session.sub).sort((a, b) => b[1] - a[1]);
  const rankOf = (v: number) => 1 + ranked.filter(([, x]) => x > v).length;
  const myLearning = xpOf.get(session.sub) ?? 0;
  const rank = myLearning > 0 ? rankOf(myLearning) : null;
  const top = ranked.filter(([, v]) => v > 0).slice(0, 5).map(([sub, v]) => ({ rank: rankOf(v), xp: v, you: sub === session.sub }));
  if (!top.some((t) => t.you) && rank !== null) top.push({ rank, xp: myLearning, you: true });
  const ahead = ranked.map(([, v]) => v).filter((v) => v > myLearning);
  const toNext = rank !== null && ahead.length ? Math.min(...ahead) - myLearning : null;

  return {
    xp,
    level: lv.level,
    levelTitle: lv.title,
    levelFrom: lv.from,
    nextLevelAt: lv.next,
    streak,
    breakdown: [
      { key: "quizzes", label: "Quizzes", count: mine.quiz.count, xp: mine.quiz.xp },
      { key: "certificates", label: "Certificates", count: mine.cert.count, xp: mine.cert.xp },
      { key: "lessons", label: "Lessons read", count: mine.lesson.count, xp: mine.lesson.xp },
      { key: "courses", label: "Courses finished", count: mine.course.count, xp: mine.course.xp },
      { key: "assignments", label: "Assignments", count: onTime + late, xp: asgXp },
      { key: "exam-prep", label: "Exam prep", count: prep.count, xp: prep.xp },
    ],
    stats: { quizAttempts: mine.quiz.count, quizzesPassed: mine.passed, certificates: mine.cert.count, lessons: mine.lesson.count, coursesDone: mine.course.count, assignments: onTime + late },
    badges,
    recent: events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10),
    board: { rank, of: ranked.filter(([, v]) => v > 0).length, myXp: myLearning, toNext, top },
    rules: RULES,
  };
}

export async function dispatchAchievements(method: string, segs: string[], session: SessionPayload): Promise<MockResult> {
  if (method !== "GET" || segs.length !== 1) return err(404, "not_found", "Not found.");
  if (session.role !== "student") return err(403, "forbidden", "XP and badges are for students.");
  return ok(AchievementsOverview.parse(await overview(session)));
}
