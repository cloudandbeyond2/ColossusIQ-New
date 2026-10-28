import { z } from "zod";

/** Shared by the browser and the server: the Event Generator's saved blueprints. */
export const SavedEventPlan = z.object({
  id: z.string(),
  plan: z.record(z.string(), z.unknown()),
  createdByName: z.string(),
  updatedAt: z.string(),
  /** The author, the Principal and the Super Admin may change or delete a plan. */
  canEdit: z.boolean(),
});
export type SavedEventPlan = z.infer<typeof SavedEventPlan>;

export const SavedEventPlans = z.object({ plans: z.array(SavedEventPlan) });
export type SavedEventPlans = z.infer<typeof SavedEventPlans>;

const CATEGORIES = ["Hackathon", "Workshop", "Seminar", "Cultural", "Sports", "Alumni", "Social service"] as const;

/** A blueprint as the generator builds it. Extra keys (agenda, budget lines, promotion copy...) are kept as sent. */
export const EventPlanBody = z.object({
  plan: z
    .object({
      title: z.string().trim().min(2).max(160),
      category: z.enum(CATEGORIES),
      status: z.enum(["Draft", "Published"]).default("Draft"),
    })
    .passthrough(),
});
