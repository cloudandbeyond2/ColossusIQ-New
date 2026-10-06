import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  randomToken,
  safeEqual,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/roles";
import { dispatch } from "@/lib/api/mock/router";
import { prefetchCourseAi } from "@/lib/api/mock/course-builder";
import { prefetchKnowledgeAi } from "@/lib/api/mock/knowledge-base";
import { prefetchQuestionAi } from "@/lib/api/mock/question-ai";
import { prefetchQuizAi } from "@/lib/api/mock/quiz-ai";
import { prefetchVivaAi } from "@/lib/api/mock/viva";
import { prefetchMentorAi } from "@/lib/api/mock/mentor";
import { prefetchStudyPlanAi } from "@/lib/api/mock/study-planner";
import { prefetchLanguageAi } from "@/lib/api/mock/languages";
import { prefetchMissionAi } from "@/lib/api/mock/mission-planner";
import { prefetchResearchAi } from "@/lib/api/mock/research";
import { KB_MAX_BODY_BYTES } from "@/lib/api/knowledge-schemas";
import { rateLimit } from "@/lib/api/mock/rate-limit";
import { RESOURCES, recordSchema } from "@/config/resources";
import { collegeName, createRecord, enabledGroups, getCollege, isCollegeActive, listColleges } from "@/lib/api/mock/records";
import { dataBackend, withRequestContext } from "@/lib/data";
import { dbErrorReason } from "@/lib/data/postgres/db";
import { EnumLabelError } from "@/lib/data/postgres/enums";
import { LookupError } from "@/lib/data/postgres/lookups";
import { accountActive, authenticate, mfaHint, verifySecondFactor } from "@/lib/auth/accounts";
import { ALL_COLLEGES, COLLEGE_ID_RE, UNIVERSITY, isCollegeScope } from "@/config/tenancy";
import { WEBSITE, recordSchema as siteSchema, type RecordValue } from "@/config/resources";
import { can } from "@/lib/auth/roles";
import { cleanText } from "@/lib/security/sanitize";
import { getMedia, saveMedia } from "@/lib/api/mock/media";
import { getSite, publicCollegeDirectory, publicCollegePage, saveSite } from "@/lib/api/mock/website";
import { audit } from "@/lib/api/mock/audit";
import { publicCertificate } from "@/lib/api/mock/learning";

/*
 * Mock implementation of the CollossusIQ REST API (/api/v1/*).
 * It applies the same controls the real backend must: authentication, role checks, CSRF,
 * origin checks, body-size limits, input validation and rate limiting.
 */

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MEDIA_BODY_BYTES = 3 * 1024 * 1024; // 2 MB image as base64 + envelope
// A course is saved whole (up to 24 units x 15 lessons of up to 8,000 characters each), so it needs far more than the default.
const COURSE_MAX_BODY_BYTES = 4 * 1024 * 1024;
const isProd = process.env.NODE_ENV === "production";

const cookieBase = { httpOnly: true, secure: isProd, sameSite: "strict" as const, path: "/" };

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
function error(status: number, code: string, message: string, headers?: Record<string, string>) {
  return json({ error: { code, message } }, status, headers);
}

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Rejects cross-site state-changing requests (defence-in-depth alongside SameSite + CSRF token). */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  return origin === req.nextUrl.origin;
}

function csrfValid(req: NextRequest): boolean {
  const cookie = req.cookies.get(CSRF_COOKIE)?.value;
  const header = req.headers.get(CSRF_HEADER);
  return Boolean(cookie && header && safeEqual(cookie, header));
}

async function readJson(req: NextRequest, limit = MAX_BODY_BYTES): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  const type = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (text.length === 0) return { ok: true, body: undefined };
  if (!type.startsWith("application/json")) return { ok: false, res: error(415, "unsupported_media_type", "Expected JSON.") };
  if (new TextEncoder().encode(text).length > limit) return { ok: false, res: error(413, "payload_too_large", "Request body too large.") };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, res: error(400, "invalid_json", "Malformed JSON.") };
  }
}

async function issueSession(res: NextResponse, payload: SessionPayload) {
  res.cookies.set(SESSION_COOKIE, await signSession(payload), { ...cookieBase, maxAge: SESSION_TTL_SECONDS });
}

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(128),
  role: z.enum(ROLES),
  college: z.string().regex(COLLEGE_ID_RE).optional(),
});
const ScopeBody = z.object({ college: z.string().refine(isCollegeScope) }).strict();
const MfaBody = z.object({ code: z.string().regex(/^\d{6}$/) });

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }, method: string): Promise<NextResponse> {
  if (process.env.NEXT_PUBLIC_API_MODE === "live") return error(404, "not_found", "Mock API disabled in live mode.");

  const segs = (await ctx.params).path ?? [];
  if (segs.length > 6 || segs.some((s) => s.length > 64)) return error(400, "bad_path", "Invalid path.");
  const route = segs.join("/");

  // ── CSRF bootstrap ────────────────────────────────
  if (method === "GET" && route === "auth/csrf") {
    const token = req.cookies.get(CSRF_COOKIE)?.value ?? randomToken();
    const res = json({ token });
    // Readable by JS on purpose (double-submit pattern); SameSite=Strict keeps it first-party only.
    res.cookies.set(CSRF_COOKIE, token, { httpOnly: false, secure: isProd, sameSite: "strict", path: "/" });
    return res;
  }

  // ── Public: uploaded images (served inert: exact type, nosniff, sandboxed) ──
  if (method === "GET" && segs[0] === "public" && segs[1] === "media" && segs.length === 3) {
    const m = await withRequestContext({ scope: "all", readOnly: true }, () => getMedia(segs[2] ?? ""));
    if (!m) return error(404, "not_found", "Not found.");
    return new NextResponse(Buffer.from(m.bytes), {
      status: 200,
      headers: {
        "Content-Type": m.contentType,
        "Content-Length": String(m.bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=86400, immutable",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  }
  // ── Public: college websites ──
  if (method === "GET" && route === "public/sites") return json({ colleges: await withRequestContext({ scope: "all", readOnly: true }, publicCollegeDirectory) });
  if (method === "GET" && segs[0] === "public" && segs[1] === "sites" && segs.length === 3) {
    const id = segs[2] ?? "";
    const page = COLLEGE_ID_RE.test(id) ? await withRequestContext({ scope: id, readOnly: true }, () => publicCollegePage(id)) : null;
    return page ? json(page) : error(404, "not_found", "College not found.");
  }

  // ── Public: certificate verification (rate-limited so IDs cannot be enumerated) ──
  if (method === "GET" && segs[0] === "public" && segs[1] === "certificates" && segs.length === 3) {
    const rl = rateLimit(`verify:${clientKey(req)}`, isProd ? 30 : 300, 10 * 60_000);
    if (!rl.ok) return error(429, "rate_limited", "Too many verification requests. Try again later.");
    return json(await withRequestContext({ scope: "all", readOnly: true }, () => publicCertificate(segs[2] ?? "")));
  }

  // ── State-changing requests: origin + CSRF ────────
  if (method !== "GET") {
    if (!sameOrigin(req)) return error(403, "bad_origin", "Cross-site request blocked.");
    if (!csrfValid(req)) return error(403, "csrf", "Security token missing or invalid. Refresh the page and try again.");
  }

  const parsedBody = method === "GET" ? { ok: true as const, body: undefined } : await readJson(req, route === "media" ? MAX_MEDIA_BODY_BYTES : route === "knowledge/documents" ? KB_MAX_BODY_BYTES : method === "PUT" && /^learning-courses\/[^/]+$/.test(route) ? COURSE_MAX_BODY_BYTES : MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.res;
  const body = parsedBody.body;

  // ── Login ──────────────────────────────────────────
  if (method === "POST" && route === "auth/login") {
    const rl = rateLimit(`login:${clientKey(req)}`, isProd ? 10 : 100, 15 * 60_000);
    if (!rl.ok) return error(429, "rate_limited", "Too many sign-in attempts. Try again later.", { "Retry-After": String(rl.retryAfter) });
    const parsed = LoginBody.safeParse(body);
    // Generic message: never reveal whether the account exists.
    if (!parsed.success) return error(401, "invalid_credentials", "Invalid email or password.");
    // The University Super Admin signs in at university scope; everyone else into exactly one college.
    let college: string = ALL_COLLEGES;
    if (parsed.data.role !== "admin") {
      const c = await withRequestContext({ scope: "all", readOnly: true }, () => getCollege(parsed.data.college));
      if (!c) return error(422, "college_required", "Choose your college.");
      if (c.status === "Suspended") return error(403, "college_suspended", "Access for this college has been suspended by the university.");
      if (c.status !== "Active") return error(403, "college_inactive", "This college is still being onboarded and is not open for sign-in yet.");
      college = c.id;
    }
    const account = await authenticate({ ...parsed.data, college: college === ALL_COLLEGES ? null : college });
    if (!account.ok) {
      await withRequestContext({ scope: "all" }, () => audit("Sign-in", account.locked ? "Sign-in blocked (account locked)" : "Sign-in failed", parsed.data.email.slice(0, 80)));
      return error(401, "invalid_credentials", "Invalid email or password.");
    }
    const res = json({ mfaRequired: true, mfaHint: await mfaHint(account.sub) });
    await issueSession(res, {
      sub: account.sub,
      role: parsed.data.role,
      name: account.name,
      tenant: UNIVERSITY.id,
      college,
      mfa: false,
      exp: Math.floor(Date.now() / 1000) + 10 * 60, // pre-MFA session lives 10 minutes
    });
    return res;
  }

  // ── Public list of active colleges (sign-in picker and online application) ──
  if (method === "GET" && route === "public/colleges") {
    const colleges = (await withRequestContext({ scope: "all", readOnly: true }, listColleges))
      .filter((c) => c.status === "Active")
      .map((c) => {
        const groups = Array.isArray(c.modules) ? (c.modules as string[]) : [];
        return {
          id: c.id,
          name: String(c.name),
          city: String(c.city),
          type: String(c.type),
          admissionsOpen: c.admissionsOpen === true && groups.includes("Admissions"),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return json({ university: UNIVERSITY.name, colleges, demo: dataBackend() === "memory" });
  }

  // ── Public online admission application (no account needed) ──
  if (method === "POST" && route === "public/admissions") {
    const rl = rateLimit(`apply:${clientKey(req)}`, isProd ? 5 : 50, 60 * 60_000);
    if (!rl.ok) return error(429, "rate_limited", "Too many applications from this network. Please try again later.", { "Retry-After": String(rl.retryAfter) });
    const env = z.object({ data: z.record(z.string(), z.unknown()), website: z.string().max(0), collegeId: z.string().regex(COLLEGE_ID_RE) }).strict().safeParse(body);
    // Honeypot filled or malformed envelope: respond generically so bots learn nothing.
    if (!env.success) return error(400, "invalid_body", "We could not accept this application.");
    const collegeId = env.data.collegeId;
    return withRequestContext({ scope: collegeId }, async () => {
    const target = await getCollege(collegeId);
    const groups = target ? await enabledGroups(target.id) : [];
    if (!target || target.status !== "Active" || target.admissionsOpen !== true || (groups !== "all" && !groups.includes("Admissions"))) {
      return json({ error: { code: "validation", message: "This college is not accepting online applications.", fields: { collegeId: "Choose a college that is accepting applications" } } }, 422);
    }
    const res = RESOURCES.admissions!;
    const applicant = recordSchema(res).omit({ status: true, documents: true, notes: true });
    const parsed = applicant.safeParse(env.data.data);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
      return json({ error: { code: "validation", message: "Please correct the highlighted fields.", fields } }, 422);
    }
    const rec = await createRecord(res, { ...parsed.data, status: "Applied", documents: [], notes: "Submitted via online application form." }, target.id);
    await audit("Online applicant", `Application submitted to ${String(target.name)}`, rec.id, { collegeId: target.id });
    return json({ applicationNo: rec.id }, 201);
    });
  }

  // Everything below requires a session.
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return error(401, "unauthenticated", "Please sign in.");
  // Slow AI drafting (AI Course Studio) runs here, before the request's database transaction opens and its 30 s clock starts.
  const early = await prefetchCourseAi(method, segs, body, session);
  if (early) return json(early.body, early.status);
  // Same for the Knowledge Base: PDF reading, embedding and answering questions happen before the transaction opens.
  const kbEarly = await prefetchKnowledgeAi(method, segs, body, session);
  if (kbEarly) return json(kbEarly.body, kbEarly.status);
  // AI question generation (Question Bank) likewise runs before the transaction.
  const qEarly = await prefetchQuestionAi(method, segs, body, session);
  if (qEarly) return json(qEarly.body, qEarly.status);
  // The AI Mentor's answer is written before the transaction too.
  const mEarly = await prefetchMentorAi(method, segs, body, session);
  if (mEarly) return json(mEarly.body, mEarly.status);
  // The Study Planner's AI note is written before the transaction too.
  const pEarly = await prefetchStudyPlanAi(method, segs, body, session);
  if (pEarly) return json(pEarly.body, pEarly.status);
  // Language lessons and the coach chat are written before the transaction too.
  const lEarly = await prefetchLanguageAi(method, segs, body, session);
  if (lEarly) return json(lEarly.body, lEarly.status);
  // The Mission Planner roadmap is written before the transaction too.
  const mpEarly = await prefetchMissionAi(method, segs, body, session);
  if (mpEarly) return json(mpEarly.body, mpEarly.status);
  // Research Assistant tools and chat are written before the transaction too.
  const rEarly = await prefetchResearchAi(method, segs, body, session);
  if (rEarly) return json(rEarly.body, rEarly.status);
  // Quiz Builder questions are written before the transaction too.
  const qzEarly = await prefetchQuizAi(method, segs, body, session);
  if (qzEarly) return json(qzEarly.body, qzEarly.status);
  // Viva examiner questions and marks are written before the transaction too.
  const vEarly = await prefetchVivaAi(method, segs, body, session);
  if (vEarly) return json(vEarly.body, vEarly.status);
  try {
    return await withRequestContext({ scope: session.college, sub: session.sub }, () => handleSession(req, method, segs, route, body, session));
  } catch (e) {
    // Database rules are the last line of defence; report them as request errors, never as internals.
    const reason = dbErrorReason(e);
    if (reason === "duplicate") return error(409, "conflict", "That record already exists.");
    if (reason === "check" || e instanceof EnumLabelError || e instanceof LookupError) return error(422, "validation", "Some values are not allowed for this college.");
    if (reason === "in_use") return error(409, "in_use", "Other records still refer to this one.");
    console.error("[api] request failed", e);
    return error(500, "server_error", "Something went wrong. Please try again.");
  }
}

/** Everything that needs a signed-in user; runs inside the request's data context. */
async function handleSession(req: NextRequest, method: string, segs: string[], route: string, body: unknown, session: SessionPayload): Promise<NextResponse> {
  if (session.college !== ALL_COLLEGES && !(await isCollegeActive(session.college))) {
    const res = error(401, "college_suspended", "Access for your college has been suspended by the university.");
    res.cookies.set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
    return res;
  }
  if (!(await accountActive(session.sub))) {
    const res = error(401, "account_inactive", "Your account is not active. Contact your college office.");
    res.cookies.set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
    return res;
  }

  if (method === "POST" && route === "auth/mfa/verify") {
    const rl = rateLimit(`mfa:${session.sub}:${clientKey(req)}`, 5, 10 * 60_000);
    if (!rl.ok) return error(429, "rate_limited", "Too many attempts. Sign in again in a few minutes.", { "Retry-After": String(rl.retryAfter) });
    const parsed = MfaBody.safeParse(body);
    const second = parsed.success ? await verifySecondFactor(session, parsed.data.code) : "invalid";
    if (second === "not_enrolled") return error(403, "mfa_not_enrolled", "Multi-factor authentication is not set up for this account. Contact your college administrator.");
    if (second !== "ok") return error(401, "invalid_code", "That code is not valid.");
    const res = json({ redirect: `/${session.role}` });
    await issueSession(res, { ...session, mfa: true, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
    // Rotate CSRF token at privilege change.
    res.cookies.set(CSRF_COOKIE, randomToken(), { httpOnly: false, secure: isProd, sameSite: "strict", path: "/" });
    return res;
  }

  if (method === "POST" && route === "auth/logout") {
    const res = json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
    res.cookies.set(CSRF_COOKIE, "", { httpOnly: false, secure: isProd, sameSite: "strict", path: "/", maxAge: 0 });
    return res;
  }

  if (!session.mfa) return error(401, "mfa_required", "Complete multi-factor verification.");

  if (method === "GET" && route === "auth/session") {
    return json({
      role: session.role,
      name: session.name,
      tenant: session.tenant,
      tenantName: UNIVERSITY.name,
      college: session.college,
      collegeName: session.college === ALL_COLLEGES ? "All colleges" : await collegeName(session.college),
      expiresAt: session.exp,
    });
  }
  // ── University Super Admin: switch between "All colleges" and one college ──
  if (method === "POST" && route === "auth/scope") {
    if (session.role !== "admin") return error(403, "forbidden", "Only the University Super Admin can switch colleges.");
    const parsed = ScopeBody.safeParse(body);
    if (!parsed.success || (parsed.data.college !== ALL_COLLEGES && !(await getCollege(parsed.data.college)))) return error(400, "invalid_body", "Unknown college.");
    const res = json({ college: parsed.data.college });
    await issueSession(res, { ...session, college: parsed.data.college });
    await audit(session.name, "Switched college scope", parsed.data.college === ALL_COLLEGES ? "All colleges" : await collegeName(parsed.data.college), { actorSub: session.sub });
    return res;
  }
  if (method === "POST" && route === "auth/refresh") {
    const res = json({ ok: true });
    await issueSession(res, { ...session, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
    return res;
  }

  // ── Image upload (website hero + gallery) ──
  if (method === "POST" && route === "media") {
    // Website managers upload site images; HODs, principals and faculty upload lesson images.
    const mayUpload = can(session.role, "website:manage") || can(session.role, "courses:manage") || session.role === "faculty";
    if (!mayUpload) return error(403, "forbidden", "You cannot upload images.");
    const rl = rateLimit(`media:${session.sub}`, isProd ? 30 : 200, 10 * 60_000);
    if (!rl.ok) return error(429, "rate_limited", "Too many uploads. Please wait a few minutes.", { "Retry-After": String(rl.retryAfter) });
    const parsed = z.object({ contentType: z.string().max(40), data: z.string().max(MAX_MEDIA_BODY_BYTES) }).strict().safeParse(body);
    if (!parsed.success) return error(400, "invalid_body", "Invalid upload.");
    const saved = await saveMedia(parsed.data.contentType, parsed.data.data, session.college === ALL_COLLEGES ? null : session.college, session.sub);
    if (!saved.ok) return error(422, "invalid_image", saved.reason);
    await audit(session.name, "Image uploaded", saved.id, { collegeId: session.college === ALL_COLLEGES ? null : session.college, actorSub: session.sub });
    return json({ id: saved.id }, 201);
  }

  // ── College website (one per college; Principal / Super Admin inside a college) ──
  if (route === "website" && (method === "GET" || method === "PUT")) {
    if (!can(session.role, "website:manage")) return error(403, "forbidden", "You cannot manage the college website.");
    if (session.college === ALL_COLLEGES) return error(400, "choose_college", "Switch into a college to edit its website.");
    const current = await getSite(session.college);
    if (!current) return error(404, "not_found", "College not found.");
    if (method === "GET") return json({ collegeId: session.college, site: current });
    const env = z.object({ data: z.record(z.string(), z.unknown()), version: z.number().int().positive() }).strict().safeParse(body);
    if (!env.success) return error(400, "invalid_body", "Invalid request.");
    if (env.data.version !== current.version) return error(409, "stale", "The website was updated by someone else. Reload to see the latest version.");
    const parsed = siteSchema(WEBSITE).safeParse(env.data.data);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
      return json({ error: { code: "validation", message: "Please correct the highlighted fields.", fields } }, 422);
    }
    const data = Object.fromEntries(
      Object.entries(parsed.data as Record<string, RecordValue>).map(([k, v]) => {
        const f = WEBSITE.fields.find((x) => x.name === k);
        return [k, typeof v === "string" && (f?.type === "text" || f?.type === "textarea") ? cleanText(v, f.maxLength ?? 120) : v];
      }),
    );
    const saved = await saveSite(session.college, data);
    await audit(session.name, "College website updated", session.college, { collegeId: session.college, actorSub: session.sub });
    return json({ collegeId: session.college, site: saved });
  }

  // AI endpoints get a tighter per-user budget.
  if (segs[0] === "ai") {
    const rl = rateLimit(`ai:${session.sub}`, 30, 60_000);
    if (!rl.ok) return error(429, "rate_limited", "You're sending requests too quickly. Please wait a moment.", { "Retry-After": String(rl.retryAfter) });
  }

  const result = await dispatch(method, segs, body, session, req.nextUrl.searchParams);
  // Simulated network latency so loading states are visible in the demo.
  if (dataBackend() === "memory") await new Promise((r) => setTimeout(r, segs[0] === "ai" ? 450 : 120));
  return json(result.body, result.status);
}

export function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx, "GET");
}
export function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx, "POST");
}
export function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx, "PUT");
}
export function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx, "PATCH");
}
export function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx, "DELETE");
}
