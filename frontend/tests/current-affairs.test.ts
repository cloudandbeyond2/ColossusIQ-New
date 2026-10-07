import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CaFeed, CaItem, Round, RoundResult } from "@/lib/api/exam-prep-schemas";
import { resetCurrentAffairsMemory } from "@/lib/api/mock/current-affairs-store";
import { resetPrepAttemptMemory } from "@/lib/api/mock/prep-attempt-store";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "student", name: "X", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const who = (sub: string, role: SessionPayload["role"] = "student", college = "COL-1001"): SessionPayload => ({ ...base, sub, role, college, name: sub });
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

const item = (over: Record<string, unknown> = {}) => ({
  date: today,
  category: "Science & Tech",
  headline: "ISRO completes a test of its reusable launch vehicle",
  summary: "The space agency carried out a landing experiment for its reusable launch vehicle programme.",
  sourceName: "PIB",
  sourceUrl: "https://pib.gov.in/PressReleasePage.aspx?PRID=1",
  tags: ["upsc-cse"],
  status: "Published",
  mcq: { question: "Which agency tested the reusable launch vehicle?", options: ["ISRO", "DRDO", "HAL", "BEL"], answer: 0, explanation: "ISRO runs the RLV programme." },
  ...over,
});

beforeEach(() => {
  resetCurrentAffairsMemory();
  resetPrepAttemptMemory();
});

describe("staff desk", () => {
  it("only teaching staff can write, inside one college, with MFA", async () => {
    expect((await call(who("s1"), "POST", "current-affairs", item())).status).toBe(403);
    expect((await call(who("pl", "placement"), "GET", "current-affairs")).status).toBe(403);
    expect((await call(who("ad", "admin", "all"), "POST", "current-affairs", item())).status).toBe(409);
    expect((await call({ ...who("f0", "faculty"), mfa: false }, "POST", "current-affairs", item())).status).toBe(403);
    const r = await call(who("f1", "faculty"), "POST", "current-affairs", item());
    expect(r.status).toBe(201);
    expect((r.body as CaItem).mcq!.answer).toBe(0);
  });
  it("accepts only https links to allowed sites", async () => {
    const f = who("f2", "faculty");
    for (const sourceUrl of ["http://pib.gov.in/x", "javascript:alert(1)", "https://evil.example.com/news", "https://user:pw@pib.gov.in/", "https://pib.gov.in.evil.com/"]) {
      expect((await call(f, "POST", "current-affairs", item({ sourceUrl }))).status, sourceUrl).toBe(422);
    }
    expect((await call(f, "POST", "current-affairs", item({ sourceUrl: "https://www.thehindu.com/news/national/x.ece" }))).status).toBe(201);
    expect((await call(f, "POST", "current-affairs", item({ mcq: { question: "Pick one of these options", options: ["A", "a", "B", "C"], answer: 0, explanation: "" } }))).status).toBe(422);
  });
  it("keeps colleges apart", async () => {
    await call(who("f3", "faculty"), "POST", "current-affairs", item());
    const other = (await call(who("f4", "faculty", "COL-1002"), "GET", "current-affairs")).body as CaFeed;
    expect(other.items).toHaveLength(0);
    const created = (await call(who("f3", "faculty"), "GET", "current-affairs")).body as CaFeed;
    expect((await call(who("f4", "faculty", "COL-1002"), "DELETE", `current-affairs/${created.items[0]!.id}`)).status).toBe(404);
  });
});

describe("student feed and weekly quiz", () => {
  it("hides drafts, future items and answers from students", async () => {
    const f = who("f5", "faculty");
    await call(f, "POST", "current-affairs", item());
    await call(f, "POST", "current-affairs", item({ status: "Draft", headline: "A draft item that is not ready yet" }));
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    await call(f, "POST", "current-affairs", item({ date: tomorrow, headline: "An item scheduled for tomorrow's feed" }));
    const feed = (await call(who("st1"), "GET", "current-affairs")).body as CaFeed;
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]!.mcq!.answer).toBeNull();
    expect(feed.items[0]!.mcq!.explanation).toBe("");
    expect(feed.canEdit).toBe(false);
    expect(((await call(f, "GET", "current-affairs")).body as CaFeed).items).toHaveLength(3);
  });
  it("builds a weekly quiz from published questions, once per week", async () => {
    const f = who("f6", "faculty");
    expect((await call(who("st2"), "POST", "exam-prep/ca-quiz/start")).status).toBe(409);
    for (let i = 0; i < 3; i++) await call(f, "POST", "current-affairs", item({ headline: `Item number ${i + 1} for this week's quiz` }));
    const r = await call(who("st2"), "POST", "exam-prep/ca-quiz/start");
    expect(r.status).toBe(201);
    const round = r.body as Round;
    expect(round.questions).toHaveLength(3);
    expect(JSON.stringify(round)).not.toMatch(/"answer"/);
    const res = (await call(who("st2"), "POST", `exam-prep/rounds/${round.id}/submit`, { answers: {} })).body as RoundResult;
    expect(res.kind).toBe("ca-quiz");
    expect((await call(who("st2"), "POST", "exam-prep/ca-quiz/start")).status).toBe(409);
    expect(((await call(who("st2"), "GET", "current-affairs")).body as CaFeed).weekly.done).toBe(true);
  });
});
