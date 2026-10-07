import "server-only";
import type { DashboardData, GalleryData, ListData, Tone } from "@/lib/api/schemas";
import { AGENTS } from "@/config/agents";
import { MODULES } from "@/config/modules";
import { aiConfig, PROVIDERS, providerOrder, refreshAiConfig, type ProviderId } from "@/lib/ai/ai-config";
import { aiCalls } from "@/lib/ai/ai-log";
import { dataBackend } from "@/lib/data";
import { ROLE_META, ROLES } from "@/lib/auth/roles";
import type { PlatformHealth } from "@/lib/api/module-control-schemas";
import { disabledPairs } from "@/lib/module-access";

/*
 * Live data for the Super Admin's platform pages: Billing & Plans, AI Observability, AI Governance, Agent Store,
 * Integrations and Developer API. Everything here is read from the running platform (colleges, users, AI provider
 * settings, the AI request log, Module Control, the API routes) rather than from sample figures.
 */

const PIDS = Object.keys(PROVIDERS) as ProviderId[];
const full = (id: ProviderId): string => `${PROVIDERS[id].vendor} ${PROVIDERS[id].name}`;
const time = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const sinceLabel = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function providerState(id: ProviderId): { label: string; tone: Tone } {
  const cfg = aiConfig();
  const p = cfg.providers[id];
  if (!p.enabled) return { label: "Switched off", tone: "neutral" };
  if (!p.apiKey) return { label: "Key missing", tone: "amber" };
  return { label: cfg.defaultProvider === id ? "Connected · default" : "Connected · fallback", tone: "teal" };
}

/* ── Billing & Plans: each college's plan, status and seats in use (no prices are shown). ── */
export async function billingPage(): Promise<ListData> {
  const { universityOverview } = await import("./router");
  const o = await universityOverview();
  return {
    template: "list",
    columns: [
      { key: "college", label: "College", kind: "text" },
      { key: "plan", label: "Plan", kind: "badge" },
      { key: "status", label: "Status", kind: "badge" },
      { key: "capacity", label: "Student capacity", kind: "number" },
      { key: "users", label: "Accounts", kind: "number" },
      { key: "staff", label: "Active staff", kind: "number" },
      { key: "use", label: "Seats used", kind: "progress" },
      { key: "areas", label: "Areas switched on", kind: "text" },
    ],
    rows: o.colleges.map((c) => ({
      college: `${c.name}, ${c.city}`,
      plan: c.plan || "Standard",
      status: c.status,
      capacity: c.capacity,
      users: c.counts.users,
      staff: c.counts.staff,
      use: c.capacity ? Math.min(100, Math.round((c.counts.users / c.capacity) * 100)) : 0,
      areas: c.modules.length ? `${c.modules.length} optional areas` : "All areas",
    })),
    filterKey: "plan",
  };
}

/* ── AI Observability: the most recent AI requests (metadata only). ── */
export async function aiObservabilityPage(): Promise<ListData> {
  await refreshAiConfig();
  const { calls } = aiCalls();
  return {
    template: "list",
    columns: [
      { key: "time", label: "Time", kind: "text" },
      { key: "provider", label: "Provider", kind: "badge" },
      { key: "model", label: "Model", kind: "text" },
      { key: "latency", label: "Latency (ms)", kind: "number" },
      { key: "result", label: "Result", kind: "badge" },
      { key: "route", label: "Route", kind: "badge" },
    ],
    rows: calls.map((c) => ({
      time: time(c.at),
      provider: PROVIDERS[c.provider as ProviderId] ? full(c.provider as ProviderId) : c.provider,
      model: c.model || "default",
      latency: c.ms,
      result: c.ok ? "Answered" : c.reason === "no_key" ? "No key" : `Failed (${c.reason})`,
      route: c.fallback ? "Fallback" : "First choice",
    })),
    filterKey: "provider",
  };
}

/* ── AI Governance: providers, routing, reliability and human oversight. ── */
export async function aiGovernancePage(): Promise<DashboardData> {
  await refreshAiConfig();
  const cfg = aiConfig();
  const order = providerOrder();
  const { calls, since } = aiCalls();
  const ok = calls.filter((c) => c.ok).length;
  const fallbacks = calls.filter((c) => c.fallback && c.ok).length;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const off = (await disabledPairs()).size;
  const usable = PIDS.filter((id) => cfg.providers[id].enabled && cfg.providers[id].apiKey);
  return {
    template: "dashboard",
    kpis: [
      { label: "Providers ready", value: `${usable.length} of ${PIDS.length}`, tone: usable.length ? "teal" : "amber", hint: usable.length ? usable.map((id) => full(id)).join(", ") : "AI features use built-in templates" },
      { label: "Default provider", value: full(cfg.defaultProvider), tone: "brand", hint: `Model ${cfg.providers[cfg.defaultProvider].model}` },
      { label: "AI requests", value: String(calls.length), tone: "sky", hint: `Since ${sinceLabel(since)}` },
      { label: "Success rate", value: calls.length ? `${Math.round((ok / calls.length) * 100)}%` : "—", tone: !calls.length || ok / calls.length >= 0.9 ? "teal" : "amber", hint: fallbacks ? `${fallbacks} answered by a fallback provider` : undefined },
    ],
    charts: [
      {
        type: "bar",
        title: "Requests by provider",
        xKey: "name",
        series: ["Answered", "Failed"],
        data: PIDS.map((id) => ({ name: full(id), Answered: calls.filter((c) => c.provider === id && c.ok).length, Failed: calls.filter((c) => c.provider === id && !c.ok).length })),
      },
      {
        type: "bar",
        title: "Average latency (ms)",
        xKey: "name",
        series: ["Latency"],
        data: PIDS.map((id) => ({ name: full(id), Latency: avg(calls.filter((c) => c.provider === id && c.ok).map((c) => c.ms)) })),
      },
    ],
    insights: [
      { title: "Routing", body: order.length ? `Requests go to ${order.map((id) => full(id)).join(" → ")}. If the first provider fails, the next switched-on provider answers.` : "No provider is switched on with a key, so every AI feature answers from built-in templates.", evidence: "AI Providers", tone: order.length ? "brand" : "amber" },
      { title: "Human oversight", body: "AI marks, risk signals and recommendations are suggestions. Faculty review every evaluation and can override marks; overrides are audit-logged.", evidence: "Evaluation review · Audit log", tone: "teal" },
      { title: "Data protection", body: "Only request metadata is logged here (provider, model, time, result). Prompts, answers and API keys are never stored in this log.", evidence: "AI Observability", tone: "sky" },
      { title: "Module Control", body: off ? `${off} module switch${off === 1 ? " is" : "es are"} off for a role, university-wide.` : "Every module is on for every role it is granted to.", evidence: "Module Control", tone: off ? "amber" : "neutral" },
    ],
  };
}

/* ── Agent Store: the agent mesh, with how each one answers today. ── */
export async function agentStorePage(): Promise<GalleryData> {
  await refreshAiConfig();
  const order = providerOrder();
  const live = order.length ? `Live · ${full(order[0]!)}` : "Built-in templates";
  const tone: Record<string, Tone> = { Student: "brand", Faculty: "teal", Institution: "gold", Platform: "sky" };
  const usedBy = (id: string) => MODULES.filter((m) => m.agent === id).map((m) => m.title);
  return {
    template: "gallery",
    items: AGENTS.map((a) => {
      const mods = usedBy(a.id);
      return { title: a.name, description: mods.length ? `${a.summary} Used in ${mods.join(", ")}.` : a.summary, tag: a.audience, meta: live, tone: tone[a.audience] ?? "brand" };
    }),
  };
}

/* ── Integrations: what the platform is actually connected to. ── */
export async function integrationsPage(): Promise<GalleryData> {
  await refreshAiConfig();
  const pg = dataBackend() === "postgres";
  const env = (k: string) => Boolean((process.env[k] ?? "").trim());
  const items: GalleryData["items"] = PIDS.map((id) => {
    const s = providerState(id);
    return { title: full(id), description: `${PROVIDERS[id].vendor} AI for mentoring, generation and evaluation. Managed in AI Providers.`, tag: "AI", meta: s.label, tone: s.tone };
  });
  items.push(
    { title: pg ? "PostgreSQL" : "In-memory demo store", description: pg ? "Primary database with row-level security isolating every college." : "Demo data kept in the server's memory. Set DATA_BACKEND=postgres for production.", tag: "Database", meta: pg ? "Connected" : "Demo mode", tone: pg ? "teal" : "amber" },
    { title: "Sign-in & MFA", description: "Built-in accounts with time-based one-time codes for staff and administrators.", tag: "Identity", meta: "Connected", tone: "teal" },
    { title: "Certificate verification", description: "Public /verify page and QR codes for every certificate the Principal issues.", tag: "Certificates", meta: env("PUBLIC_APP_URL") ? "Connected" : "Uses request host", tone: env("PUBLIC_APP_URL") ? "teal" : "sky" },
    { title: "Email gateway", description: "Institution-approved email for notifications and digests.", tag: "Communication", meta: env("SMTP_HOST") ? "Connected" : "Not configured", tone: env("SMTP_HOST") ? "teal" : "neutral" },
    { title: "SMS gateway", description: "Exam reminders and alerts by SMS.", tag: "Communication", meta: env("SMS_API_KEY") ? "Connected" : "Not configured", tone: env("SMS_API_KEY") ? "teal" : "neutral" },
    { title: "Student Information System / ERP", description: "Sync students, programmes, fees and timetables from the university ERP.", tag: "SIS / ERP", meta: "Available on request", tone: "neutral" },
    { title: "LMS (Moodle / Canvas)", description: "Courses, content and grades.", tag: "LMS", meta: "Available on request", tone: "neutral" },
  );
  return { template: "gallery", items };
}

/* ── Developer API: the platform's real REST endpoints. ── */
const AREAS: Array<[string, string, string]> = [
  ["records", "Records (courses, events, admissions, staff, users …)", "GET · POST · PUT · DELETE"],
  ["module-control", "Module Control", "GET · PUT"],
  ["notice-board", "Notice Board", "GET · POST · DELETE"],
  ["content-desk", "University Content Desk", "GET · POST · PUT · DELETE"],
  ["curriculum", "Curriculum Studio", "GET · POST · PUT · DELETE"],
  ["course-roadmap", "Course Roadmap", "GET · POST · PATCH · DELETE"],
  ["ai-providers", "AI Providers", "GET · PUT · POST"],
  ["learning-courses", "AI Course Studio", "GET · POST · PUT"],
  ["teaching", "Teaching Studio & Skill Booster", "GET · POST"],
  ["assignments", "Assignments", "GET · POST · PUT"],
  ["knowledge", "Knowledge Base", "GET · POST · DELETE"],
  ["exam-prep", "Competitive Exam Prep Hub", "GET · POST · PUT"],
  ["current-affairs", "Current Affairs", "GET · POST · PUT · DELETE"],
  ["prep-content", "Exam Prep Studio", "GET · POST · PUT · DELETE"],
  ["certificate-desk", "Certificate Authority", "GET · POST · PUT"],
  ["drives", "Placement Drives", "GET · POST · PUT"],
  ["jobs", "Job Matching", "GET · POST"],
  ["alumni", "Alumni Network", "GET · POST"],
  ["students", "Students", "GET · POST · PUT"],
  ["faculty", "Faculty", "GET · POST · PUT"],
  ["research", "Research Assistant", "GET · POST · PUT"],
  ["languages", "Language Learning", "GET · POST · PUT"],
  ["experience", "Experience Passport", "GET · POST · PUT"],
];
export async function developerApiPage(): Promise<ListData> {
  const { PATTERNS } = await import("./router");
  const rows: ListData["rows"] = PATTERNS.map((p) => {
    const [method, path] = p.split(" ") as [string, string];
    return { endpoint: `/api/v1/${path}`, method, area: path.split("/")[0] ?? "", access: method === "GET" ? "Signed-in session" : "Session + CSRF token" };
  });
  for (const [seg, title, methods] of AREAS) rows.push({ endpoint: `/api/v1/${seg}/…`, method: methods, area: title, access: "Session + CSRF token" });
  rows.push({ endpoint: "/verify/:id", method: "GET", area: "Public certificate verification", access: "Public (rate-limited)" });
  return {
    template: "list",
    columns: [
      { key: "endpoint", label: "Endpoint", kind: "text" },
      { key: "method", label: "Method", kind: "badge" },
      { key: "area", label: "Area", kind: "text" },
      { key: "access", label: "Access", kind: "badge" },
    ],
    rows,
    filterKey: "method",
  };
}

/* ── Super Admin home: platform health at a glance. ── */
export async function platformHealth(): Promise<PlatformHealth> {
  await refreshAiConfig();
  const cfg = aiConfig();
  const { calls, since } = aiCalls();
  const okCalls = calls.filter((c) => c.ok);
  const off = await disabledPairs();
  return {
    providers: PIDS.map((id) => {
      const s = providerState(id);
      return { id, name: full(id), state: s.label, tone: s.tone, isDefault: cfg.defaultProvider === id };
    }),
    ai: { requests: calls.length, ok: okCalls.length, since, avgMs: okCalls.length ? Math.round(okCalls.reduce((a, c) => a + c.ms, 0) / okCalls.length) : 0 },
    access: ROLES.map((role) => {
      const granted = MODULES.filter((m) => m.roles.includes(role));
      return { role, label: ROLE_META[role].label, granted: granted.length, on: granted.filter((m) => !off.has(`${m.slug}|${role}`)).length };
    }),
    switchedOff: off.size,
    database: dataBackend() === "postgres" ? "postgres" : "memory",
  };
}
