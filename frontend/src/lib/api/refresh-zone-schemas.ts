import { z } from "zod";

/** Shared by the browser and the server: the Refresh Zone (short brain-break games with saved scores). */

export const QUIZ_ACTIVITIES = ["subject", "aptitude", "vocabulary"] as const;
export const QuizActivity = z.enum(QUIZ_ACTIVITIES);
export type QuizActivity = z.infer<typeof QuizActivity>;
export const ACTIVITY_IDS = ["subject", "aptitude", "vocabulary", "memory", "breathing"] as const;
export const ActivityId = z.enum(ACTIVITY_IDS);
export type ActivityId = z.infer<typeof ActivityId>;

export const MAX_MEMORY_LEVEL = 20;

export const StartBody = z.object({ activity: QuizActivity }).strict();
export const SubmitBody = z.object({ answers: z.record(z.string().regex(/^q\d{1,2}$/), z.number().int().min(0).max(3)) }).strict();
export const MemoryBody = z.object({ level: z.number().int().min(0).max(MAX_MEMORY_LEVEL) }).strict();
export const BreathingBody = z.object({ seconds: z.number().int().min(20).max(900) }).strict();

const Tone = z.enum(["brand", "gold", "teal", "rose", "amber", "sky"]);

export const ActivityCard = z.object({
  id: ActivityId,
  title: z.string(),
  description: z.string(),
  tag: z.string(),
  tone: Tone,
  kind: z.enum(["quiz", "memory", "breathing"]),
  available: z.boolean(),
  /** Why it cannot be played, or a short note about where the questions come from. */
  note: z.string(),
  plays: z.number(),
  /** Best score: percent for quiz games, level reached for Memory Matrix, minutes for the breathing break. */
  best: z.number().nullable(),
  last: z.number().nullable(),
});
export type ActivityCard = z.infer<typeof ActivityCard>;

export const RefreshOverview = z.object({
  activities: z.array(ActivityCard),
  today: z.object({ plays: z.number(), goal: z.number() }),
  streak: z.object({ current: z.number(), longest: z.number() }),
  week: z.array(z.object({ day: z.string(), label: z.string(), plays: z.number() })),
  totals: z.object({ plays: z.number(), answered: z.number(), correct: z.number(), minutes: z.number() }),
});
export type RefreshOverview = z.infer<typeof RefreshOverview>;

export const Round = z.object({
  id: z.string(),
  activity: QuizActivity,
  title: z.string(),
  secondsPerQuestion: z.number(),
  questions: z.array(z.object({ id: z.string(), prompt: z.string(), options: z.array(z.string()) })),
});
export type Round = z.infer<typeof Round>;

export const RoundResult = z.object({
  score: z.number(),
  total: z.number(),
  percentage: z.number(),
  newBest: z.boolean(),
  best: z.number(),
  review: z.array(z.object({ id: z.string(), prompt: z.string(), options: z.array(z.string()), given: z.number().nullable(), answer: z.number(), correct: z.boolean(), explanation: z.string() })),
});
export type RoundResult = z.infer<typeof RoundResult>;

export const PlayResult = z.object({ best: z.number(), newBest: z.boolean(), plays: z.number() });
export type PlayResult = z.infer<typeof PlayResult>;

/** What the server keeps for one person (one document). */
const Stat = z.object({ plays: z.number().int().min(0), best: z.number().min(0), last: z.number().min(0), correct: z.number().int().min(0), answered: z.number().int().min(0), seconds: z.number().int().min(0) });
export type Stat = z.infer<typeof Stat>;
export const StoredRefresh = z.object({
  stats: z.record(z.string(), Stat),
  /** India-time day → number of breaks that day (the last three weeks). */
  days: z.record(z.string(), z.number().int().min(0)),
  pending: z
    .object({
      id: z.string(),
      activity: QuizActivity,
      questions: z.array(z.object({ prompt: z.string(), options: z.array(z.string()).length(4), answer: z.number().int().min(0).max(3), explanation: z.string() })),
      startedAt: z.number(),
    })
    .nullable(),
  updatedAt: z.string(),
});
export type StoredRefresh = z.infer<typeof StoredRefresh>;
