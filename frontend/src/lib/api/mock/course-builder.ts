import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { MEDIA_REF_RE, RESOURCES, emptyValues } from "@/config/resources";
import { streamOptions, type Stream } from "@/config/streams";
import { ALL_COLLEGES } from "@/config/tenancy";
import { can } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { cleanText } from "@/lib/security/sanitize";
import { isReferenceUrl, parseVideoUrl } from "@/lib/video";
import { audit } from "./audit";
import { libraryFor } from "./course-library";
import { TOPIC_EXTRA, type TopicExtra } from "./course-library-extra";
import { allLessons, completedLessons, courseCompleted, type CourseUnit, type LearningCourse, type Lesson } from "./course-state";
import { aiQuestions, planChapters, writeChapters, type AiTopic, type ChapterContent, type ChapterPlan, type CourseBrief } from "./course-ai";
import { geminiEnabled } from "@/lib/ai/gemini";
import { Figure, MAX_FIGURES, mapFigureText } from "@/lib/api/figure-schemas";
import { rateLimit } from "./rate-limit";
import { getStore, withRequestContext } from "@/lib/data";
import { recordFacultyEvent } from "./faculty-activity";
import { bankFor, templateQuestions, type BankQuestion } from "./learning-content";
import { courseCode, newId, shuffleOptions, type Quiz } from "./learning";
import { collegeIndex, collegeName, collegeStream, createRecord, getCollege } from "./records";
import type { MockResult } from "./router";

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({
  status,
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
});
const ID = /^LC-[A-F0-9]{8}$/;
const LESSON_ID = /^L\d{1,3}$/;
const STAFF = new Set(["faculty", "hod", "institution", "admin"]);
export const FINAL_QUIZ_SIZE = 30;

export const LEVELS = ["Foundation (UG Year 1)", "Intermediate (UG Year 2–3)", "Advanced (UG final / PG)", "Certificate / value-added"] as const;

type Question = BankQuestion & { review?: boolean };

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/* ───────────────────────────── syllabus parsing ─────────────────────────── */
// eslint-disable-next-line security/detect-unsafe-regex -- anchored, applied to lines capped at 160 chars
const UNIT_LINE = /^(?:unit|module|part|chapter)\s*(?:[0-9]+|[ivxlc]+\b)?\s*[:.\-–—]?\s*(.*)$/i;
/** Anything after these headings (text books, references, outcomes…) is not course content. */
const STOP_LINE = /^(text ?books?|references?|reference books|course outcomes?|outcomes?|total\b|list of experiments)/i;

/** Turns pasted syllabus text into units → lesson titles. "Unit 2: Relational model" lines start a unit; other lines are lessons. */
export function parseSyllabus(text: string): Array<{ title: string; lessons: string[] }> {
  const units: Array<{ title: string; lessons: string[] }> = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = cleanText(raw, 160)
      .replace(/^(?:[-*•·▪◦]|\d{1,2}[.)])\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (line.length < 3) continue;
    if (STOP_LINE.test(line)) break;
    const unit = UNIT_LINE.exec(line);
    if (unit || line.endsWith(":")) {
      const name = (unit ? unit[1]!.replace(/\s+\d{1,2}$/, "") : line.slice(0, -1)) || `Unit ${units.length + 1}`;
      units.push({ title: name.slice(0, 100), lessons: [] });
      continue;
    }
    // Syllabi usually separate topics with " – " (Anna University style) or semicolons.
    for (const part of line.split(/\s+[–—-]\s+|\s*;\s*/)) {
      const t = part.trim().slice(0, 120);
      if (t.length < 3 || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      if (!units.length) units.push({ title: "", lessons: [] });
      units[units.length - 1]!.lessons.push(t);
    }
  }
  const nonEmpty = units.filter((u) => u.lessons.length);
  // One long unnamed list → group into units of three lessons.
  if (nonEmpty.length === 1 && !nonEmpty[0]!.title && nonEmpty[0]!.lessons.length > 4) {
    const all = nonEmpty[0]!.lessons;
    return Array.from({ length: Math.ceil(all.length / 3) }, (_, i) => ({ title: `Unit ${i + 1}`, lessons: all.slice(i * 3, i * 3 + 3) })).slice(0, 12);
  }
  return nonEmpty.slice(0, 12).map((u, i) => ({ title: u.title || `Unit ${i + 1}`, lessons: u.lessons.slice(0, 15) }));
}

/* ───────────────────────────── lesson writing ───────────────────────────── */
const PRACTICE: Record<Stream, string> = {
  engineering: "In lab and project work you will use this when designing, testing and debugging real systems. Work through each point with a small example of your own before moving on.",
  medical: "On the wards and in the skills lab, connect each point to the patients you see — the history, examination findings and investigations. Discuss one case with your peer group.",
  artsScience: "In tutorials and assignments, explain each point in your own words and link it to an example from the prescribed texts or a problem set.",
  management: "Relate each point to a company or case you know: how would a manager use it to make a better decision?",
  polytechnic: "In the workshop, apply each point step by step and write the observations in your practical record.",
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const ORIENTATION = "Getting started";
const REVISION = "Course revision";

/** What the template lessons take, plus the diagrams the AI drew for the topic. */
type LessonExtra = TopicExtra & { figures?: Figure[] };

interface GenCtx {
  course: string;
  department: string;
  stream: Stream;
  next: () => string;
}

/** Search pages and readings that always resolve; faculty can replace them with specific videos. */
function referenceLinks(topic: string, course: string): Array<{ label: string; url: string }> {
  const q = (s: string) => encodeURIComponent(s);
  return [
    { label: `NPTEL lectures: ${topic}`, url: `https://www.youtube.com/results?search_query=${q(`NPTEL ${topic} ${course}`)}` },
    { label: `Video explanations: ${topic}`, url: `https://www.youtube.com/results?search_query=${q(`${topic} explained`)}` },
    { label: `Read more: ${topic}`, url: `https://en.wikipedia.org/w/index.php?search=${q(topic)}` },
  ];
}

function overviewLesson(ctx: GenCtx, chapters: string[]): Lesson {
  return {
    id: ctx.next(),
    title: `Welcome to ${ctx.course}`,
    layout: "overview",
    minutes: 10,
    objectives: ["See how the course is organised", "Know how lessons, practice and the final assessment fit together", "Plan your study time"],
    body: [
      `## About this course`,
      `**${ctx.course}** is offered by the Department of ${ctx.department}. It has **${chapters.length} chapters**, shown in the course map above, followed by a revision chapter and a final assessment.`,
      ``,
      `## How each chapter works`,
      `1. **Key concepts** — the ideas, the key points and the vocabulary, with a concept map.`,
      `2. **Worked example** — the ideas applied step by step, and the mistakes students most often make.`,
      `3. **Practice & recap** — questions with model answers and a checklist of what you should now know.`,
      ``,
      `## Final assessment and certificate`,
      `When every lesson is complete, a 30-question final assessment unlocks. Its questions come from the key points and key terms in the lessons. Pass it to earn a certificate graded by your marks (O, A+, A, B or C).`,
      ``,
      `## Study tips`,
      `- Take one lesson per sitting and finish its practice before moving on.`,
      `- Say each key point aloud in your own words before marking a lesson complete.`,
      `- When an idea does not click, use the **Watch & read** links in that lesson.`,
    ].join("\n"),
    keyPoints: ["Each chapter moves from concepts to a worked example to practice.", "The final assessment unlocks after every lesson is complete.", "Certificates are graded O, A+, A, B or C by marks."],
  };
}

function conceptsLesson(ctx: GenCtx, topic: string, facts: readonly string[], extra?: LessonExtra): Lesson {
  const keyPoints = facts.length
    ? [...facts]
    : [
        `${topic}: know the definition, purpose and scope, and the key terms used with it.`,
        `The principles of ${topic} are applied step by step and each result is checked against the definition.`,
        `Most mistakes in ${topic} come from skipping assumptions — state them first.`,
      ];
  const intro =
    extra?.intro ?? `${topic} is part of ${ctx.course}. This lesson introduces the idea, the vocabulary used with it and where it is applied in ${ctx.department}. Your faculty will add detailed notes for your syllabus.`;
  return {
    id: ctx.next(),
    title: `${topic} — key concepts`,
    layout: "concepts",
    minutes: 20,
    objectives: [`Explain what ${topic} is and why it matters`, `State the key points of ${topic}`, extra ? `Use the key terms of ${topic} correctly` : `Relate ${topic} to ${ctx.department}`],
    body: [
      `## Introduction`,
      intro,
      ``,
      `## The key points`,
      ...keyPoints.map((p, i) => `${i + 1}. ${p}`),
      ``,
      `## Making it stick`,
      `The concept map above shows how these points connect. For each one, ask yourself **why** it is true and what would go wrong if it were not — being able to give the reason is what separates understanding from memorising. The worked example in the next lesson puts these ideas to use.`,
    ].join("\n"),
    keyPoints,
    terms: extra?.terms.map(([term, meaning]) => ({ term, meaning })) ?? [],
    links: referenceLinks(topic, ctx.course),
    ...(extra?.figures?.length ? { figures: extra.figures } : {}),
  };
}

function exampleLesson(ctx: GenCtx, topic: string, extra: TopicExtra): Lesson {
  return {
    id: ctx.next(),
    title: `${topic} — worked example`,
    layout: "example",
    minutes: 20,
    objectives: [`Follow a worked example of ${topic}`, `Recognise the most common mistakes`, `Apply ${topic} to a new problem`],
    body: [
      `## Worked example`,
      extra.example,
      ``,
      `## In practice`,
      PRACTICE[ctx.stream],
      ``,
      `## Now you try`,
      `Change one value or condition in the example above and work it through again on paper. Then check your reasoning against the “Watch out” panel.`,
    ].join("\n"),
    keyPoints: [...extra.mistakes],
    links: referenceLinks(topic, ctx.course),
  };
}

function practiceLesson(ctx: GenCtx, topic: string, facts: readonly string[], extra?: TopicExtra): Lesson {
  const practice = extra
    ? extra.practice.map(([q, a]) => ({ q, a }))
    : [
        { q: `In two or three sentences, explain ${topic} to a first-year student.`, a: `A good answer defines ${topic}, gives one example from ${ctx.department} and names one limitation or common mistake.` },
        { q: `Where is ${topic} used in ${ctx.department}?`, a: `Name one real application and describe what ${topic} contributes to it.` },
      ];
  return {
    id: ctx.next(),
    title: `${topic} — practice & recap`,
    layout: "practice",
    minutes: 15,
    objectives: [`Check your understanding of ${topic}`, `Recall the key points without notes`],
    body: [
      `## Recap`,
      `Before moving on, make sure you can explain every item in the checklist without looking back.`,
      ``,
      `## Practice`,
      `Write or say your answer first, then reveal the model answer and compare. If you missed something, reopen the concepts lesson of this chapter.`,
    ].join("\n"),
    keyPoints: facts.length ? [...facts] : [`Explain ${topic} in your own words`, `Give an example of ${topic} from ${ctx.department}`],
    practice,
  };
}

function revisionLesson(ctx: GenCtx): Lesson {
  return {
    id: ctx.next(),
    title: `Revision — ${ctx.course} at a glance`,
    layout: "revision",
    minutes: 20,
    objectives: ["Review every chapter's key points in one place", "Find the chapters to revise before the final assessment"],
    body: [
      `## How to revise`,
      `1. Read each chapter card above and say its points aloud.`,
      `2. Note any point you cannot explain and reopen that chapter.`,
      `3. When every card feels familiar, start the final assessment.`,
      ``,
      `## On the day`,
      `- The final assessment has 30 questions and a timer.`,
      `- Read every option before choosing — several may look similar.`,
      `- You have three attempts, and your best mark counts.`,
    ].join("\n"),
    keyPoints: ["Revise chapter by chapter before the final assessment."],
  };
}

const outline = (ctx: GenCtx, chapters: CourseUnit[]): CourseUnit[] => [
  { title: ORIENTATION, lessons: [overviewLesson(ctx, chapters.map((c) => c.title))] },
  ...chapters,
  { title: REVISION, lessons: [revisionLesson(ctx)] },
];

const BLOOM = [
  ["Remember", "Recall"],
  ["Understand", "Explain"],
  ["Apply", "Apply"],
  ["Analyse", "Analyse"],
  ["Evaluate", "Evaluate"],
  ["Create", "Design solutions using"],
] as const;

const isFrame = (u: CourseUnit) => u.lessons.length > 0 && u.lessons.every((l) => l.layout === "overview" || l.layout === "revision");

function outcomesFor(units: CourseUnit[], level: string, course: string) {
  const start = level.startsWith("Foundation") ? 0 : level.startsWith("Intermediate") ? 1 : 2;
  const chapters = units.filter((u) => !isFrame(u));
  // Group chapters into at most six outcomes so long courses keep a readable CO list.
  const size = Math.max(1, Math.ceil(chapters.length / 6));
  const groups = Array.from({ length: Math.ceil(chapters.length / size) }, (_, i) => chapters.slice(i * size, i * size + size));
  return groups.map((g, i) => {
    const [bloom, verb] = BLOOM[Math.min(start + i, BLOOM.length - 1)]!;
    const names = g.map((u) => u.title.toLowerCase());
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
    return { code: `CO${i + 1}`, bloom, text: `${verb} ${list} in ${course}.` };
  });
}

/** Lesson ids follow reading order (L1, L2, …). */
function renumber(units: CourseUnit[]): CourseUnit[] {
  let n = 0;
  for (const u of units) for (const l of u.lessons) l.id = `L${++n}`;
  return units;
}

export function buildUnits(input: { title: string; department: string; mode: "title" | "syllabus"; syllabus?: string }, stream: Stream): { units: CourseUnit[]; curated: boolean } {
  const ctx: GenCtx = { course: input.title, department: input.department, stream, next: () => "L0" };

  if (input.mode === "syllabus") {
    const chapters = parseSyllabus(input.syllabus ?? "").map((u) => {
      const lessons = u.lessons.map((t) => ({ ...conceptsLesson(ctx, t, []), title: t })); // syllabus topics keep their own names
      return { title: u.title, lessons: [...lessons, practiceLesson(ctx, u.title, u.lessons.map((t) => `Explain ${t} in your own words.`))] };
    });
    return { curated: false, units: renumber(outline(ctx, chapters)) };
  }

  const lib = libraryFor(input.title);
  if (lib) {
    const chapters: CourseUnit[] = lib.units.flatMap((part, pi) =>
      part.lessons.map((topic) => {
        const extra = TOPIC_EXTRA[topic.title];
        return {
          title: topic.title,
          part: `Part ${ROMAN[pi] ?? pi + 1} · ${part.title}`,
          lessons: extra
            ? [conceptsLesson(ctx, topic.title, topic.facts, extra), exampleLesson(ctx, topic.title, extra), practiceLesson(ctx, topic.title, topic.facts, extra)]
            : [conceptsLesson(ctx, topic.title, topic.facts), practiceLesson(ctx, topic.title, topic.facts)],
        };
      }),
    );
    return { curated: true, units: renumber(outline(ctx, chapters)) };
  }

  const t = input.title;
  const topics = [`Introduction to ${t}`, "Basic concepts & terminology", `Core principles of ${t}`, "Methods & techniques", "Tools & applications", "Problem solving", `Case studies in ${input.department}`, "Current trends"];
  const chapters = topics.map((topic) => ({ title: topic, lessons: [conceptsLesson(ctx, topic, []), practiceLesson(ctx, topic, [])] }));
  return { curated: false, units: renumber(outline(ctx, chapters)) };
}

/* ───────────────────────────── AI drafting (Gemini) ─────────────────────────── */
/** A chapter the model could not write: the same generic draft the templates produce. */
function templateChapter(ctx: GenCtx, ch: ChapterPlan, mode: "title" | "syllabus"): CourseUnit {
  if (mode === "syllabus") {
    const lessons = ch.topics.map((t) => ({ ...conceptsLesson(ctx, t, []), title: t }));
    return { title: ch.title, lessons: [...lessons, practiceLesson(ctx, ch.title, ch.topics.map((t) => `Explain ${t} in your own words.`))] };
  }
  return { title: ch.title, part: ch.part, lessons: [conceptsLesson(ctx, ch.title, []), practiceLesson(ctx, ch.title, [])] };
}

function aiChapter(ctx: GenCtx, ch: ChapterPlan, c: ChapterContent, mode: "title" | "syllabus", part: string | undefined): CourseUnit {
  const extra = (t: AiTopic): LessonExtra => ({ intro: t.intro, terms: t.terms, example: c.example, mistakes: c.mistakes, practice: c.practice, figures: t.figures });
  const lead = c.topics[0]!;
  if (mode === "syllabus") {
    // Syllabus topics keep their own lesson names; one worked example and one practice lesson close the unit.
    const concepts = c.topics.map((t) => ({ ...conceptsLesson(ctx, t.title, t.keyPoints, extra(t)), title: t.title }));
    return { title: ch.title, lessons: [...concepts, exampleLesson(ctx, ch.title, extra(lead)), practiceLesson(ctx, ch.title, c.topics.flatMap((t) => t.keyPoints).slice(0, 4), extra(lead))] };
  }
  return {
    title: ch.title,
    part,
    lessons: [conceptsLesson(ctx, ch.title, lead.keyPoints, extra(lead)), exampleLesson(ctx, ch.title, extra(lead)), practiceLesson(ctx, ch.title, lead.keyPoints.slice(0, 4), extra(lead))],
  };
}

/**
 * Drafts the course with Gemini: chapter outline (or the faculty's syllabus units) → each chapter's lessons.
 * Returns null when AI is off or nothing usable came back, so the caller uses the built-in templates;
 * a single failed chapter is templated on its own.
 */
async function buildUnitsAi(input: { title: string; department: string; level: string; mode: "title" | "syllabus"; syllabus?: string }, stream: Stream): Promise<CourseUnit[] | null> {
  if (!geminiEnabled()) return null;
  const brief: CourseBrief = { title: input.title, department: input.department, level: input.level, streamLabel: stream };
  let plan: ChapterPlan[] | null;
  if (input.mode === "syllabus") {
    plan = parseSyllabus(input.syllabus ?? "")
      .slice(0, 12)
      .map((u) => ({ title: u.title, topics: u.lessons.slice(0, 6) }));
    if (!plan.length) return null;
  } else {
    plan = await planChapters(brief);
  }
  if (!plan) return null;
  const content = await writeChapters(brief, plan, input.mode === "syllabus" ? input.syllabus : undefined);
  if (content.every((c) => c === null)) return null;

  const ctx: GenCtx = { course: input.title, department: input.department, stream, next: () => "L0" };
  const parts = new Map<string, string>();
  const chapters = plan.map((ch, i) => {
    const c = content[i];
    let part: string | undefined;
    if (ch.part) {
      if (!parts.has(ch.part)) parts.set(ch.part, `Part ${ROMAN[parts.size] ?? parts.size + 1} · ${ch.part}`);
      part = parts.get(ch.part);
    }
    return c ? aiChapter(ctx, ch, c, input.mode, part) : templateChapter(ctx, { ...ch, part }, input.mode);
  });
  return renumber(outline(ctx, chapters));
}

/** What the question writer reads: each chapter's key points and terms, as the students see them. */
function courseDigest(units: CourseUnit[]): string {
  return units
    .filter((u) => !isFrame(u))
    .map((u) => {
      const points = u.lessons.filter((l) => (l.layout ?? "concepts") === "concepts").flatMap((l) => l.keyPoints).slice(0, 6);
      const terms = u.lessons.flatMap((l) => l.terms ?? []).slice(0, 6);
      return [`## ${u.title}`, ...points.map((p) => `- ${p}`), ...terms.map((t) => `- Term: ${t.term} — ${t.meaning}`)].join("\n");
    })
    .join("\n\n")
    .slice(0, 14_000);
}

/**
 * The final assessment: Gemini-written questions grounded in the lessons (every one flagged "review", so a person
 * confirms the answer key before publishing), topped up by the rule-based questions. Falls back to those alone.
 */
export async function buildQuestions(units: CourseUnit[], department: string, brief?: CourseBrief, n = FINAL_QUIZ_SIZE): Promise<Question[]> {
  if (brief && geminiEnabled()) {
    const ai = await aiQuestions(brief, courseDigest(units), n);
    if (ai) {
      const picked: Question[] = ai.slice(0, n).map((q) => ({ ...shuffleOptions(q), review: true }));
      return picked.length >= n ? picked : shuffle([...picked, ...courseQuestions(units, department, n - picked.length)]);
    }
  }
  return courseQuestions(units, department, n);
}

/* ───────────────────────────── AI before the transaction ─────────────────────────── */
/*
 * In postgres mode every request runs inside one database transaction with a 30 s limit, and a Gemini call can take
 * longer than that. So the route calls prefetchCourseAi() BEFORE opening the transaction: it does the slow AI work,
 * parks the result here, and createCourse() / the regenerate handler pick it up (once) inside the request.
 */
interface Prepared {
  at: number;
  units: CourseUnit[] | null;
  questions: Question[] | null;
}
const prepared = new Map<string, Prepared>();
const PREPARED_TTL_MS = 10 * 60_000;

const prepKey = (who: string, i: { title: string; department: string; level: string; mode: string; syllabus?: string }) =>
  JSON.stringify([who, i.title, i.department, i.level, i.mode, i.syllabus ?? ""]);
const regenKey = (who: string, courseId: string, version: number) => JSON.stringify([who, "regen", courseId, version]);

function takePrepared(key: string): Prepared | undefined {
  const p = prepared.get(key);
  prepared.delete(key);
  return p && Date.now() - p.at < PREPARED_TTL_MS ? p : undefined;
}
function park(key: string, p: Omit<Prepared, "at">) {
  const now = Date.now();
  for (const [k, v] of prepared) if (now - v.at >= PREPARED_TTL_MS) prepared.delete(k);
  prepared.set(key, { ...p, at: now });
}

/**
 * Runs the Gemini steps for POST learning-courses/generate and .../quiz/regenerate ahead of the request's database
 * transaction. Returns an error result (429) to send back, or null to carry on. Anything it skips (AI off, invalid
 * input, no access) is handled normally by dispatchCourses.
 */
export async function prefetchCourseAi(method: string, segs: string[], rawBody: unknown, session: SessionPayload): Promise<MockResult | null> {
  if (method !== "POST" || segs[0] !== "learning-courses" || !geminiEnabled() || !STAFF.has(session.role)) return null;
  const who = session.sub ?? session.name;
  const limited = () => {
    const rl = rateLimit(`course-ai:${who}`, 15, 3_600_000);
    return rl.ok ? null : err(429, "rate_limited", `You have generated several AI drafts recently. Try again in ${Math.ceil(rl.retryAfter / 60)} minute(s).`);
  };

  if (segs[1] === "generate") {
    const p = GenerateBody.safeParse(rawBody);
    if (!p.success || session.college === ALL_COLLEGES) return null;
    const stream = await withRequestContext({ scope: session.college, sub: session.sub, readOnly: true }, () => collegeStream(session.college));
    if (!stream) return null;
    const d = p.data;
    if (!streamOptions("department", stream).includes(d.department) || !streamOptions("semester", stream).includes(d.semester)) return null;
    if (d.mode === "syllabus" && parseSyllabus(d.syllabus ?? "").reduce((n, u) => n + u.lessons.length, 0) < 3) return null;
    const blocked = limited();
    if (blocked) return blocked;
    const input = { ...d, title: cleanText(d.title, 100), faculty: cleanText(d.faculty, 80) };
    const units = await buildUnitsAi(input, stream);
    const questions = units ? await aiOnlyQuestions(units, input, stream) : null;
    park(prepKey(who, input), { units, questions });
    return null;
  }

  if (segs[2] === "quiz" && segs[3] === "regenerate" && ID.test(segs[1] ?? "")) {
    const course = await withRequestContext({ scope: session.college, sub: session.sub, readOnly: true }, async () => {
      const c = await getStore().courses.get(segs[1]!);
      return c && (session.college === ALL_COLLEGES || c.collegeId === session.college) && c.status === "Draft" ? c : undefined;
    });
    if (!course) return null;
    const blocked = limited();
    if (blocked) return blocked;
    const stream = session.college === ALL_COLLEGES ? course.department : ((await withRequestContext({ scope: session.college, sub: session.sub, readOnly: true }, () => collegeStream(session.college))) ?? course.department);
    const questions = await aiOnlyQuestions(course.units, course, stream);
    park(regenKey(who, course.id, course.version), { units: null, questions });
    return null;
  }
  return null;
}

/** AI questions topped up by the rule-based ones, or null when the model gave nothing usable. */
async function aiOnlyQuestions(units: CourseUnit[], c: { title: string; department: string; level: string }, stream: string): Promise<Question[] | null> {
  const ai = await aiQuestions({ title: c.title, department: c.department, level: c.level, streamLabel: stream }, courseDigest(units), FINAL_QUIZ_SIZE);
  if (!ai) return null;
  const picked: Question[] = ai.slice(0, FINAL_QUIZ_SIZE).map((q) => ({ ...shuffleOptions(q), review: true }));
  return picked.length >= FINAL_QUIZ_SIZE ? picked : shuffle([...picked, ...courseQuestions(units, c.department, FINAL_QUIZ_SIZE - picked.length)]);
}

/* ───────────────────────────── final assessment ─────────────────────────── */
/**
 * Builds the final assessment from what students actually read:
 * key terms ("which term means …"), key points ("which chapter teaches …"), syllabus topic → chapter,
 * department bank questions that match the course, and — only if still short — placeholders flagged for review.
 */
export function courseQuestions(units: CourseUnit[], department: string, n = FINAL_QUIZ_SIZE): Question[] {
  const chapters = units.filter((u) => !isFrame(u));
  const chapterTitles = [...new Set(chapters.map((u) => u.title))];
  const others = (pool: string[], exclude: string[]) => shuffle(pool.filter((t) => !exclude.includes(t))).slice(0, 3);

  const terms = new Map<string, { meaning: string; chapter: string }>();
  for (const u of chapters) for (const l of u.lessons) for (const t of l.terms ?? []) if (!terms.has(t.term)) terms.set(t.term, { meaning: t.meaning, chapter: u.title });
  const termNames = [...terms.keys()];
  const termQs: Question[] =
    termNames.length >= 4
      ? [...terms]
          .filter(([term, v]) => !v.meaning.toLowerCase().includes(term.toLowerCase().replace(/\s*\(.*\)$/, "")))
          .map(([term, v]) => ({
            prompt: `Which key term of this course means: “${v.meaning}”`,
            options: [term, ...others(termNames, [term])] as Question["options"],
            answer: 0,
            explanation: `“${term}” — covered in the chapter “${v.chapter}”.`,
          }))
      : [];

  const factQs: Question[] = [];
  if (chapterTitles.length >= 4) {
    const seen = new Set<string>();
    for (const u of chapters) {
      for (const l of u.lessons) {
        if (l.layout && l.layout !== "concepts") continue;
        for (const kp of l.keyPoints) {
          const low = kp.toLowerCase();
          if (seen.has(kp) || kp.length < 20 || low.includes(u.title.toLowerCase()) || low.includes(l.title.toLowerCase())) continue;
          seen.add(kp);
          factQs.push({ prompt: `Which chapter of this course teaches that: “${kp}”`, options: [u.title, ...others(chapterTitles, [u.title])] as Question["options"], answer: 0, explanation: `This is a key point of the chapter “${u.title}”.` });
        }
      }
    }
  }

  const structureQs: Question[] = [];
  if (chapterTitles.length >= 4) {
    for (const u of chapters)
      for (const l of u.lessons)
        if (l.layout !== "practice" && !l.title.toLowerCase().includes(u.title.toLowerCase()))
          structureQs.push({ prompt: `In this course, the lesson “${l.title}” belongs to which chapter?`, options: [u.title, ...others(chapterTitles, [u.title])] as Question["options"], answer: 0, explanation: `“${l.title}” is taught in the chapter “${u.title}”.` });
  }
  const topicTitles = chapters.flatMap((u) => u.lessons.filter((l) => (l.layout ?? "concepts") === "concepts" && !l.title.includes(" — ")).map((l) => l.title));
  if (topicTitles.length >= 5) {
    for (let i = 0; i < topicTitles.length - 1; i++)
      structureQs.push({
        prompt: `Which topic comes straight after “${topicTitles[i]}”?`,
        options: [topicTitles[i + 1]!, ...others(topicTitles, [topicTitles[i]!, topicTitles[i + 1]!])] as Question["options"],
        answer: 0,
        explanation: `The course order is “${topicTitles[i]}” → “${topicTitles[i + 1]}”.`,
      });
  }

  const stop = new Set(["which", "their", "there", "about", "lesson", "course", "every", "where", "these", "those", "using", "concepts", "practice", "recap", "example"]);
  const words = new Set(chapters.flatMap((u) => u.lessons.flatMap((l) => `${l.title} ${l.keyPoints.join(" ")}`.toLowerCase().match(/[a-z][a-z0-9+]{4,}/g) ?? [])).filter((w) => !stop.has(w)));
  const bankQs: Question[] = bankFor(department).filter((q) => (`${q.prompt} ${q.explanation}`.toLowerCase().match(/[a-z][a-z0-9+]{4,}/g) ?? []).some((w) => words.has(w)));

  // Alternate term and key-point questions so the assessment covers both vocabulary and ideas.
  const t = shuffle(termQs);
  const f = shuffle(factQs);
  const mixed: Question[] = [];
  for (let i = 0; i < Math.max(t.length, f.length); i++) {
    if (t[i]) mixed.push(t[i]!);
    if (f[i]) mixed.push(f[i]!);
  }
  const picked: Question[] = [...mixed, ...shuffle(structureQs), ...bankQs].slice(0, n);
  if (picked.length < n) {
    const titles = chapterTitles.length ? chapterTitles : [department];
    picked.push(...templateQuestions(department, titles, n - picked.length).map((q) => ({ ...q, review: true })));
  }
  return shuffle(picked).map((q) => ({ ...shuffleOptions(q), review: q.review ?? false }));
}

/* ─────────────────────────────────── seed ───────────────────────────────── */
const seedFlag = { done: false };
const SEEDS: Record<string, Array<{ department: string; title: string }>> = {
  "COL-1001": [{ department: "Computer Science & Engineering", title: "Database Management Systems" }],
  "COL-1003": [{ department: "Computer Science & Engineering", title: "Operating Systems" }],
  "COL-1002": [
    { department: "Commerce", title: "Financial Accounting" },
    { department: "Computer Science", title: "Python Programming" },
  ],
  "COL-1004": [{ department: "Finance", title: "Financial Management" }],
  "COL-1006": [{ department: "Pathology", title: "General Pathology" }],
  "COL-1007": [{ department: "Nursing", title: "Fundamentals of Nursing" }],
};

/** Creates the sample department courses once per server (memory backend; also used by Teaching Studio). */
export async function ensureCourseSeed() {
  if (seedFlag.done || getStore().kind !== "memory") return;
  seedFlag.done = true;
  for (const [collegeId, list] of Object.entries(SEEDS)) {
    const college = await getCollege(collegeId);
    const stream = await collegeStream(collegeId);
    if (!college || !stream) continue;
    for (const s of list) {
      if (!streamOptions("department", stream).includes(s.department)) continue;
      const terms = streamOptions("semester", stream);
      const { course, quiz } = await createCourse(
        { ...s, level: LEVELS[1], semester: terms[Math.min(2, terms.length - 1)]!, credits: 4, faculty: "Department faculty", mode: "title" },
        collegeId,
        stream,
        { name: "HOD (sample course)", sub: null },
        new Date(Date.now() - 12 * 86_400_000).toISOString(),
        false, // sample courses use the hand-checked templates, never the AI
      );
      quiz.questions = quiz.questions.map((q) => ({ ...q, review: false }));
      quiz.status = "Published";
      course.status = "Published";
      course.publishedAt = course.createdAt;
      await getStore().quizzes.save(quiz);
      await getStore().courses.save(course);
    }
  }
}

/* ───────────────────────────── create / publish ─────────────────────────── */
async function createCourse(
  input: { department: string; title: string; level: string; semester: string; credits: number; faculty: string; mode: "title" | "syllabus"; syllabus?: string },
  collegeId: string,
  stream: Stream,
  author: { name: string; sub: string | null },
  at = new Date().toISOString(),
  useAi = true,
): Promise<{ course: LearningCourse; quiz: Quiz }> {
  // In postgres mode the route runs the AI step before the database transaction opens (see prefetchCourseAi).
  const pre = useAi ? takePrepared(prepKey(author.sub ?? author.name, input)) : undefined;
  const aiUnits = pre ? pre.units : useAi ? await buildUnitsAi(input, stream) : null;
  const { units, curated } = aiUnits ? { units: aiUnits, curated: false } : buildUnits(input, stream);
  const id = `LC-${newId("X").slice(2)}`;
  const quizId = newId("QZ");
  const lessonCount = units.reduce((s, u) => s + u.lessons.length, 0);
  const course: LearningCourse = {
    id,
    collegeId,
    department: input.department,
    title: input.title,
    code: await courseCode(input.department, collegeId),
    level: input.level,
    semester: input.semester,
    credits: input.credits,
    faculty: input.faculty,
    source: input.mode,
    syllabus: input.mode === "syllabus" ? (input.syllabus ?? "").slice(0, 6000) : "",
    summary: `${input.title} for ${input.department} students: ${lessonCount} lessons in ${units.filter((u) => u.title !== "Getting started" && u.title !== "Course revision").length} chapters, followed by a ${FINAL_QUIZ_SIZE}-question final assessment and a mark-based certificate.${curated ? "" : aiUnits ? " Drafted by AI from the course title and syllabus — check the facts in each lesson and the assessment before publishing." : " Generated from a generic outline — review and enrich each lesson before publishing."}`,
    units,
    outcomes: outcomesFor(units, input.level, input.title),
    finalQuizId: quizId,
    status: "Draft",
    createdBy: author.name,
    createdBySub: author.sub,
    createdAt: at,
    publishedAt: null,
    courseRecordId: null,
    version: 1,
  };
  const quiz: Quiz = {
    id: quizId,
    collegeId,
    title: `${input.title} — final assessment`,
    department: input.department,
    course: input.title,
    passMark: 50,
    durationMin: 45,
    certificateEnabled: true,
    status: "Draft",
    questions: pre ? (pre.questions ?? courseQuestions(units, input.department)) : await buildQuestions(units, input.department, !useAi ? undefined : { title: input.title, department: input.department, level: input.level, streamLabel: stream }),
    courseId: id,
    createdBy: author.name,
    createdAt: at,
  };
  // The course row comes first: the final assessment references it.
  await getStore().courses.save(course);
  await getStore().quizzes.save(quiz);
  return { course, quiz };
}

/* ───────────────────────────── request schemas ──────────────────────────── */
const Text = (min: number, max: number) => z.string().trim().min(min).max(max);
const GenerateBody = z
  .object({
    department: Text(2, 80),
    title: Text(3, 100),
    level: z.enum(LEVELS),
    semester: Text(1, 30),
    credits: z.number().int().min(1).max(6),
    faculty: Text(2, 80),
    mode: z.enum(["title", "syllabus"]),
    syllabus: z.string().max(6000).optional(),
  })
  .strict();
const LessonBody = z
  .object({
    id: z.string().regex(LESSON_ID).optional(),
    title: Text(2, 120),
    minutes: z.number().int().min(5).max(180),
    objectives: z.array(Text(3, 200)).max(6),
    body: Text(20, 8000),
    keyPoints: z.array(Text(5, 300)).min(1).max(6),
    layout: z.enum(["overview", "concepts", "example", "practice", "revision"]).optional(),
    terms: z.array(z.object({ term: Text(1, 80), meaning: Text(5, 300) }).strict()).max(8).optional(),
    practice: z.array(z.object({ q: Text(5, 400), a: Text(1, 600) }).strict()).max(6).optional(),
    videos: z
      .array(z.object({ title: Text(1, 120), url: z.string().max(300).refine((u) => parseVideoUrl(u) !== null, "Use a YouTube, NPTEL or SWAYAM link") }).strict())
      .max(6)
      .optional(),
    links: z.array(z.object({ label: Text(1, 120), url: z.string().max(400).refine(isReferenceUrl, "Unsupported link") }).strict()).max(6).optional(),
    images: z.array(z.object({ ref: z.string().regex(MEDIA_REF_RE), caption: z.string().trim().max(160) }).strict()).max(6).optional(),
    figures: z.array(Figure).max(MAX_FIGURES).optional(),
  })
  .strict();
const UpdateBody = z
  .object({
    version: z.number().int().min(1),
    title: Text(3, 100),
    faculty: Text(2, 80),
    summary: Text(10, 600),
    units: z.array(z.object({ title: Text(2, 100), part: z.string().trim().max(100).optional(), lessons: z.array(LessonBody).min(1).max(15) }).strict()).min(1).max(24),
  })
  .strict();
const QuizQuestion = z
  .object({
    prompt: Text(5, 400),
    options: z.tuple([Text(1, 200), Text(1, 200), Text(1, 200), Text(1, 200)]),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().trim().max(400),
    review: z.boolean(),
  })
  .strict();
const QuizBody = z
  .object({ version: z.number().int().min(1), passMark: z.number().int().min(30).max(90), durationMin: z.number().int().min(10).max(180), questions: z.array(QuizQuestion).min(10).max(50) })
  .strict();

/* ───────────────────────────── views ────────────────────────────────────── */
/** Everything the course views need about one course, loaded once. */
interface CourseStats {
  quiz: Quiz;
  learners: string[];
  completedBy: number;
  certificates: number;
}
async function statsFor(c: LearningCourse): Promise<CourseStats> {
  const store = getStore();
  const quiz = (await store.quizzes.get(c.finalQuizId))!;
  const learners = await store.progress.learners(c.id);
  let completedBy = 0;
  for (const sub of learners) if (await courseCompleted(c.id, sub)) completedBy++;
  const certificates = (await store.certificates.list({ quizId: c.finalQuizId })).length;
  return { quiz, learners, completedBy, certificates };
}

function staffSummary(c: LearningCourse, st: CourseStats, collegeName: string) {
  const lessons = allLessons(c);
  return {
    id: c.id,
    title: c.title,
    code: c.code,
    department: c.department,
    semester: c.semester,
    status: c.status,
    source: c.source,
    units: c.units.filter((u) => !isFrame(u)).length,
    lessons: lessons.length,
    questions: st.quiz.questions.length,
    flagged: st.quiz.questions.filter((q) => q.review).length,
    learners: st.learners.length,
    completed: st.completedBy,
    certificates: st.certificates,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    publishedAt: c.publishedAt,
    collegeName,
  };
}

async function staffDetail(c: LearningCourse) {
  const st = await statsFor(c);
  const quiz = st.quiz;
  return {
    ...staffSummary(c, st, await collegeName(c.collegeId)),
    level: c.level,
    credits: c.credits,
    faculty: c.faculty,
    summary: c.summary,
    syllabus: c.syllabus,
    units: c.units,
    outcomes: c.outcomes,
    version: c.version,
    courseRecordId: c.courseRecordId,
    quiz: { id: quiz.id, passMark: quiz.passMark, durationMin: quiz.durationMin, questions: quiz.questions.map((q) => ({ ...q, review: Boolean(q.review) })) },
  };
}

async function finalState(c: LearningCourse, sub: string) {
  const store = getStore();
  const quiz = (await store.quizzes.get(c.finalQuizId))!;
  const mine = await store.attempts.list({ quizId: quiz.id, studentSub: sub });
  const cert = (await store.certificates.list({ quizId: quiz.id, studentSub: sub }))[0] ?? null;
  return {
    quizId: quiz.id,
    questions: quiz.questions.length,
    passMark: quiz.passMark,
    durationMin: quiz.durationMin,
    unlocked: await courseCompleted(c.id, sub),
    attempts: mine.length,
    attemptsLeft: Math.max(0, 3 - mine.length),
    bestPercentage: mine.length ? Math.max(...mine.map((a) => a.percentage)) : null,
    certificateId: cert?.id ?? null,
  };
}

async function studentSummary(c: LearningCourse, sub: string) {
  const lessons = allLessons(c);
  const done = (await completedLessons(sub, c.id)).length;
  return {
    id: c.id,
    title: c.title,
    code: c.code,
    department: c.department,
    semester: c.semester,
    credits: c.credits,
    faculty: c.faculty,
    summary: c.summary,
    units: c.units.filter((u) => !isFrame(u)).length,
    lessons: lessons.length,
    minutes: lessons.reduce((s, l) => s + l.minutes, 0),
    completedLessons: done,
    final: await finalState(c, sub),
  };
}

/* ───────────────────────────── dispatcher ───────────────────────────────── */
export async function dispatchCourses(method: string, segs: string[], rawBody: unknown, session: SessionPayload, query?: URLSearchParams): Promise<MockResult> {
  await ensureCourseSeed();
  const store = getStore();
  const [, id, sub1, sub2, sub3] = segs;
  const isStaff = STAFF.has(session.role);
  const isStudent = session.role === "student";
  if (!isStaff && !isStudent) return err(403, "forbidden", "Not available for your role.");
  const stream = session.college === ALL_COLLEGES ? null : await collegeStream(session.college);
  const canPublish = can(session.role, "courses:manage");
  const inScope = (c: LearningCourse) => session.college === ALL_COLLEGES || c.collegeId === session.college;
  const auditOpts = (c: LearningCourse) => ({ collegeId: c.collegeId, actorSub: session.sub });

  // ── list ──
  if (!id && method === "GET") {
    const list = (await store.courses.list(session.college)).filter(inScope).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (isStudent) return ok(await Promise.all(list.filter((c) => c.status === "Published").map((c) => studentSummary(c, session.sub))));
    const colleges = await collegeIndex();
    const items = await Promise.all(list.map(async (c) => staffSummary(c, await statsFor(c), String(colleges.get(c.collegeId)?.name ?? "Unknown college"))));
    return ok({ canPublish, stream, items });
  }

  // ── generate a new draft ──
  if (id === "generate" && method === "POST") {
    if (!isStaff) return err(403, "forbidden", "Only faculty and HODs create courses.");
    if (!stream) return err(400, "choose_college", "Switch into a college to create department courses.");
    const p = GenerateBody.safeParse(rawBody);
    if (!p.success) {
      const fields: Record<string, string> = {};
      for (const i of p.error.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
      return err(422, "validation", "Check the course details.", fields);
    }
    const d = p.data;
    if (!streamOptions("department", stream).includes(d.department)) return err(422, "validation", "Choose a department of your college.", { department: "Not a department of your college" });
    if (!streamOptions("semester", stream).includes(d.semester)) return err(422, "validation", "Choose a valid term.", { semester: "Choose a valid term" });
    if (d.mode === "syllabus") {
      const lessons = parseSyllabus(d.syllabus ?? "").reduce((s, u) => s + u.lessons.length, 0);
      if (lessons < 3) return err(422, "validation", "Paste a syllabus with at least 3 topics (one per line).", { syllabus: "At least 3 topics, one per line" });
    }
    const { course } = await createCourse({ ...d, title: cleanText(d.title, 100), faculty: cleanText(d.faculty, 80) }, session.college, stream, { name: session.name, sub: session.sub });
    await audit(session.name, "AI course generated (draft)", `${course.id} · ${course.title}`, auditOpts(course));
    return ok(await staffDetail(course), 201);
  }

  if (!id || !ID.test(id)) return err(404, "not_found", "Course not found.");
  const course = await store.courses.get(id);
  if (!course || !inScope(course) || (isStudent && course.status !== "Published")) return err(404, "not_found", "Course not found.");
  const quiz = (await store.quizzes.get(course.finalQuizId))!;

  // ── student: read + progress ──
  if (isStudent) {
    if (!sub1 && method === "GET") {
      return ok({ ...(await studentSummary(course, session.sub)), units: course.units, outcomes: course.outcomes, completed: await completedLessons(session.sub, course.id) });
    }
    if (sub1 === "lessons" && sub2 && LESSON_ID.test(sub2) && sub3 === "complete" && method === "POST") {
      const order = allLessons(course);
      const idx = order.findIndex((l) => l.id === sub2);
      if (idx < 0) return err(404, "not_found", "Lesson not found.");
      const done = new Set(await completedLessons(session.sub, course.id));
      if (order.slice(0, idx).some((l) => !done.has(l.id))) return err(409, "locked", "Finish the earlier lessons first.");
      done.add(sub2);
      await store.progress.set(session.sub, course.id, order.filter((l) => done.has(l.id)).map((l) => l.id));
      return ok({ completed: [...done].length, total: order.length, finalUnlocked: await courseCompleted(course.id, session.sub) });
    }
    return err(404, "not_found", "Not found.");
  }

  // ── staff ──
  if (!sub1 && method === "GET") return ok(await staffDetail(course));

  if (!sub1 && method === "PUT") {
    const p = UpdateBody.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "Some lessons are incomplete — every lesson needs a title, content (20+ characters) and at least one key point.");
    if (p.data.version !== course.version) return err(409, "version_conflict", "Someone else changed this course. Reload to see the latest version.");
    const total = p.data.units.reduce((s, u) => s + u.lessons.length, 0);
    if (total > 90) return err(422, "validation", "A course can have at most 90 lessons.");
    const used = new Set<string>();
    let next = Math.max(0, ...allLessons(course).map((l) => Number(l.id.slice(1)))) + 1;
    const videosBefore = allLessons(course).reduce((n, l) => n + (l.videos?.length ?? 0), 0);
    course.units = p.data.units.map((u) => ({
      title: cleanText(u.title, 100),
      ...(u.part ? { part: cleanText(u.part, 100) } : {}),
      lessons: u.lessons.map((l) => {
        const lid = l.id && !used.has(l.id) ? l.id : `L${next++}`;
        used.add(lid);
        return {
          id: lid,
          title: cleanText(l.title, 120),
          minutes: l.minutes,
          objectives: l.objectives.map((o) => cleanText(o, 200)),
          body: cleanText(l.body, 8000),
          keyPoints: l.keyPoints.map((k) => cleanText(k, 300)),
          ...(l.layout ? { layout: l.layout } : {}),
          terms: (l.terms ?? []).map((t) => ({ term: cleanText(t.term, 80), meaning: cleanText(t.meaning, 300) })),
          practice: (l.practice ?? []).map((x) => ({ q: cleanText(x.q, 400), a: cleanText(x.a, 600) })),
          videos: (l.videos ?? []).map((v) => ({ title: cleanText(v.title, 120), url: parseVideoUrl(v.url)!.url })),
          links: (l.links ?? []).map((x) => ({ label: cleanText(x.label, 120), url: x.url })),
          images: (l.images ?? []).map((i) => ({ ref: i.ref, caption: cleanText(i.caption, 160) })),
          figures: (l.figures ?? []).map((f) => mapFigureText(f, (x) => cleanText(x, 300))),
        };
      }),
    }));
    course.title = cleanText(p.data.title, 100);
    course.faculty = cleanText(p.data.faculty, 80);
    course.summary = cleanText(p.data.summary, 600);
    course.outcomes = outcomesFor(course.units, course.level, course.title);
    quiz.title = `${course.title} — final assessment`;
    quiz.course = course.title;
    course.version++;
    await store.courses.save(course);
    await store.quizzes.save(quiz);
    await audit(session.name, "Course lessons edited", course.id, auditOpts(course));
    const videosAdded = allLessons(course).reduce((n, l) => n + (l.videos?.length ?? 0), 0) - videosBefore;
    if (videosAdded > 0) await recordFacultyEvent(session.sub, "video_added", videosAdded, course.collegeId);
    return ok(await staffDetail(course));
  }

  if (sub1 === "quiz" && !sub2 && method === "PUT") {
    const p = QuizBody.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "Every question needs a prompt, four options and one correct answer (10–50 questions).");
    if (p.data.version !== course.version) return err(409, "version_conflict", "Someone else changed this course. Reload to see the latest version.");
    quiz.passMark = p.data.passMark;
    quiz.durationMin = p.data.durationMin;
    quiz.questions = p.data.questions.map((q) => ({
      prompt: cleanText(q.prompt, 400),
      options: q.options.map((o) => cleanText(o, 200)) as Question["options"],
      answer: q.answer,
      explanation: cleanText(q.explanation, 400),
      review: q.review,
    }));
    course.version++;
    await store.quizzes.save(quiz);
    await store.courses.save(course);
    await audit(session.name, "Course assessment edited", course.id, auditOpts(course));
    return ok(await staffDetail(course));
  }

  if (sub1 === "quiz" && sub2 === "regenerate" && method === "POST") {
    if (course.status !== "Draft") return err(409, "published", "Move the course back to draft first.");
    const pre = takePrepared(regenKey(session.sub ?? session.name, course.id, course.version));
    quiz.questions = pre ? (pre.questions ?? courseQuestions(course.units, course.department)) : await buildQuestions(course.units, course.department, { title: course.title, department: course.department, level: course.level, streamLabel: stream ?? course.department });
    course.version++;
    await store.quizzes.save(quiz);
    await store.courses.save(course);
    return ok(await staffDetail(course));
  }

  if (sub1 === "publish" && method === "POST") {
    if (!canPublish) return err(403, "forbidden", "Only the HOD or Principal can publish courses to students.");
    if (course.status === "Published") return ok(await staffDetail(course));
    const flagged = quiz.questions.filter((q) => q.review).length;
    if (flagged) return err(409, "needs_review", `${flagged} assessment question(s) are still marked for review.`);
    if (quiz.questions.length < 10) return err(409, "too_few_questions", "The final assessment needs at least 10 questions.");
    course.status = "Published";
    course.publishedAt = new Date().toISOString();
    quiz.status = "Published";
    if (!course.courseRecordId && stream && streamOptions("semester", stream).includes(course.semester)) {
      const rec = await createRecord(
        RESOURCES.courses!,
        {
          ...emptyValues(RESOURCES.courses!),
          code: course.code,
          title: course.title,
          department: course.department,
          semester: course.semester,
          credits: course.credits,
          courseType: "Theory",
          faculty: course.faculty,
          status: "Active",
          description: course.outcomes.map((o) => `${o.code} (${o.bloom}): ${o.text}`).join("\n").slice(0, 1500),
        },
        course.collegeId,
      );
      course.courseRecordId = rec.id;
    }
    course.version++;
    await store.courses.save(course);
    await store.quizzes.save(quiz);
    await audit(session.name, "Course published to students", `${course.id} · ${course.title}`, auditOpts(course));
    await recordFacultyEvent(session.sub, "course_published", 1, course.collegeId);
    return ok(await staffDetail(course));
  }

  if (sub1 === "unpublish" && method === "POST") {
    if (!canPublish) return err(403, "forbidden", "Only the HOD or Principal can unpublish courses.");
    course.status = "Draft";
    quiz.status = "Draft";
    course.version++;
    await store.courses.save(course);
    await store.quizzes.save(quiz);
    await audit(session.name, "Course moved back to draft", course.id, auditOpts(course));
    return ok(await staffDetail(course));
  }

  if (!sub1 && method === "DELETE") {
    if (!canPublish) return err(403, "forbidden", "Only the HOD or Principal can delete courses.");
    const force = query?.get("force") === "1";
    if (!force) {
      if (course.status !== "Draft") return err(409, "published", "Unpublish the course before deleting it.");
      const started = (await store.progress.learners(course.id)).length > 0 || (await store.attempts.list({ quizId: quiz.id })).length > 0;
      if (started) return err(409, "has_learners", "Students have started this course, so it cannot be deleted. Keep it as a draft instead.");
    }
    await store.quizzes.delete(quiz.id);
    await store.courses.delete(course.id);
    await audit(session.name, "Course deleted", course.id, auditOpts(course));
    return ok({ ok: true });
  }

  return err(404, "not_found", "Not found.");
}

export const _coursesTest = { ensureSeed: ensureCourseSeed };
