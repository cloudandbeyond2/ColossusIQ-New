import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { APTITUDE_KINDS, aptitudeOfKind, aptitudeRound, vocabularyRound, WORDS } from "@/lib/api/mock/refresh-zone-content";
import { dispatch } from "@/lib/api/mock/router";
import type { PlayResult, RefreshOverview, Round, RoundResult } from "@/lib/api/refresh-zone-schemas";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "student", name: "X", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const who = (sub: string, role: SessionPayload["role"] = "student"): SessionPayload => ({ ...base, sub, role });
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const home = async (s: SessionPayload) => (await call(s, "GET", "refresh-zone")).body as RefreshOverview;
const card = (o: RefreshOverview, id: string) => o.activities.find((a) => a.id === id)!;

describe("question generators", () => {
  it("always gives four distinct options and a valid answer", () => {
    for (const kind of APTITUDE_KINDS) {
      for (let i = 0; i < 300; i++) {
        const g = aptitudeOfKind(kind, Math.random);
        expect(new Set(g.options).size, `${kind}: ${g.prompt}`).toBe(4);
        expect(g.answer).toBeGreaterThanOrEqual(0);
        expect(g.answer).toBeLessThan(4);
        expect(g.options.join()).not.toMatch(/NaN|undefined|-\d/);
      }
    }
  });
  it("computes the answers (percentage, time and work, average)", () => {
    for (let i = 0; i < 200; i++) {
      const p = aptitudeOfKind("percent", Math.random);
      const [, pc, n] = /What is (\d+)% of (\d+)\?/.exec(p.prompt)!;
      expect(p.options[p.answer]).toBe(String((Number(pc) * Number(n)) / 100));
      const w = aptitudeOfKind("timeWork", Math.random);
      const [, a, b] = /in (\d+) days and B in (\d+) days/.exec(w.prompt)!;
      expect(Number.parseInt(w.options[w.answer]!)).toBe((Number(a) * Number(b)) / (Number(a) + Number(b)));
      const m = aptitudeOfKind("missingNumber", Math.random);
      const [, mean, known] = /is (\d+)\. Four of them are ([\d, ]+)\./.exec(m.prompt)!;
      expect(Number(m.options[m.answer])).toBe(Number(mean) * 5 - known!.split(",").reduce((s, v) => s + Number(v), 0));
    }
  });
  it("builds a round of different questions", () => {
    const r = aptitudeRound(10);
    expect(r).toHaveLength(10);
    expect(new Set(r.map((x) => x.prompt)).size).toBe(10);
  });
  it("asks each vocabulary word with its own meaning as the answer", () => {
    const meanings = new Map(WORDS.map(([w, m]) => [w, m]));
    for (const v of vocabularyRound(10)) {
      const word = /“(.+)”/.exec(v.prompt)![1]!;
      expect(v.options[v.answer]).toBe(meanings.get(word));
      expect(new Set(v.options).size).toBe(4);
    }
  });
});

describe("Refresh Zone", () => {
  it("starts empty for a new student", async () => {
    const o = await home(who("rz-new"));
    expect(o.today.plays).toBe(0);
    expect(o.streak).toEqual({ current: 0, longest: 0 });
    expect(o.activities).toHaveLength(5);
    expect(card(o, "aptitude")).toMatchObject({ available: true, plays: 0, best: null });
    expect(o.week).toHaveLength(7);
  });

  it("plays a quiz round: no answer key out, server scores it, best is kept per student", async () => {
    const s = who("rz-a");
    const start = await call(s, "POST", "refresh-zone/rounds", { activity: "vocabulary" });
    expect(start.status).toBe(201);
    const round = start.body as Round;
    expect(round.questions).toHaveLength(10);
    expect(JSON.stringify(round)).not.toMatch(/"answer"|"explanation"/);

    // Answer by looking the meanings up, the way a student who knows the words would.
    const { WORDS: words } = await import("@/lib/api/mock/refresh-zone-content");
    const meanings = new Map(words.map(([w, m]) => [w, m]));
    const answers: Record<string, number> = {};
    round.questions.forEach((x, i) => {
      const word = /“(.+)”/.exec(x.prompt)![1]!;
      if (i < 7) answers[x.id] = x.options.indexOf(meanings.get(word)!);
    });
    const done = await call(s, "POST", `refresh-zone/rounds/${round.id}/submit`, { answers });
    expect(done.status).toBe(200);
    const r = done.body as RoundResult;
    expect(r).toMatchObject({ score: 7, total: 10, percentage: 70, newBest: true, best: 70 });
    expect(r.review.filter((x) => !x.correct)).toHaveLength(3);

    // A round can be submitted once.
    expect((await call(s, "POST", `refresh-zone/rounds/${round.id}/submit`, { answers })).status).toBe(404);

    const o = await home(s);
    expect(card(o, "vocabulary")).toMatchObject({ plays: 1, best: 70, last: 70 });
    expect(o.today.plays).toBe(1);
    expect(o.streak.current).toBe(1);
    expect(o.totals).toMatchObject({ answered: 10, correct: 7 });
    expect(card(await home(who("rz-b")), "vocabulary").plays).toBe(0);
  });

  it("rejects a round that is not the student's current one", async () => {
    const s = who("rz-c");
    const first = (await call(s, "POST", "refresh-zone/rounds", { activity: "aptitude" })).body as Round;
    const second = (await call(s, "POST", "refresh-zone/rounds", { activity: "aptitude" })).body as Round;
    expect((await call(s, "POST", `refresh-zone/rounds/${first.id}/submit`, { answers: {} })).status).toBe(404);
    expect((await call(who("rz-d"), "POST", `refresh-zone/rounds/${second.id}/submit`, { answers: {} })).status).toBe(404);
    const done = await call(s, "POST", `refresh-zone/rounds/${second.id}/submit`, { answers: {} });
    expect(done.body).toMatchObject({ score: 0, percentage: 0 });
  });

  it("keeps the highest score as best", async () => {
    const s = who("rz-e");
    const play = async (n: number) => {
      const round = (await call(s, "POST", "refresh-zone/rounds", { activity: "aptitude" })).body as Round;
      const res = await call(s, "POST", `refresh-zone/rounds/${round.id}/submit`, { answers: Object.fromEntries(round.questions.slice(0, n).map((x) => [x.id, 0])) });
      return res.body as RoundResult;
    };
    const a = await play(10);
    const b = await play(0);
    expect(b.best).toBe(a.best);
    expect(b.newBest).toBe(false);
  });

  it("saves memory levels and breathing minutes, clamped", async () => {
    const s = who("rz-f");
    expect((await call(s, "POST", "refresh-zone/memory", { level: 6 })).body).toMatchObject({ best: 6, newBest: true, plays: 1 });
    expect((await call(s, "POST", "refresh-zone/memory", { level: 4 })).body).toMatchObject({ best: 6, newBest: false, plays: 2 });
    expect((await call(s, "POST", "refresh-zone/memory", { level: 99 })).status).toBe(422);
    const b = (await call(s, "POST", "refresh-zone/breathing", { seconds: 120 })).body as PlayResult;
    expect(b.best).toBe(2);
    expect((await call(s, "POST", "refresh-zone/breathing", { seconds: 5 })).status).toBe(422);
    const o = await home(s);
    expect(card(o, "memory")).toMatchObject({ best: 6, plays: 2 });
    expect(card(o, "breathing")).toMatchObject({ best: 2, plays: 1 });
    expect(o.today.plays).toBe(3);
    expect(o.totals.minutes).toBe(2);
  });

  it("plays the subject quiz from the college's question banks", async () => {
    const s = who("rz-g");
    expect(card(await home(s), "subject").available).toBe(true);
    const res = await call(s, "POST", "refresh-zone/rounds", { activity: "subject" });
    expect(res.status).toBe(201);
    expect((res.body as Round).questions.length).toBeGreaterThanOrEqual(5);
  });

  it("is for students only and validates input", async () => {
    expect((await call(who("rz-fac", "faculty"), "GET", "refresh-zone")).status).toBe(403);
    expect((await call(who("rz-h"), "POST", "refresh-zone/rounds", { activity: "chess" })).status).toBe(422);
    expect((await call(who("rz-h"), "DELETE", "refresh-zone")).status).toBe(404);
  });
});
