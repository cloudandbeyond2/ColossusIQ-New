import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { GenerateResult, Round, StudioOverview, StudioSet, Syllabus, TopicList, TopicNotes } from "@/lib/api/exam-prep-schemas";
import { resetPrepAttemptMemory } from "@/lib/api/mock/prep-attempt-store";
import { resetPrepContentMemory } from "@/lib/api/mock/prep-content-store";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "x", role: "student", name: "X", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const who = (sub: string, role: SessionPayload["role"] = "student", college = "COL-1001"): SessionPayload => ({ ...base, sub, role, college, name: sub });
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const faculty = who("Dr. Meena", "faculty");

const question = (i: number) => ({ prompt: `Which scheme number ${i} was launched for rural roads?`, options: [`Answer ${i}`, `Wrong A${i}`, `Wrong B${i}`, `Wrong C${i}`], answer: 0, explanation: `Explanation ${i}` });
const set = (over: Record<string, unknown> = {}) => ({ title: "Government schemes set 1", topicId: null, newTopic: "Government schemes", examIds: ["ssc-cgl"], section: "General Awareness", status: "Published", questions: Array.from({ length: 12 }, (_, i) => question(i + 1)), ...over });
const sectionOf = (sy: Syllabus, name: string) => sy.sections.find((x) => x.name === name)!;

beforeEach(() => {
  resetPrepContentMemory();
  resetPrepAttemptMemory();
});

describe("Exam Prep Studio access", () => {
  it("is for teaching staff inside one college, with MFA for changes", async () => {
    expect((await call(who("s1"), "GET", "prep-content")).status).toBe(403);
    expect((await call(who("pl", "placement"), "GET", "prep-content")).status).toBe(403);
    const o = (await call(faculty, "GET", "prep-content")).body as StudioOverview;
    expect(o.canEdit).toBe(true);
    expect(o.aiAvailable).toBe(false);
    expect(o.topics.length).toBeGreaterThan(40);
    expect(o.exams.find((e) => e.id === "ssc-cgl")!.sections).toContain("General Awareness");
    expect((await call({ ...faculty, mfa: false }, "POST", "prep-content/sets", set())).status).toBe(403);
    expect((await call(who("ad", "admin", "all"), "POST", "prep-content/sets", set())).status).toBe(409);
  });
});

describe("question sets build the syllabus", () => {
  it("adds a new college topic to the exam section, its drills and its mocks", async () => {
    const r = await call(faculty, "POST", "prep-content/sets", set());
    expect(r.status).toBe(201);
    const created = r.body as StudioSet;
    expect(created.topicId).toBe("c-government-schemes");

    const sy = (await call(who("st1"), "GET", "exam-prep/syllabus/ssc-cgl")).body as Syllabus;
    const topic = sectionOf(sy, "General Awareness").topics.find((t) => t.id === "c-government-schemes")!;
    expect(topic).toMatchObject({ title: "Government schemes", custom: true, status: "not-started" });

    const list = (await call(who("st1"), "GET", "exam-prep/topics")).body as TopicList;
    expect(list.families.find((f) => f.family === "College topics")!.topics[0]!.id).toBe("c-government-schemes");

    const drill = (await call(who("st1"), "POST", "exam-prep/practice", { topicId: "c-government-schemes" })).body as Round;
    expect(drill.questions).toHaveLength(10);
    expect(drill.questions.every((x) => x.prompt.startsWith("Which scheme number"))).toBe(true);

    // Another college never sees it.
    const other = (await call(who("st2", "student", "COL-1002"), "GET", "exam-prep/syllabus/ssc-cgl")).body as Syllabus;
    expect(sectionOf(other, "General Awareness").topics.some((t) => t.custom)).toBe(false);

    // Deleting the set removes the topic.
    expect((await call(faculty, "DELETE", `prep-content/sets/${created.id}`)).status).toBe(200);
    const after = (await call(who("st1"), "GET", "exam-prep/syllabus/ssc-cgl")).body as Syllabus;
    expect(sectionOf(after, "General Awareness").topics.some((t) => t.custom)).toBe(false);
  });
  it("needs an exam section for a published new topic, and valid questions", async () => {
    expect((await call(faculty, "POST", "prep-content/sets", set({ section: "" }))).status).toBe(422);
    expect((await call(faculty, "POST", "prep-content/sets", set({ section: "Not a section" }))).status).toBe(422);
    expect((await call(faculty, "POST", "prep-content/sets", set({ questions: [{ ...question(1), options: ["A", "a", "B", "C"] }] }))).status).toBe(422);
    expect((await call(faculty, "POST", "prep-content/sets", set({ topicId: "made-up", newTopic: "" }))).status).toBe(422);
    // Drafts do not reach students.
    await call(faculty, "POST", "prep-content/sets", set({ status: "Draft" }));
    const sy = (await call(who("st3"), "GET", "exam-prep/syllabus/ssc-cgl")).body as Syllabus;
    expect(sectionOf(sy, "General Awareness").topics.some((t) => t.custom)).toBe(false);
  });
  it("adds questions to a built-in topic", async () => {
    await call(faculty, "POST", "prep-content/sets", set({ topicId: "g-polity", newTopic: "", examIds: [], section: "" }));
    const list = (await call(who("st4"), "GET", "exam-prep/topics")).body as TopicList;
    const polity = list.families.flatMap((f) => f.topics).find((t) => t.id === "g-polity")!;
    expect(polity.items).toMatch(/\+ 12 from your college/);
  });
});

describe("study notes", () => {
  it("serves built-in notes, then the college's faculty notes", async () => {
    const s = who("n1");
    const b = (await call(s, "GET", "exam-prep/topics/q-interest/notes")).body as TopicNotes;
    expect(b.source).toBe("built-in");
    expect(b.formulas.join(" ")).toMatch(/PRT\/100/);
    const ga = (await call(s, "GET", "exam-prep/topics/g-polity/notes")).body as TopicNotes;
    expect(ga.keyPoints.some((k) => k.includes("26 January 1950"))).toBe(true);

    const note = { topicId: "q-interest", status: "Published", summary: "Our college's notes on simple and compound interest for bank exams.", keyPoints: ["SI = PRT/100"], formulas: [], example: null, mistakes: [], tips: [] };
    expect((await call(faculty, "POST", "prep-content/notes", note)).status).toBe(201);
    const f = (await call(s, "GET", "exam-prep/topics/q-interest/notes")).body as TopicNotes;
    expect(f).toMatchObject({ source: "faculty", author: "Dr. Meena", summary: note.summary });
    // Saving again updates the same note rather than adding another.
    expect((await call(faculty, "POST", "prep-content/notes", { ...note, summary: "Updated notes on simple and compound interest." })).status).toBe(200);
    expect(((await call(faculty, "GET", "prep-content")).body as StudioOverview).notes).toHaveLength(1);
    expect((await call(s, "GET", "exam-prep/topics/nope/notes")).status).toBe(404);
  });
  it("tracks syllabus status: studied, practised, strong", async () => {
    const s = who("n2");
    expect((await call(s, "POST", "exam-prep/topics/q-speed/studied", { studied: true })).status).toBe(200);
    let sy = (await call(s, "GET", "exam-prep/syllabus/ssc-cgl")).body as Syllabus;
    const find = (x: Syllabus) => sectionOf(x, "Quantitative Aptitude").topics.find((t) => t.id === "q-speed")!;
    expect(find(sy).status).toBe("studied");
    expect(sy.coverage).toBeGreaterThan(0);
    const r = (await call(s, "POST", "exam-prep/practice", { topicId: "q-speed" })).body as Round;
    await call(s, "POST", `exam-prep/rounds/${r.id}/submit`, { answers: { q1: 0 } });
    sy = (await call(s, "GET", "exam-prep/syllabus/ssc-cgl")).body as Syllabus;
    expect(find(sy).status).toBe("practised");
    expect(sy.counts.practised).toBe(1);
    expect((await call(s, "GET", "exam-prep/syllabus/tnea")).status).toBe(404);
  });
});

describe("drafting (AI off: built-in fallbacks)", () => {
  it("drafts questions from the bank for a built-in topic, and refuses a new topic without AI", async () => {
    const g = (await call(faculty, "POST", "prep-content/generate", { kind: "questions", topicId: "q-ratio", count: 8 })).body as GenerateResult;
    expect(g.source).toBe("built-in");
    expect(g.questions).toHaveLength(8);
    expect((await call(faculty, "POST", "prep-content/generate", { kind: "questions", topicId: null, topicTitle: "Space missions", count: 5 })).status).toBe(409);
    const n = (await call(faculty, "POST", "prep-content/generate", { kind: "notes", topicId: "r-direction" })).body as GenerateResult;
    expect(n.source).toBe("built-in");
    expect(n.notes!.keyPoints.length).toBeGreaterThan(0);
  });
});

describe("full-length mocks", () => {
  it("uses the real paper's size and time", async () => {
    const r = (await call(who("fm1"), "POST", "exam-prep/mocks/ssc-cgl/start", { length: "full" })).body as Round;
    expect(r.questions.length).toBeGreaterThanOrEqual(90);
    expect(r.durationSec).toBeLessThanOrEqual(60 * 60);
    expect(r.title).toMatch(/full-length/);
    const short = (await call(who("fm2"), "POST", "exam-prep/mocks/ssc-cgl/start", { length: "short" })).body as Round;
    expect(short.questions).toHaveLength(40);
    expect((await call(who("fm3"), "POST", "exam-prep/mocks/ssc-cgl/start", { length: "huge" })).status).toBe(422);
  });
  it("includes the college's questions in the right section", async () => {
    await call(faculty, "POST", "prep-content/sets", set());
    const r = (await call(who("fm4"), "POST", "exam-prep/mocks/ssc-cgl/start", { length: "full" })).body as Round;
    const ga = r.sections!.find((x) => x.name === "General Awareness")!;
    const inGa = r.questions.slice(ga.from, ga.to + 1);
    expect(inGa.some((x) => x.prompt.startsWith("Which scheme number"))).toBe(true);
  });
});
