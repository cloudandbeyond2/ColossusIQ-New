import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { NoticeBody } from "@/lib/api/notice-schemas";
import { postgresNotices } from "@/lib/data/postgres/notices";
import { sharedState } from "./global-state";

/*
 * Notices and who has read them. In memory for the demo backend, PostgreSQL otherwise (data/postgres/notices.ts).
 * `college` is the college's public id, or null for a University notice that every college sees.
 */

export interface NoticeRow extends NoticeBody {
  id: string;
  college: string | null;
  authorSub: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

export interface ReadState {
  read: boolean;
  acknowledged: boolean;
}

export interface NoticeStore {
  /** This college's notices plus the University's (scope "all": the University's only). Newest first. */
  list(scope: string): Promise<NoticeRow[]>;
  create(row: Omit<NoticeRow, "id" | "createdAt">): Promise<NoticeRow>;
  remove(id: string): Promise<boolean>;
  readsFor(userSub: string, ids: string[]): Promise<Map<string, ReadState>>;
  markRead(id: string, userSub: string, college: string | null, acknowledge: boolean): Promise<void>;
  stats(ids: string[]): Promise<Map<string, { reads: number; acknowledged: number }>>;
}

const notices = sharedState("notices.rows", () => new Map<string, NoticeRow>());
const reads = sharedState("notices.reads", () => new Map<string, { id: string; user: string; ack: boolean }>());

const memoryNotices: NoticeStore = {
  async list(scope) {
    return [...notices.values()]
      .filter((n) => n.college === null || (scope !== "all" && n.college === scope))
      .map((n) => structuredClone(n))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async create(row) {
    const n: NoticeRow = { ...structuredClone(row), id: randomUUID(), createdAt: new Date().toISOString() };
    notices.set(n.id, n);
    return structuredClone(n);
  },
  async remove(id) {
    for (const [k, r] of reads) if (r.id === id) reads.delete(k);
    return notices.delete(id);
  },
  async readsFor(userSub, ids) {
    const out = new Map<string, ReadState>();
    for (const id of ids) {
      const r = reads.get(`${id}|${userSub}`);
      if (r) out.set(id, { read: true, acknowledged: r.ack });
    }
    return out;
  },
  async markRead(id, userSub, _college, acknowledge) {
    const k = `${id}|${userSub}`;
    const r = reads.get(k);
    reads.set(k, { id, user: userSub, ack: acknowledge || !!r?.ack });
  },
  async stats(ids) {
    const want = new Set(ids);
    const out = new Map<string, { reads: number; acknowledged: number }>();
    for (const r of reads.values()) {
      if (!want.has(r.id)) continue;
      const s = out.get(r.id) ?? { reads: 0, acknowledged: 0 };
      s.reads++;
      if (r.ack) s.acknowledged++;
      out.set(r.id, s);
    }
    return out;
  },
};

/** Test helper (memory backend only). */
export function resetNoticesMemory() {
  notices.clear();
  reads.clear();
}

export function noticeStore(): NoticeStore {
  return dataBackend() === "postgres" ? postgresNotices : memoryNotices;
}
