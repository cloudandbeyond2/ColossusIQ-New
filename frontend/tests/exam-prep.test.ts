import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Catalogue, DailyStatus, ExamDetail, PrepOverview, Round, RoundResult, StoredPrep } from "@/lib/api/exam-prep-schemas";
import { resetPrepAttemptMemory } from "@/lib/api/mock/prep-attempt-store";
import { dispatch } from "@/lib/api/mock/router";
import { studentStateStore } from "@/lib/api/mock/student-state-store";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "student", name: "X", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const who = (sub: string, role: SessionPayload["role"] = "student", college = "COL-1001"): SessionPayload => ({ ...base, sub, role, college });
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const state = async (s: SessionPayload) => (await studentStateStore().get(s.sub, "exam-prep-hub")) as StoredPrep;
const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => resetPrepAttemptMemory());

describe("access", () => {
  it("is for students only", async () => {
    for (const role of ["faculty", "hod", "placement", "admin"] as const) expect((await call(who("p-" + role, role), "GET", "exam-prep")).status).toBe(403);
    expect((await call(who("p-student"), "GET", "exam-prep")).status).toBe(200);
  });
});

describe("catalogue and eligibility", () => {
  it("lists 30+ exams with an eligibility verdict for the student", async () => {
    const r = await call(who("cat-1"), "GET", "exam-prep/catalogue");
    const c = r.body as Catalogue;
    expect(c.exams.length).toBeGreaterThanOrEqual(30);
    const by = (id: string) => c.exams.find((e) => e.id === id)!;
    // The demo engineering student is in semester 5 (third year) of B.E.
    expect(by("gate").eligibility).toBe("eligible-final-year");
    expect(by("ssc-chsl").eligibility).toBe("eligible");
    expect(by("upsc-cse").eligibility).toBe("not-yet");
    expect(by("ugc-net").eligibility).toBe("not-yet");
    expect(by("ctet").eligibility).toBe("check-notification");
    expect(by("neet-pg").eligibility).toBe("not-yet");
    expect(c.disclaimer).toMatch(/official notification/);
  });
  it("shows an exam's pattern, topics and practice-mock size", async () => {
    const d = (await call(who("cat-2"), "GET", "exam-prep/exams/ssc-cgl")).body as ExamDetail;
    expect(d.sections).toHaveLength(4);
    expect(d.sections[0]!.negative).toBe(0.5);
    expect(d.mock).toEqual({ questions: 40, minutes: 24, scaled: true, full: { questions: 100, minutes: 60 } });
    expect((await call(who("cat-2"), "GET", "exam-prep/exams/nope")).status).toBe(404);
  });
});

describe("targets", () => {
  it("saves up to three targets with future dates", async () => {
    const s = who("t-1");
    const r = await call(s, "PUT", "exam-prep/targets", { targets: [{ examId: "gate", date: inDays(120) }, { examId: "cat", date: null }] });
    expect(r.status).toBe(200);
    const o = r.body as PrepOverview;
    expect(o.targets.map((t) => t.examId)).toEqual(["gate", "cat"]);
    expect(o.targets[0]!.daysLeft).toBe(120);
    expect(o.targets[0]!.readiness).toBeNull();
  });
  it("rejects bad targets", async () => {
    const s = who("t-2");
    const four = ["gate", "cat", "ssc-cgl", "ibps-po"].map((examId) => ({ examId, date: null }));
    expect((await call(s, "PUT", "exam-prep/targets", { targets: four })).status).toBe(422);
    expect((await call(s, "PUT", "exam-prep/targets", { targets: [{ examId: "gate", date: inDays(-1) }] })).status).toBe(422);
    expect((await call(s, "PUT", "exam-prep/targets", { targets: [{ examId: "made-up", date: null }] })).status).toBe(422);
    expect((await call(s, "PUT", "exam-prep/targets", { targets: [{ examId: "gate", date: null }, { examId: "gate", date: null }] })).status).toBe(422);
  });
});

describe("rounds never send answer keys", () => {
  it("daily, practice, English and mock rounds carry prompts and options only", async () => {
    const s = who("k-1");
    const rounds = [
      await call(s, "POST", "exam-prep/practice", { topicId: "q-interest" }),
      await call(s, "POST", "exam-prep/english/rounds", { kind: "error-spotting" }),
      await call(s, "POST", "exam-prep/mocks/ibps-po/start"),
      await call(s, "POST", "exam-prep/daily/start"),
    ];
    for (const r of rounds) {
      expect(r.status).toBe(201);
      const json = JSON.stringify(r.body);
      expect(json).not.toMatch(/"answer"|"explanation"/);
    }
  });
});

describe("daily aptitude test", () => {
  it("is the same for two students of a college and allows one attempt a day", async () => {
    const a = (await call(who("d-a"), "POST", "exam-prep/daily/start")).body as Round;
    const b = (await call(who("d-b"), "POST", "exam-prep/daily/start")).body as Round;
    expect(a.questions.map((x) => x.prompt)).toEqual(b.questions.map((x) => x.prompt));
    expect(a.questions).toHaveLength(10);
    const done = await call(who("d-a"), "POST", `exam-prep/rounds/${a.id}/submit`, { answers: { q1: 0 } });
    expect(done.status).toBe(200);
    expect((done.body as RoundResult).xp).toBe(15);
    expect(((await call(who("d-a"), "GET", "exam-prep/daily")).body as DailyStatus).done).toBe(true);
    expect((await call(who("d-a"), "POST", "exam-prep/daily/start")).status).toBe(409);
    expect((await call(who("d-a"), "POST", `exam-prep/rounds/${a.id}/submit`, { answers: {} })).status).toBe(404);
  });
});

describe("practice mocks", () => {
  it("applies negative marking per section", async () => {
    const s = who("m-1");
    const r = (await call(s, "POST", "exam-prep/mocks/ibps-po/start")).body as Round;
    const key = (await state(s)).pending!.questions.map((x) => x.answer);
    // Right on q1, wrong on q2, the rest left blank.
    const res = (await call(s, "POST", `exam-prep/rounds/${r.id}/submit`, { answers: { q1: key[0]!, q2: (key[1]! + 1) % 4 } })).body as RoundResult;
    expect(res.correct).toBe(1);
    expect(res.wrong).toBe(1);
    expect(res.skipped).toBe(r.questions.length - 2);
    expect(res.score).toBe(0.75);
    expect(res.max).toBe(r.questions.length);
    expect(res.sections).toHaveLength(3);
    expect(res.timedOut).toBe(false);
    expect(res.percentile).toBeNull();
  });
  it("still grades a test submitted after time is up", async () => {
    const s = who("m-2");
    const r = (await call(s, "POST", "exam-prep/mocks/ssc-chsl/start")).body as Round;
    const st = await state(s);
    st.pending!.startedAt -= (r.durationSec + 120) * 1000;
    await studentStateStore().save(s.college, s.sub, "exam-prep-hub", st);
    const res = (await call(s, "POST", `exam-prep/rounds/${r.id}/submit`, { answers: { q1: st.pending!.questions[0]!.answer } })).body as RoundResult;
    expect(res.timedOut).toBe(true);
    expect(res.correct).toBe(1);
  });
  it("shows a percentile only once five attempts exist", async () => {
    let last: RoundResult | null = null;
    for (let i = 0; i < 5; i++) {
      const s = who(`pc-${i}`);
      const r = (await call(s, "POST", "exam-prep/mocks/sbi-po/start")).body as Round;
      last = (await call(s, "POST", `exam-prep/rounds/${r.id}/submit`, { answers: {} })).body as RoundResult;
      if (i < 4) expect(last.percentile).toBeNull();
    }
    expect(last!.peers).toBe(5);
    expect(last!.percentile).not.toBeNull();
  });
  it("has no mock for TNEA (admission on marks)", async () => {
    expect((await call(who("m-3"), "POST", "exam-prep/mocks/tnea/start")).status).toBe(404);
  });
});

describe("personal plan", () => {
  it("tracks topic accuracy, weak topics and today's tasks", async () => {
    const s = who("plan-1");
    await call(s, "PUT", "exam-prep/targets", { targets: [{ examId: "ssc-cgl", date: inDays(45) }] });
    for (let i = 0; i < 2; i++) {
      const r = (await call(s, "POST", "exam-prep/practice", { topicId: "q-speed" })).body as Round;
      await call(s, "POST", `exam-prep/rounds/${r.id}/submit`, { answers: {} });
      const r2 = (await call(s, "POST", "exam-prep/practice", { topicId: "q-speed" })).body as Round;
      const key = (await state(s)).pending!.questions.map((x) => (x.answer + 1) % 4);
      await call(s, "POST", `exam-prep/rounds/${r2.id}/submit`, { answers: Object.fromEntries(key.map((v, j) => [`q${j + 1}`, v])) });
    }
    const o = (await call(s, "GET", "exam-prep")).body as PrepOverview;
    expect(o.weakTopics[0]?.id).toBe("q-speed");
    expect(o.weakTopics[0]?.accuracy).toBe(0);
    expect(o.tasks.find((t) => t.id === "drill")!.done).toBe(true);
    expect(o.tasks.find((t) => t.id === "mock")).toBeDefined();
    expect(o.targets[0]!.readiness).not.toBeNull();
    expect(o.plan).toHaveLength(7);
    expect(o.streak.current).toBe(1);
  });
});

describe("XP & Badges", () => {
  it("counts exam-prep tests and drills towards XP", async () => {
    const s = who("xp-1");
    const d = (await call(s, "POST", "exam-prep/daily/start")).body as Round;
    await call(s, "POST", `exam-prep/rounds/${d.id}/submit`, { answers: {} });
    const p = (await call(s, "POST", "exam-prep/practice", { topicId: "r-coding" })).body as Round;
    await call(s, "POST", `exam-prep/rounds/${p.id}/submit`, { answers: {} });
    const o = (await call(s, "GET", "achievements")).body as { breakdown: Array<{ key: string; xp: number; count: number }>; badges: Array<{ id: string; value: number }> };
    expect(o.breakdown.find((b) => b.key === "exam-prep")).toMatchObject({ xp: 15 + 5, count: 2 });
    expect(o.badges.find((b) => b.id === "daily-7")!.value).toBe(1);
  });
});
