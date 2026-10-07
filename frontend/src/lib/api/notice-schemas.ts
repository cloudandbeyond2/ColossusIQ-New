import { z } from "zod";

/* Notice Board: important announcements from staff, the Principal and the University to students and staff. */

export const NOTICE_CATEGORIES = ["Academic", "Examination", "Event", "Placement", "Holiday", "Fees", "Hostel & Transport", "General"] as const;
export const NOTICE_PRIORITIES = ["Normal", "Important", "Urgent"] as const;
export const NOTICE_AUDIENCES = ["everyone", "students", "staff"] as const;
export const AUDIENCE_LABEL: Record<(typeof NOTICE_AUDIENCES)[number], string> = { everyone: "Everyone", students: "All students", staff: "All staff" };

const day = /^\d{4}-\d{2}-\d{2}$/;

export const NoticeBody = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(140),
  body: z.string().trim().min(3, "Write the notice").max(3000),
  category: z.enum(NOTICE_CATEGORIES),
  priority: z.enum(NOTICE_PRIORITIES),
  audience: z.enum(NOTICE_AUDIENCES),
  /** Department name to narrow a student notice ("" = every department). */
  department: z.string().trim().max(80).default(""),
  /** Year of study to narrow a student notice (0 = every year). */
  year: z.number().int().min(0).max(6).default(0),
  pinned: z.boolean().default(false),
  requiresAck: z.boolean().default(false),
  linkUrl: z.union([z.literal(""), z.string().trim().max(300).url().startsWith("https://", "Use an https:// link")]).default(""),
  expiresOn: z.string().regex(day).nullable().default(null),
});
export type NoticeBody = z.infer<typeof NoticeBody>;

export const NoticeView = NoticeBody.extend({
  id: z.string(),
  authorName: z.string(),
  authorRole: z.string(),
  createdAt: z.string(),
  /** Posted by the University for every college. */
  university: z.boolean(),
  read: z.boolean(),
  acknowledged: z.boolean(),
  mine: z.boolean(),
  canDelete: z.boolean(),
  expired: z.boolean(),
  /** Reach, shown to the author, the Principal and the Super Admin. */
  stats: z.object({ reads: z.number(), acknowledged: z.number() }).nullable(),
});
export type NoticeView = z.infer<typeof NoticeView>;

export const NoticeBoard = z.object({
  notices: z.array(NoticeView),
  unread: z.number(),
  pendingAck: z.number(),
  compose: z
    .object({
      audiences: z.array(z.enum(NOTICE_AUDIENCES)),
      canPin: z.boolean(),
      departments: z.array(z.string()),
      /** Where a notice goes: this college, or every college (Super Admin at "All colleges"). */
      reach: z.string(),
    })
    .nullable(),
});
export type NoticeBoard = z.infer<typeof NoticeBoard>;

export const AckBody = z.object({ acknowledge: z.boolean().default(false) });
