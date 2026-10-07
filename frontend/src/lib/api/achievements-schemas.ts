import { z } from "zod";

/** Shared by the browser and the server: a student's XP, level, streak, badges and class standing. */

export const BADGE_GROUPS = ["Quizzes", "Courses", "Assignments", "Exam prep", "Consistency", "Progress"] as const;
export const BadgeGroup = z.enum(BADGE_GROUPS);
export type BadgeGroup = z.infer<typeof BadgeGroup>;

export const BadgeTone = z.enum(["brand", "gold", "teal", "rose", "amber", "sky"]);

export const Badge = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  group: BadgeGroup,
  tone: BadgeTone,
  value: z.number(),
  target: z.number(),
  earned: z.boolean(),
});
export type Badge = z.infer<typeof Badge>;

export const AchievementsOverview = z.object({
  xp: z.number(),
  level: z.number(),
  levelTitle: z.string(),
  /** XP at which this level started and at which the next one starts. */
  levelFrom: z.number(),
  nextLevelAt: z.number(),
  streak: z.object({ current: z.number(), longest: z.number(), activeToday: z.boolean() }),
  breakdown: z.array(z.object({ key: z.string(), label: z.string(), count: z.number(), xp: z.number() })),
  stats: z.object({ quizAttempts: z.number(), quizzesPassed: z.number(), certificates: z.number(), lessons: z.number(), coursesDone: z.number(), assignments: z.number() }),
  badges: z.array(Badge),
  recent: z.array(z.object({ at: z.string(), label: z.string(), xp: z.number() })),
  board: z.object({
    /** Rank by learning XP (quizzes, certificates, lessons); null when nobody in the college has started. */
    rank: z.number().nullable(),
    of: z.number(),
    myXp: z.number(),
    toNext: z.number().nullable(),
    top: z.array(z.object({ rank: z.number(), xp: z.number(), you: z.boolean() })),
  }),
  rules: z.array(z.object({ label: z.string(), xp: z.number() })),
});
export type AchievementsOverview = z.infer<typeof AchievementsOverview>;
