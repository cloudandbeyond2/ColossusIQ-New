import "server-only";
import type { Prisma } from "@prisma/client";
import type { ContentInput, ContentRow, PrepContentStore } from "@/lib/api/mock/prep-content-store";
import { db, isUuid } from "./db";
import { collegeUuid } from "./lookups";

/*
 * Exam-prep content on PostgreSQL: `prep_content` (db/migrations/0014_prep_content.sql). Row-level security limits
 * every query to the signed-in college.
 */

interface Row {
  id: string;
  kind: string;
  topicId: string;
  topicTitle: string;
  examIds: string[];
  section: string;
  title: string;
  body: unknown;
  source: string;
  status: string;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
}

const toRow = (r: Row): ContentRow => ({
  id: r.id,
  kind: r.kind as ContentRow["kind"],
  topicId: r.topicId,
  topicTitle: r.topicTitle,
  examIds: r.examIds,
  section: r.section,
  title: r.title,
  body: r.body,
  source: r.source as ContentRow["source"],
  status: r.status as ContentRow["status"],
  author: r.authorName,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const data = (c: ContentInput, author: string) => ({
  kind: c.kind,
  topicId: c.topicId,
  topicTitle: c.topicTitle,
  examIds: c.examIds,
  section: c.section,
  title: c.title,
  body: c.body as Prisma.InputJsonValue,
  source: c.source,
  status: c.status,
  authorName: author,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (db() as any).prepContent;

export const postgresPrepContent: PrepContentStore = {
  async list(_s, kind) {
    const rows = await table().findMany({ where: kind ? { kind } : {}, orderBy: { updatedAt: "desc" }, take: 2000 });
    return rows.map((r: Row) => toRow(r));
  },
  async get(_s, id) {
    if (!isUuid(id)) return undefined;
    const r = await table().findUnique({ where: { id } });
    return r ? toRow(r) : undefined;
  },
  async create(s, c, author) {
    const r = await table().create({ data: { collegeId: await collegeUuid(s.college), ...data(c, author) } });
    return toRow(r);
  },
  async update(_s, id, c, author) {
    if (!isUuid(id)) return undefined;
    const old = await table().findUnique({ where: { id } });
    if (!old) return undefined;
    const r = await table().update({ where: { id }, data: { ...data(c, author), updatedAt: new Date() } });
    return toRow(r);
  },
  async remove(_s, id) {
    if (!isUuid(id)) return false;
    const r = await table().deleteMany({ where: { id } });
    return r.count > 0;
  },
};
