import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

vi.mock("server-only", () => ({}));

const model = vi.hoisted(() => ({ enabled: true, fail: false, prompts: [] as string[] }));
vi.mock("@/lib/ai/gemini", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/gemini")>();
  return {
    ...actual,
    geminiEnabled: () => model.enabled,
    geminiJson: async (schema: z.ZodTypeAny, o: { prompt: string }) => {
      model.prompts.push(o.prompt);
      if (model.fail) return { ok: false, reason: "http_500" };
      if (o.prompt.includes("Ask the first question")) {
        const p = schema.safeParse({ question: "Opening: tell me about your best project." });
        return p.success ? { ok: true, data: p.data } : { ok: false, reason: "schema" };
      }
      const q = Number(/Question (\d+) of (\d+):/.exec(o.prompt)![1]);
      const good = /<student_answer>\nGOOD/.test(o.prompt);
      const last = o.prompt.includes("This was the LAST question");
      const m = good ? 90 : 30;
      const data = {
        feedback: good ? "Clear and correct." : "Too vague.",
        scores: { content: m, technical: o.prompt.includes("Technical interview") ? m : null, clarity: m, structure: m, relevance: m },
        next: last ? null : { question: `Follow-up number ${q + 1}: what trade-off did you accept?`, kind: "follow-up" },
        report: last ? { summary: "A decent interview.", strengths: ["Clear answers"], improvements: ["Add numbers"] } : null,
      };
      const p = schema.safeParse(data);
      return p.success ? { ok: true, data: p.data } : { ok: false, reason: "schema" };
    },
  };
});

import { dispatch } from "@/lib/api/mock/router";
import { bankQuestion, buildScorecard, measureAnswer } from "@/lib/api/mock/interview";
import type { IvOverview, IvSession } from "@/lib/api/interview-schemas";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "student", name: "X", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const who = (sub: string, role: SessionPayload["role"] = "student"): SessionPayload => ({ ...base, sub, role });
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const home = async (s: SessionPayload) => (await call(s, "GET", "interview")).body as IvOverview;
const start = (s: SessionPayload, over: Record<string, unknown> = {}) => call(s, "POST", "interview/sessions", { mode: "technical", role: "Backend developer", questions: 3, ...over });
const answer = (s: SessionPayload, a: IvSession, text: string, over: Record<string, unknown> = {}) =>
  call(s, "POST", `interview/sessions/${a.id}/answer`, { n: a.turns[a.turns.length - 1]!.n, answer: text, seconds: 20, ...over });

beforeEach(() => {
  model.enabled = true;
  model.fail = false;
  model.prompts.length = 0;
});

describe("AI Mock Interview", () => {
  it("starts empty and is for students only", async () => {
    const o = await home(who("i-new"));
    expect(o.history).toEqual([]);
    expect(o.active).toBeNull();
    expect(o.stats).toEqual({ sessions: 0, best: null, average: null, last: null });
    expect((await call(who("i-f", "faculty"), "GET", "interview")).status).toBe(403);
    expect((await start(who("i-f", "faculty"))).status).toBe(403);
  });

  it("rejects a bad setup and an empty answer", async () => {
    const s = who("i-bad");
    expect((await start(s, { mode: "nope" })).status).toBe(422);
    expect((await start(s, { questions: 20 })).status).toBe(422);
    const a = (await start(s)).body as IvSession;
    expect((await answer(s, a, "")).status).toBe(422);
  });

  it("runs an AI interview and builds the scorecard from the marks", async () => {
    const s = who("i-ai");
    let a = (await start(s)).body as IvSession;
    expect(a.aiLive).toBe(true);
    expect(a.turns[0]!.question).toContain("Opening");
    a = (await answer(s, a, "GOOD answer with an example and 40% faster results")).body as IvSession;
    expect(a.turns).toHaveLength(2);
    expect(a.turns[0]!.scores!["Technical accuracy"]).toBe(90);
    expect(a.turns[1]!.kind).toBe("follow-up");
    a = (await answer(s, a, "GOOD again")).body as IvSession;
    a = (await answer(s, a, "bad vague thing")).body as IvSession;
    expect(a.status).toBe("done");
    const sc = a.scorecard!;
    expect(sc.aiMarked).toBe(true);
    expect(sc.dimensions.map((d) => d.name)).toContain("Technical accuracy");
    expect(sc.overall).toBeGreaterThan(55);
    expect(sc.overall).toBeLessThan(75); // two good answers, one weak: an average, not a made-up number
    expect(sc.summary).toBe("A decent interview.");
    const o = await home(s);
    expect(o.active).toBeNull();
    expect(o.history).toHaveLength(1);
    expect(o.stats.sessions).toBe(1);
  });

  it("works without the AI: bank questions, text-only marks and an honest scorecard", async () => {
    model.enabled = false;
    const s = who("i-off");
    let a = (await start(s, { mode: "hr", questions: 3 })).body as IvSession;
    expect(a.aiLive).toBe(false);
    expect(model.prompts).toHaveLength(0);
    a = (await answer(s, a, "I am a final year student who built a small app because I enjoy solving problems. For example I reduced load time by 30%. Finally I learned to test.")).body as IvSession;
    a = (await answer(s, a, "um basically I think maybe")).body as IvSession;
    a = (await answer(s, a, "", { skip: true })).body as IvSession;
    expect(a.status).toBe("done");
    expect(a.scorecard!.aiMarked).toBe(false);
    expect(a.scorecard!.dimensions.map((d) => d.name)).not.toContain("Technical accuracy");
    expect(a.scorecard!.summary).toContain("text only");
    expect(new Set(a.turns.map((t) => t.question)).size).toBe(3);
  });

  it("falls back to the bank when the AI fails mid-interview", async () => {
    const s = who("i-fail");
    let a = (await start(s)).body as IvSession;
    model.fail = true;
    a = (await answer(s, a, "some answer about my project and what I built")).body as IvSession;
    expect(a.turns[0]!.byAi).toBe(false);
    expect(a.turns[0]!.scores).not.toBeNull();
    expect(a.turns).toHaveLength(2);
  });

  it("ignores a stale or repeated answer", async () => {
    const s = who("i-stale");
    const a = (await start(s)).body as IvSession;
    expect((await answer(s, a, "GOOD one")).status).toBe(200);
    expect((await answer(s, a, "GOOD one again")).status).toBe(409);
    expect((await call(who("i-other"), "POST", `interview/sessions/${a.id}/answer`, { n: 1, answer: "x" })).status).toBe(404);
  });

  it("ending early scores only what was answered, and a short one does not count for readiness", async () => {
    const s = who("i-early");
    let a = (await start(s, { questions: 5 })).body as IvSession;
    expect((await call(s, "POST", `interview/sessions/${a.id}/end`, {})).status).toBe(200);
    expect((await home(s)).history).toEqual([]); // nothing answered: discarded
    a = (await start(s, { questions: 5 })).body as IvSession;
    a = (await answer(s, a, "GOOD answer")).body as IvSession;
    const o = (await call(s, "POST", `interview/sessions/${a.id}/end`, {})).body as IvOverview;
    expect(o.history[0]!.countsForReadiness).toBe(false);
    const done = (await call(s, "GET", `interview/sessions/${a.id}`)).body as IvSession;
    expect(done.scorecard!.endedEarly).toBe(true);
    expect(done.turns).toHaveLength(1);
  });

  it("deletes from history", async () => {
    const s = who("i-del");
    let a = (await start(s, { questions: 3 })).body as IvSession;
    for (let i = 0; i < 3; i++) a = (await answer(s, a, "GOOD")).body as IvSession;
    expect((await call(s, "DELETE", `interview/sessions/${a.id}`)).status).toBe(200);
    expect((await call(s, "DELETE", `interview/sessions/${a.id}`)).status).toBe(404);
    expect((await home(s)).history).toEqual([]);
  });

  it("measures how an answer reads, never whether it is correct", () => {
    const good = measureAnswer("Tell me about a project you built", "I built a library app because students queued for books. First I designed the data model, then I used React. As a result, checkout time fell by 40%.", 60, "behavioral");
    const poor = measureAnswer("Tell me about a project you built", "um basically I think maybe like not sure", 300, "behavioral");
    for (const k of ["Content", "Clarity", "Structure", "Confidence indicators", "Relevance"]) expect(good[k]!).toBeGreaterThan(poor[k]!);
  });

  it("builds a scorecard that counts a skipped question as zero", () => {
    const turn = (n: number, scores: Record<string, number> | null, skipped = false) => ({ n, question: `q${n}`, kind: "main" as const, answer: skipped ? null : "a", skipped, seconds: 0, byAi: true, feedback: "", scores });
    const sc = buildScorecard({ total: 2, turns: [turn(1, { Content: 80, Clarity: 60 }), turn(2, null, true)] }, null, false);
    expect(sc.dimensions).toEqual([{ name: "Content", score: 40 }, { name: "Clarity", score: 30 }]);
    expect(sc.overall).toBe(35);
    expect(bankQuestion({ mode: "hr", role: "", turns: [] }, { projects: [] })).toContain("Tell me about yourself");
  });
});
