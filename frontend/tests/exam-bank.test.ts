import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ENGLISH_KINDS } from "@/lib/api/exam-prep-schemas";
import { englishRound, ERROR_SPOTTING, FILL_BLANKS, IDIOMS, ONE_WORD, SENTENCE_IMPROVEMENT, TRIPLES } from "@/lib/api/mock/exam-bank-english";
import { GA_TOPICS } from "@/lib/api/mock/exam-bank-ga";
import { QUANT } from "@/lib/api/mock/exam-bank-quant";
import { BLOOD_RELATIONS, REASONING, SYLLOGISMS } from "@/lib/api/mock/exam-bank-reasoning";
import { EXAMS, mockPlan, MOCK_SECTION_CAP, sectionQuestions, TOPICS } from "@/lib/api/mock/exam-catalogue";
import { dailyQuestions, seeded } from "@/lib/api/mock/exam-prep";
import type { Q } from "@/lib/api/mock/refresh-zone-content";

const valid = (q: Q, label: string) => {
  expect(q.options, label).toHaveLength(4);
  expect(new Set(q.options.map((o) => o.toLowerCase())).size, `${label}: ${q.prompt} → ${q.options.join(" | ")}`).toBe(4);
  expect(q.answer, label).toBeGreaterThanOrEqual(0);
  expect(q.answer, label).toBeLessThan(4);
  expect(q.options.join(), label).not.toMatch(/NaN|undefined|Infinity/);
  expect(q.prompt.length, label).toBeGreaterThan(5);
  expect(q.explanation.length, label).toBeGreaterThan(3);
};

describe("generated questions", () => {
  it("quant and reasoning generators always give four distinct options and a valid answer", () => {
    for (const [kind, gen] of [...Object.entries(QUANT), ...Object.entries(REASONING)]) {
      const rng = seeded(kind);
      for (let i = 0; i < 300; i++) valid(gen(rng), kind);
    }
  });
  it("computes quant answers from the prompt", () => {
    const rng = seeded("check");
    for (let i = 0; i < 200; i++) {
      const t = QUANT.train!(rng);
      const [, kmh, sec] = /at (\d+) km\/h crosses a pole in (\d+) seconds/.exec(t.prompt)!;
      expect(t.options[t.answer]).toBe(`${((Number(kmh) * 5) / 18) * Number(sec)} m`);
      const a = QUANT.ages!(rng);
      const [, k, n] = /A is (\d+) years older than B\. (\d+) years ago/.exec(a.prompt)!;
      expect(a.options[a.answer]).toBe(`${Number(k) + Number(n)} years`);
      const r = REASONING.ranking!(rng);
      const [, total, left] = /row of (\d+) students, Arun is (\d+)th/.exec(r.prompt)!;
      expect(Number(r.options[r.answer])).toBe(Number(total) - Number(left) + 1);
    }
  });
});

describe("reviewed banks", () => {
  it("every curated item has four different options, a valid answer and an explanation", () => {
    const fixed = [...BLOOD_RELATIONS, ...SYLLOGISMS, ...ERROR_SPOTTING, ...FILL_BLANKS, ...SENTENCE_IMPROVEMENT];
    for (const [prompt, options, answer, explanation] of fixed) valid({ prompt, options, answer, explanation }, "fixed");
    for (const [id, t] of Object.entries(GA_TOPICS)) for (const [prompt, ...rest] of t.rows) valid({ prompt, options: [rest[0], rest[1], rest[2], rest[3]], answer: 0, explanation: rest[4] }, id);
  });
  it("keeps word lists free of clashes", () => {
    const cols = [TRIPLES.map((t) => t[0]), TRIPLES.map((t) => t[1]), TRIPLES.map((t) => t[2])];
    for (const c of cols) expect(new Set(c).size).toBe(c.length);
    expect(new Set(IDIOMS.map(([, m]) => m)).size).toBe(IDIOMS.length);
    expect(new Set(ONE_WORD.map(([, w]) => w)).size).toBe(ONE_WORD.length);
  });
  it("builds every English round with the right answer in place", () => {
    for (const kind of ENGLISH_KINDS) {
      const rng = seeded(kind);
      for (let i = 0; i < 20; i++) for (const q of englishRound(kind, 10, rng)) valid(q, kind);
    }
    const syn = new Map(TRIPLES.map(([w, s]) => [w, s]));
    for (const q of englishRound("synonyms", 10, Math.random)) expect(q.options[q.answer]).toBe(syn.get(/“(.+)”/.exec(q.prompt)![1]!));
    for (const q of englishRound("error-spotting", 10, Math.random)) expect(q.options[3]).toBe("No error");
  });
});

describe("catalogue", () => {
  it("has unique exams whose sections point at real topics", () => {
    expect(new Set(EXAMS.map((e) => e.id)).size).toBe(EXAMS.length);
    expect(EXAMS.length).toBeGreaterThanOrEqual(30);
    for (const e of EXAMS) {
      if (e.officialSite) expect(e.officialSite, e.id).toMatch(/^https:\/\//);
      for (const s of e.sections) for (const t of s.topics) expect(TOPICS.has(t), `${e.id} → ${t}`).toBe(true);
      expect(e.hasTest === false ? e.sections.length === 0 : e.sections.length > 0, e.id).toBe(true);
    }
  });
  it("every topic can build a round", () => {
    for (const t of TOPICS.values()) {
      const qs = t.build(10, seeded(t.id));
      expect(qs.length, t.id).toBeGreaterThanOrEqual(Math.min(5, qs.length || 5));
      for (const q of qs) valid(q, t.id);
    }
  });
  it("sizes practice mocks to the pattern, capped per section", () => {
    for (const e of EXAMS) {
      const plan = mockPlan(e);
      if (e.hasTest === false) {
        expect(plan).toBeNull();
        continue;
      }
      expect(plan!.sections.length).toBe(e.sections.length);
      for (const s of plan!.sections) expect(s.count).toBe(Math.min(s.questions, MOCK_SECTION_CAP));
      for (const s of plan!.sections) {
        const qs = sectionQuestions(s.topics, s.count, seeded(`${e.id}:${s.name}`));
        expect(qs.length, `${e.id} ${s.name}`).toBeGreaterThan(0);
        expect(new Set(qs.map((q) => q.prompt)).size).toBe(qs.length);
      }
    }
  });
  it("gives a college the same daily test all day, and a new one tomorrow", () => {
    const a = dailyQuestions("COL-1001", "2026-10-06");
    expect(a).toHaveLength(10);
    expect(dailyQuestions("COL-1001", "2026-10-06").map((q) => q.prompt)).toEqual(a.map((q) => q.prompt));
    expect(dailyQuestions("COL-1001", "2026-10-07").map((q) => q.prompt)).not.toEqual(a.map((q) => q.prompt));
    for (const q of a) valid(q, "daily");
  });
});
