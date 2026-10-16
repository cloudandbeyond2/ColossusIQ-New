import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { streamOptions, type Stream } from "@/config/streams";
import { ALL_COLLEGES } from "@/config/tenancy";
import type { SessionPayload } from "@/lib/auth/session";
import { cleanText } from "@/lib/security/sanitize";
import { isReferenceUrl, parseVideoUrl } from "@/lib/video";
import { audit } from "./audit";
import { ensureCourseSeed } from "./course-builder";
import { COURSE_LIBRARY } from "./course-library";
import { TOPIC_EXTRA } from "./course-library-extra";
import type { CourseUnit, LearningCourse } from "./course-state";
import { eventCounts, recordFacultyEvent, type FacultyEvent } from "./faculty-activity";
import { getStore, dataBackend } from "@/lib/data";
import { db } from "@/lib/data/postgres/db";
import { memoryState } from "@/lib/data/memory";
import { collegeIndex, collegeStream } from "./records";
import type { MockResult } from "./router";

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string): MockResult => ({ status, body: { error: { code, message } } });
const STAFF = new Set(["faculty", "hod", "institution", "admin"]);
const SUMMARY_ID = /^CS-[A-F0-9]{8}$/;
const OUTLINE_ID = /^LO-[A-F0-9]{8}$/;
const COURSE_ID = /^LC-[A-F0-9]{8}$/;
const newId = (p: string) => `${p}-${randomBytes(4).toString("hex").toUpperCase()}`;

export type Illustration = "flow" | "layers" | "cycle";

export interface TeachingPack {
  source: { kind: "course" | "topic"; courseId?: string; courseTitle?: string; code?: string; chapterIndex?: number };
  topic: string;
  department: string;
  draft: boolean;
  basics: { what: string; why: string; before: string[]; bigIdea: string[] };
  keyPoints: string[];
  terms: Array<{ term: string; meaning: string }>;
  mistakes: string[];
  example: string;
  practice: Array<{ q: string; a: string }>;
  links: Array<{ label: string; url: string }>;
  videos: Array<{ title: string; url: string }>;
  illustration: Illustration;
  nextTopic: string | null;
  outline: {
    minutes: number;
    blocks: Array<{ start: number; minutes: number; title: string; teacher: string; students: string; icon: string }>;
    materials: string[];
    exitTicket: string[];
  };
  roadmap: { title: string; weeks: Array<{ week: number; title: string; items: string[]; kind: "orientation" | "teach" | "assessment" | "revision" | "final"; current?: boolean }> };
}

/* ───────────────────────────── building a pack ───────────────────────────── */
const WHY: Record<Stream, (t: string) => string> = {
  engineering: (t) => `${t} comes up in lab work, projects and technical interviews, and later topics build directly on it.`,
  medical: (t) => `${t} explains findings students will meet on the wards and in the skills lab, and it is regularly examined in university assessments.`,
  artsScience: (t) => `${t} is a building block of the syllabus: it appears in internal tests, university examinations and in the topics that follow.`,
  management: (t) => `${t} is used in real business decisions, case discussions and placement interviews.`,
  polytechnic: (t) => `${t} is used directly in workshop practice and in the jobs students will do on the shop floor.`,
};

const isFrame = (u: CourseUnit) => u.lessons.length > 0 && u.lessons.every((l) => l.layout === "overview" || l.layout === "revision");

function section(body: string, heading: string): string {
  const start = body.indexOf(`## ${heading}`);
  if (start < 0) return "";
  const rest = body.slice(start + heading.length + 3).replace(/^\n+/, "");
  const end = rest.search(/\n## /);
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}

/** Finds library material for a typed topic ("deadlock" → "Deadlocks"). */
function libraryTopic(topic: string): { title: string; facts: readonly string[] } | null {
  const t = topic.trim().toLowerCase();
  if (t.length < 4) return null;
  for (const c of COURSE_LIBRARY) for (const u of c.units) for (const l of u.lessons) {
    const k = l.title.toLowerCase();
    if (k === t || k.includes(t) || t.includes(k.replace(/\s*\(.*\)$/, ""))) return { title: l.title, facts: l.facts };
  }
  return null;
}

function scaleBlocks(minutes: number, pack: Pick<TeachingPack, "topic" | "terms" | "practice">) {
  const plan: Array<[number, string, string, string, string]> = [
    [5, "Hook", `Open with a question: “${pack.practice[0]?.q ?? `What do you already know about ${pack.topic}?`}”`, "Think for a minute, discuss in pairs, share one idea.", "interrogation"],
    [10, "Topic basics", `Explain what ${pack.topic} is in plain words${pack.terms.length ? ` and introduce the key terms: ${pack.terms.map((t) => t.term).join(", ")}` : ""}.`, "Write each key term in their own words.", "book-open-cover"],
    [10, "The big idea", "Walk through the illustration and the concept map on the smart board, one point at a time.", "Predict how each point connects to the next.", "chart-network"],
    [10, "Worked example", "Solve the example step by step; pause before each step and ask what comes next.", "Work alongside and call out the next step.", "calculator"],
    [10, "Practice", `Set the question “${pack.practice[1]?.q ?? pack.practice[0]?.q ?? `Explain ${pack.topic} with an example.`}” and circulate while students work.`, "Solve alone, then compare with a partner (think–pair–share).", "users"],
    [5, "Recap & exit ticket", "Summarise the key points, then share the class summary with students.", "Answer the exit ticket before leaving.", "list-check"],
  ];
  const scale = minutes / 50;
  let start = 0;
  const blocks = plan.map(([m, title, teacher, students, icon], i) => {
    const mins = i === plan.length - 1 ? Math.max(3, minutes - start) : Math.max(3, Math.round(m * scale));
    const b = { start, minutes: mins, title, teacher, students, icon };
    start += mins;
    return b;
  });
  return blocks;
}

function courseRoadmap(course: LearningCourse, current: number): TeachingPack["roadmap"] {
  const chapters = course.units.map((u, i) => ({ u, i })).filter(({ u }) => !isFrame(u));
  const weeks: TeachingPack["roadmap"]["weeks"] = [];
  let w = 1;
  weeks.push({ week: w++, title: "Orientation", items: ["Course map and how lessons work", "Set expectations for the final assessment"], kind: "orientation" });
  chapters.forEach(({ u, i }, n) => {
    weeks.push({ week: w++, title: u.title, items: u.lessons.map((l) => l.title.replace(`${u.title} — `, "")).map((s) => s.charAt(0).toUpperCase() + s.slice(1)), kind: "teach", current: i === current });
    if ((n + 1) % 4 === 0 && n < chapters.length - 1) weeks.push({ week: w++, title: `Class test — chapters ${n - 2}–${n + 1}`, items: ["Short quiz in the Quiz Builder", "Revisit the weakest topic"], kind: "assessment" });
  });
  weeks.push({ week: w++, title: "Revision", items: ["Revision board: every chapter at a glance", "Doubt-clearing session"], kind: "revision" });
  weeks.push({ week: w++, title: "Final assessment & certificates", items: ["30-question final assessment", "Certificates graded by marks"], kind: "final" });
  return { title: `${course.title} — ${weeks.length}-week teaching roadmap`, weeks };
}

function topicRoadmap(topic: string): TeachingPack["roadmap"] {
  return {
    title: `${topic} — 4-session teaching roadmap`,
    weeks: [
      { week: 1, title: "Session 1 · Basics", items: ["Hook question", "Plain-language explanation", "Key terms"], kind: "orientation", current: true },
      { week: 2, title: "Session 2 · Key ideas & example", items: ["Illustration on the smart board", "Worked example"], kind: "teach" },
      { week: 3, title: "Session 3 · Practice", items: ["Think–pair–share problems", "Short quiz"], kind: "assessment" },
      { week: 4, title: "Session 4 · Review", items: ["Class summary shared with students", "Doubt clearing"], kind: "revision" },
    ],
  };
}

function searchLinks(topic: string): TeachingPack["links"] {
  const q = encodeURIComponent;
  return [
    { label: `NPTEL lectures: ${topic}`, url: `https://www.youtube.com/results?search_query=${q(`NPTEL ${topic}`)}` },
    { label: `Read more: ${topic}`, url: `https://en.wikipedia.org/w/index.php?search=${q(topic)}` },
  ];
}

export function buildPack(input: { course?: LearningCourse; chapterIndex?: number; topic?: string; department: string; minutes: number }, stream: Stream): TeachingPack {
  let base: Omit<TeachingPack, "outline" | "roadmap">;
  let roadmap: TeachingPack["roadmap"];

  if (input.course && input.chapterIndex !== undefined) {
    const c = input.course;
    const unit = c.units[input.chapterIndex]!;
    const concepts = unit.lessons.find((l) => (l.layout ?? "concepts") === "concepts") ?? unit.lessons[0]!;
    const example = unit.lessons.find((l) => l.layout === "example");
    const practice = unit.lessons.find((l) => l.layout === "practice");
    const chapters = c.units.map((u, i) => ({ u, i })).filter(({ u }) => !isFrame(u));
    const pos = chapters.findIndex(({ i }) => i === input.chapterIndex);
    const prev = chapters.slice(Math.max(0, pos - 2), pos).map(({ u }) => u.title);
    const intro = section(concepts.body, "Introduction") || TOPIC_EXTRA[unit.title]?.intro || `${unit.title} is part of ${c.title}.`;
    base = {
      source: { kind: "course", courseId: c.id, courseTitle: c.title, code: c.code, chapterIndex: input.chapterIndex },
      topic: unit.title,
      department: c.department,
      draft: !TOPIC_EXTRA[unit.title],
      basics: { what: intro, why: WHY[stream](unit.title), before: prev.length ? prev : ["No earlier chapter needed — this is a starting point."], bigIdea: concepts.keyPoints.slice(0, 3) },
      keyPoints: concepts.keyPoints,
      terms: concepts.terms ?? [],
      mistakes: example?.keyPoints ?? [],
      example: example ? section(example.body, "Worked example") : "",
      practice: practice?.practice ?? [],
      links: concepts.links?.length ? concepts.links : searchLinks(unit.title),
      videos: unit.lessons.flatMap((l) => l.videos ?? []),
      illustration: (["flow", "layers", "cycle"] as const)[input.chapterIndex % 3]!,
      nextTopic: chapters[pos + 1]?.u.title ?? null,
    };
    roadmap = courseRoadmap(c, input.chapterIndex);
  } else {
    const typed = cleanText(input.topic ?? "", 100);
    const lib = libraryTopic(typed);
    const extra = lib ? TOPIC_EXTRA[lib.title] : undefined;
    const topic = lib?.title ?? typed;
    const generic = [
      `${topic}: know the definition, purpose and scope, and the key terms used with it.`,
      `The principles of ${topic} are applied step by step and each result is checked against the definition.`,
      `Most mistakes in ${topic} come from skipping assumptions — state them first.`,
    ];
    base = {
      source: { kind: "topic" },
      topic,
      department: input.department,
      draft: !extra,
      basics: {
        what: extra?.intro ?? `${topic} — add a one-paragraph, plain-language definition here, with one everyday example your students will recognise.`,
        why: WHY[stream](topic),
        before: ["Check which earlier topics your syllabus lists as prerequisites."],
        bigIdea: (lib?.facts ?? generic).slice(0, 3),
      },
      keyPoints: [...(lib?.facts ?? generic)],
      terms: extra?.terms.map(([term, meaning]) => ({ term, meaning })) ?? [],
      mistakes: extra ? [...extra.mistakes] : [`Memorising the definition of ${topic} without being able to apply it.`, "Skipping the assumptions behind each step."],
      example: extra?.example ?? `Work through one example of ${topic} from your ${input.department} syllabus here, step by step.`,
      practice: extra?.practice.map(([q, a]) => ({ q, a })) ?? [{ q: `Explain ${topic} to a first-year student in three sentences.`, a: `Define ${topic}, give one example and name one common mistake.` }],
      links: searchLinks(topic),
      videos: [],
      illustration: "flow",
      nextTopic: null,
    };
    roadmap = topicRoadmap(topic);
  }

  const outline: TeachingPack["outline"] = {
    minutes: input.minutes,
    blocks: scaleBlocks(input.minutes, base),
    materials: [
      "Smart board slides (Teaching Studio → Smart board)",
      "Infographic handout — print it or share it with the class summary",
      `${base.practice.length} practice question${base.practice.length === 1 ? "" : "s"} with model answers`,
      ...(base.videos.length ? [`${base.videos.length} lecture video${base.videos.length === 1 ? "" : "s"} pinned in the course`] : []),
    ],
    exitTicket: [base.practice.at(-1)?.q ?? `State one key point of ${base.topic} in your own words.`, "What is one thing that is still unclear?"],
  };
  return { ...base, outline, roadmap };
}

/* ───────────────────────────── stores ───────────────────────────── */
export interface SavedOutline {
  id: string;
  sub: string;
  collegeId: string;
  topic: string;
  courseTitle: string | null;
  minutes: number;
  blocks: TeachingPack["outline"]["blocks"];
  createdAt: string;
}
export interface ClassSummary {
  id: string;
  collegeId: string;
  authorSub: string;
  authorName: string;
  department: string;
  courseTitle: string | null;
  topic: string;
  title: string;
  date: string;
  points: string[];
  homework: string;
  nextClass: string;
  resources: Array<{ label: string; url: string }>;
  infographic: { what: string; keyPoints: string[]; terms: Array<{ term: string; meaning: string }>; mistakes: string[]; illustration: Illustration; question: { q: string; a: string } | null } | null;
  sharedAt: string;
  readers: string[];
}
/** Raw demo state (memory backend only) — tests inspect it directly. */
export const summaries = dataBackend() === "memory" ? memoryState.summaries : [];

/* ───────────────────────────── skill booster ───────────────────────────── */
const TASKS: Array<{ id: string; title: string; detail: string; event: FacultyEvent; target: number; points: number; module: string }> = [
  { id: "smartboard", title: "Teach a class on the smart board", detail: "Teaching Studio → Smart board: present a topic and annotate live.", event: "smartboard_session", target: 1, points: 20, module: "teaching-studio" },
  { id: "outline", title: "Save a lesson outline", detail: "Plan a class with the timed lesson outline and save it.", event: "outline_saved", target: 1, points: 10, module: "teaching-studio" },
  { id: "summaries", title: "Share 3 class summaries with students", detail: "After class, share what was covered, homework and resources.", event: "summary_shared", target: 3, points: 30, module: "teaching-studio" },
  { id: "infographic", title: "Share an infographic lesson", detail: "Attach the one-page infographic to a class summary.", event: "infographic_shared", target: 1, points: 15, module: "teaching-studio" },
  { id: "video", title: "Pin a lecture video to a course lesson", detail: "AI Course Studio → Lessons → Videos.", event: "video_added", target: 1, points: 15, module: "ai-course-studio" },
  { id: "quiz", title: "Publish a quiz for your class", detail: "AI Quiz Builder: generate, review and publish.", event: "quiz_published", target: 1, points: 15, module: "quiz-builder" },
];

const TRACKS: Array<{ id: string; title: string; minutes: number; steps: Array<{ id: string; title: string; body: string }> }> = [
  {
    id: "active-learning",
    title: "Active learning in a 50-minute class",
    minutes: 20,
    steps: [
      { id: "a1", title: "Open with a question", body: "Start with a question students can attempt before you explain anything. It wakes up what they already know and shows you where the class stands." },
      { id: "a2", title: "Teach in 10-minute chunks", body: "Attention drops after about ten minutes of listening. Break the explanation with a quick task: predict the next step, vote on an option, or explain it to a neighbour." },
      { id: "a3", title: "Think–pair–share", body: "One minute to think alone, two to discuss in pairs, then a few pairs share. Every student answers — not just the confident few." },
      { id: "a4", title: "Close with an exit ticket", body: "One or two short questions at the end tell you what landed and what to revisit in the next class." },
    ],
  },
  {
    id: "visual-teaching",
    title: "Teaching with visuals and the smart board",
    minutes: 15,
    steps: [
      { id: "v1", title: "One idea per slide", body: "A slide that carries one idea keeps attention on what you are saying, not on reading text." },
      { id: "v2", title: "Draw while you explain", body: "Annotating live slows you to the students' pace and shows the reasoning, not just the result." },
      { id: "v3", title: "Show the whole idea in one picture", body: "A single illustration of how the parts connect helps students hold the topic in memory." },
      { id: "v4", title: "Hand the picture over", body: "Share the infographic after class so students revise from the same visual you taught with." },
    ],
  },
  {
    id: "good-mcqs",
    title: "Writing good multiple-choice questions",
    minutes: 15,
    steps: [
      { id: "m1", title: "Test one idea per question", body: "A question that mixes two ideas cannot tell you which one the student misunderstood." },
      { id: "m2", title: "Make every wrong option plausible", body: "Distractors should come from real misconceptions — the mistakes you see in answer scripts." },
      { id: "m3", title: "Avoid “all of the above”", body: "It rewards partial knowledge and lets students guess from two options." },
      { id: "m4", title: "Spread the correct answers", body: "Vary the position of the right option; the Quiz Builder shuffles options for you." },
    ],
  },
  {
    id: "ai-responsibly",
    title: "Using AI responsibly in teaching",
    minutes: 15,
    steps: [
      { id: "r1", title: "Treat AI output as a draft", body: "Read and correct every generated lesson, question and summary before students see it." },
      { id: "r2", title: "Keep people in charge of marks", body: "AI suggestions can speed up evaluation, but the final mark is yours, and every override is audit-logged." },
      { id: "r3", title: "Protect student data", body: "Never paste names, roll numbers or marks into outside AI tools; use the platform, which keeps data inside your college." },
      { id: "r4", title: "Tell students how AI is used", body: "Say which materials were AI-assisted and how you reviewed them. It builds trust and models good practice." },
    ],
  },
];

const LEVELS = [
  { name: "Explorer", min: 0 },
  { name: "Practitioner", min: 60 },
  { name: "Mentor", min: 140 },
  { name: "Champion", min: 220 },
];

async function booster(sub: string) {
  const done = await getStore().booster.steps(sub);
  const counts = await eventCounts(sub);
  const tasks = TASKS.map((t) => {
    const count = counts[t.event] ?? 0;
    const complete = count >= t.target;
    return { ...t, count: Math.min(count, t.target), complete, earned: complete ? t.points : 0 };
  });
  const tracks = TRACKS.map((t) => ({ ...t, steps: t.steps.map((s) => ({ ...s, done: done.has(`${t.id}:${s.id}`) })) }));
  const points = tasks.reduce((s, t) => s + t.earned, 0) + tracks.reduce((s, t) => s + t.steps.filter((x) => x.done).length * 5, 0);
  const levelIndex = LEVELS.reduce((idx, l, i) => (points >= l.min ? i : idx), 0);
  const nextLevel = LEVELS[levelIndex + 1] ?? null;
  const badges = [
    { id: "board", title: "Smart board starter", earned: tasks.find((t) => t.id === "smartboard")!.complete, icon: "chalkboard-user" },
    { id: "sharer", title: "Class sharer", earned: tasks.find((t) => t.id === "summaries")!.complete, icon: "share" },
    { id: "visual", title: "Visual teacher", earned: tasks.find((t) => t.id === "infographic")!.complete && tracks.find((t) => t.id === "visual-teaching")!.steps.every((s) => s.done), icon: "picture" },
    { id: "assessor", title: "Fair assessor", earned: tasks.find((t) => t.id === "quiz")!.complete && tracks.find((t) => t.id === "good-mcqs")!.steps.every((s) => s.done), icon: "test" },
    { id: "ai", title: "Responsible AI user", earned: tracks.find((t) => t.id === "ai-responsibly")!.steps.every((s) => s.done), icon: "shield-check" },
  ];
  return {
    points,
    level: LEVELS[levelIndex]!.name,
    levels: LEVELS.map((l, i) => ({ ...l, reached: i <= levelIndex })),
    nextLevel: nextLevel ? { name: nextLevel.name, needs: nextLevel.min - points } : null,
    tasks,
    tracks,
    badges,
  };
}

/* ───────────────────────────── request schemas ───────────────────────────── */
const PackBody = z
  .object({
    courseId: z.string().regex(COURSE_ID).optional(),
    chapterIndex: z.number().int().min(0).max(40).optional(),
    topic: z.string().trim().min(3).max(100).optional(),
    department: z.string().max(80).optional(),
    minutes: z.number().int().min(30).max(180),
  })
  .strict()
  .refine((b) => (b.courseId && b.chapterIndex !== undefined) || b.topic, "Choose a chapter or type a topic");
const Link = z.object({ label: z.string().trim().min(1).max(120), url: z.string().max(400).refine((u) => isReferenceUrl(u) || parseVideoUrl(u) !== null, "Unsupported link") }).strict();
const SummaryBody = z
  .object({
    title: z.string().trim().min(3).max(140),
    topic: z.string().trim().min(2).max(120),
    department: z.string().max(80),
    courseTitle: z.string().trim().max(120).nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    points: z.array(z.string().trim().min(3).max(300)).min(1).max(10),
    homework: z.string().trim().max(600),
    nextClass: z.string().trim().max(200),
    resources: z.array(Link).max(8),
    infographic: z
      .object({
        what: z.string().trim().max(800),
        keyPoints: z.array(z.string().trim().min(3).max(300)).max(6),
        terms: z.array(z.object({ term: z.string().trim().min(1).max(80), meaning: z.string().trim().min(3).max(300) }).strict()).max(6),
        mistakes: z.array(z.string().trim().min(3).max(300)).max(4),
        illustration: z.enum(["flow", "layers", "cycle"]),
        question: z.object({ q: z.string().trim().min(3).max(400), a: z.string().trim().min(1).max(600) }).strict().nullable(),
      })
      .passthrough()
      .nullable(),
  })
  .strict();
const OutlineBody = z
  .object({
    topic: z.string().trim().min(2).max(120),
    courseTitle: z.string().trim().max(120).nullable(),
    minutes: z.number().int().min(30).max(180),
    blocks: z
      .array(z.object({ start: z.number().int().min(0).max(180), minutes: z.number().int().min(1).max(180), title: z.string().trim().min(2).max(80), teacher: z.string().trim().max(400), students: z.string().trim().max(400), icon: z.string().regex(/^[a-z-]{2,30}$/) }).strict())
      .min(1)
      .max(12),
  })
  .strict();

/** A summary without who read it or the author's account id. */
function publicSummary(s: ClassSummary) {
  const { id, collegeId, authorName, department, courseTitle, topic, title, date, points, homework, nextClass, resources, infographic, sharedAt } = s;
  return { id, collegeId, authorName, department, courseTitle, topic, title, date, points, homework, nextClass, resources, infographic, sharedAt };
}

/* ───────────────────────────── dispatcher ───────────────────────────── */
export async function dispatchTeaching(method: string, segs: string[], rawBody: unknown, session: SessionPayload): Promise<MockResult> {
  const store = getStore();
  const [, area, id, action] = segs;
  const isStaff = STAFF.has(session.role);
  const isStudent = session.role === "student";
  const inCollege = session.college !== ALL_COLLEGES;
  const stream = inCollege ? await collegeStream(session.college) : null;
  const auditOpts = { collegeId: inCollege ? session.college : null, actorSub: session.sub };

  /* class summaries — staff share, students read */
  if (area === "summaries") {
    if (!id && method === "GET") {
      const inScope = (await store.summaries.list(session.college)).sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
      if (isStudent) return ok(inScope.map((s) => ({ ...publicSummary(s), read: s.readers.includes(session.sub) })));
      if (!isStaff) return err(403, "forbidden", "Not available for your role.");
      const mine = session.role === "faculty" ? inScope.filter((s) => s.authorSub === session.sub) : inScope;
      const colleges = await collegeIndex();
      return ok(mine.map((s) => ({ ...publicSummary(s), readCount: s.readers.length, collegeName: String(colleges.get(s.collegeId)?.name ?? "Unknown college") })));
    }
    if (!id && method === "POST") {
      if (!isStaff) return err(403, "forbidden", "Only faculty can share class summaries.");
      if (!inCollege || !stream) return err(400, "choose_college", "Switch into a college first.");
      const p = SummaryBody.safeParse(rawBody);
      if (!p.success) return err(422, "validation", "Check the summary — every key point needs text, and links must be YouTube, NPTEL, SWAYAM or reference pages.");
      if (!streamOptions("department", stream).includes(p.data.department)) return err(422, "validation", "Choose a department of your college.");
      const d = p.data;
      const c = (s: string, n: number) => cleanText(s, n);
      const summary: ClassSummary = {
        id: newId("CS"),
        collegeId: session.college,
        authorSub: session.sub,
        authorName: session.name,
        department: d.department,
        courseTitle: d.courseTitle ? c(d.courseTitle, 120) : null,
        topic: c(d.topic, 120),
        title: c(d.title, 140),
        date: d.date,
        points: d.points.map((x) => c(x, 300)),
        homework: c(d.homework, 600),
        nextClass: c(d.nextClass, 200),
        resources: d.resources.map((r) => ({ label: c(r.label, 120), url: parseVideoUrl(r.url)?.url ?? r.url })),
        infographic: d.infographic
          ? {
              what: c(d.infographic.what, 800),
              keyPoints: d.infographic.keyPoints.map((x) => c(x, 300)),
              terms: d.infographic.terms.map((t) => ({ term: c(t.term, 80), meaning: c(t.meaning, 300) })),
              mistakes: d.infographic.mistakes.map((x) => c(x, 300)),
              illustration: d.infographic.illustration,
              question: d.infographic.question ? { q: c(d.infographic.question.q, 400), a: c(d.infographic.question.a, 600) } : null,
            }
          : null,
        sharedAt: new Date().toISOString(),
        readers: [],
      };
      await store.summaries.add(summary);
      await recordFacultyEvent(session.sub, "summary_shared", 1, summary.collegeId);
      if (summary.infographic) await recordFacultyEvent(session.sub, "infographic_shared", 1, summary.collegeId);
      await audit(session.name, "Class summary shared with students", `${summary.id} · ${summary.title}`, auditOpts);
      return ok({ id: summary.id }, 201);
    }
    if (!id || !SUMMARY_ID.test(id)) return err(404, "not_found", "Summary not found.");
    const s = await store.summaries.get(id);
    if (!s || (session.college !== ALL_COLLEGES && s.collegeId !== session.college)) return err(404, "not_found", "Summary not found.");
    if (action === "read" && method === "POST") {
      if (!isStudent) return err(403, "forbidden", "Students only.");
      await store.summaries.markRead(id, session.sub);
      return ok({ ok: true });
    }
    if (!action && method === "DELETE") {
      const may = s.authorSub === session.sub || session.role === "hod" || session.role === "institution" || session.role === "admin";
      if (!may) return err(403, "forbidden", "Only the author or the HOD can withdraw this summary.");
      await store.summaries.withdraw(id);
      await audit(session.name, "Class summary withdrawn", id, auditOpts);
      return ok({ ok: true });
    }
    return err(404, "not_found", "Not found.");
  }

  if (!isStaff) return err(403, "forbidden", "Teaching tools are for faculty.");

  if (area === "sources" && method === "GET") {
    await ensureCourseSeed();
    if (!stream) return ok({ stream: null, departments: [], courses: [] });
    const courses = (await store.courses.list(session.college))
      .filter((c) => c.collegeId === session.college)
      .map((c) => ({ id: c.id, title: c.title, code: c.code, department: c.department, status: c.status, chapters: c.units.map((u, i) => ({ index: i, title: u.title, part: u.part ?? null, frame: isFrame(u) })).filter((x) => !x.frame) }));
    return ok({ stream, departments: streamOptions("department", stream), courses });
  }

  if (area === "pack" && method === "POST") {
    if (!stream) return err(400, "choose_college", "Switch into a college first.");
    const p = PackBody.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "Choose a chapter or type a topic (3–100 characters) and a class length of 30–180 minutes.");
    const d = p.data;
    if (d.courseId) {
      const course = await store.courses.get(d.courseId);
      if (!course || course.collegeId !== session.college) return err(404, "not_found", "Course not found.");
      const unit = course.units[d.chapterIndex!];
      if (!unit || isFrame(unit)) return err(422, "validation", "Choose a chapter of this course.");
      return ok(buildPack({ course, chapterIndex: d.chapterIndex, department: course.department, minutes: d.minutes }, stream));
    }
    const department = d.department && streamOptions("department", stream).includes(d.department) ? d.department : streamOptions("department", stream)[0]!;
    return ok(buildPack({ topic: d.topic, department, minutes: d.minutes }, stream));
  }

  if (area === "outlines") {
    if (!id && method === "GET") return ok((await store.outlines.list(session.sub)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    if (!id && method === "POST") {
      const p = OutlineBody.safeParse(rawBody);
      if (!p.success) return err(422, "validation", "Every block needs a title and minutes.");
      const o: SavedOutline = {
        id: newId("LO"),
        sub: session.sub,
        collegeId: session.college,
        topic: cleanText(p.data.topic, 120),
        courseTitle: p.data.courseTitle ? cleanText(p.data.courseTitle, 120) : null,
        minutes: p.data.minutes,
        blocks: p.data.blocks.map((b) => ({ ...b, title: cleanText(b.title, 80), teacher: cleanText(b.teacher, 400), students: cleanText(b.students, 400) })),
        createdAt: new Date().toISOString(),
      };
      await store.outlines.add(o);
      await recordFacultyEvent(session.sub, "outline_saved", 1, inCollege ? session.college : null);
      return ok(o, 201);
    }
    if (id && OUTLINE_ID.test(id) && method === "DELETE") {
      const o = await store.outlines.get(id);
      if (!o || o.sub !== session.sub) return err(404, "not_found", "Outline not found.");
      await store.outlines.delete(id);
      return ok({ ok: true });
    }
    return err(404, "not_found", "Not found.");
  }

  if (area === "events") {
    if (method === "POST") {
      const p = z
        .object({
          kind: z.literal("smartboard_session"),
        })
        .strict()
        .safeParse(rawBody);
      if (!p.success) return err(422, "validation", "Unknown event.");
      await recordFacultyEvent(session.sub, p.data.kind, 1, inCollege ? session.college : null);
      return ok({ ok: true, kind: p.data.kind });
    }
    if (method === "DELETE") {
      const kind = id as FacultyEvent;
      // Note: faculty_activity_events is an append-only audit ledger in PostgreSQL (protected by trigger).
      return ok({ ok: true, kind, immutable: true });
    }
  }

  if (area === "booster") {
    if (!id && method === "GET") return ok(await booster(session.sub));
    if (id === "steps" && method === "POST") {
      const p = z.object({ track: z.string().max(40), step: z.string().max(10), done: z.boolean() }).strict().safeParse(rawBody);
      if (!p.success) return err(422, "validation", "Invalid step.");
      const track = TRACKS.find((t) => t.id === p.data.track);
      if (!track || !track.steps.some((s) => s.id === p.data.step)) return err(404, "not_found", "Step not found.");
      await store.booster.setStep(session.sub, `${track.id}:${p.data.step}`, p.data.done);
      return ok(await booster(session.sub));
    }
  }

  return err(404, "not_found", "Not found.");
}

export const _teachingTest = { TASKS, TRACKS };
