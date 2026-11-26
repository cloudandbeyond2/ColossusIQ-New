import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { cleanText } from "@/lib/security/sanitize";
import { dataBackend } from "@/lib/data";
import { db } from "@/lib/data/postgres/db";
import type { SessionPayload } from "@/lib/auth/session";

export interface MockResult {
  status: number;
  body: unknown;
}

export interface DocumentHistoryRecord {
  id: string;
  collegeId?: string | null;
  module: string;
  task: string;
  title: string;
  inputText: string;
  markdown: string;
  authorName: string;
  authorSub: string;
  createdAt: string;
  updatedAt: string;
}

const INITIAL_HISTORY: DocumentHistoryRecord[] = [
  {
    id: "DOC-2026-PY-001",
    collegeId: "COL-001",
    module: "document-ai",
    task: "Create flashcards",
    title: "Python Basics",
    inputText: "Python basics",
    authorName: "Faculty Member",
    authorSub: "USR-004",
    createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    markdown: `#### Flashcard 1: Python Interpreted Nature
- **Front (Question / Prompt):** What does it mean that Python is an interpreted language?
- **Back (Answer / Explanation):** Python executes code line-by-line using an interpreter, rather than compiling directly to machine machine code ahead of time. This enables rapid prototyping and interactive testing.
- **Memory Hook / Key Takeaway:** Python translates on-the-fly, giving speed in development.

#### Flashcard 2: Python Data Types
- **Front (Question / Prompt):** What are the core built-in primitive data types in Python?
- **Back (Answer / Explanation):** The core primitive types are int (integers), float (floating-point decimals), str (text strings), and bool (True/False boolean values).
- **Memory Hook / Key Takeaway:** Numbers, text, and flags form the foundation of Python memory.

#### Flashcard 3: Lists vs Tuples
- **Front (Question / Prompt):** What is the fundamental difference between a Python list and a tuple?
- **Back (Answer / Explanation):** Lists are mutable (can be modified after creation with append, pop, etc.), denoted by square brackets []. Tuples are immutable (read-only after creation), denoted by parentheses ().
- **Memory Hook / Key Takeaway:** Lists can change; Tuples stay true.`,
  },
];

function getStoragePath(): string {
  const base = process.cwd();
  if (fs.existsSync(path.join(base, "frontend"))) {
    return path.join(base, "frontend", ".document-history-data.json");
  }
  return path.join(base, ".document-history-data.json");
}

let inMemoryHistory: DocumentHistoryRecord[] | null = null;

function loadHistory(): DocumentHistoryRecord[] {
  if (inMemoryHistory !== null) return inMemoryHistory;
  try {
    const p = getStoragePath();
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        inMemoryHistory = parsed;
        return inMemoryHistory;
      }
    }
  } catch (err) {
    console.warn("[document-history] Failed to load from disk, using seed:", err);
  }
  inMemoryHistory = [...INITIAL_HISTORY];
  persistHistory(inMemoryHistory);
  return inMemoryHistory;
}

function persistHistory(records: DocumentHistoryRecord[]): void {
  try {
    const p = getStoragePath();
    fs.writeFileSync(p, JSON.stringify(records, null, 2), "utf-8");
  } catch (err) {
    console.warn("[document-history] Failed to write to disk:", err);
  }
}

export interface ListDocumentHistoryOptions {
  module?: string | null;
  task?: string | null;
  search?: string | null;
  collegeId?: string | null;
  authorSub?: string | null;
}

export async function listDocumentHistory(options: ListDocumentHistoryOptions = {}): Promise<DocumentHistoryRecord[]> {
  const targetModule = options.module || "document-ai";
  const search = (options.search || "").trim().toLowerCase();
  const task = options.task?.trim();

  if (dataBackend() === "postgres") {
    try {
      const t = db() as any;
      if (typeof t?.documentHistory?.findMany === "function") {
        const where: any = {
          module: targetModule,
        };
        if (task && task !== "ALL") {
          where.task = task;
        }
        if (options.authorSub) {
          where.authorSub = options.authorSub;
        }
        if (search) {
          where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { inputText: { contains: search, mode: "insensitive" } },
            { markdown: { contains: search, mode: "insensitive" } },
          ];
        }

        const rows = await t.documentHistory.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 50,
        });

        return rows.map((r: any) => ({
          id: r.publicId || r.id,
          collegeId: r.collegeId,
          module: r.module,
          task: r.task,
          title: r.title,
          inputText: r.inputText,
          markdown: r.markdown,
          authorName: r.authorName,
          authorSub: r.authorSub,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));
      }
    } catch (err) {
      console.warn("[document-history] Postgres query failed, falling back to disk:", err);
    }
  }

  // File/in-memory fallback
  const all = loadHistory();
  return all
    .filter((h) => {
      if (h.module !== targetModule) return false;
      if (task && task !== "ALL" && h.task !== task) return false;
      if (options.authorSub && h.authorSub !== options.authorSub) return false;
      if (search) {
        const matchesTitle = h.title.toLowerCase().includes(search);
        const matchesInput = h.inputText.toLowerCase().includes(search);
        const matchesMd = h.markdown.toLowerCase().includes(search);
        if (!matchesTitle && !matchesInput && !matchesMd) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveDocumentHistory(data: {
  module?: string;
  task?: string;
  title?: string;
  inputText?: string;
  markdown: string;
  authorName?: string;
  authorSub?: string;
  collegeId?: string | null;
}): Promise<DocumentHistoryRecord> {
  const mod = cleanText(data.module || "document-ai", 100);
  const task = cleanText(data.task || "Create flashcards", 100);
  const rawTitle = data.title || data.inputText?.slice(0, 50) || "Study Document";
  const title = cleanText(rawTitle.trim(), 255);
  const inputText = data.inputText || "";
  const markdown = data.markdown || "";
  const authorName = cleanText(data.authorName || "Faculty Member", 120);
  const authorSub = cleanText(data.authorSub || "USR-004", 120);
  const collegeId = data.collegeId || null;
  const publicId = `DOC-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();

  const record: DocumentHistoryRecord = {
    id: publicId,
    collegeId,
    module: mod,
    task,
    title,
    inputText,
    markdown,
    authorName,
    authorSub,
    createdAt: now,
    updatedAt: now,
  };

  if (dataBackend() === "postgres") {
    try {
      const t = db() as any;
      if (typeof t?.documentHistory?.create === "function") {
        const created = await t.documentHistory.create({
          data: {
            publicId,
            collegeId: collegeId && /^[0-9a-f-]{36}$/i.test(collegeId) ? collegeId : null,
            module: mod,
            task,
            title,
            inputText,
            markdown,
            authorName,
            authorSub,
          },
        });
        record.id = created.publicId || created.id;
      }
    } catch (err) {
      console.warn("[document-history] Postgres create failed, saving to disk storage:", err);
    }
  }

  const all = loadHistory();
  all.unshift(record);
  persistHistory(all);
  return record;
}

export async function deleteDocumentHistory(
  id: string,
  requesterSub?: string,
  userRole?: string
): Promise<boolean> {
  if (!id) return false;

  let deleted = false;
  if (dataBackend() === "postgres") {
    try {
      const t = db() as any;
      if (typeof t?.documentHistory?.deleteMany === "function") {
        const where: any = {
          OR: [{ publicId: id }, { id: /^[0-9a-f-]{36}$/i.test(id) ? id : undefined }].filter(Boolean),
        };
        // If not admin/institution, ensure the requester owns the record
        if (requesterSub && userRole !== "admin" && userRole !== "institution") {
          where.authorSub = requesterSub;
        }
        await t.documentHistory.deleteMany({ where });
        deleted = true;
      }
    } catch (err) {
      console.warn("[document-history] Postgres delete failed, checking file storage:", err);
    }
  }

  const all = loadHistory();
  const prevLen = all.length;
  const filtered = all.filter((r) => {
    if (r.id !== id) return true;
    // Ownership check
    if (requesterSub && userRole !== "admin" && userRole !== "institution" && r.authorSub !== requesterSub) {
      return true; // Not authorized to delete
    }
    return false; // Remove
  });

  if (filtered.length !== prevLen) {
    inMemoryHistory = filtered;
    persistHistory(filtered);
    deleted = true;
  }

  return deleted;
}

export async function dispatchDocumentAiHistory(
  method: string,
  segs: string[],
  rawBody: unknown,
  session: SessionPayload,
  query: URLSearchParams
): Promise<MockResult> {
  // GET /api/v1/document-ai/history
  if (method === "GET") {
    const list = await listDocumentHistory({
      module: query.get("module") || "document-ai",
      task: query.get("task") || undefined,
      search: query.get("search") || undefined,
      authorSub: session.sub,
      collegeId: session.college,
    });
    return { status: 200, body: { ok: true, history: list } };
  }

  // POST /api/v1/document-ai/history
  if (method === "POST") {
    const body = (rawBody || {}) as any;
    if (!body?.markdown) {
      return { status: 400, body: { error: { code: "invalid_body", message: "markdown is required" } } };
    }
    const saved = await saveDocumentHistory({
      module: body.module || "document-ai",
      task: body.task || "Create flashcards",
      title: body.title || body.inputText?.slice(0, 50) || "Document",
      inputText: body.inputText || "",
      markdown: body.markdown,
      authorName: session.name || "Faculty Member",
      authorSub: session.sub,
      collegeId: session.college,
    });
    return { status: 200, body: { ok: true, record: saved } };
  }

  // DELETE /api/v1/document-ai/history/:id
  if (method === "DELETE") {
    const id = segs.at(-1);
    if (!id || id === "history" || id === "document-ai") {
      return { status: 400, body: { error: { code: "invalid_id", message: "History ID is required" } } };
    }
    const deleted = await deleteDocumentHistory(id, session.sub, session.role);
    if (!deleted) {
      return { status: 404, body: { error: { code: "not_found", message: "Document history item not found" } } };
    }
    return { status: 200, body: { ok: true } };
  }

  return { status: 405, body: { error: { code: "method_not_allowed", message: "Method not allowed" } } };
}
