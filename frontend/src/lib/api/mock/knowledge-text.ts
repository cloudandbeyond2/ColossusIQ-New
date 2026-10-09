/*
 * Pure text helpers for the Knowledge Base: normalising, splitting into passages, keyword (BM25) and
 * vector (cosine) ranking, and an extractive fallback answer. No I/O, so it is easy to test.
 */

export interface RawChunk {
  section: string;
  content: string;
  tokens: number;
  page: number | null;
}

export const estimateTokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

/** CRLF → LF, form feeds and tabs → whitespace, control characters removed, runs of blank lines collapsed. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[  ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** True when decoded bytes look like binary rather than text. */
export function looksBinary(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 4000);
  const bad = (sample.match(/[\u0000-\u0008\u000e-\u001f�]/g) ?? []).length;
  return bad / sample.length > 0.02;
}

const PAGE_RE = /^\s*={2,}\s*PAGE\s+(\d{1,5})\s*={2,}\s*$/i;
// eslint-disable-next-line security/detect-unsafe-regex -- only ever applied to lines of at most 120 characters
const NAMED_HEADING = /^(?:clause|section|article|chapter|regulation|rule|annexure|appendix|part|unit|schedule)\s\S{1,20}(?:\s.{0,90})?$/i;
// eslint-disable-next-line security/detect-unsafe-regex -- only ever applied to lines of at most 120 characters
const NUMBERED_HEADING = /^\d{1,2}(?:\.\d{1,2}){0,3}[.)]?\s+[A-Z][^.!?]{2,90}$/;

/** The section title a line introduces, or null when it is ordinary text. */
export function headingOf(line: string): string | null {
  const t = line.trim();
  if (t.length < 3 || t.length > 120) return null;
  const md = /^#{1,4}\s+(.{2,110})$/.exec(t);
  if (md) return md[1]!.trim();
  if (/[.!?,;]$/.test(t)) return null; // sentences are not headings
  if (NAMED_HEADING.test(t) || NUMBERED_HEADING.test(t)) return t;
  if (t.length <= 80 && /\p{Lu}{3}/u.test(t) && t === t.toUpperCase() && !/\p{Ll}/u.test(t)) return t;
  return null;
}

function splitLong(paragraph: string, max: number): string[] {
  if (paragraph.length <= max) return [paragraph];
  const out: string[] = [];
  let cur = "";
  for (const s of paragraph.split(/(?<=[.!?])\s+/)) {
    for (let piece = s; piece.length > 0; ) {
      const room = max - cur.length - (cur ? 1 : 0);
      if (piece.length <= room) {
        cur = cur ? `${cur} ${piece}` : piece;
        break;
      }
      if (cur && piece.length <= max) {
        out.push(cur);
        cur = "";
        continue;
      }
      const cut = piece.lastIndexOf(" ", Math.max(room, 1));
      const at = cut > max * 0.4 ? cut : Math.max(room, 1);
      cur = cur ? `${cur} ${piece.slice(0, at)}` : piece.slice(0, at);
      out.push(cur);
      cur = "";
      piece = piece.slice(at).trimStart();
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Splits a document into passages of about `maxTokens`, keeping headings with their text.
 * Page markers of the form "=== PAGE n ===" (written by the PDF reader) set each passage's page.
 */
export function chunkText(text: string, maxTokens = 512, fallbackSection = "General"): RawChunk[] {
  const maxChars = Math.max(400, maxTokens * 4);
  const out: RawChunk[] = [];
  let section = fallbackSection.slice(0, 120);
  let page: number | null = null;
  let buf: string[] = [];
  let bufLen = 0;
  let bufSection = section;
  let bufPage: number | null = null;
  let lastPara = "";
  let para: string[] = [];

  const flush = () => {
    const content = buf.join("\n\n").trim();
    if (content.length >= 20) out.push({ section: bufSection, content, tokens: estimateTokens(content), page: bufPage });
    buf = [];
    bufLen = 0;
  };
  const push = (p: string) => {
    if (buf.length === 0) {
      bufSection = section;
      bufPage = page;
    }
    buf.push(p);
    bufLen += p.length + 2;
    lastPara = p;
  };
  const addPara = () => {
    const p = para.join(" ").replace(/\s+/g, " ").trim();
    para = [];
    if (!p) return;
    for (const piece of splitLong(p, maxChars)) {
      if (buf.length > 0 && bufLen + piece.length + 2 > maxChars) {
        const carry = lastPara.length <= 300 && lastPara !== piece ? lastPara : "";
        flush();
        if (carry) push(carry);
      }
      push(piece);
    }
  };

  for (const raw of normalizeText(text).split("\n")) {
    const line = raw.trim();
    const pm = PAGE_RE.exec(line);
    if (pm) {
      addPara();
      page = Number(pm[1]);
      continue;
    }
    if (!line) {
      addPara();
      continue;
    }
    const h = headingOf(line);
    if (h) {
      addPara();
      flush();
      lastPara = "";
      section = h;
      push(h);
      continue;
    }
    para.push(line);
  }
  addPara();
  flush();
  return out;
}

/* ───────────────────────────── ranking ─────────────────────────── */

const STOP = new Set(
  "a an and are as at be by can do does for from has have how i if in is it its me my of on or our shall should so than that the their them there these they this to was we what when where which who whom why will with would you your about any all also been being but into not only other such then too very".split(" "),
);

function stem(t: string): string {
  if (t.length > 5 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith("ed")) return t.slice(0, -2);
  if (t.length > 4 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

/** Lower-cased, de-stopped, lightly stemmed words (letters and digits in any script). */
export function terms(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length > 1 && !STOP.has(t)).map(stem);
}

export interface Passage {
  section: string;
  content: string;
  embedding?: number[] | null;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** BM25 over the given passages (section titles count double). Returns raw scores and the share of question words found. */
export function keywordScores(query: string, items: Passage[]): Array<{ score: number; coverage: number }> {
  const q = [...new Set(terms(query))];
  if (q.length === 0 || items.length === 0) return items.map(() => ({ score: 0, coverage: 0 }));
  const tokens = items.map((i) => terms(`${i.section} ${i.section} ${i.content}`));
  const counts = tokens.map((t) => {
    const m = new Map<string, number>();
    for (const w of t) m.set(w, (m.get(w) ?? 0) + 1);
    return m;
  });
  const n = items.length;
  const avg = tokens.reduce((s, t) => s + t.length, 0) / n || 1;
  /** Occurrences of a question word; words of 4+ letters also match longer forms ("exam" finds "examination"). */
  const tfOf = (c: Map<string, number>, w: string) => {
    let tf = c.get(w) ?? 0;
    if (w.length >= 4) for (const [t, k] of c) if (t !== w && t.startsWith(w)) tf += k;
    return tf;
  };
  const idf = q.map((w) => {
    const df = counts.reduce((s, c) => s + (tfOf(c, w) > 0 ? 1 : 0), 0);
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  });
  const k1 = 1.2;
  const b = 0.75;
  return counts.map((c, i) => {
    let score = 0;
    let hit = 0;
    q.forEach((w, j) => {
      const tf = tfOf(c, w);
      if (tf === 0) return;
      hit++;
      score += idf[j]! * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * tokens[i]!.length) / avg)));
    });
    return { score, coverage: hit / q.length };
  });
}

export interface Hit<T> {
  item: T;
  /** Ranking value, 0..1. */
  score: number;
  /** What the person sees: cosine similarity, or the share of question words found. */
  similarity: number;
  basis: "semantic" | "keyword";
}

/**
 * Ranks passages for a question. With a query embedding, passages that have one are scored by
 * 70% cosine + 30% keyword; passages without an embedding fall back to keywords alone.
 */
export function rank<T extends Passage>(query: string, items: T[], queryVector: number[] | null, k = 6): Array<Hit<T>> {
  const kw = keywordScores(query, items);
  const max = Math.max(0, ...kw.map((s) => s.score));
  const hits: Array<Hit<T>> = [];
  items.forEach((item, i) => {
    const norm = max > 0 ? kw[i]!.score / max : 0;
    const coverage = kw[i]!.coverage;
    if (queryVector && item.embedding && item.embedding.length === queryVector.length) {
      const cos = cosine(queryVector, item.embedding);
      if (cos < 0.25 && coverage < 0.5) return;
      hits.push({ item, score: 0.7 * Math.max(cos, 0) + 0.3 * norm, similarity: cos, basis: "semantic" });
    } else {
      if (kw[i]!.score <= 0 || coverage < 0.34) return;
      hits.push({ item, score: norm * (queryVector ? 0.7 : 1), similarity: coverage, basis: "keyword" });
    }
  });
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Answer without a language model: the sentences of the best passages that share the most words with the
 * question, each tagged with the passage it came from. `used` lists the passage numbers (1-based) quoted.
 */
export function extractAnswer(question: string, passages: Array<{ title: string; section: string; content: string }>): { text: string; used: number[] } {
  const q = [...new Set(terms(question))];
  // Same leniency as passage search: words of 4+ letters also match longer forms ("attend" and "attendance").
  const same = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
  const picked: Array<{ n: number; s: string; score: number; order: number }> = [];
  passages.slice(0, 3).forEach((p, idx) => {
    const sentences = p.content.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length >= 20);
    sentences.forEach((s, order) => {
      const score = new Set(terms(s).filter((w) => q.some((x) => same(w, x)))).size;
      picked.push({ n: idx + 1, s, score: score - idx * 0.1, order });
    });
  });
  const best = picked.filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  const chosen = (best.length ? best : picked.slice(0, 2)).sort((a, b) => a.n - b.n || a.order - b.order);
  const used = [...new Set(chosen.map((c) => c.n))];
  const text = chosen.map((c) => `${c.s.length > 420 ? `${c.s.slice(0, 417)}…` : c.s} [${c.n}]`).join(" ");
  return { text, used };
}
