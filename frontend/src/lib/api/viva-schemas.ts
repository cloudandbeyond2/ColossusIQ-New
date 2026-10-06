import { z } from "zod";

export const VIVA_MODES = ["Subject", "Project", "Technical"] as const;
export const VivaMode = z.enum(VIVA_MODES);
export type VivaMode = z.infer<typeof VivaMode>;

export const VIVA_LEVELS = ["Friendly", "Standard", "Tough"] as const;
export const VivaLevel = z.enum(VIVA_LEVELS);
export type VivaLevel = z.infer<typeof VivaLevel>;

export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 10;
export const MAX_ANSWER = 2000;
export const MAX_HISTORY = 15;

const text = (max: number) => z.string().trim().max(max);

/** What the student picks on the setup card. */
export const StartBody = z
  .object({
    mode: VivaMode,
    level: VivaLevel.default("Standard"),
    questions: z.number().int().min(MIN_QUESTIONS).max(MAX_QUESTIONS).default(5),
    /** Subject code from the student's own subjects (Subject viva; optional for Technical). */
    subject: text(40).default(""),
    /** Project title (Project viva) or the topic to be examined on (Technical viva; optional narrowing for Subject). */
    topic: text(120).default(""),
    /** A few sentences about the project, so the examiner asks about the real thing. */
    brief: text(600).default(""),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.mode === "Subject" && !v.subject) ctx.addIssue({ code: "custom", path: ["subject"], message: "Pick a subject" });
    if (v.mode === "Project" && v.topic.length < 3) ctx.addIssue({ code: "custom", path: ["topic"], message: "Enter your project title" });
    if (v.mode === "Technical" && v.topic.length < 2 && !v.subject) ctx.addIssue({ code: "custom", path: ["topic"], message: "Enter a topic, or pick a subject" });
  });
export type StartBody = z.infer<typeof StartBody>;

export const AnswerBody = z
  .object({
    /** The question number being answered, so a double-click or a stale tab cannot answer twice. */
    n: z.number().int().min(1).max(MAX_QUESTIONS + 5),
    answer: text(MAX_ANSWER).default(""),
    skip: z.boolean().default(false),
  })
  .strict()
  .refine((v) => v.skip || v.answer.length > 0, { message: "Write your answer first, or skip the question", path: ["answer"] });
export type AnswerBody = z.infer<typeof AnswerBody>;

export const VivaTurn = z.object({
  n: z.number(),
  question: z.string(),
  /** "follow-up" when the examiner is digging into the previous answer. */
  kind: z.enum(["main", "follow-up"]),
  answer: z.string().nullable(),
  skipped: z.boolean(),
  feedback: z.string(),
  /** 0–10; null when the AI could not mark this answer. */
  score: z.number().nullable(),
});
export type VivaTurn = z.infer<typeof VivaTurn>;

export const VivaReport = z.object({
  /** 0–100, from the marked answers; null when none could be marked. */
  overall: z.number().nullable(),
  verdict: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  revise: z.array(z.string()),
  answered: z.number(),
  marked: z.number(),
});
export type VivaReport = z.infer<typeof VivaReport>;

export const VivaSession = z.object({
  id: z.string(),
  mode: VivaMode,
  level: VivaLevel,
  /** "Database Management Systems", the project title, or the topic. */
  title: z.string(),
  subject: z.string(),
  total: z.number(),
  status: z.enum(["active", "done"]),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  turns: z.array(VivaTurn),
  report: VivaReport.nullable(),
  /** True when the AI is writing and marking this viva. */
  aiLive: z.boolean(),
  /** The setup, so "Try again" can repeat it. */
  setup: z.object({ mode: VivaMode, level: VivaLevel, questions: z.number(), subject: z.string(), topic: z.string(), brief: z.string() }),
});
export type VivaSession = z.infer<typeof VivaSession>;

export const VivaHistoryItem = z.object({
  id: z.string(),
  mode: VivaMode,
  level: VivaLevel,
  title: z.string(),
  score: z.number().nullable(),
  answered: z.number(),
  total: z.number(),
  finishedAt: z.string(),
});
export type VivaHistoryItem = z.infer<typeof VivaHistoryItem>;

export const VivaOverview = z.object({
  aiLive: z.boolean(),
  subjects: z.array(z.object({ code: z.string(), title: z.string(), shortName: z.string(), units: z.array(z.string()) })),
  project: z.object({ name: z.string() }),
  active: VivaSession.nullable(),
  history: z.array(VivaHistoryItem),
  stats: z.object({ sessions: z.number(), best: z.number().nullable(), average: z.number().nullable(), last: z.number().nullable() }),
});
export type VivaOverview = z.infer<typeof VivaOverview>;

/** What is kept per student (student_state, key "viva"). */
export const StoredViva = z.object({
  active: VivaSession.nullable(),
  history: z.array(VivaSession),
  updatedAt: z.string(),
});
export type StoredViva = z.infer<typeof StoredViva>;
