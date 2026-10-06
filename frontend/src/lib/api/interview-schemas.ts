import { z } from "zod";

/* AI Mock Interview: what the setup sends, what a running interview looks like and what is kept per student. */

export const IV_MODES = ["technical", "hr", "behavioral"] as const;
export const IvMode = z.enum(IV_MODES);
export type IvMode = z.infer<typeof IvMode>;

export const IV_MIN = 3;
export const IV_MAX = 8;
export const MAX_ANSWER = 4000;
export const MAX_HISTORY = 12;

/** The six scorecard dimensions, in the order they are shown. */
export const DIMENSIONS = ["Content", "Technical accuracy", "Clarity", "Structure", "Confidence indicators", "Relevance"] as const;

const text = (max: number) => z.string().trim().max(max);

export const StartBody = z
  .object({
    mode: IvMode,
    /** The job the student is practising for, e.g. "Backend developer". Optional. */
    role: text(60).default(""),
    questions: z.number().int().min(IV_MIN).max(IV_MAX).default(5),
  })
  .strict();
export type StartBody = z.infer<typeof StartBody>;

export const AnswerBody = z
  .object({
    /** The question number being answered, so a double-click or a stale tab cannot answer twice. */
    n: z.number().int().min(1).max(IV_MAX + 2),
    answer: text(MAX_ANSWER).default(""),
    skip: z.boolean().default(false),
    /** Seconds from the question appearing to sending the answer (measured by the page). */
    seconds: z.number().int().min(0).max(3600).default(0),
  })
  .strict()
  .refine((v) => v.skip || v.answer.length > 0, { message: "Write your answer first, or skip the question", path: ["answer"] });
export type AnswerBody = z.infer<typeof AnswerBody>;

export const IvTurn = z.object({
  n: z.number(),
  question: z.string(),
  kind: z.enum(["main", "follow-up"]),
  answer: z.string().nullable(),
  skipped: z.boolean(),
  seconds: z.number(),
  /** True when the AI marked this answer; false when only the plain text measures were used. */
  byAi: z.boolean(),
  feedback: z.string(),
  /** 0–100 per dimension for this answer; null until it is marked. */
  scores: z.record(z.string(), z.number()).nullable(),
});
export type IvTurn = z.infer<typeof IvTurn>;

export const IvScorecard = z.object({
  overall: z.number(),
  dimensions: z.array(z.object({ name: z.string(), score: z.number() })),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  summary: z.string(),
  answered: z.number(),
  /** True when the AI marked the answers; false when only the plain text measures were used. */
  aiMarked: z.boolean(),
  /** Ended before half the questions: shown, but not counted towards placement readiness. */
  endedEarly: z.boolean(),
  countsForReadiness: z.boolean(),
});
export type IvScorecard = z.infer<typeof IvScorecard>;

export const IvSession = z.object({
  id: z.string(),
  mode: IvMode,
  role: z.string(),
  total: z.number(),
  status: z.enum(["active", "done"]),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  turns: z.array(IvTurn),
  scorecard: IvScorecard.nullable(),
  aiLive: z.boolean(),
});
export type IvSession = z.infer<typeof IvSession>;

export const IvHistoryItem = z.object({
  id: z.string(),
  mode: IvMode,
  role: z.string(),
  overall: z.number(),
  answered: z.number(),
  total: z.number(),
  finishedAt: z.string(),
  aiMarked: z.boolean(),
  countsForReadiness: z.boolean(),
});
export type IvHistoryItem = z.infer<typeof IvHistoryItem>;

export const IvOverview = z.object({
  aiLive: z.boolean(),
  active: IvSession.nullable(),
  history: z.array(IvHistoryItem),
  /** What the interviewer can see of the student: used to tell them how their questions are chosen. */
  context: z.object({ hasResume: z.boolean(), projects: z.array(z.string()), subjects: z.array(z.string()) }),
  stats: z.object({ sessions: z.number(), best: z.number().nullable(), average: z.number().nullable(), last: z.number().nullable() }),
});
export type IvOverview = z.infer<typeof IvOverview>;

/** What is kept per student (student_state, key "interview"). */
export const StoredInterview = z.object({
  active: IvSession.nullable(),
  history: z.array(IvSession),
  updatedAt: z.string(),
});
export type StoredInterview = z.infer<typeof StoredInterview>;
