import "server-only";
import type { z } from "zod";
import { ALL_COLLEGES } from "@/config/tenancy";
import { RESOURCES } from "@/config/resources";
import type { Role } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import type { Notification } from "@/lib/api/schemas";
import { AckBody, NoticeBoard, NoticeBody, type NoticeView } from "@/lib/api/notice-schemas";
import { cleanText } from "@/lib/security/sanitize";
import { audit } from "./audit";
import { noticeStore, type NoticeRow } from "./notice-store";
import { rateLimit } from "./rate-limit";
import type { MockResult } from "./router";
import { getStudentAcademicProfile } from "./student-profile";

/*
 * Notice Board. Faculty and HODs post to students (optionally one department or year); the Principal, placement and
 * incubation heads post to students, staff or everyone in their college; the University Super Admin posts to every
 * college from "All colleges". Readers see what is meant for them, mark it read and acknowledge notices that ask for
 * it; authors, the Principal and the Super Admin see how many have read and acknowledged.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
const invalid = (e: z.ZodError): MockResult => {
  const fields: Record<string, string> = {};
  for (const i of e.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
  return err(422, "validation", "Please correct the highlighted fields.", fields);
};

const POSTERS: Partial<Record<Role, Array<NoticeBody["audience"]>>> = {
  faculty: ["students"],
  hod: ["students", "staff", "everyone"],
  placement: ["students", "everyone"],
  incubation: ["students", "everyone"],
  institution: ["everyone", "students", "staff"],
  admin: ["everyone", "students", "staff"],
};
const READERS = new Set<Role>(["student", "faculty", "hod", "placement", "incubation", "institution", "admin"]);
const OVERSEERS = new Set<Role>(["institution", "admin"]);
const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

interface Viewer {
  student: boolean;
  department: string;
  year: number;
}
async function viewerOf(s: SessionPayload): Promise<Viewer> {
  if (s.role !== "student") return { student: false, department: "", year: 0 };
  try {
    const p = await getStudentAcademicProfile(s);
    return { student: true, department: p.department, year: Math.max(1, Math.ceil(p.semester / 2)) };
  } catch {
    return { student: true, department: "", year: 0 };
  }
}

/** Is this notice meant for the viewer? Authors always see their own; the Principal and Super Admin see all. */
function meantFor(n: NoticeRow, s: SessionPayload, v: Viewer): boolean {
  if (n.authorSub === s.sub || OVERSEERS.has(s.role)) return true;
  if (v.student) {
    if (n.audience === "staff") return false;
    if (n.department && v.department && n.department.toLowerCase() !== v.department.toLowerCase()) return false;
    if (n.year && v.year && n.year !== v.year) return false;
    return true;
  }
  return n.audience !== "students";
}

const rank = (n: NoticeView) => (n.pinned ? 0 : 4) + (n.priority === "Urgent" ? 0 : n.priority === "Important" ? 1 : 2) + (n.read ? 3 : 0);

async function visible(s: SessionPayload): Promise<{ rows: NoticeRow[]; views: NoticeView[] }> {
  const store = noticeStore();
  const v = await viewerOf(s);
  const t = today();
  const rows = (await store.list(s.college)).filter((n) => meantFor(n, s, v));
  const readers = await store.readsFor(s.sub, rows.map((n) => n.id));
  const mayStats = (n: NoticeRow) => n.authorSub === s.sub || OVERSEERS.has(s.role);
  const stats = await store.stats(rows.filter(mayStats).map((n) => n.id));
  const views = rows
    .map((n): NoticeView => {
      const expired = !!n.expiresOn && n.expiresOn < t;
      const mine = n.authorSub === s.sub;
      const r = readers.get(n.id);
      const { college, authorSub, ...rest } = n;
      void authorSub;
      return {
        ...rest,
        university: college === null,
        read: mine || !!r?.read,
        acknowledged: !!r?.acknowledged,
        mine,
        canDelete: mine || s.role === "admin" || (s.role === "institution" && college !== null),
        expired,
        stats: mayStats(n) ? (stats.get(n.id) ?? { reads: 0, acknowledged: 0 }) : null,
      };
    })
    // Readers don't see expired notices; authors and overseers keep them (marked expired) for the record.
    .filter((n) => !n.expired || n.mine || OVERSEERS.has(s.role))
    .sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
  return { rows, views };
}

async function departments(college: string): Promise<string[]> {
  if (college === ALL_COLLEGES) return [];
  const recs = await getStore().records.all(RESOURCES.departments!, college);
  return [...new Set(recs.map((r) => String(r.department ?? "")).filter(Boolean))].sort();
}

async function board(s: SessionPayload): Promise<NoticeBoard> {
  const { views } = await visible(s);
  const audiences = POSTERS[s.role];
  return NoticeBoard.parse({
    notices: views.slice(0, 300),
    unread: views.filter((n) => !n.read && !n.expired).length,
    pendingAck: views.filter((n) => n.requiresAck && !n.acknowledged && !n.mine && !n.expired).length,
    compose: audiences
      ? {
          audiences,
          canPin: s.role === "institution" || s.role === "admin",
          departments: await departments(s.college),
          reach: s.role === "admin" && s.college === ALL_COLLEGES ? "Every college in the university" : "This college",
        }
      : null,
  });
}

/** Unread notices for the notification bell. */
export async function noticeNotifications(s: SessionPayload): Promise<Notification[]> {
  if (!READERS.has(s.role)) return [];
  try {
    const { views } = await visible(s);
    return views
      .filter((n) => !n.read && !n.mine && !n.expired)
      .slice(0, 8)
      .map((n) => ({
        id: `notice-${n.id}`,
        title: `${n.priority === "Normal" ? "" : `${n.priority}: `}${n.title}`,
        body: n.body.length > 140 ? `${n.body.slice(0, 137)}…` : n.body,
        when: new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        unread: true,
        tone: n.priority === "Urgent" ? "rose" : n.priority === "Important" ? "amber" : "brand",
      }));
  } catch {
    return [];
  }
}

export async function dispatchNotices(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (!READERS.has(s.role)) return err(403, "forbidden", "The notice board is not available for your role.");
  const store = noticeStore();
  const [, id, action] = segs;

  if (method === "GET" && segs.length === 1) return ok(await board(s));

  // POST notice-board/:id/read  { acknowledge }
  if (method === "POST" && id && action === "read" && segs.length === 3) {
    const b = AckBody.safeParse(rawBody ?? {});
    if (!b.success) return invalid(b.error);
    const { rows } = await visible(s);
    const n = rows.find((x) => x.id === id);
    if (!n) return err(404, "not_found", "That notice is no longer available.");
    await store.markRead(id, s.sub, s.college === ALL_COLLEGES ? null : s.college, b.data.acknowledge && n.requiresAck);
    return ok({ ok: true });
  }

  if (!s.mfa) return err(403, "mfa_required", "Confirm your sign-in code first.");

  if (method === "POST" && segs.length === 1) {
    const audiences = POSTERS[s.role];
    if (!audiences) return err(403, "forbidden", "Your role cannot post notices.");
    if (s.college === ALL_COLLEGES && s.role !== "admin") return err(409, "choose_college", "Switch into a college to post a notice.");
    if (!rateLimit(`notices:${s.sub}`, 30, 3_600_000).ok) return err(429, "rate_limited", "You have posted many notices in the last hour. Please wait a little.");
    const p = NoticeBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const b = p.data;
    if (!audiences.includes(b.audience)) return err(422, "validation", "Please correct the highlighted fields.", { audience: "Your role cannot address this audience" });
    if (b.audience === "staff" && (b.department || b.year)) return err(422, "validation", "Please correct the highlighted fields.", { department: "Department and year apply to student notices only" });
    if (b.department && s.college !== ALL_COLLEGES && !(await departments(s.college)).some((d) => d.toLowerCase() === b.department.toLowerCase())) return err(422, "validation", "Please correct the highlighted fields.", { department: "Pick a department of this college" });
    if (b.expiresOn && b.expiresOn < today()) return err(422, "validation", "Please correct the highlighted fields.", { expiresOn: "Pick today or a later date" });
    const row = await store.create({
      ...b,
      title: cleanText(b.title, 140),
      body: cleanText(b.body, 3000),
      pinned: b.pinned && (s.role === "institution" || s.role === "admin"),
      college: s.college === ALL_COLLEGES ? null : s.college,
      authorSub: s.sub,
      authorName: s.name,
      authorRole: s.role,
    });
    await audit(s.name, `notice.post:${b.priority.toLowerCase()}`, row.title, { collegeId: row.college, actorSub: s.sub });
    return ok(await board(s), 201);
  }

  if (method === "DELETE" && id && segs.length === 2) {
    const { views } = await visible(s);
    const n = views.find((x) => x.id === id);
    if (!n) return err(404, "not_found", "That notice is no longer available.");
    if (!n.canDelete) return err(403, "forbidden", "Only the author, the Principal or the Super Admin can remove this notice.");
    await store.remove(id);
    await audit(s.name, "notice.remove", n.title, { collegeId: s.college === ALL_COLLEGES ? null : s.college, actorSub: s.sub });
    return ok(await board(s));
  }

  return err(404, "not_found", "Not found.");
}
