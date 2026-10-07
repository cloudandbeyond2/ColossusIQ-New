import { z } from "zod";

/*
 * Shared by the browser and the server: the Competitive Exam Prep Hub (Indian competitive, eligibility and entrance
 * exams) and the staff Current Affairs Desk. Answer keys never appear in a student-facing shape.
 */

/* ───────────────────────────── exams ───────────────────────────── */
export const EXAM_GROUPS = ["central", "state", "banking", "railways", "defence", "teaching", "ug-entrance", "pg-entrance"] as const;
export const ExamGroup = z.enum(EXAM_GROUPS);
export type ExamGroup = z.infer<typeof ExamGroup>;
export const GROUP_LABEL: Record<ExamGroup, string> = {
  central: "Central government jobs",
  state: "Tamil Nadu government jobs",
  banking: "Banking & insurance",
  railways: "Railways",
  defence: "Defence",
  teaching: "Teaching & eligibility tests",
  "ug-entrance": "UG entrance (after 12th)",
  "pg-entrance": "PG entrance (after a degree)",
};

export const ELIGIBILITY = ["eligible", "eligible-final-year", "not-yet", "check-notification"] as const;
export const Eligibility = z.enum(ELIGIBILITY);
export type Eligibility = z.infer<typeof Eligibility>;

export const ExamCard = z.object({
  id: z.string(),
  name: z.string(),
  fullName: z.string(),
  conductedBy: z.string(),
  group: ExamGroup,
  /** Minimum qualification in plain words, e.g. "Graduate (final-year students may apply)". */
  qualification: z.string(),
  summary: z.string(),
  officialSite: z.string().nullable(),
  totalQuestions: z.number(),
  durationMin: z.number(),
  negativeMarking: z.boolean(),
  /** False for admissions decided on marks alone (no test to practise). */
  hasTest: z.boolean(),
  eligibility: Eligibility,
  eligibilityNote: z.string(),
  isTarget: z.boolean(),
});
export type ExamCard = z.infer<typeof ExamCard>;

export const ExamSectionDetail = z.object({
  name: z.string(),
  questions: z.number(),
  marks: z.number(),
  negative: z.number(),
  topics: z.array(z.object({ id: z.string(), title: z.string() })),
});
export const ExamDetail = ExamCard.extend({
  sections: z.array(ExamSectionDetail),
  ageNote: z.string(),
  patternNote: z.string(),
  mock: z.object({ questions: z.number(), minutes: z.number(), scaled: z.boolean(), full: z.object({ questions: z.number(), minutes: z.number() }) }).nullable(),
});
export type ExamDetail = z.infer<typeof ExamDetail>;

export const Catalogue = z.object({
  groups: z.array(z.object({ id: ExamGroup, label: z.string() })),
  exams: z.array(ExamCard),
  disclaimer: z.string(),
});
export type Catalogue = z.infer<typeof Catalogue>;

/* ───────────────────────────── targets & plan ───────────────────────────── */
export const MAX_TARGETS = 3;
const IsoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-02-14");
export const Target = z.object({ examId: z.string().regex(/^[a-z0-9-]{2,40}$/), date: IsoDay.nullable() }).strict();
export type Target = z.infer<typeof Target>;
export const TargetBody = z.object({ targets: z.array(Target).max(MAX_TARGETS, `Pick up to ${MAX_TARGETS} exams`) }).strict();

export const TaskTab = z.enum(["daily", "practice", "mocks", "current-affairs", "english", "catalogue"]);
export type TaskTab = z.infer<typeof TaskTab>;

export const PrepOverview = z.object({
  profile: z.object({ name: z.string(), degree: z.string(), year: z.string() }),
  targets: z.array(
    z.object({
      examId: z.string(),
      name: z.string(),
      date: z.string().nullable(),
      daysLeft: z.number().nullable(),
      eligibility: Eligibility,
      eligibilityNote: z.string(),
      /** Practice-based estimate 0–100; null until the student has practised this exam's sections. */
      readiness: z.number().nullable(),
      sections: z.array(z.object({ name: z.string(), accuracy: z.number().nullable(), answered: z.number() })),
    })
  ),
  tasks: z.array(z.object({ id: z.string(), title: z.string(), detail: z.string(), done: z.boolean(), tab: TaskTab, topicId: z.string().nullable() })),
  streak: z.object({ current: z.number(), longest: z.number() }),
  week: z.array(z.object({ day: z.string(), label: z.string(), daily: z.boolean(), rounds: z.number() })),
  weakTopics: z.array(z.object({ id: z.string(), title: z.string(), accuracy: z.number(), answered: z.number() })),
  totals: z.object({ dailyTests: z.number(), mocks: z.number(), rounds: z.number(), answered: z.number(), accuracy: z.number().nullable() }),
  plan: z.array(z.object({ day: z.string(), label: z.string(), focus: z.string() })),
});
export type PrepOverview = z.infer<typeof PrepOverview>;

/* ───────────────────────────── topics ───────────────────────────── */
export const TOPIC_FAMILIES = ["Quantitative aptitude", "Reasoning", "English", "General awareness", "Subjects", "College topics"] as const;
export const TopicFamily = z.enum(TOPIC_FAMILIES);
export const TopicList = z.object({
  families: z.array(z.object({ family: TopicFamily, topics: z.array(z.object({ id: z.string(), title: z.string(), items: z.string(), answered: z.number(), accuracy: z.number().nullable() })) })),
});
export type TopicList = z.infer<typeof TopicList>;
export const PracticeBody = z.object({ topicId: z.string().regex(/^[a-z0-9-]{2,40}$/) }).strict();

export const ENGLISH_KINDS = ["vocabulary", "synonyms", "antonyms", "idioms", "one-word", "error-spotting", "fill-blanks", "sentence-improvement"] as const;
export const EnglishKind = z.enum(ENGLISH_KINDS);
export type EnglishKind = z.infer<typeof EnglishKind>;
export const EnglishBody = z.object({ kind: EnglishKind }).strict();
export const EnglishHome = z.object({
  word: z.object({ word: z.string(), meaning: z.string(), synonym: z.string().nullable(), antonym: z.string().nullable() }),
  kinds: z.array(z.object({ id: EnglishKind, title: z.string(), description: z.string(), answered: z.number(), accuracy: z.number().nullable() })),
});
export type EnglishHome = z.infer<typeof EnglishHome>;

/* ───────────────────────────── rounds (daily, practice, English, mock, weekly quiz) ───────────────────────────── */
export const ROUND_KINDS = ["daily", "practice", "english", "mock", "ca-quiz"] as const;
export const RoundKind = z.enum(ROUND_KINDS);
export type RoundKind = z.infer<typeof RoundKind>;

export const RoundSection = z.object({ name: z.string(), from: z.number(), to: z.number(), marks: z.number(), negative: z.number() });
export const Round = z.object({
  id: z.string(),
  kind: RoundKind,
  title: z.string(),
  /** Time for the whole round. */
  durationSec: z.number(),
  questions: z.array(z.object({ id: z.string(), prompt: z.string(), options: z.array(z.string()) })),
  sections: z.array(RoundSection).nullable(),
  note: z.string(),
});
export type Round = z.infer<typeof Round>;

export const SubmitBody = z.object({ answers: z.record(z.string().regex(/^q\d{1,3}$/), z.number().int().min(0).max(3).nullable()) }).strict();

export const RoundResult = z.object({
  kind: RoundKind,
  title: z.string(),
  score: z.number(),
  max: z.number(),
  correct: z.number(),
  wrong: z.number(),
  skipped: z.number(),
  percentage: z.number(),
  seconds: z.number(),
  timedOut: z.boolean(),
  sections: z
    .array(z.object({ name: z.string(), score: z.number(), max: z.number(), correct: z.number(), wrong: z.number(), skipped: z.number(), accuracy: z.number().nullable() }))
    .nullable(),
  /** Share of college peers' attempts at the same test scoring lower; null below the privacy threshold. */
  percentile: z.number().nullable(),
  peers: z.number(),
  review: z.array(z.object({ id: z.string(), prompt: z.string(), options: z.array(z.string()), given: z.number().nullable(), answer: z.number(), correct: z.boolean(), explanation: z.string(), section: z.string().nullable() })),
  xp: z.number(),
});
export type RoundResult = z.infer<typeof RoundResult>;

export const DailyStatus = z.object({
  date: z.string(),
  done: z.boolean(),
  questions: z.number(),
  minutes: z.number(),
  last: z.object({ score: z.number(), max: z.number(), percentage: z.number(), percentile: z.number().nullable() }).nullable(),
  streak: z.object({ current: z.number(), longest: z.number() }),
  history: z.array(z.object({ day: z.string(), label: z.string(), percentage: z.number().nullable() })),
});
export type DailyStatus = z.infer<typeof DailyStatus>;

export const MockList = z.object({
  mocks: z.array(
    z.object({
      examId: z.string(),
      name: z.string(),
      group: ExamGroup,
      questions: z.number(),
      minutes: z.number(),
      negative: z.boolean(),
      scaled: z.boolean(),
      /** The full-length mock: the real paper's size and time (capped at MAX_FULL_QUESTIONS). */
      full: z.object({ questions: z.number(), minutes: z.number() }),
      isTarget: z.boolean(),
      attempts: z.number(),
      best: z.number().nullable(),
    })
  ),
  history: z.array(z.object({ at: z.string(), examId: z.string(), name: z.string(), score: z.number(), max: z.number(), percentage: z.number() })),
});
export type MockList = z.infer<typeof MockList>;

/* ───────────────────────────── current affairs ───────────────────────────── */
export const CA_CATEGORIES = ["National", "Tamil Nadu", "International", "Economy", "Science & Tech", "Environment", "Sports", "Awards", "Schemes", "Appointments"] as const;
export const CaCategory = z.enum(CA_CATEGORIES);
export type CaCategory = z.infer<typeof CaCategory>;

/** News and government sites a source link may point to (https only). */
export const SOURCE_HOSTS = [
  "pib.gov.in",
  "gov.in",
  "nic.in",
  "rbi.org.in",
  "isro.gov.in",
  "prsindia.org",
  "thehindu.com",
  "indianexpress.com",
  "hindustantimes.com",
  "livemint.com",
  "business-standard.com",
  "dtnext.in",
  "newsonair.gov.in",
  "ddnews.gov.in",
  "un.org",
  "who.int",
  "worldbank.org",
  "imf.org",
] as const;

export function isAllowedSource(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
  const host = u.hostname.toLowerCase();
  return SOURCE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

const CaMcqBody = z
  .object({
    question: z.string().trim().min(10, "Write the question").max(300),
    options: z.array(z.string().trim().min(1, "Fill in every option").max(120)).length(4),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().trim().max(300).default(""),
  })
  .strict()
  .refine((m) => new Set(m.options.map((o) => o.toLowerCase())).size === 4, { message: "The four options must be different", path: ["options"] });

export const CaBody = z
  .object({
    date: IsoDay,
    category: CaCategory,
    headline: z.string().trim().min(10, "Write a headline of at least 10 characters").max(140),
    summary: z.string().trim().min(20, "Write a summary of at least 20 characters").max(600),
    sourceName: z.string().trim().max(80).default(""),
    sourceUrl: z
      .string()
      .trim()
      .max(300)
      .default("")
      .refine((v) => v === "" || isAllowedSource(v), { message: "Use an https link from a government or listed news site" }),
    tags: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).max(8).default([]),
    status: z.enum(["Draft", "Published"]),
    mcq: CaMcqBody.nullable().default(null),
  })
  .strict();
export type CaBody = z.infer<typeof CaBody>;

export const CaItem = z.object({
  id: z.string(),
  date: z.string(),
  category: CaCategory,
  headline: z.string(),
  summary: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  tags: z.array(z.string()),
  status: z.enum(["Draft", "Published"]),
  /** Students see the question and options only; staff also see the answer. */
  mcq: z.object({ question: z.string(), options: z.array(z.string()), answer: z.number().nullable(), explanation: z.string() }).nullable(),
  author: z.string(),
  updatedAt: z.string(),
});
export type CaItem = z.infer<typeof CaItem>;

export const CaFeed = z.object({
  items: z.array(CaItem),
  canEdit: z.boolean(),
  weekly: z.object({ week: z.string(), questions: z.number(), done: z.boolean(), last: z.number().nullable() }),
  exams: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type CaFeed = z.infer<typeof CaFeed>;

/* ───────────────────────────── saved per-student state ───────────────────────────── */
const TopicStat = z.object({ answered: z.number().int().min(0), correct: z.number().int().min(0), rounds: z.number().int().min(0), last: z.string() });
export const StoredPrep = z.object({
  targets: z.array(Target).max(MAX_TARGETS),
  topics: z.record(z.string(), TopicStat),
  english: z.record(z.string(), TopicStat),
  /** Topic id → the India-time day the student marked its notes as studied. */
  studied: z.record(z.string(), z.string()).default({}),
  /** India-time day → what was done that day (the last five weeks). */
  days: z.record(z.string(), z.object({ daily: z.number().nullable(), rounds: z.number().int().min(0) })),
  pending: z
    .object({
      id: z.string(),
      kind: RoundKind,
      title: z.string(),
      examId: z.string().nullable(),
      ref: z.string().nullable(),
      startedAt: z.number(),
      durationSec: z.number(),
      sections: z.array(RoundSection).nullable(),
      questions: z.array(
        z.object({ prompt: z.string(), options: z.array(z.string()).length(4), answer: z.number().int().min(0).max(3), explanation: z.string(), topic: z.string().nullable() })
      ),
    })
    .nullable(),
  updatedAt: z.string(),
});
export type StoredPrep = z.infer<typeof StoredPrep>;

/* ───────────────────────────── mocks: length ───────────────────────────── */
export const MAX_FULL_QUESTIONS = 200;
export const MockStartBody = z.object({ length: z.enum(["short", "full"]).default("short") }).strict();

/* ───────────────────────────── study notes & syllabus ───────────────────────────── */
const line = (max: number) => z.string().trim().min(1).max(max);
/** The content of a topic's study notes (shared by faculty notes, AI notes and built-in notes). */
export const NoteContent = z.object({
  summary: z.string().trim().min(20, "Write a short overview (at least 20 characters)").max(1200),
  keyPoints: z.array(line(300)).min(1, "Add at least one key point").max(15),
  formulas: z.array(line(200)).max(10).default([]),
  example: z.object({ problem: line(600), solution: line(1200) }).nullable().default(null),
  mistakes: z.array(line(300)).max(8).default([]),
  tips: z.array(line(300)).max(8).default([]),
});
export type NoteContent = z.infer<typeof NoteContent>;

export const NOTE_SOURCES = ["faculty", "ai", "built-in"] as const;
export const NoteSource = z.enum(NOTE_SOURCES);
export type NoteSource = z.infer<typeof NoteSource>;
export const TopicNotes = NoteContent.extend({
  topicId: z.string(),
  title: z.string(),
  family: z.string(),
  source: NoteSource,
  /** Who wrote or reviewed it (faculty notes only). */
  author: z.string(),
  updatedAt: z.string().nullable(),
  studied: z.boolean(),
  answered: z.number(),
  accuracy: z.number().nullable(),
});
export type TopicNotes = z.infer<typeof TopicNotes>;

export const TOPIC_STATUSES = ["not-started", "studied", "practised", "strong"] as const;
export const TopicStatus = z.enum(TOPIC_STATUSES);
export type TopicStatus = z.infer<typeof TopicStatus>;
export const Syllabus = z.object({
  examId: z.string(),
  name: z.string(),
  /** Percent of topics studied or practised, and percent at "strong". */
  coverage: z.number(),
  mastery: z.number(),
  counts: z.object({ "not-started": z.number(), studied: z.number(), practised: z.number(), strong: z.number() }),
  sections: z.array(
    z.object({
      name: z.string(),
      questions: z.number(),
      topics: z.array(z.object({ id: z.string(), title: z.string(), status: TopicStatus, answered: z.number(), accuracy: z.number().nullable(), notes: NoteSource, custom: z.boolean() })),
    })
  ),
  exams: z.array(z.object({ id: z.string(), name: z.string(), isTarget: z.boolean() })),
});
export type Syllabus = z.infer<typeof Syllabus>;

/* ───────────────────────────── Exam Prep Studio (staff content) ───────────────────────────── */
export const MAX_SET_QUESTIONS = 100;
export const SetQuestion = z
  .object({
    prompt: z.string().trim().min(8, "Write the question").max(600),
    options: z.array(z.string().trim().min(1, "Fill in every option").max(300)).length(4),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().trim().max(600).default(""),
  })
  .strict()
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === 4, { message: "The four options must be different", path: ["options"] });
export type SetQuestion = z.infer<typeof SetQuestion>;

const TopicRef = z.string().regex(/^[a-z0-9-]{2,60}$/);
const ContentStatus = z.enum(["Draft", "Published"]);

export const SetBody = z
  .object({
    title: z.string().trim().min(4, "Give the set a title").max(120),
    /** An existing topic id, or null with newTopic to add a college topic to the syllabus. */
    topicId: TopicRef.nullable(),
    newTopic: z.string().trim().max(80).default(""),
    examIds: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).max(10).default([]),
    /** The exam section a new topic belongs to, so it appears in that exam's syllabus and mocks. */
    section: z.string().trim().max(120).default(""),
    status: ContentStatus,
    questions: z.array(SetQuestion).min(1, "Add at least one question").max(MAX_SET_QUESTIONS),
  })
  .strict()
  .refine((b) => b.topicId !== null || b.newTopic.length >= 3, { message: "Pick a topic or name a new one", path: ["topicId"] });
export type SetBody = z.infer<typeof SetBody>;

export const NoteBody = NoteContent.extend({ topicId: TopicRef, status: ContentStatus }).strict();
export type NoteBody = z.infer<typeof NoteBody>;

export const GenerateBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("questions"), topicId: TopicRef.nullable().default(null), topicTitle: z.string().trim().max(80).default(""), count: z.number().int().min(3).max(20).default(10) }).strict(),
  z.object({ kind: z.literal("notes"), topicId: TopicRef }).strict(),
]);
export type GenerateBody = z.infer<typeof GenerateBody>;

const PlainQuestion = z.object({ prompt: z.string(), options: z.array(z.string()), answer: z.number(), explanation: z.string() });
export const GenerateResult = z.object({
  source: z.enum(["ai", "built-in"]),
  questions: z.array(PlainQuestion).nullable(),
  notes: NoteContent.nullable(),
  message: z.string(),
});
export type GenerateResult = z.infer<typeof GenerateResult>;

export const StudioSet = z.object({
  id: z.string(),
  title: z.string(),
  topicId: z.string(),
  topicTitle: z.string(),
  examIds: z.array(z.string()),
  section: z.string(),
  status: ContentStatus,
  questions: z.array(PlainQuestion),
  author: z.string(),
  updatedAt: z.string(),
});
export type StudioSet = z.infer<typeof StudioSet>;
export const StudioNote = NoteContent.extend({ id: z.string(), topicId: z.string(), topicTitle: z.string(), source: z.enum(["faculty", "ai"]), status: ContentStatus, author: z.string(), updatedAt: z.string() });
export type StudioNote = z.infer<typeof StudioNote>;

export const StudioOverview = z.object({
  sets: z.array(StudioSet),
  notes: z.array(StudioNote),
  topics: z.array(z.object({ id: z.string(), title: z.string(), family: z.string() })),
  exams: z.array(z.object({ id: z.string(), name: z.string(), sections: z.array(z.string()) })),
  aiAvailable: z.boolean(),
  canEdit: z.boolean(),
});
export type StudioOverview = z.infer<typeof StudioOverview>;
