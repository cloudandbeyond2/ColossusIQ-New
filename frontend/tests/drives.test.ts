import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { todayIst } from "@/lib/api/mock/drives";
import { meetsDrive, packageText, type DriveDetail, type DriveItem, type DriveOverview } from "@/lib/api/drive-schemas";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "placement", name: "Placement", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const who = (college: string, role: SessionPayload["role"] = "placement", sub = "p1"): SessionPayload => ({ ...base, college, role, sub });
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const home = async (s: SessionPayload) => (await call(s, "GET", "drives")).body as DriveOverview;
const shift = (days: number) => new Date(Date.parse(`${todayIst()}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const draft = (over: Record<string, unknown> = {}) => ({ company: "Acme Systems", role: "Graduate Engineer", type: "On-campus", date: shift(10), packageMin: 4, packageMax: 6, ...over });
const add = async (s: SessionPayload, over: Record<string, unknown> = {}) => call(s, "POST", "drives", draft(over));

describe("Placement Drives", () => {
  it("starts empty with the college's own departments and student count", async () => {
    const o = await home(who("COL-1001"));
    expect(o.items).toEqual([]);
    expect(o.canEdit).toBe(true);
    expect(o.students).toBeGreaterThan(0);
    expect(o.departments.length).toBeGreaterThan(0);
    expect(o.summary).toMatchObject({ total: 0, open: 0, upcoming: 0, completed: 0, offers: 0, averagePackage: null });
  });

  it("schedules a drive and counts the students who meet its rules", async () => {
    const s = who("COL-1001"); // a college that has students on the readiness board
    const before = (await home(s)).summary;
    const r = await add(s, { company: "Eligibility Co", status: "Open" });
    expect(r.status).toBe(201);
    const d = r.body as DriveItem;
    expect(d.phase).toBe("upcoming");
    expect(d.eligible).toBeGreaterThan(0); // no rules: everyone
    const strict = (await add(s, { company: "Strict Co", minReadiness: 100 })).body as DriveItem;
    expect(strict.eligible).toBeLessThanOrEqual(d.eligible);
    const after = (await home(s)).summary;
    expect(after.total - before.total).toBe(2);
    expect(after.open - before.open).toBe(1);
    expect(after.upcoming - before.upcoming).toBe(2);
  });

  it("narrows eligibility by department and lists those students", async () => {
    const s = who("COL-1001");
    const o = await home(s);
    const dept = o.departments[0]!;
    const d = (await add(s, { company: "Department Co", departments: [dept] })).body as DriveItem;
    const detail = (await call(s, "GET", `drives/${d.id}`)).body as DriveDetail;
    expect(detail.students).toHaveLength(d.eligible);
    expect(detail.students.every((x) => x.department === dept)).toBe(true);
    expect(detail.students.every((x) => /\u2022/.test(x.rollNo) || x.rollNo.length <= 4)).toBe(true); // masked like the readiness board
    const sorted = [...detail.students].sort((a, b) => b.total - a.total);
    expect(detail.students.map((x) => x.total)).toEqual(sorted.map((x) => x.total));
  });

  it("validates the form", async () => {
    const s = who("COL-D-3");
    expect((await add(s, { company: "" })).status).toBe(422);
    expect((await add(s, { date: "2026-02-31" })).status).toBe(422);
    expect((await add(s, { packageMin: 8, packageMax: 4 })).status).toBe(422);
    expect((await add(s, { deadline: shift(20) })).status).toBe(422);
    expect((await add(s, { registered: 5, shortlisted: 9 })).status).toBe(422);
    expect((await add(s, { registered: 5, offers: 9 })).status).toBe(422);
    expect((await add(s, { time: "25:00" })).status).toBe(422);
    expect((await add(s, { surprise: 1 })).status).toBe(422);
    const r = await add(s, { status: "Completed" }); // date is in the future
    expect(r.status).toBe(422);
    expect((r.body as { error: { fields: Record<string, string> } }).error.fields.status).toContain("Completed");
  });

  it("refuses a duplicate drive", async () => {
    const s = who("COL-D-4");
    expect((await add(s)).status).toBe(201);
    expect((await add(s, { company: "acme systems" })).status).toBe(409);
    expect((await add(s, { date: shift(11) })).status).toBe(201);
  });

  it("edits a drive and records how it went", async () => {
    const s = who("COL-D-5");
    const d = (await add(s, { date: shift(-3), status: "Open" })).body as DriveItem;
    expect(d.phase).toBe("past");
    const r = await call(s, "PUT", `drives/${d.id}`, draft({ date: shift(-3), status: "Completed", packageMin: 5, packageMax: 7, registered: 40, shortlisted: 12, offers: 5 }));
    expect(r.status).toBe(200);
    const o = await home(s);
    expect(o.summary).toMatchObject({ completed: 1, offers: 5, averagePackage: 6, upcoming: 0 });
    expect((await call(s, "PUT", `drives/missing`, draft())).status).toBe(404);
  });

  it("deletes a drive", async () => {
    const s = who("COL-D-6");
    const d = (await add(s)).body as DriveItem;
    expect((await call(s, "DELETE", `drives/${d.id}`)).status).toBe(200);
    expect((await call(s, "DELETE", `drives/${d.id}`)).status).toBe(404);
    expect((await call(s, "GET", `drives/${d.id}`)).status).toBe(404);
  });

  it("keeps each college's drives to itself", async () => {
    const a = who("COL-D-7");
    const b = who("COL-D-8", "placement", "p2");
    const d = (await add(a)).body as DriveItem;
    expect((await home(b)).items).toEqual([]);
    expect((await call(b, "GET", `drives/${d.id}`)).status).toBe(404);
    expect((await call(b, "DELETE", `drives/${d.id}`)).status).toBe(404);
    expect((await call(b, "PUT", `drives/${d.id}`, draft())).status).toBe(404);
  });

  it("lets leaders read but only the placement officer change", async () => {
    const owner = who("COL-D-9");
    const d = (await add(owner)).body as DriveItem;
    const hod = who("COL-D-9", "hod", "h1");
    const o = await home(hod);
    expect(o.items).toHaveLength(1);
    expect(o.canEdit).toBe(false);
    expect((await call(hod, "POST", "drives", draft({ company: "Other" }))).status).toBe(403);
    expect((await call(hod, "PUT", `drives/${d.id}`, draft())).status).toBe(403);
    expect((await call(hod, "DELETE", `drives/${d.id}`)).status).toBe(403);
    expect((await call(who("COL-D-9", "student", "s1"), "GET", "drives")).status).toBe(403);
    expect((await call(who("COL-D-9", "faculty", "f1"), "POST", "drives", draft())).status).toBe(403);
  });

  it("applies the eligibility rule and formats packages", () => {
    expect(meetsDrive({ departments: [], minReadiness: 0 }, { department: "CSE", total: 0 })).toBe(true);
    expect(meetsDrive({ departments: ["CSE"], minReadiness: 60 }, { department: "CSE", total: 60 })).toBe(true);
    expect(meetsDrive({ departments: ["CSE"], minReadiness: 60 }, { department: "ECE", total: 90 })).toBe(false);
    expect(meetsDrive({ departments: [], minReadiness: 60 }, { department: "ECE", total: 59 })).toBe(false);
    expect(packageText(0, 0)).toBe("Not stated");
    expect(packageText(6, 6)).toBe("₹6 LPA");
    expect(packageText(4.5, 8)).toBe("₹4.5–8 LPA");
  });
});

