import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

vi.mock("server-only", () => ({}));

// Gemini is replaced: hashed bag-of-words "embeddings", a scripted answer writer and a scripted PDF reader.
const model = vi.hoisted(() => ({ enabled: true, failEmbed: false, calls: { embed: 0, answer: 0, pdf: 0 } }));
vi.mock("@/lib/ai/gemini", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/gemini")>();
  const vec = (t: string) => {
    const v = new Array<number>(actual.EMBED_DIMS).fill(0);
    for (const w of t.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
      let h = 0;
      for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) % actual.EMBED_DIMS;
      v[h]! += 1;
    }
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / n);
  };
  return {
    ...actual,
    geminiEnabled: () => model.enabled,
    geminiEmbed: async (texts: string[]) => {
      model.calls.embed++;
      return model.failEmbed ? { ok: false, reason: "http_500" } : { ok: true, vectors: texts.map(vec) };
    },
    geminiPdfText: async () => {
      model.calls.pdf++;
      return { ok: true, text: "=== PAGE 1 ===\nClause 7.1 Library fines\nA fine of Rs 2 per day is charged for late return of books.\n=== PAGE 2 ===\nClause 7.2 Lost books\nA lost book must be replaced or paid for at twice its price.", truncated: false };
    },
    geminiJson: async (schema: z.ZodTypeAny, o: { prompt: string }) => {
      model.calls.answer++;
      const found = /attendance/i.test(o.prompt.split("Question:")[1] ?? "");
      const data = found ? { answer: "Students need at least 75% attendance in each course [1].", found: true, cited: [1] } : { answer: "The approved documents do not cover this.", found: false, cited: [] };
      const p = schema.safeParse(data);
      return p.success ? { ok: true, data: p.data } : { ok: false, reason: "schema" };
    },
  };
});

import { dispatch } from "@/lib/api/mock/router";
import { prefetchKnowledgeAi } from "@/lib/api/mock/knowledge-base";
import { chunkText, extractAnswer, rank, terms } from "@/lib/api/mock/knowledge-text";
import type { SessionPayload } from "@/lib/auth/session";

const principal: SessionPayload = { sub: "inst-COL-1001", role: "institution", name: "Dr. Principal", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const otherCollege: SessionPayload = { ...principal, sub: "inst-COL-1002", college: "COL-1002" };
const admin: SessionPayload = { sub: "admin-all", role: "admin", name: "Admin", tenant: "uni-tntu", college: "all", mfa: true, exp: 9e9 };
const faculty: SessionPayload = { ...principal, sub: "fac-1", role: "faculty" };
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const pre = (s: SessionPayload, method: string, path: string, body?: unknown) => prefetchKnowledgeAi(method, path.split("/"), body, s);

const REGS = [
  "# Attendance",
  "Clause 4.2 Attendance requirements",
  "A candidate shall be permitted to appear for end-semester examinations only with not less than 75% attendance in each course. Condonation up to 10% may be granted on medical grounds.",
  "",
  "Clause 6.1 Evaluation weightage",
  "Continuous internal assessment carries 40% weightage and the end semester examination carries 60% weightage.",
  "",
  "Clause 9.4 Hostel rules",
  "Students staying in the hostel must return by 9 pm and sign the register at the gate.",
].join("\n");
let n = 0;
const doc = (over: Record<string, unknown> = {}) => ({ title: `Regulations ${++n}`, type: "Regulation", owner: "Registrar", scope: "Institution-wide", description: "", text: REGS, chunkTokens: 512, approve: false, ...over });

interface D { id: string; status: string; chunks: number; embeddedChunks: number; indexing: string; title: string }
interface Ans { answer: string; grounded: boolean; mode: string; citations: Array<{ docId: string; cited: boolean; basis: string; section: string }>; searched: { documents: number; passages: number } }

beforeEach(() => {
  model.enabled = false;
  model.failEmbed = false;
  model.calls = { embed: 0, answer: 0, pdf: 0 };
});

describe("text helpers", () => {
  it("splits on clause headings and keeps the section with its text", () => {
    const c = chunkText(REGS, 512, "Regulations");
    expect(c.map((x) => x.section)).toEqual(["Clause 4.2 Attendance requirements", "Clause 6.1 Evaluation weightage", "Clause 9.4 Hostel rules"]);
    expect(c[0]!.content).toContain("75% attendance");
    expect(c.every((x) => x.tokens > 0)).toBe(true);
  });

  it("reads page markers, splits long text into bounded passages and never loses words", () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} explains one rule of the policy in detail.`).join(" ");
    const second = Array.from({ length: 40 }, (_, i) => `Fee item ${i} must be paid before the published deadline each term.`).join(" ");
    const c = chunkText(`=== PAGE 1 ===\n${long}\n=== PAGE 2 ===\n${second}`, 256);
    expect(c.length).toBeGreaterThan(2);
    expect(c.every((x) => x.content.length <= 256 * 4 + 400)).toBe(true);
    expect(c[0]!.page).toBe(1);
    expect(c.some((x) => x.page === 2)).toBe(true);
    for (let i = 0; i < 60; i++) expect(c.some((x) => x.content.includes(`number ${i} `))).toBe(true);
    for (let i = 0; i < 40; i++) expect(c.some((x) => x.content.includes(`Fee item ${i} `))).toBe(true);
  });

  it("ranks by keywords and ignores unrelated passages", () => {
    const items = chunkText(REGS, 512, "R");
    const hits = rank("what is the minimum attendance for exams", items, null);
    expect(hits[0]!.item.section).toBe("Clause 4.2 Attendance requirements");
    expect(rank("cafeteria menu pricing", items, null)).toHaveLength(0);
    expect(terms("The attendance requirements")).toEqual(["attendance", "requirement"]);
  });

  it("quotes the best sentences with their passage numbers", () => {
    const r = extractAnswer("attendance for exams", [{ title: "Reg", section: "S", content: "Hostels close at 9 pm every day. Students need 75% attendance to sit examinations." }]);
    expect(r.text).toContain("75% attendance");
    expect(r.text).not.toContain("Hostels");
    expect(r.used).toEqual([1]);
  });
});

describe("knowledge base API (memory backend)", () => {
  it("is for principals and the super admin only", async () => {
    expect((await call(faculty, "GET", "knowledge/documents")).status).toBe(403);
    expect((await call(faculty, "POST", "knowledge/ask", { question: "attendance rules" })).status).toBe(403);
    expect((await call(principal, "GET", "knowledge/documents")).status).toBe(200);
  });

  it("starts empty: no sample data", async () => {
    const r = await call(otherCollege, "GET", "knowledge/documents");
    const o = r.body as { documents: unknown[]; stats: { documents: number; chunks: number } };
    expect(o.documents).toEqual([]);
    expect(o.stats).toMatchObject({ documents: 0, chunks: 0 });
  });

  it("uploads text, waits for approval, then grounds answers with citations", async () => {
    const freshCollege: SessionPayload = { ...principal, sub: "inst-COL-1003", college: "COL-1003" };
    const r = await call(freshCollege, "POST", "knowledge/documents", doc({ title: "Academic Regulations 2021" }));
    expect(r.status).toBe(201);
    const created = (r.body as { document: D; notes: string[] }).document;
    expect(created.status).toBe("Pending approval");
    expect(created.chunks).toBeGreaterThanOrEqual(3);
    expect(created.indexing).toBe("keyword");

    // not approved yet → not used
    let a = (await call(freshCollege, "POST", "knowledge/ask", { question: "What is the minimum attendance for exams?" })).body as Ans;
    expect(a.grounded).toBe(false);
    expect(a.mode).toBe("none");

    const ap = await call(freshCollege, "PATCH", `knowledge/documents/${created.id}`, { status: "Approved" });
    expect((ap.body as D).status).toBe("Approved");
    a = (await call(freshCollege, "POST", "knowledge/ask", { question: "What is the minimum attendance for exams?" })).body as Ans;
    expect(a.grounded).toBe(true);
    expect(a.mode).toBe("extract");
    expect(a.answer).toContain("75% attendance");
    expect(a.citations[0]).toMatchObject({ docId: created.id, cited: true, basis: "keyword", section: "Clause 4.2 Attendance requirements" });

    // archive removes it from grounding again
    await call(freshCollege, "PATCH", `knowledge/documents/${created.id}`, { status: "Archived" });
    a = (await call(freshCollege, "POST", "knowledge/ask", { question: "What is the minimum attendance for exams?" })).body as Ans;
    expect(a.grounded).toBe(false);
  });

  it("keeps colleges apart", async () => {
    const mine = (await call(principal, "POST", "knowledge/documents", doc({ approve: true }))).body as { document: D };
    expect(((await call(otherCollege, "GET", "knowledge/documents")).body as { documents: D[] }).documents.some((d) => d.id === mine.document.id)).toBe(false);
    expect((await call(otherCollege, "GET", `knowledge/documents/${mine.document.id}`)).status).toBe(404);
    expect((await call(otherCollege, "DELETE", `knowledge/documents/${mine.document.id}`)).status).toBe(404);
    const a = (await call(otherCollege, "POST", "knowledge/ask", { question: "attendance requirements" })).body as Ans;
    expect(a.citations).toHaveLength(0);
  });

  it("shows real stats, passages and supports edit and delete", async () => {
    const c = (await call(principal, "POST", "knowledge/documents", doc({ approve: true, title: "Handbook A", type: "Handbook" }))).body as { document: D };
    const detail = (await call(principal, "GET", `knowledge/documents/${c.document.id}`)).body as { chunks: Array<{ section: string }>; truncated: boolean };
    expect(detail.chunks.length).toBe(c.document.chunks);
    expect(detail.truncated).toBe(false);
    const edited = (await call(principal, "PATCH", `knowledge/documents/${c.document.id}`, { title: "Handbook A (2026)", owner: "IQAC" })).body as D & { owner: string };
    expect(edited.title).toBe("Handbook A (2026)");
    expect(edited.owner).toBe("IQAC");
    const o = (await call(principal, "GET", "knowledge/documents")).body as { stats: { documents: number; approved: number; chunks: number } };
    expect(o.stats.documents).toBeGreaterThan(0);
    expect(o.stats.approved).toBeGreaterThan(0);
    expect((await call(principal, "DELETE", `knowledge/documents/${c.document.id}`)).status).toBe(200);
    expect((await call(principal, "GET", `knowledge/documents/${c.document.id}`)).status).toBe(404);
  });

  it("rejects bad uploads", async () => {
    const t = "Duplicate Policy Doc";
    expect((await call(principal, "POST", "knowledge/documents", doc({ title: t }))).status).toBe(201);
    expect((await call(principal, "POST", "knowledge/documents", doc({ title: t.toUpperCase() }))).status).toBe(409);
    expect((await call(principal, "POST", "knowledge/documents", doc({ text: "too short" }))).status).toBe(422);
    expect((await call(principal, "POST", "knowledge/documents", { ...doc(), type: "Meme" })).status).toBe(422);
    expect((await call(principal, "POST", "knowledge/documents", { ...doc(), extra: 1 })).status).toBe(422);
    expect((await call(admin, "POST", "knowledge/documents", doc())).status).toBe(400); // must pick a college
    const pdf = Buffer.from("%PDF-1.4 fake").toString("base64");
    const noAi = await call(principal, "POST", "knowledge/documents", { ...doc(), text: undefined, fileName: "a.pdf", mime: "application/pdf", dataBase64: pdf });
    expect(noAi.status).toBe(422); // PDFs need the AI reader
    const notPdf = await call(principal, "POST", "knowledge/documents", { ...doc(), text: undefined, fileName: "a.pdf", mime: "application/pdf", dataBase64: Buffer.from("hello world").toString("base64") });
    expect(notPdf.status).toBe(422);
    const exe = await call(principal, "POST", "knowledge/documents", { ...doc(), text: undefined, fileName: "a.exe", mime: "application/octet-stream", dataBase64: Buffer.from("MZ....").toString("base64") });
    expect(exe.status).toBe(422);
    const bin = await call(principal, "POST", "knowledge/documents", { ...doc(), text: undefined, fileName: "a.txt", mime: "text/plain", dataBase64: Buffer.from([0, 1, 2, 3, 0, 5, 6, 0, 8, 9, 0, 1, 2, 3, 4, 5, 0, 0, 0, 0]).toString("base64") });
    expect(bin.status).toBe(422);
  });

  it("accepts a text file upload", async () => {
    const r = await call(principal, "POST", "knowledge/documents", { ...doc({ title: "Circular 42 file" }), text: undefined, fileName: "circular.txt", mime: "text/plain", dataBase64: Buffer.from(REGS).toString("base64") });
    expect(r.status).toBe(201);
    expect((r.body as { document: { fileName: string; sizeBytes: number } }).document).toMatchObject({ fileName: "circular.txt", sizeBytes: Buffer.byteLength(REGS) });
  });
});

describe("knowledge base with Gemini", () => {
  beforeEach(async () => {
    const all = (await call(principal, "GET", "knowledge/documents")).body as { documents: D[] };
    for (const d of all.documents) await call(principal, "DELETE", `knowledge/documents/${d.id}`);
  });

  it("indexes with embeddings before the request, answers with AI, and re-indexes", async () => {
    model.enabled = true;
    const body = doc({ title: "Regulations (AI)", approve: true });
    expect(await pre(principal, "POST", "knowledge/documents", body)).toBeNull();
    const embeds = model.calls.embed;
    expect(embeds).toBe(1);
    const r = await call(principal, "POST", "knowledge/documents", body);
    expect(r.status).toBe(201);
    expect(model.calls.embed).toBe(embeds); // the request reused the prefetched work
    const d = (r.body as { document: D }).document;
    expect(d.indexing).toBe("semantic");
    expect(d.embeddedChunks).toBe(d.chunks);

    const early = await pre(principal, "POST", "knowledge/ask", { question: "What attendance do students need for exams?" });
    expect(early?.status).toBe(200);
    const a = early!.body as Ans;
    expect(a.mode).toBe("ai");
    expect(a.grounded).toBe(true);
    expect(a.answer).toContain("75%");
    expect(a.citations.some((c) => c.basis === "semantic")).toBe(true);

    const none = (await pre(principal, "POST", "knowledge/ask", { question: "zzz qqq" }))!.body as Ans;
    expect(none.grounded).toBe(false);

    // embeddings failed at upload → keyword-only until re-indexed
    model.failEmbed = true;
    const body2 = doc({ title: "Regulations (offline)", approve: true });
    await pre(principal, "POST", "knowledge/documents", body2);
    const d2 = ((await call(principal, "POST", "knowledge/documents", body2)).body as { document: D; notes: string[] });
    expect(d2.document.indexing).toBe("keyword");
    expect(d2.notes.join(" ")).toMatch(/keyword/i);
    model.failEmbed = false;
    expect((await call(principal, "POST", `knowledge/documents/${d2.document.id}/reindex`)).status).toBe(503); // nothing prefetched
    expect(await pre(principal, "POST", `knowledge/documents/${d2.document.id}/reindex`)).toBeNull();
    const re = await call(principal, "POST", `knowledge/documents/${d2.document.id}/reindex`);
    expect(re.status).toBe(200);
    expect((re.body as D).indexing).toBe("semantic");
  });

  it("reads PDFs with the AI reader and records page numbers", async () => {
    model.enabled = true;
    const body = { ...doc({ title: "Library Rules PDF", approve: true }), text: undefined, fileName: "library.pdf", mime: "application/pdf", dataBase64: Buffer.from("%PDF-1.7 minimal").toString("base64") };
    await pre(principal, "POST", "knowledge/documents", body);
    expect(model.calls.pdf).toBe(1);
    const r = await call(principal, "POST", "knowledge/documents", body);
    expect(r.status).toBe(201);
    const id = (r.body as { document: D }).document.id;
    const chunks = (await call(principal, "GET", `knowledge/documents/${id}`)).body as { chunks: Array<{ page: number | null; section: string }> };
    expect(chunks.chunks.map((c) => c.page)).toContain(2);
  });

  it("does nothing early for people who may not use it, or when the AI is off", async () => {
    model.enabled = true;
    expect(await pre(faculty, "POST", "knowledge/ask", { question: "attendance rules" })).toBeNull();
    expect(await pre({ ...principal, mfa: false }, "POST", "knowledge/ask", { question: "attendance rules" })).toBeNull();
    model.enabled = false;
    expect(await pre(principal, "POST", "knowledge/ask", { question: "attendance rules" })).toBeNull();
    expect(model.calls.answer).toBe(0);
  });
});
