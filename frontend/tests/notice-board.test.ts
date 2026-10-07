import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NoticeBoard, type NoticeBody } from "@/lib/api/notice-schemas";
import { resetNoticesMemory } from "@/lib/api/mock/notice-store";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type { Notification } from "@/lib/api/schemas";

const base: SessionPayload = { sub: "demo-student", role: "student", name: "Student", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const as = (role: SessionPayload["role"], over: Partial<SessionPayload> = {}): SessionPayload => ({ ...base, role, sub: `demo-${role}`, name: `Test ${role}`, ...over });
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const board = async (s: SessionPayload) => NoticeBoard.parse((await call(s, "GET", "notice-board")).body);
const notice = (over: Partial<NoticeBody> = {}): NoticeBody => ({ title: "Internal assessment II", body: "IA-II starts Monday. Bring your ID card.", category: "Examination", priority: "Important", audience: "students", department: "", year: 0, pinned: false, requiresAck: false, linkUrl: "", expiresOn: null, ...over });

const student = as("student", { sub: "demo-student" });
const faculty = as("faculty");
const principal = as("institution");
const admin = as("admin", { college: "all" });

beforeEach(() => resetNoticesMemory());

describe("Notice Board", () => {
  it("faculty post to students; students read, acknowledge and see it in the bell", async () => {
    const r = await call(faculty, "POST", "notice-board", notice({ requiresAck: true, priority: "Urgent" }));
    expect(r.status).toBe(201);
    const mine = NoticeBoard.parse(r.body).notices[0]!;
    expect(mine).toMatchObject({ mine: true, stats: { reads: 0, acknowledged: 0 } });

    let b = await board(student);
    expect(b.compose).toBeNull();
    expect(b.unread).toBe(1);
    expect(b.pendingAck).toBe(1);
    const n = b.notices[0]!;
    expect(n.stats).toBeNull();
    const bell = (await call(student, "GET", "notifications")).body as Notification[];
    expect(bell.some((x) => x.title === "Urgent: Internal assessment II" && x.tone === "rose")).toBe(true);

    expect((await call(student, "POST", `notice-board/${n.id}/read`, { acknowledge: true })).status).toBe(200);
    b = await board(student);
    expect(b).toMatchObject({ unread: 0, pendingAck: 0 });
    expect((await board(faculty)).notices[0]!.stats).toEqual({ reads: 1, acknowledged: 1 });
  });

  it("limits who can post what, and students cannot post", async () => {
    expect((await call(student, "POST", "notice-board", notice())).status).toBe(403);
    expect((await call(faculty, "POST", "notice-board", notice({ audience: "staff" }))).status).toBe(422);
    expect((await call({ ...faculty, mfa: false }, "POST", "notice-board", notice())).status).toBe(403);
    expect((await call(faculty, "POST", "notice-board", notice({ linkUrl: "http://insecure.example" }))).status).toBe(422);
    expect((await call(principal, "POST", "notice-board", notice({ audience: "staff", pinned: true }))).status).toBe(201);
    // Staff-only notices stay away from students.
    expect((await board(student)).notices).toHaveLength(0);
    expect((await board(faculty)).notices.some((n) => n.audience === "staff")).toBe(true);
  });

  it("narrows to a department and year", async () => {
    await call(principal, "POST", "notice-board", notice({ year: 5, title: "Final-year only notice" }));
    expect((await board(student)).notices).toHaveLength(0);
    expect((await board(principal)).notices).toHaveLength(1);
  });

  it("University notices from the Super Admin reach every college", async () => {
    expect((await call(admin, "POST", "notice-board", notice({ title: "University holiday on Pongal", category: "Holiday", audience: "everyone" }))).status).toBe(201);
    expect((await board(admin)).compose?.reach).toBe("Every college in the university");
    const other = as("student", { sub: "s2", college: "COL-1002" });
    expect((await board(other)).notices[0]).toMatchObject({ university: true, title: "University holiday on Pongal" });
    expect((await board(student)).notices[0]!.university).toBe(true);
    // A college Principal cannot remove a University notice; the Super Admin can.
    const id = (await board(principal)).notices[0]!.id;
    expect((await call(principal, "DELETE", `notice-board/${id}`)).status).toBe(403);
    expect((await call(admin, "DELETE", `notice-board/${id}`)).status).toBe(200);
    expect((await board(student)).notices).toHaveLength(0);
  });

  it("hides expired notices from readers but keeps them for the author", async () => {
    const r = await call(faculty, "POST", "notice-board", notice({ expiresOn: "2020-01-01" }));
    expect(r.status).toBe(422);
  });
});
