import "server-only";
import type { NoticeRow, NoticeStore, ReadState } from "@/lib/api/mock/notice-store";
import { db, isUuid } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * Notice Board on PostgreSQL: `notices` and `notice_reads` (db/migrations/0018_content_curriculum_notices.sql).
 * Row-level security shows a college its own notices plus the University's (college_id NULL).
 */

interface Row {
  id: string;
  collegeId: string | null;
  authorSub: string;
  authorName: string;
  authorRole: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  audience: string;
  department: string;
  year: number;
  pinned: boolean;
  requiresAck: boolean;
  linkUrl: string;
  expiresOn: string | null;
  createdAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const notices = () => (db() as any).notice;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reads = () => (db() as any).noticeRead;

async function toRow(r: Row): Promise<NoticeRow> {
  return {
    id: r.id,
    college: r.collegeId ? await collegePublic(r.collegeId) : null,
    authorSub: r.authorSub,
    authorName: r.authorName,
    authorRole: r.authorRole,
    title: r.title,
    body: r.body,
    category: r.category as NoticeRow["category"],
    priority: r.priority as NoticeRow["priority"],
    audience: r.audience as NoticeRow["audience"],
    department: r.department,
    year: r.year,
    pinned: r.pinned,
    requiresAck: r.requiresAck,
    linkUrl: r.linkUrl,
    expiresOn: r.expiresOn,
    createdAt: r.createdAt.toISOString(),
  };
}

export const postgresNotices: NoticeStore = {
  async list(scope) {
    const where = scope === "all" ? { collegeId: null } : { OR: [{ collegeId: null }, { collegeId: await collegeUuid(scope) }] };
    const rows = (await notices().findMany({ where, orderBy: { createdAt: "desc" }, take: 500 })) as Row[];
    return Promise.all(rows.map(toRow));
  },
  async create(row) {
    const created = (await notices().create({
      data: {
        collegeId: row.college ? await collegeUuid(row.college) : null,
        authorSub: row.authorSub,
        authorName: row.authorName,
        authorRole: row.authorRole,
        title: row.title,
        body: row.body,
        category: row.category,
        priority: row.priority,
        audience: row.audience,
        department: row.department,
        year: row.year,
        pinned: row.pinned,
        requiresAck: row.requiresAck,
        linkUrl: row.linkUrl,
        expiresOn: row.expiresOn,
      },
    })) as Row;
    return toRow(created);
  },
  async remove(id) {
    if (!isUuid(id)) return false;
    return ((await notices().deleteMany({ where: { id } })) as { count: number }).count > 0;
  },
  async readsFor(userSub, ids) {
    const out = new Map<string, ReadState>();
    const valid = ids.filter(isUuid);
    if (!valid.length) return out;
    const rows = (await reads().findMany({ where: { userSub, noticeId: { in: valid } } })) as Array<{ noticeId: string; acknowledgedAt: Date | null }>;
    for (const r of rows) out.set(r.noticeId, { read: true, acknowledged: !!r.acknowledgedAt });
    return out;
  },
  async markRead(id, userSub, college, acknowledge) {
    if (!isUuid(id)) return;
    const collegeId = college ? await collegeUuid(college) : null;
    await reads().upsert({
      where: { noticeId_userSub: { noticeId: id, userSub } },
      create: { noticeId: id, userSub, collegeId, acknowledgedAt: acknowledge ? new Date() : null },
      update: acknowledge ? { acknowledgedAt: new Date() } : {},
    });
  },
  async stats(ids) {
    const out = new Map<string, { reads: number; acknowledged: number }>();
    const valid = ids.filter(isUuid);
    if (!valid.length) return out;
    const rows = (await reads().findMany({ where: { noticeId: { in: valid } }, select: { noticeId: true, acknowledgedAt: true } })) as Array<{ noticeId: string; acknowledgedAt: Date | null }>;
    for (const r of rows) {
      const s = out.get(r.noticeId) ?? { reads: 0, acknowledged: 0 };
      s.reads++;
      if (r.acknowledgedAt) s.acknowledged++;
      out.set(r.noticeId, s);
    }
    return out;
  },
};
