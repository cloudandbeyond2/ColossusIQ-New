import { z } from "zod";
import { KB_DOC_TYPES, KB_SCOPES, KbAnswerSchema, KbAskBody } from "./knowledge-schemas";

/*
 * Policy Assistant: Principals, HODs and faculty ask questions of their college's approved documents (the Knowledge
 * Base) and get a short answer with the passages it came from. Each person's recent questions are kept for them.
 */

export const POLICY_HISTORY_MAX = 30;
export const PolicyAskBody = KbAskBody;

/** What the assistant knows: approved documents only, never drafts or archived files. */
export const PolicySource = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(KB_DOC_TYPES),
  owner: z.string(),
  scope: z.enum(KB_SCOPES),
  passages: z.number(),
  updatedAt: z.string(),
});
export type PolicySource = z.infer<typeof PolicySource>;

/** One answered question. Passages are kept as references (title, section, page), not as stored text. */
export const PolicyTurn = z.object({
  id: z.string(),
  at: z.string(),
  question: z.string(),
  answer: z.string(),
  grounded: z.boolean(),
  mode: z.enum(["ai", "extract", "none"]),
  searched: z.object({ documents: z.number(), passages: z.number() }),
  citations: z.array(
    z.object({
      n: z.number(),
      docId: z.string(),
      docTitle: z.string(),
      section: z.string(),
      page: z.number().nullable(),
      snippet: z.string(),
      cited: z.boolean(),
    }),
  ),
});
export type PolicyTurn = z.infer<typeof PolicyTurn>;

export const PolicyOverview = z.object({
  sources: z.array(PolicySource),
  stats: z.object({ approved: z.number(), pending: z.number(), passages: z.number(), categories: z.number(), lastUpdated: z.string().nullable() }),
  suggestions: z.array(z.string()),
  ai: z.object({ enabled: z.boolean() }),
  /** The Principal can add and approve documents in the Knowledge Base; others ask the Principal to. */
  canManage: z.boolean(),
  history: z.array(PolicyTurn),
});
export type PolicyOverview = z.infer<typeof PolicyOverview>;

export const PolicyAnswer = z.object({ turn: PolicyTurn });
export type PolicyAnswer = z.infer<typeof PolicyAnswer>;

/** Saved form of the history document. */
export const StoredPolicyHistory = z.object({ turns: z.array(PolicyTurn).max(POLICY_HISTORY_MAX) });
export type StoredPolicyHistory = z.infer<typeof StoredPolicyHistory>;
export { KbAnswerSchema };
