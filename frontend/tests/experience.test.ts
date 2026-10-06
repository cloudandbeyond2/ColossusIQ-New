import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { periodOf, thisMonth } from "@/lib/api/mock/experience";
import type { ExperienceItem, ExperienceOverview } from "@/lib/api/experience-schemas";
import type { Notification } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "student", name: "X", tenant: "uni-tntu", college: "COL-EXP-1", mfa: true, exp: 9e9 };
const who = (sub: string, role: SessionPayload["role"] = "student", college = base.college): SessionPayload => ({ ...base, sub, role, college, name: `${role}-${sub}` });
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const overview = async (s: SessionPayload) => (await call(s, "GET", "experience")).body as ExperienceOverview;
const draft = (over: Record<string, unknown> = {}) => ({ title: "NSS camp", category: "Social service", organisation: "NSS Unit", role: "Volunteer", startMonth: "2025-06", endMonth: "2025-08", description: "", link: "", ...over });
const add = async (s: SessionPayload, over: Record<string, unknown> = {}) => (await call(s, "POST", "experience", draft(over))).body as ExperienceItem;

describe("Experience Passport", () => {
  it("starts empty for a new student", async () => {
    const o = await overview(who("e-new"));
    expect(o.items).toEqual([]);
    expect(o.canReview).toBe(false);
    expect(o.summary).toEqual({ total: 0, verified: 0, pending: 0, rejected: 0 });
  });

  it("adds an activity as Pending with a readable period", async () => {
    const s = who("e-add");
    const r = await call(s, "POST", "experience", draft());
    expect(r.status).toBe(201);
    const it = r.body as ExperienceItem;
    expect(it.status).toBe("Pending");
    expect(it.period).toBe("Jun 2025 – Aug 2025");
    expect(it.mine).toBe(true);
    expect((await overview(s)).summary).toMatchObject({ total: 1, pending: 1 });
  });

  it("treats a missing end month as ongoing", async () => {
    const it = await add(who("e-ongoing"), { endMonth: null, startMonth: "2025-01" });
    expect(it.period).toBe("Jan 2025 – Present");
    expect(periodOf("2025-03", "2025-03")).toBe("Mar 2025");
  });

  it("rejects invalid input with field errors", async () => {
    const s = who("e-bad");
    const a = await call(s, "POST", "experience", draft({ title: "" }));
    expect(a.status).toBe(422);
    expect((a.body as { error: { fields: Record<string, string> } }).error.fields).toHaveProperty("title");
    expect((await call(s, "POST", "experience", draft({ category: "Piracy" }))).status).toBe(422);
    expect((await call(s, "POST", "experience", draft({ startMonth: "2025-13" }))).status).toBe(422);
    expect((await call(s, "POST", "experience", draft({ startMonth: "2025-08", endMonth: "2025-06" }))).status).toBe(422);
    expect((await call(s, "POST", "experience", draft({ link: "javascript:alert(1)" }))).status).toBe(422);
  });

  it("refuses a start month in the future", async () => {
    const [y, m] = thisMonth().split("-").map(Number);
    const next = `${m === 12 ? y! + 1 : y}-${String(m === 12 ? 1 : m! + 1).padStart(2, "0")}`;
    const r = await call(who("e-future"), "POST", "experience", draft({ startMonth: next, endMonth: null }));
    expect(r.status).toBe(422);
  });

  it("keeps each student's passport private", async () => {
    const a = who("e-priv-a");
    const b = who("e-priv-b");
    const it = await add(a);
    expect((await overview(b)).items).toEqual([]);
    expect((await call(b, "PUT", `experience/${it.id}`, { title: "Hacked" })).status).toBe(404);
    expect((await call(b, "DELETE", `experience/${it.id}`)).status).toBe(404);
    expect((await overview(a)).items[0]!.title).toBe("NSS camp");
  });

  it("lets staff see the whole college but not add activities", async () => {
    const s = who("e-col-s");
    await add(s, { title: "Hackathon" });
    const f = who("e-col-f", "faculty");
    const o = await overview(f);
    expect(o.canReview).toBe(true);
    expect(o.items.some((i) => i.title === "Hackathon" && i.studentName === s.name)).toBe(true);
    expect((await call(f, "POST", "experience", draft())).status).toBe(403);
  });

  it("does not leak across colleges", async () => {
    const s = who("e-iso-s", "student", "COL-EXP-2");
    const it = await add(s, { title: "Only here" });
    const other = who("e-iso-f", "faculty", "COL-EXP-3");
    expect((await overview(other)).items.some((i) => i.title === "Only here")).toBe(false);
    expect((await call(other, "POST", `experience/${it.id}/review`, { decision: "Verified", note: "" })).status).toBe(404);
  });

  it("verifies, records who did it, and notifies the student", async () => {
    const s = who("e-ver-s");
    const f = who("e-ver-f", "hod");
    const it = await add(s, { title: "Smart India Hackathon" });
    const r = await call(f, "POST", `experience/${it.id}/review`, { decision: "Verified", note: "Saw the certificate" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "Verified", reviewerName: f.name, reviewerRole: "HOD", reviewNote: "Saw the certificate" });
    const n = (await call(s, "GET", "notifications")).body as Notification[];
    expect(n.some((x) => x.title === "Verified: Smart India Hackathon")).toBe(true);
  });

  it("needs a note to send an activity back", async () => {
    const s = who("e-rej-s");
    const f = who("e-rej-f", "faculty");
    const it = await add(s);
    expect((await call(f, "POST", `experience/${it.id}/review`, { decision: "Rejected", note: "" })).status).toBe(422);
    const r = await call(f, "POST", `experience/${it.id}/review`, { decision: "Rejected", note: "Add the certificate link" });
    expect(r.body).toMatchObject({ status: "Rejected", reviewNote: "Add the certificate link" });
    const n = (await call(s, "GET", "notifications")).body as Notification[];
    expect(n.some((x) => x.title.startsWith("Needs changes") && x.body === "Add the certificate link")).toBe(true);
  });

  it("only staff can review", async () => {
    const s = who("e-role-s");
    const it = await add(s);
    expect((await call(s, "POST", `experience/${it.id}/review`, { decision: "Verified", note: "" })).status).toBe(403);
  });

  it("sends an edited, already-reviewed entry back to Pending", async () => {
    const s = who("e-edit-s");
    const f = who("e-edit-f", "faculty");
    const it = await add(s);
    await call(f, "POST", `experience/${it.id}/review`, { decision: "Verified", note: "ok" });
    const r = await call(s, "PUT", `experience/${it.id}`, { description: "Led a team of 10" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "Pending", reviewerName: "", reviewNote: "", reviewedAt: null, description: "Led a team of 10" });
  });

  it("rejects an edit that puts the end before the start", async () => {
    const s = who("e-edit-bad");
    const it = await add(s, { startMonth: "2025-06", endMonth: "2025-08" });
    expect((await call(s, "PUT", `experience/${it.id}`, { endMonth: "2025-05" })).status).toBe(422);
  });

  it("deletes your own activity", async () => {
    const s = who("e-del");
    const it = await add(s);
    expect((await call(s, "DELETE", `experience/${it.id}`)).status).toBe(200);
    expect((await overview(s)).items).toEqual([]);
  });

  it("tells faculty how many activities are waiting", async () => {
    const s = who("e-wait-s", "student", "COL-EXP-4");
    const f = who("e-wait-f", "faculty", "COL-EXP-4");
    await add(s);
    await add(s, { title: "Second" });
    const n = (await call(f, "GET", "notifications")).body as Notification[];
    expect(n.find((x) => x.id === "exp-waiting")?.title).toBe("2 activities to verify");
  });

  it("caps the passport at 100 activities", async () => {
    const s = who("e-cap");
    for (let i = 0; i < 100; i++) expect((await call(s, "POST", "experience", draft({ title: `Activity ${i}` }))).status).toBe(201);
    expect((await call(s, "POST", "experience", draft({ title: "One more" }))).status).toBe(409);
  });
});
