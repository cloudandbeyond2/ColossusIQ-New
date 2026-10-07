import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// AI is "on" for these tests, with fixed drafts.
vi.mock("@/lib/ai/gemini", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/gemini")>()), geminiEnabled: () => true }));
vi.mock("@/lib/api/mock/content-desk-ai", async (orig) => {
  const real = await orig<typeof import("@/lib/api/mock/content-desk-ai")>();
  return {
    ...real,
    draftContent: async (g: { kind: string; date?: string; sourceName?: string }) =>
      g.kind === "current-affair"
        ? [{ title: "RBI keeps the repo rate at 6.5 per cent", data: { date: g.date, category: "Economy", headline: "RBI keeps the repo rate at 6.5 per cent", summary: "The Monetary Policy Committee kept the repo rate unchanged at 6.5 per cent for the sixth time.", sourceName: g.sourceName, sourceUrl: "", mcq: { question: "What is the repo rate after the policy review?", options: ["6.0%", "6.25%", "6.5%", "6.75%"], answer: 2, explanation: "Unchanged at 6.5%." } } }]
        : null,
  };
});

import { DeskOverview } from "@/lib/api/content-desk-schemas";
import { CaFeed } from "@/lib/api/exam-prep-schemas";
import { resetContentMemory } from "@/lib/api/mock/content-store";
import { resetCurrentAffairsMemory } from "@/lib/api/mock/current-affairs-store";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";

const admin: SessionPayload = { sub: "demo-admin", role: "admin", name: "Super Admin", tenant: "uni-tntu", college: "all", mfa: true, exp: 9e9 };
const student: SessionPayload = { ...admin, sub: "demo-student", role: "student", name: "Student", college: "COL-1001" };
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const desk = async () => DeskOverview.parse((await call(admin, "GET", "content-desk")).body);
const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const feed = async (s = student) => CaFeed.parse((await call(s, "GET", "current-affairs")).body);

beforeEach(() => {
  resetContentMemory();
  resetCurrentAffairsMemory();
});

describe("University Content Desk", () => {
  it("is for the Super Admin at All colleges only", async () => {
    expect((await call(student, "GET", "content-desk")).status).toBe(403);
    expect((await call({ ...admin, college: "COL-1001" }, "GET", "content-desk")).status).toBe(409);
    expect((await desk()).colleges.length).toBeGreaterThan(1);
  });

  it("AI drafts wait for review; publishing after verification reaches students; withdrawing removes it", async () => {
    const before = (await feed()).items.length;
    const gen = await call(admin, "POST", "content-desk/generate", { kind: "current-affair", sourceText: "x".repeat(100), sourceName: "PIB", sourceUrl: "", date: today, count: 1 });
    expect(gen.status).toBe(201);
    const item = DeskOverview.parse(gen.body).items[0]!;
    expect(item).toMatchObject({ status: "In review", source: "AI" });
    // Nothing reaches students before it is verified and published.
    expect((await feed()).items.length).toBe(before);

    expect((await call(admin, "POST", `content-desk/${item.id}/publish`, { verified: false, targets: "all" })).status).toBe(422);
    const pub = await call(admin, "POST", `content-desk/${item.id}/publish`, { verified: true, targets: ["COL-1001"] });
    expect(pub.status).toBe(200);
    expect(DeskOverview.parse(pub.body).items[0]).toMatchObject({ status: "Published", reach: 1, verifiedBy: "Super Admin" });
    expect((await feed()).items.some((i) => i.headline === "RBI keeps the repo rate at 6.5 per cent")).toBe(true);
    // Another college was not chosen.
    expect((await feed({ ...student, college: "COL-1002" })).items.some((i) => i.headline.startsWith("RBI"))).toBe(false);
    // Published items cannot be edited until withdrawn.
    expect((await call(admin, "PUT", `content-desk/${item.id}`, { data: item.data, targets: "all" })).status).toBe(409);

    expect((await call(admin, "POST", `content-desk/${item.id}/withdraw`)).status).toBe(200);
    expect((await feed()).items.some((i) => i.headline.startsWith("RBI"))).toBe(false);
  });

  it("question sets publish only approved questions into each college's Question Bank", async () => {
    const data = {
      subject: "Database Management Systems",
      items: [
        { question: "Define second normal form with an example.", topic: "Normalization", difficulty: "Medium", bloom: "Understand", co: "CO2", marks: 5, explanation: "No partial dependency.", approved: true },
        { question: "A question the reviewer did not approve.", topic: "Normalization", difficulty: "Easy", bloom: "Remember", co: "CO2", marks: 2, explanation: "", approved: false },
      ],
    };
    const r = await call(admin, "POST", "content-desk", { kind: "question-set", data, targets: ["COL-1001"] });
    expect(r.status).toBe(201);
    const item = DeskOverview.parse(r.body).items[0]!;
    expect(item.status).toBe("Draft");
    const faculty = { ...student, role: "faculty" as const, sub: "demo-faculty" };
    const count = async () => ((await call(faculty, "GET", "records/questions", undefined)).body as { total: number }).total;
    const before = await count();
    expect((await call(admin, "POST", `content-desk/${item.id}/publish`, { verified: true, targets: ["COL-1001"] })).status).toBe(200);
    expect(await count()).toBe(before + 1);
    await call(admin, "POST", `content-desk/${item.id}/withdraw`);
    expect(await count()).toBe(before);
  });

  it("validates hand-written content and rejects with a reason", async () => {
    expect((await call(admin, "POST", "content-desk", { kind: "event", data: { title: "Hi" }, targets: "all" })).status).toBe(422);
    const ok = await call(admin, "POST", "content-desk", { kind: "event", data: { title: "Inter-college AI Hackathon", type: "Hackathon", date: today, startTime: "09:00", venue: "Each college campus", organiser: "University", capacity: 300, registrationOpen: true, description: "24 hours, teams of four." }, targets: "all" });
    expect(ok.status).toBe(201);
    const id = DeskOverview.parse(ok.body).items[0]!.id;
    expect((await call(admin, "POST", `content-desk/${id}/reject`, { note: "" })).status).toBe(422);
    const rej = await call(admin, "POST", `content-desk/${id}/reject`, { note: "Clashes with exams" });
    expect(DeskOverview.parse(rej.body).items[0]).toMatchObject({ status: "Rejected", reviewNote: "Clashes with exams" });
    expect((await call({ ...admin, mfa: false }, "DELETE", `content-desk/${id}`)).status).toBe(403);
    expect((await call(admin, "DELETE", `content-desk/${id}`)).status).toBe(200);
  });
});
