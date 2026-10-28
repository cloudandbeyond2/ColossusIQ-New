import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { resetEventPlansMemory } from "@/lib/api/mock/event-plans";
import type { SessionPayload } from "@/lib/auth/session";
import type { SavedEventPlan } from "@/lib/api/event-plan-schemas";

const base: SessionPayload = { sub: "f-1", role: "faculty", name: "Dr Rao", tenant: "TNTU", college: "COL-1001", mfa: true, exp: 9999999999 };
const who = (role: SessionPayload["role"], sub: string, college = "COL-1001"): SessionPayload => ({ ...base, role, sub, college, name: `Name ${sub}` });
const call = (s: SessionPayload, method: string, path: string, body?: unknown) =>
  dispatch(method, path.split("/"), body === undefined ? undefined : JSON.stringify(body), s, new URLSearchParams());

const plan = (over: Record<string, unknown> = {}) => ({
  plan: { id: "PLAN-1", title: "Tech Fest", category: "Hackathon", status: "Draft", budget: 50000, audience: 200, sessions: [{ id: "s1", title: "Keynote" }], ...over },
});

describe("event generator saved plans", () => {
  beforeEach(() => resetEventPlansMemory());

  it("starts empty and saves a plan for the whole college", async () => {
    const author = who("faculty", "f-1");
    expect(((await call(author, "GET", "event-plans")).body as { plans: SavedEventPlan[] }).plans).toEqual([]);

    const res = await call(author, "POST", "event-plans", plan());
    expect(res.status).toBe(201);
    const saved = res.body as SavedEventPlan;
    expect(saved.id).not.toBe("PLAN-1");
    expect(saved.plan.title).toBe("Tech Fest");
    expect(saved.plan.sessions).toEqual([{ id: "s1", title: "Keynote" }]);
    expect(saved.canEdit).toBe(true);

    // a colleague (HOD) and the Principal see it; another college does not
    const hod = (await call(who("hod", "h-1"), "GET", "event-plans")).body as { plans: SavedEventPlan[] };
    expect(hod.plans.map((p) => p.id)).toEqual([saved.id]);
    expect(hod.plans[0]?.canEdit).toBe(false);
    expect(((await call(who("institution", "p-1"), "GET", "event-plans")).body as { plans: SavedEventPlan[] }).plans[0]?.canEdit).toBe(true);
    expect(((await call(who("faculty", "f-9", "COL-1002"), "GET", "event-plans")).body as { plans: SavedEventPlan[] }).plans).toEqual([]);
  });

  it("only the author or the Principal can change or delete a plan", async () => {
    const saved = (await call(who("faculty", "f-1"), "POST", "event-plans", plan())).body as SavedEventPlan;
    const hod = who("hod", "h-1");
    expect((await call(hod, "PUT", `event-plans/${saved.id}`, plan({ title: "Hijacked" }))).status).toBe(403);
    expect((await call(hod, "DELETE", `event-plans/${saved.id}`)).status).toBe(403);

    const upd = await call(who("faculty", "f-1"), "PUT", `event-plans/${saved.id}`, plan({ title: "Tech Fest 2", status: "Published" }));
    expect(upd.status).toBe(200);
    expect((upd.body as SavedEventPlan).plan).toMatchObject({ title: "Tech Fest 2", status: "Published" });

    expect((await call(who("institution", "p-1"), "DELETE", `event-plans/${saved.id}`)).status).toBe(200);
    expect(((await call(hod, "GET", "event-plans")).body as { plans: SavedEventPlan[] }).plans).toEqual([]);
    expect((await call(who("faculty", "f-1"), "DELETE", `event-plans/${saved.id}`)).status).toBe(404);
  });

  it("rejects bad input and other roles", async () => {
    const f = who("faculty", "f-1");
    expect((await call(f, "POST", "event-plans", plan({ title: "" }))).status).toBe(400);
    expect((await call(f, "POST", "event-plans", plan({ category: "Party" }))).status).toBe(400);
    expect((await call(f, "POST", "event-plans", plan({ blob: "x".repeat(300_000) }))).status).toBe(400);
    expect((await call(who("student", "s-1"), "GET", "event-plans")).status).toBe(403);
    expect((await call(who("placement", "pl-1"), "POST", "event-plans", plan())).status).toBe(403);
  });
});
