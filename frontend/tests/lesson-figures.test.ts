import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

vi.mock("server-only", () => ({}));

const model = vi.hoisted(() => ({ enabled: true, prompts: [] as string[], figures: null as unknown[] | null }));
vi.mock("@/lib/ai/gemini", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/gemini")>();
  return {
    ...actual,
    geminiEnabled: () => model.enabled,
    geminiJson: async (schema: z.ZodTypeAny, o: { prompt: string }) => {
      model.prompts.push(o.prompt);
      const p = o.prompt;
      let data: unknown;
      if (p.includes("Design the chapter outline")) {
        data = { chapters: ["Relational model", "SQL basics", "Normalization", "Transactions", "Indexing", "Concurrency control", "Recovery", "NoSQL systems"].map((title) => ({ title, part: "Core" })) };
      } else if (p.includes("Write the teaching content")) {
        const title = /Chapter \d+ of \d+: (.+)/.exec(p)![1]!;
        const listed = /Topics to cover[^:]*: (.+)/.exec(p);
        const names = listed ? [...listed[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!) : [title];
        data = {
          topics: names.map((name) => ({
            title: name,
            intro: `${name} explained in a few plain sentences for first-year students.`,
            keyPoints: [1, 2, 3, 4].map((n) => `${name} fact number ${n} that a student can be examined on.`),
            terms: [1, 2, 3, 4].map((n) => ({ term: `${name} term ${n}`, meaning: `The meaning of term ${n} in ${name}.` })),
            figures: model.figures ?? samples(name),
          })),
          example: `## Example\nA worked example of ${title} with steps and a result, long enough to be a real example for students to follow.`,
          mistakes: [`Confusing ${title} with a similar idea; check the definition.`, `Skipping the assumptions of ${title}; state them first.`],
          practice: [1, 2, 3].map((n) => ({ q: `Practice question ${n} on ${title}?`, a: `Model answer ${n} for ${title}.` })),
        };
      } else {
        data = { questions: Array.from({ length: 34 }, (_, n) => ({ prompt: `Question ${n + 1}: which statement about the course is correct?`, options: [`Right ${n}`, `Wrong A ${n}`, `Wrong B ${n}`, `Wrong C ${n}`], answer: 0, explanation: `Because ${n}.` })) };
      }
      const parsed = schema.safeParse(data);
      return parsed.success ? { ok: true, data: parsed.data } : { ok: false, reason: "schema" };
    },
  };
});

import { Figure, describeFigure, mapFigureText, FIGURE_KINDS } from "@/lib/api/figure-schemas";
import { tidyFigures } from "@/lib/api/mock/course-ai";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";

const s = (label: string, detail = "One short factual sentence.") => ({ label, detail });
function samples(name: string): unknown[] {
  return [
    { kind: "flow", title: `How ${name} works`, caption: "Read left to right.", steps: [s("Parse the query"), s("Optimise the plan"), s("Execute the plan"), s("Return rows")] },
    { kind: "compare", title: `${name}: two approaches`, caption: "Compare row by row.", columns: ["Approach A", "Approach B"], rows: [{ label: "Speed", cells: ["Fast", "Slower"] }, { label: "Storage", cells: ["More", "Less"] }] },
  ];
}
const ALL: Record<string, unknown> = {
  flow: { kind: "flow", title: "Query processing", caption: "", steps: [s("Parse"), s("Optimise"), s("Execute")] },
  cycle: { kind: "cycle", title: "Transaction life cycle", caption: "", steps: [s("Begin"), s("Run"), s("Commit"), s("Next transaction")] },
  layers: { kind: "layers", title: "DBMS architecture", caption: "", layers: [s("Application"), s("Query processor"), s("Storage manager")] },
  tree: { kind: "tree", title: "Kinds of keys", caption: "", root: { label: "Keys", children: [{ label: "Candidate keys", children: [{ label: "Primary key" }, { label: "Alternate key" }] }, { label: "Foreign key", children: [] }] } },
  compare: { kind: "compare", title: "SQL vs NoSQL", caption: "", columns: ["SQL", "NoSQL"], rows: [{ label: "Schema", cells: ["Fixed", "Flexible"] }, { label: "Scaling", cells: ["Vertical", "Horizontal"] }] },
  timeline: { kind: "timeline", title: "History of databases", caption: "", events: [{ when: "1970", label: "Relational model", detail: "Codd's paper" }, { when: "1974", label: "SQL", detail: "" }, { when: "1986", label: "SQL standard", detail: "" }] },
  parts: { kind: "parts", title: "Parts of a DBMS", caption: "", center: "DBMS", parts: [s("Storage manager"), s("Query processor"), s("Transaction manager")] },
};

const hod: SessionPayload = { sub: "hod-COL-1001", role: "hod", name: "Test hod", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const q = new URLSearchParams();
const call = (method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, hod, q);
const brief = { department: "Computer Science & Engineering", title: "Database Management Systems (figures)", level: "Intermediate (UG Year 2–3)", semester: "4", credits: 4, faculty: "Dr. Test", mode: "title" };
interface Lesson { id: string; title: string; layout?: string; figures?: Array<{ kind: string; title: string; caption: string }> }
interface Detail { id: string; version: number; title: string; faculty: string; summary: string; units: Array<{ title: string; part?: string; lessons: Lesson[] }> }

beforeEach(() => {
  model.enabled = true;
  model.prompts.length = 0;
  model.figures = null;
});

describe("figure schema", () => {
  it("accepts every kind of diagram", () => {
    expect(Object.keys(ALL).sort()).toEqual([...FIGURE_KINDS].sort());
    for (const [kind, f] of Object.entries(ALL)) expect(Figure.safeParse(f).success, kind).toBe(true);
  });
  it("rejects diagrams that are incomplete or malformed", () => {
    const bad = [
      { ...(ALL.flow as object), steps: [s("Only"), s("Two")] },
      { ...(ALL.compare as object), rows: [{ label: "Speed", cells: ["Fast"] }, { label: "Storage", cells: ["More", "Less"] }] },
      { ...(ALL.parts as object), kind: "spiral" },
      { ...(ALL.layers as object), title: "x".repeat(81) },
      { ...(ALL.timeline as object), events: [] },
      { kind: "flow", title: "", steps: [s("a"), s("b"), s("c")] },
      "not a figure",
    ];
    for (const b of bad) expect(Figure.safeParse(b).success).toBe(false);
  });
  it("describes each diagram in words for screen readers", () => {
    for (const f of Object.values(ALL)) expect(describeFigure(Figure.parse(f)).length).toBeGreaterThan(20);
    expect(describeFigure(Figure.parse(ALL.flow))).toContain("1. Parse; 2. Optimise; 3. Execute");
    expect(describeFigure(Figure.parse(ALL.tree))).toContain("Candidate keys (Primary key, Alternate key)");
  });
  it("can rewrite every piece of text", () => {
    for (const f of Object.values(ALL)) {
      const out = JSON.stringify(mapFigureText(Figure.parse(f), (x) => (x ? `«${x}»` : x)));
      expect(out).toContain("«");
      expect(out).not.toMatch(/"label":"[A-Za-z]/);
    }
  });
});

describe("tidyFigures (what the model returns)", () => {
  it("drops broken diagrams, strips links and markup, removes repeats and keeps two", () => {
    const out = tidyFigures([
      { kind: "flow", title: "Broken", steps: [s("one")] },
      { ...(ALL.flow as object), title: "See https://evil.example now <b>bold</b>", steps: [s("Parse <script>x</script>"), s("Optimise"), s("Execute")], extra: "ignored" },
      { ...(ALL.flow as object), title: "see  now bold" },
      ALL.layers,
      ALL.tree,
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!.title).not.toMatch(/https?:|<|>/);
    expect(JSON.stringify(out)).not.toMatch(/script|evil/);
    expect(out.map((f) => f.kind)).toEqual(["flow", "layers"]);
    expect(tidyFigures(undefined)).toEqual([]);
  });
});

describe("AI course generation with diagrams", () => {
  it("attaches the diagrams to each concept lesson and asks for specific, accurate figures", async () => {
    const r = await call("POST", "learning-courses/generate", brief);
    expect(r.status).toBe(201);
    const c = r.body as Detail;
    const concepts = c.units.flatMap((u) => u.lessons).filter((l) => l.layout === "concepts");
    expect(concepts.length).toBe(8);
    for (const l of concepts) expect(l.figures!.map((f) => f.kind)).toEqual(["flow", "compare"]);
    for (const l of c.units.flatMap((u) => u.lessons).filter((x) => x.layout !== "concepts")) expect(l.figures ?? []).toEqual([]);
    const prompt = model.prompts.find((p) => p.includes("Write the teaching content"))!;
    expect(prompt).toContain('"figures"');
    expect(prompt).toMatch(/never placeholders like "Step 1"/);
    expect(prompt).toMatch(/Only draw what you are sure is correct/);
  });

  it("keeps the chapter when some diagrams are unusable", async () => {
    model.figures = [{ kind: "flow", title: "Broken", steps: [s("one")] }, "junk", ALL.cycle];
    const c = (await call("POST", "learning-courses/generate", { ...brief, title: "DBMS junk figures" })).body as Detail;
    const concepts = c.units.flatMap((u) => u.lessons).filter((l) => l.layout === "concepts");
    expect(concepts).toHaveLength(8);
    expect(concepts[0]!.figures!.map((f) => f.kind)).toEqual(["cycle"]);
  });

  it("asks for one diagram per topic when a chapter has many topics", async () => {
    const syllabus = "Unit I: Lexical analysis\nTokens – Regular expressions – Finite automata – Lex tools\nUnit II: Parsing\nTop-down parsing – LR parsing – Error recovery";
    await call("POST", "learning-courses/generate", { ...brief, title: "Compiler Design figures", mode: "syllabus", syllabus });
    const prompt = model.prompts.find((p) => p.includes("Write the teaching content"))!;
    expect(prompt).toContain("exactly 1 labelled diagram");
  });

  it("makes a course without diagrams when the model gives none", async () => {
    model.figures = [];
    const c = (await call("POST", "learning-courses/generate", { ...brief, title: "DBMS no figures" })).body as Detail;
    expect(c.units.flatMap((u) => u.lessons).every((l) => (l.figures ?? []).length === 0)).toBe(true);
  });
});

describe("editing diagrams in the studio", () => {
  const save = (d: Detail, mutate: (units: Detail["units"]) => void) => {
    const units = structuredClone(d.units);
    mutate(units);
    return call("PUT", `learning-courses/${d.id}`, { version: d.version, title: d.title, faculty: d.faculty, summary: d.summary, units });
  };
  const fresh = async (title: string) => (await call("POST", "learning-courses/generate", { ...brief, title })).body as Detail;
  const firstConcept = (units: Detail["units"]) => units.flatMap((u) => u.lessons).find((l) => l.layout === "concepts")!;

  it("keeps edits to a diagram's title and caption, with invisible characters removed", async () => {
    const d = await fresh("DBMS edit figures");
    const r = await save(d, (u) => {
      const f = firstConcept(u).figures![0]!;
      f.title = "Query processing steps";
      f.caption = "Read left to right.\u200b";
    });
    expect(r.status).toBe(200);
    const f = firstConcept((r.body as Detail).units).figures![0]!;
    expect(f.title).toBe("Query processing steps");
    expect(f.caption).toBe("Read left to right.");
  });

  it("removes a diagram", async () => {
    const d = await fresh("DBMS remove figure");
    const r = await save(d, (u) => {
      firstConcept(u).figures!.splice(0, 1);
    });
    expect(r.status).toBe(200);
    expect(firstConcept((r.body as Detail).units).figures).toHaveLength(1);
  });

  it("refuses a malformed diagram and more than four", async () => {
    const d = await fresh("DBMS bad figures");
    expect((await save(d, (u) => { firstConcept(u).figures = [{ kind: "flow", title: "Bad", caption: "", steps: [] }] as never; })).status).toBe(422);
    expect((await save(d, (u) => { firstConcept(u).figures = Array.from({ length: 5 }, () => ALL.flow as never); })).status).toBe(422);
    expect((await save(d, (u) => { firstConcept(u).figures = [ALL.flow, ALL.cycle, ALL.layers, ALL.tree] as never; })).status).toBe(200);
  });
});
