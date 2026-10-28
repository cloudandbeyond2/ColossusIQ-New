import "server-only";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { RESOURCES } from "@/config/resources";
import { STREAM_DEFS, streamOptions, type Stream } from "@/config/streams";
import { ALL_COLLEGES } from "@/config/tenancy";
import type { SessionPayload } from "@/lib/auth/session";
import { resolveUserDepartment } from "@/lib/auth/department";
import { cleanText, mask } from "@/lib/security/sanitize";
import { signCertificateFields } from "@/lib/security/certificate-signature";
import { getStore } from "@/lib/data";
import { memoryState } from "@/lib/data/memory";
import type { Attempt } from "@/lib/data/store";
import { geminiEnabled } from "@/lib/ai/gemini";
import { audit } from "./audit";
import { courseCompleted } from "./course-state";
import { recordFacultyEvent } from "./faculty-activity";
import { GenerateQuizBody, type QuizResults } from "@/lib/api/learning-schemas";
import { aiQuizQuestions } from "./quiz-ai";
import { APTITUDE_BANK, bankFor, templateQuestions, topicsFor, type BankQuestion } from "./learning-content";
import { collegeIndex, collegeName, collegeStream, enabledGroups, listColleges } from "./records";
import type { MockResult } from "./router";

/* ───────────────────────────── helpers ───────────────────────────── */
const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({
  status,
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
});
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const STAFF_ROLES = new Set(["faculty", "hod", "institution", "admin"]);

async function sessionStream(session: SessionPayload): Promise<Stream | null> {
  return session.college === ALL_COLLEGES ? null : collegeStream(session.college);
}

/* ──────────────────────────── grading ────────────────────────────── */
export const GRADE_BANDS = [
  { min: 90, grade: "O", label: "Outstanding" },
  { min: 80, grade: "A+", label: "Distinction" },
  { min: 70, grade: "A", label: "First Class" },
  { min: 60, grade: "B", label: "Second Class" },
] as const;

export function gradeFor(percentage: number, passMark: number): { grade: string; label: string; passed: boolean } {
  if (percentage < passMark) return { grade: "RA", label: "Re-appear", passed: false };
  const band = GRADE_BANDS.find((b) => percentage >= b.min);
  return band ? { grade: band.grade, label: band.label, passed: true } : { grade: "C", label: "Pass", passed: true };
}

/* ───────────────────────── certificate signing ───────────────────── */

export interface Certificate {
  id: string;
  kind: "course" | "quiz";
  studentSub: string;
  studentName: string;
  collegeId: string;
  quizId: string;
  title: string;
  course: string;
  department: string;
  marks: number;
  total: number;
  percentage: number;
  grade: string;
  gradeLabel: string;
  issuedAt: string;
  signature: string;
}

/** HMAC-SHA256 over the printed fields (base64url, 43 characters). */
export function signCert(c: Omit<Certificate, "signature">): string {
  return signCertificateFields(c);
}
export async function verifyCertificate(id: string): Promise<{ valid: boolean; certificate?: Certificate; tampered?: boolean }> {
  if (!/^CIQ-\d{4}-[A-F0-9]{8}$/.test(id)) return { valid: false };
  const c = await getStore().certificates.get(id);
  if (!c) return { valid: false };
  const { signature, ...rest } = c;
  const expected = Buffer.from(signCert(rest));
  const actual = Buffer.from(signature);
  const good = expected.length === actual.length && timingSafeEqual(expected, actual);
  return good ? { valid: true, certificate: c } : { valid: false, tampered: true };
}

/* ───────────────────────────── types ─────────────────────────────── */
export interface Quiz {
  id: string;
  collegeId: string;
  title: string;
  department: string;
  course: string;
  passMark: number;
  durationMin: number;
  certificateEnabled: boolean;
  status: "Draft" | "Published" | "Closed";
  questions: Array<BankQuestion & { review?: boolean }>;
  /** Set when this is the final assessment of a department course (locked until every lesson is read). */
  courseId?: string;
  createdBy: string;
  createdAt: string;
}

/** Raw demo state (memory backend only) — tests inspect it directly. */
export const quizzes = memoryState.quizzes;
const seededFlag = { done: false };

/** Shuffle the options so the correct answer is not always in the same position. */
export function shuffleOptions(q: BankQuestion): BankQuestion {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return { ...q, options: order.map((k) => q.options[k]!) as BankQuestion["options"], answer: order.indexOf(q.answer) };
}

export function newId(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function issueCertificate(a: Attempt, quiz: Quiz, gradeInfo: { grade: string; label: string }, replaces?: string): Promise<Certificate> {
  const base = {
    id: `CIQ-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`,
    kind: quiz.courseId ? ("course" as const) : ("quiz" as const),
    studentSub: a.studentSub,
    studentName: a.studentName,
    collegeId: a.collegeId,
    quizId: quiz.id,
    title: quiz.title,
    course: quiz.course,
    department: quiz.department,
    marks: a.score,
    total: a.total,
    percentage: a.percentage,
    grade: gradeInfo.grade,
    gradeLabel: gradeInfo.label,
    issuedAt: a.at,
  };
  const cert: Certificate = { ...base, signature: signCert(base) };
  await getStore().certificates.issue(cert, replaces);
  return cert;
}

/** Demo data: one or two published quizzes per active college, matching its stream (memory backend only). */
async function ensureSeed() {
  if (seededFlag.done || getStore().kind !== "memory") return;
  seededFlag.done = true;
  for (const c of await listColleges()) {
    if (c.status !== "Active") continue;
    const stream = (await collegeStream(c.id))!;
    const depts = STREAM_DEFS[stream].departments.filter((d) => bankFor(d).length);
    const picks = (depts.length ? depts : [STREAM_DEFS[stream].departments[0]!]).slice(0, 2);
    for (const [i, department] of picks.entries()) {
      const bank = bankFor(department);
      const questions = bank.length >= 3 ? bank.slice(0, Math.min(bank.length, 6)) : templateQuestions(department, topicsFor(department, department), 5);
      await getStore().quizzes.save({
        id: newId("QZ"),
        collegeId: c.id,
        title: `${department} — ${i === 0 ? "Unit test 1" : "Certification quiz"}`,
        department,
        course: topicsFor(department, department)[0] ?? department,
        passMark: 50,
        durationMin: 15,
        certificateEnabled: true,
        status: "Published",
        questions: questions.map(shuffleOptions),
        createdBy: "AI Quiz Builder · reviewed by faculty",
        createdAt: new Date(Date.now() - (i + 2) * 86_400_000).toISOString(),
      });
    }
    // Placement aptitude quiz for every college
    await getStore().quizzes.save({
      id: newId("QZ"),
      collegeId: c.id,
      title: "Placement aptitude — quantitative",
      department: APTITUDE_DEPARTMENT,
      course: "Aptitude",
      passMark: 60,
      durationMin: 10,
      certificateEnabled: true,
      status: "Published",
      questions: APTITUDE_BANK.map(shuffleOptions),
      createdBy: "Placement Cell",
      createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
  }
}

/** Placement aptitude quizzes are not tied to an academic department. */
export const APTITUDE_DEPARTMENT = "Training & Placement";

export async function courseCode(department: string, collegeId: string): Promise<string> {
  const words = department.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter((w) => w && !/^(and|of|the)$/i.test(w));
  // "Computer Science & Engineering" → CSE; single-word departments use their first letters ("Commerce" → COM).
  const letters = (words.length === 1 ? words[0]!.slice(0, 3) : words.map((w) => w[0]!).join("").slice(0, 3)).toUpperCase().padEnd(2, "X");
  const existing = new Set([
    ...(await getStore().records.all(RESOURCES.courses!, collegeId)).map((c) => String(c.code)),
    ...(await getStore().courses.list(collegeId)).map((c) => c.code),
  ]);
  for (let n = 101; n < 999; n++) {
    const code = `${letters}${n}`;
    if (!existing.has(code)) return code;
  }
  return `${letters}999`;
}

/* ─────────────────────────── placement readiness ─────────────────── */
export interface Readiness {
  studentSub: string;
  name: string;
  rollNo: string;
  department: string;
  collegeId: string;
  quizAverage: number;
  certificates: number;
  aptitude: number;
  interview: number;
  resume: number;
  total: number;
  status: "Placement ready" | "Almost ready" | "Needs work";
  gaps: string[];
}
/** The measured inputs; total, status and gaps are derived by computeReadiness. */
export type ReadinessBase = Omit<Readiness, "total" | "status" | "gaps">;

export const READINESS_RULES = { minTotal: 70, minQuizAverage: 60, minCertificates: 2, minInterview: 50 };

export function computeReadiness(base: ReadinessBase): Readiness {
  const total = Math.round(base.quizAverage * 0.35 + (Math.min(base.certificates, 4) / 4) * 20 + base.aptitude * 0.15 + base.interview * 0.15 + base.resume * 0.15);
  const gaps: string[] = [];
  if (base.quizAverage < READINESS_RULES.minQuizAverage) gaps.push(`Raise your quiz average to ${READINESS_RULES.minQuizAverage}%`);
  if (base.certificates < READINESS_RULES.minCertificates) gaps.push(`Earn ${READINESS_RULES.minCertificates - base.certificates} more certificate(s)`);
  if (base.interview < READINESS_RULES.minInterview) gaps.push(`Score ${READINESS_RULES.minInterview}+ in a mock interview`);
  if (base.resume < 70) gaps.push("Complete your resume (ATS score 70+)");
  if (total < READINESS_RULES.minTotal) gaps.push(`Reach a total of ${READINESS_RULES.minTotal}`);
  const ready = total >= READINESS_RULES.minTotal && base.quizAverage >= READINESS_RULES.minQuizAverage && base.certificates >= READINESS_RULES.minCertificates && base.interview >= READINESS_RULES.minInterview;
  return { ...base, total, status: ready ? "Placement ready" : total >= 55 ? "Almost ready" : "Needs work", gaps: ready ? [] : gaps };
}

/* ───────────────────────────── request schemas ───────────────────── */
const QuestionSchema = z
  .object({
    prompt: z.string().trim().min(5).max(400),
    options: z.tuple([z.string().trim().min(1).max(200), z.string().trim().min(1).max(200), z.string().trim().min(1).max(200), z.string().trim().min(1).max(200)]),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().trim().max(400).default(""),
  })
  .strict();
const CreateQuiz = z
  .object({
    title: z.string().trim().min(3).max(120),
    department: z.string().min(2).max(80),
    course: z.string().trim().min(2).max(100),
    passMark: z.number().int().min(30).max(90),
    durationMin: z.number().int().min(5).max(120),
    certificateEnabled: z.boolean(),
    status: z.enum(["Draft", "Published"]),
    questions: z.array(QuestionSchema).min(3).max(30),
  })
  .strict();

/** Per-quiz analytics for staff: who took it, how they scored, and which questions the class got wrong. */
async function quizResults(quiz: Quiz): Promise<QuizResults> {
  const store = getStore();
  const attempts = (await store.attempts.list({ quizId: quiz.id })).sort((x, y) => x.at.localeCompare(y.at));
  const certs = new Set((await store.certificates.list({ quizId: quiz.id })).map((c) => c.studentSub));
  const by = new Map<string, Attempt[]>();
  for (const t of attempts) by.set(t.studentSub, [...(by.get(t.studentSub) ?? []), t]);
  const students = [...by.values()]
    .map((list) => {
      const last = list[list.length - 1]!;
      const best = Math.max(...list.map((t) => t.percentage));
      return { name: last.studentName, attempts: list.length, best, latest: last.percentage, passed: best >= quiz.passMark, certificate: certs.has(last.studentSub), lastAt: last.at };
    })
    .sort((x, y) => y.best - x.best || x.name.localeCompare(y.name));
  const bests = students.map((x) => x.best);
  const passed = students.filter((x) => x.passed).length;
  const buckets = [
    { label: "0–39%", min: 0 },
    { label: "40–59%", min: 40 },
    { label: "60–79%", min: 60 },
    { label: "80–100%", min: 80 },
  ];
  const distribution = buckets.map((b, i) => ({ label: b.label, count: bests.filter((v) => v >= b.min && (i === buckets.length - 1 || v < buckets[i + 1]!.min)).length }));
  // Answers recorded before the quiz was edited no longer line up with its questions, so they are left out.
  const usable = attempts.filter((t) => t.answers && t.answers.length === quiz.questions.length);
  const questions = quiz.questions.map((x, i) => {
    const optionCounts = [0, 0, 0, 0];
    let answered = 0;
    let right = 0;
    for (const t of usable) {
      const given = t.answers![i];
      if (given === null || given === undefined) continue;
      answered++;
      optionCounts[given] = (optionCounts[given] ?? 0) + 1;
      if (given === x.answer) right++;
    }
    return { number: i + 1, prompt: x.prompt, answer: x.answer, answered, correctPct: answered ? Math.round((right / answered) * 100) : null, optionCounts, options: [...x.options] };
  });
  return {
    quiz: { id: quiz.id, title: quiz.title, status: quiz.status, passMark: quiz.passMark, questions: quiz.questions.length },
    summary: {
      students: students.length,
      attempts: attempts.length,
      passed,
      passRate: students.length ? Math.round((passed / students.length) * 100) : 0,
      average: attempts.length ? Math.round(attempts.reduce((n, t) => n + t.percentage, 0) / attempts.length) : 0,
      highest: bests.length ? Math.max(...bests) : 0,
      lowest: bests.length ? Math.min(...bests) : 0,
    },
    distribution,
    students,
    questions,
  };
}

/* ───────────────────────────── dispatcher ────────────────────────── */
export async function dispatchLearning(method: string, segs: string[], rawBody: unknown, session: SessionPayload, query?: URLSearchParams): Promise<MockResult> {
  await ensureSeed();
  const store = getStore();
  const [area, a1, a2] = segs;
  const inCollege = session.college !== ALL_COLLEGES;
  const stream = await sessionStream(session);
  const isStaff = STAFF_ROLES.has(session.role);

  /* context for department pickers */
  if (area === "learning" && a1 === "context" && method === "GET") {
    if (!stream) return ok({ collegeId: null, stream: null, streamLabel: "All colleges", departments: [], terms: [] });
    const allDepts = streamOptions("department", stream).filter((d) => !/Administration/.test(d));
    const userDept = (session.role === "hod" || session.role === "faculty") ? await resolveUserDepartment(session) : null;
    const matchingDept = userDept ? allDepts.find((d) => d.toLowerCase() === userDept.toLowerCase()) : null;
    const departments = matchingDept ? [matchingDept] : allDepts;
    return ok({ collegeId: session.college, stream, streamLabel: STREAM_DEFS[stream].label, departments, terms: streamOptions("semester", stream), userDepartment: userDept });
  }

  /* ── Quizzes ── */
  if (area === "quizzes") {
    if (a1 === "generate" && method === "POST") {
      if (!isStaff) return err(403, "forbidden", "Only faculty can generate quizzes.");
      if (!stream) return err(400, "choose_college", "Switch into a college first.");
      const p = GenerateQuizBody.safeParse(rawBody);
      if (!p.success) return err(422, "validation", "Check the quiz settings.");
      if (!streamOptions("department", stream).includes(p.data.department) && p.data.department !== APTITUDE_DEPARTMENT) return err(422, "validation", "Department not in your college's stream.");
      const topicText = p.data.topic ? cleanText(p.data.topic, 100) : "";
      const ai = await aiQuizQuestions(session, p.data);
      if (ai.limited) return ai.limited;
      const written = (ai.questions ?? []).slice(0, p.data.count).map(shuffleOptions);
      const bank = p.data.department === APTITUDE_DEPARTMENT ? APTITUDE_BANK : bankFor(p.data.department);
      const topics = topicText ? [topicText, ...topicsFor(p.data.department, topicText)] : topicsFor(p.data.department, p.data.department);
      // The curated bank fills whatever the model did not write; templates only fill what is still missing.
      const fromBank = bank.slice(0, p.data.count - written.length).map(shuffleOptions);
      const templated = templateQuestions(p.data.department, topics, Math.max(0, p.data.count - written.length - fromBank.length)).map(shuffleOptions);
      const questions = [...fromBank, ...written, ...templated];
      return ok({ questions, fromBank: fromBank.length, templated: templated.length, aiCount: written.length, aiGenerated: written.length > 0, aiFailed: geminiEnabled() && written.length === 0, reviewRequired: true });
    }

    if (a1 === undefined && method === "GET") {
      const scoped = await store.quizzes.list(session.college);
      if (isStaff || session.role === "placement") {
        const colleges = await collegeIndex();
        const all = await store.attempts.list({ collegeId: inCollege ? session.college : undefined });
        return ok(
          scoped
            .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
            .map((q) => {
              const qa = all.filter((t) => t.quizId === q.id);
              const students = new Set(qa.map((t) => t.studentSub)).size;
              const passed = new Set(qa.filter((t) => t.percentage >= q.passMark).map((t) => t.studentSub)).size;
              return {
                id: q.id,
                title: q.title,
                department: q.department,
                course: q.course,
                status: q.status,
                questions: q.questions.length,
                passMark: q.passMark,
                durationMin: q.durationMin,
                certificateEnabled: q.certificateEnabled,
                attempts: qa.length,
                students,
                passRate: students ? Math.round((passed / students) * 100) : 0,
                average: qa.length ? Math.round(qa.reduce((s, t) => s + t.percentage, 0) / qa.length) : 0,
                collegeName: String(colleges.get(q.collegeId)?.name ?? "Unknown college"),
                createdAt: q.createdAt,
              };
            }),
        );
      }
      if (session.role !== "student") return err(403, "forbidden", "Not available for your role.");
      const mine = await store.attempts.list({ studentSub: session.sub });
      const certs = await store.certificates.list({ studentSub: session.sub });
      return ok(
        scoped
          .filter((q) => q.status === "Published")
          .map((q) => {
            const own = mine.filter((t) => t.quizId === q.id);
            const best = own.length ? Math.max(...own.map((t) => t.percentage)) : null;
            const cert = certs.find((c) => c.quizId === q.id);
            return { id: q.id, title: q.title, department: q.department, course: q.course, questions: q.questions.length, passMark: q.passMark, durationMin: q.durationMin, certificateEnabled: q.certificateEnabled, attempts: own.length, bestPercentage: best, certificateId: cert?.id ?? null };
          }),
      );
    }

    if (a1 === undefined && method === "POST") {
      if (!isStaff) return err(403, "forbidden", "Only faculty can create quizzes.");
      if (!inCollege || !stream) return err(400, "choose_college", "Switch into a college to create quizzes.");
      const p = CreateQuiz.safeParse(rawBody);
      if (!p.success) {
        const fields: Record<string, string> = {};
        for (const i of p.error.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
        return err(422, "validation", "Please correct the quiz.", fields);
      }
      if (!streamOptions("department", stream).includes(p.data.department) && p.data.department !== APTITUDE_DEPARTMENT) return err(422, "validation", "Department not in your college's stream.", { department: "Choose a department of your college" });
      const clean = (s: string, n: number) => cleanText(s, n);
      const q: Quiz = {
        id: newId("QZ"),
        collegeId: session.college,
        title: clean(p.data.title, 120),
        department: p.data.department,
        course: clean(p.data.course, 100),
        passMark: p.data.passMark,
        durationMin: p.data.durationMin,
        certificateEnabled: p.data.certificateEnabled,
        status: p.data.status,
        questions: p.data.questions.map((x) => ({ prompt: clean(x.prompt, 400), options: x.options.map((o) => clean(o, 200)) as BankQuestion["options"], answer: x.answer, explanation: clean(x.explanation, 400) })),
        createdBy: session.name,
        createdAt: new Date().toISOString(),
      };
      await store.quizzes.save(q);
      await audit(session.name, `Quiz ${q.status === "Published" ? "published" : "saved as draft"}`, `${q.id} · ${q.title}`, { collegeId: q.collegeId, actorSub: session.sub });
      if (q.status === "Published") await recordFacultyEvent(session.sub, "quiz_published", 1, q.collegeId);
      return ok({ id: q.id }, 201);
    }

    if (!a1 || !ID.test(a1)) return err(404, "not_found", "Quiz not found.");
    const quiz = await store.quizzes.get(a1);
    if (!quiz || (session.college !== ALL_COLLEGES && quiz.collegeId !== session.college)) return err(404, "not_found", "Quiz not found.");

    // A course's final assessment unlocks only after the student has read every lesson.
    if (quiz.courseId && session.role === "student" && !(await courseCompleted(quiz.courseId, session.sub)))
      return err(403, "course_incomplete", "Finish every lesson of the course to unlock the final assessment.");
    if (quiz.courseId && (a2 === "status" || method === "DELETE")) return err(409, "managed_by_course", "This is a course's final assessment. Manage it in AI Course Studio.");

    if (a2 === undefined && method === "GET") {
      if (isStaff) return ok({ ...quiz, collegeName: await collegeName(quiz.collegeId) });
      if (session.role !== "student" || quiz.status !== "Published") return err(404, "not_found", "Quiz not found.");
      // Students never receive the answer key.
      return ok({ id: quiz.id, title: quiz.title, department: quiz.department, course: quiz.course, passMark: quiz.passMark, durationMin: quiz.durationMin, certificateEnabled: quiz.certificateEnabled, questions: quiz.questions.map((x, i) => ({ id: `q${i + 1}`, prompt: x.prompt, options: x.options })) });
    }

    if (a2 === "submit" && method === "POST") {
      if (session.role !== "student") return err(403, "forbidden", "Only students can attempt quizzes.");
      if (quiz.status !== "Published") return err(409, "closed", "This quiz is not open.");
      const p = z.object({ answers: z.record(z.string().regex(/^q\d{1,2}$/), z.number().int().min(0).max(3)) }).strict().safeParse(rawBody);
      if (!p.success) return err(422, "validation", "Invalid answers.");
      const prior = (await store.attempts.list({ quizId: quiz.id, studentSub: session.sub })).length;
      if (prior >= 3) return err(409, "attempt_limit", "You have used all 3 attempts for this quiz.");
      let score = 0;
      const chosen: Array<number | null> = [];
      const review = quiz.questions.map((x, i) => {
        const given = p.data.answers[`q${i + 1}`];
        chosen.push(given ?? null);
        const correct = given === x.answer;
        if (correct) score++;
        return { id: `q${i + 1}`, prompt: x.prompt, options: x.options, given: given ?? null, answer: x.answer, correct, explanation: x.explanation };
      });
      const total = quiz.questions.length;
      const percentage = Math.round((score / total) * 100);
      const g = gradeFor(percentage, quiz.passMark);
      const attempt: Attempt = { quizId: quiz.id, studentSub: session.sub, studentName: session.name, collegeId: quiz.collegeId, score, total, percentage, at: new Date().toISOString(), answers: chosen };
      await store.attempts.add(attempt);
      let certificate: Certificate | null = null;
      if (g.passed && quiz.certificateEnabled) {
        // One certificate per quiz per student — re-issued only when the new mark is higher.
        const existing = (await store.certificates.list({ quizId: quiz.id, studentSub: session.sub }))[0];
        if (!existing || existing.percentage < percentage) {
          certificate = await issueCertificate(attempt, quiz, g, existing?.id);
          await audit(session.name, `Certificate issued (${g.grade})`, `${certificate.id} · ${quiz.title}`, { collegeId: quiz.collegeId, actorSub: session.sub });
        } else certificate = existing;
      }
      return ok({ score, total, percentage, grade: g.grade, gradeLabel: g.label, passed: g.passed, passMark: quiz.passMark, attemptsLeft: 2 - prior, certificateId: certificate?.id ?? null, review });
    }

    if (a2 === "results" && method === "GET") {
      if (!isStaff) return err(403, "forbidden", "Only faculty can see results.");
      return ok(await quizResults(quiz));
    }

    if (a2 === "status" && method === "POST") {
      if (!isStaff) return err(403, "forbidden", "Not allowed.");
      const p = z.object({ status: z.enum(["Draft", "Published", "Closed"]) }).strict().safeParse(rawBody);
      if (!p.success) return err(422, "validation", "Invalid status.");
      if (p.data.status === "Published" && quiz.status !== "Published") await recordFacultyEvent(session.sub, "quiz_published", 1, quiz.collegeId);
      quiz.status = p.data.status;
      await store.quizzes.save(quiz);
      await audit(session.name, `Quiz ${p.data.status.toLowerCase()}`, quiz.id, { collegeId: quiz.collegeId, actorSub: session.sub });
      return ok({ id: quiz.id, status: quiz.status });
    }

    if (a2 === undefined && method === "PUT") {
      if (!isStaff) return err(403, "forbidden", "Only faculty can edit quizzes.");
      if (!stream) return err(400, "choose_college", "Switch into a college to edit quizzes.");
      const p = CreateQuiz.safeParse(rawBody);
      if (!p.success) {
        const fields: Record<string, string> = {};
        for (const i of p.error.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
        return err(422, "validation", "Please correct the quiz.", fields);
      }
      if (!streamOptions("department", stream).includes(p.data.department) && p.data.department !== APTITUDE_DEPARTMENT) return err(422, "validation", "Department not in your college's stream.", { department: "Choose a department of your college" });
      const clean = (s: string, n: number) => cleanText(s, n);
      quiz.title = clean(p.data.title, 120);
      quiz.department = p.data.department;
      quiz.course = clean(p.data.course, 100);
      quiz.passMark = p.data.passMark;
      quiz.durationMin = p.data.durationMin;
      quiz.certificateEnabled = p.data.certificateEnabled;
      quiz.status = p.data.status;
      quiz.questions = p.data.questions.map((x) => ({ prompt: clean(x.prompt, 400), options: x.options.map((o) => clean(o, 200)) as BankQuestion["options"], answer: x.answer, explanation: clean(x.explanation, 400) }));
      await store.quizzes.save(quiz);
      await audit(session.name, "Quiz updated", `${quiz.id} · ${quiz.title}`, { collegeId: quiz.collegeId, actorSub: session.sub });
      if (quiz.status === "Published") await recordFacultyEvent(session.sub, "quiz_published", 1, quiz.collegeId);
      return ok({ id: quiz.id, status: quiz.status });
    }

    if (a2 === undefined && method === "DELETE") {
      if (!isStaff) return err(403, "forbidden", "Not allowed.");
      const force = query?.get("force") === "1";
      if (!force && (await store.attempts.list({ quizId: quiz.id })).length > 0) {
        return err(409, "has_attempts", "Students have attempted this quiz. Close it instead of deleting, so marks and certificates stay verifiable.");
      }
      await store.quizzes.delete(quiz.id);
      await audit(session.name, "Quiz deleted", quiz.id, { collegeId: quiz.collegeId, actorSub: session.sub });
      return ok({ ok: true });
    }
    return err(404, "not_found", "Not found.");
  }

  /* ── Certificates ── */
  if (area === "certificates" && method === "GET" && a1 === undefined) {
    const colleges = await collegeIndex();
    const show = (c: Certificate) => ({ ...c, signature: undefined, collegeName: String(colleges.get(c.collegeId)?.name ?? "Unknown college") });
    const byDate = (x: Certificate, y: Certificate) => y.issuedAt.localeCompare(x.issuedAt);
    if (session.role === "student") return ok((await store.certificates.list({ studentSub: session.sub })).sort(byDate).map(show));
    if (!isStaff && session.role !== "placement") return err(403, "forbidden", "Not available for your role.");
    return ok((await store.certificates.list({ scope: session.college })).sort(byDate).map(show));
  }

  /* ── Placement readiness ── (honours the college's Career / Placement switches) */
  if (area === "placement") {
    const groups = await enabledGroups(session.college);
    const need = a1 === "me" ? "Career" : "Placement";
    if (groups !== "all" && !groups.includes(need)) return err(403, "module_disabled", `${need} is switched off for your college.`);
    if (a1 === "me" && method === "GET") {
      if (session.role !== "student") return err(403, "forbidden", "Students only.");
      return ok({ readiness: computeReadiness(await store.readiness.forStudent(session)), rules: READINESS_RULES });
    }
    if (a1 === "board" && method === "GET") {
      if (!["placement", "hod", "institution", "admin"].includes(session.role)) return err(403, "forbidden", "Not available for your role.");
      const colleges = await collegeIndex();
      const ids = session.college === ALL_COLLEGES ? [...colleges.keys()] : [session.college];
      const rows = [];
      for (const id of ids) {
        const board = (await store.readiness.board(id)).map(computeReadiness).sort((a, b) => b.total - a.total);
        rows.push(...board.map((r) => ({ ...r, collegeName: String(colleges.get(id)?.name ?? ""), rollNo: mask(r.rollNo) })));
      }
      return ok({ rows, rules: READINESS_RULES });
    }
  }

  return err(404, "not_found", "Not found.");
}

export const _learningTest = { quizzes: memoryState.quizzes, attempts: memoryState.attempts, certificates: memoryState.certificates, ensureSeed };

/** Public verification view — only what an employer needs to confirm the certificate is genuine. */
export async function publicCertificate(id: string) {
  const v = await verifyCertificate(id);
  if (!v.valid || !v.certificate) return { valid: false as const, tampered: Boolean(v.tampered) };
  const c = v.certificate;
  return {
    valid: true as const,
    id: c.id,
    kind: c.kind,
    studentName: c.studentName,
    collegeName: await collegeName(c.collegeId),
    title: c.title,
    course: c.course,
    department: c.department,
    marks: c.marks,
    total: c.total,
    percentage: c.percentage,
    grade: c.grade,
    gradeLabel: c.gradeLabel,
    issuedAt: c.issuedAt,
  };
}
