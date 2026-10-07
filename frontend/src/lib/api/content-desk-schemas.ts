import { z } from "zod";
import { BLOOM_LEVELS, COURSE_OUTCOMES, DIFFICULTY_OPTIONS } from "@/config/resources";
import { CA_CATEGORIES, isAllowedSource } from "@/lib/api/exam-prep-schemas";

/*
 * University Content Desk (Super Admin): current affairs, question sets and university events are drafted (by AI or by
 * hand), verified, and published to every college or chosen colleges. Publishing copies the content into each
 * college's own Current Affairs feed, Question Bank or Campus Events; withdrawing removes those copies.
 */

export const CONTENT_KINDS = ["current-affair", "question-set", "event"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export const KIND_LABEL: Record<ContentKind, string> = { "current-affair": "Current affairs", "question-set": "Question set", event: "University event" };
export const CONTENT_STATUSES = ["Draft", "In review", "Published", "Rejected", "Withdrawn"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const EVENT_TYPES = ["Seminar", "Workshop", "Hackathon", "Cultural", "Sports", "Alumni", "Social service"] as const;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-02-14");

const Mcq = z
  .object({
    question: z.string().trim().min(10, "Write the question").max(300),
    options: z.array(z.string().trim().min(1, "Fill in every option").max(120)).length(4),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().trim().max(300).default(""),
  })
  .refine((m) => new Set(m.options.map((o) => o.toLowerCase())).size === 4, { message: "The four options must be different", path: ["options"] });

export const CurrentAffairData = z.object({
  date: day,
  category: z.enum(CA_CATEGORIES),
  headline: z.string().trim().min(10, "Write a headline of at least 10 characters").max(140),
  summary: z.string().trim().min(20, "Write a summary of at least 20 characters").max(600),
  sourceName: z.string().trim().min(2, "Name the source you checked").max(80),
  sourceUrl: z
    .string()
    .trim()
    .max(300)
    .default("")
    .refine((v) => v === "" || isAllowedSource(v), { message: "Use an https link from a government or listed news site" }),
  mcq: Mcq.nullable().default(null),
});
export type CurrentAffairData = z.infer<typeof CurrentAffairData>;

export const QuestionItem = z.object({
  question: z.string().trim().min(10, "Write the question").max(2000),
  topic: z.string().trim().min(2).max(100),
  difficulty: z.enum(DIFFICULTY_OPTIONS),
  bloom: z.enum(BLOOM_LEVELS),
  co: z.enum(COURSE_OUTCOMES),
  marks: z.number().int().min(1).max(50),
  explanation: z.string().trim().max(2000).default(""),
  /** Only approved questions are published. */
  approved: z.boolean().default(false),
});
export type QuestionItem = z.infer<typeof QuestionItem>;

export const QuestionSetData = z.object({
  subject: z.string().trim().min(2, "Name the subject").max(100),
  items: z.array(QuestionItem).min(1, "Add at least one question").max(40),
});
export type QuestionSetData = z.infer<typeof QuestionSetData>;

export const EventData = z.object({
  title: z.string().trim().min(3).max(100),
  type: z.enum(EVENT_TYPES),
  date: day,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use a time like 09:30"),
  venue: z.string().trim().min(2).max(80),
  organiser: z.string().trim().min(2).max(80),
  capacity: z.number().int().min(1).max(20000),
  registrationOpen: z.boolean().default(true),
  description: z.string().trim().max(1500).default(""),
});
export type EventData = z.infer<typeof EventData>;

export const DATA_SCHEMA = { "current-affair": CurrentAffairData, "question-set": QuestionSetData, event: EventData } as const;

/** "all" or a list of college ids. */
export const Targets = z.union([z.literal("all"), z.array(z.string().regex(/^COL-\d{4}$/)).min(1, "Pick at least one college").max(200)]);
export type Targets = z.infer<typeof Targets>;

export const ContentItem = z.object({
  id: z.string(),
  kind: z.enum(CONTENT_KINDS),
  status: z.enum(CONTENT_STATUSES),
  source: z.enum(["AI", "Manual"]),
  title: z.string(),
  data: z.record(z.string(), z.unknown()),
  targets: Targets,
  /** How many colleges hold a published copy. */
  reach: z.number(),
  createdBy: z.string(),
  verifiedBy: z.string(),
  reviewNote: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
});
export type ContentItem = z.infer<typeof ContentItem>;

export const DeskOverview = z.object({
  items: z.array(ContentItem),
  colleges: z.array(z.object({ id: z.string(), name: z.string(), status: z.string() })),
  aiReady: z.boolean(),
  canEdit: z.boolean(),
});
export type DeskOverview = z.infer<typeof DeskOverview>;

/* Requests */
export const SaveBody = z.object({ kind: z.enum(CONTENT_KINDS), data: z.unknown(), targets: Targets.default("all") });
export const UpdateBody = z.object({ data: z.unknown(), targets: Targets });
export const PublishBody = z.object({ verified: z.literal(true, { message: "Confirm that you have verified this content" }), targets: Targets });
export const NoteBody = z.object({ note: z.string().trim().min(3, "Say why").max(500) });

export const GenerateBody = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("current-affair"),
    /** The news text or official release the drafts must be based on. AI never invents news. */
    sourceText: z.string().trim().min(80, "Paste at least a paragraph of the news or official release").max(8000),
    sourceName: z.string().trim().min(2, "Name the source").max(80),
    sourceUrl: z.string().trim().max(300).default(""),
    date: day,
    count: z.number().int().min(1).max(5),
  }),
  z.object({
    kind: z.literal("question-set"),
    subject: z.string().trim().min(2, "Name the subject").max(100),
    topics: z.array(z.string().trim().min(2).max(100)).min(1, "Enter at least one topic").max(8),
    count: z.number().int().min(3).max(20),
    difficulty: z.enum(["Mixed", ...DIFFICULTY_OPTIONS] as const),
    bloom: z.enum(["Mixed", ...BLOOM_LEVELS] as const),
    co: z.enum(COURSE_OUTCOMES),
    notes: z.string().trim().max(3000).default(""),
  }),
  z.object({
    kind: z.literal("event"),
    brief: z.string().trim().min(20, "Describe the event in a sentence or two").max(1500),
    type: z.enum(EVENT_TYPES),
    date: day,
  }),
]);
export type GenerateBody = z.infer<typeof GenerateBody>;
