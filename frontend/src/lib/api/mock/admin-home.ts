import "server-only";

import { RESOURCES, type RecordValue } from "@/config/resources";
import { STREAM_DEFS, STREAMS, streamOfType } from "@/config/streams";
import { UNIVERSITY } from "@/config/tenancy";
import type { ChartSpec, Insight, Kpi, RoleHome } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { formatNumber } from "@/lib/utils";
import { platformHealth } from "./platform-pages";
import { listColleges } from "./records";
import { recentAudit } from "./audit";

type QueueItem = RoleHome["queue"][number];

/**
 * Builds the Central University Super Admin Home dashboard dynamically from live
 * college records, admissions pipeline, platform health, AI gateway usage, and audit records.
 */
export async function dynamicAdminHome(session: SessionPayload): Promise<RoleHome> {
  const [collegesRaw, health, auditLogs] = await Promise.all([
    listColleges(),
    platformHealth(),
    recentAudit(10),
  ]);

  const colleges = collegesRaw.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const count = (key: string, collegeId: string, where?: Record<string, RecordValue>) =>
    getStore().records.count(RESOURCES[key]!, collegeId, where);

  const collegeRows = await Promise.all(
    colleges.map(async (c) => {
      const counts = {
        applications: await count("admissions", c.id),
        enrolled: await count("admissions", c.id, { status: "Enrolled" }),
        staff: await count("staff", c.id, { status: "Active" }),
        users: await count("users", c.id),
        courses: await count("courses", c.id, { status: "Active" }),
        events: await count("events", c.id),
        departments: await count("departments", c.id),
      };
      const capacity = typeof c.studentCapacity === "number" ? c.studentCapacity : 0;
      return {
        id: c.id,
        name: String(c.name),
        city: String(c.city),
        type: String(c.type),
        status: String(c.status),
        plan: String(c.plan),
        principal: String(c.principal),
        capacity,
        modules: Array.isArray(c.modules) ? (c.modules as string[]) : [],
        counts,
      };
    }),
  );

  const sum = (k: keyof (typeof collegeRows)[number]["counts"]) =>
    collegeRows.reduce((a, r) => a + (r.counts[k] ?? 0), 0);

  const totals = {
    colleges: collegeRows.length,
    active: collegeRows.filter((r) => r.status === "Active").length,
    onboarding: collegeRows.filter((r) => r.status === "Onboarding").length,
    suspended: collegeRows.filter((r) => r.status === "Suspended").length,
    capacity: collegeRows.reduce((a, r) => a + r.capacity, 0),
    applications: sum("applications"),
    enrolled: sum("enrolled"),
    staff: sum("staff"),
    users: sum("users"),
    courses: sum("courses"),
    departments: sum("departments"),
  };

  // 1. Time-based Greeting
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const adminName = session.name || "Super Admin";
  const greeting = `${timeOfDay}, ${adminName} · Central University Operations`;

  // 2. Real-time KPIs
  const connectedProviders = health.providers.filter((p) => p.tone === "teal").length;
  const fillRate = totals.capacity > 0 ? Math.round((totals.enrolled / totals.capacity) * 100) : 0;
  const aiSuccessPct = health.ai.requests > 0 ? Math.round((health.ai.ok / health.ai.requests) * 100) : 100;

  const kpis: Kpi[] = [
    {
      label: "Colleges & Tenants",
      value: String(totals.colleges),
      delta: `${totals.active} active · ${totals.onboarding} onboarding${totals.suspended ? ` · ${totals.suspended} suspended` : ""}`,
      tone: "brand",
      hint: UNIVERSITY.name,
    },
    {
      label: "Total Enrolled",
      value: formatNumber(totals.enrolled),
      delta: `${formatNumber(totals.applications)} applications`,
      tone: "teal",
      hint: `${fillRate}% seat fill rate (${formatNumber(totals.capacity)} capacity)`,
    },
    {
      label: "AI Gateway Requests",
      value: formatNumber(health.ai.requests),
      delta: health.ai.requests > 0 ? `${aiSuccessPct}% success rate` : "Gateway online",
      tone: "sky",
      hint: `${health.ai.avgMs}ms average latency`,
    },
    {
      label: "Teaching Staff & Faculty",
      value: formatNumber(totals.staff),
      delta: `${totals.departments} departments`,
      tone: "gold",
      hint: `${formatNumber(totals.users)} platform user accounts`,
    },
    {
      label: "Module Access & Governance",
      value: health.switchedOff === 0 ? "100% active" : `${health.switchedOff} restricted`,
      delta: `${connectedProviders} AI models connected`,
      tone: health.switchedOff === 0 ? "teal" : "amber",
      hint: "University Module Control",
    },
    {
      label: "Platform Security & Audits",
      value: health.database === "postgres" ? "PostgreSQL (RLS)" : "In-Memory Store",
      delta: `${auditLogs.length} recent audit events`,
      tone: "neutral",
      hint: "Tamper-evident system activity",
    },
  ];

  // 3. Dynamic Charts
  const comparisonData = collegeRows.slice(0, 6).map((c) => ({
    name: c.name.split(" ").slice(0, 2).join(" "),
    Applications: c.counts.applications,
    Enrolled: c.counts.enrolled,
    Staff: c.counts.staff,
  }));

  const streamDistributionData = STREAMS.map((s) => {
    const cs = collegeRows.filter((c) => streamOfType(c.type) === s);
    return {
      name: STREAM_DEFS[s].label,
      Colleges: cs.length,
      Applications: cs.reduce((a, c) => a + c.counts.applications, 0),
      Enrolled: cs.reduce((a, c) => a + c.counts.enrolled, 0),
    };
  }).filter((d) => d.Colleges > 0);

  const charts: ChartSpec[] = [
    {
      type: "bar",
      title: "College admissions & active staff comparison",
      xKey: "name",
      series: ["Applications", "Enrolled", "Staff"],
      data: comparisonData,
    },
    {
      type: "bar",
      title: "Enrollment & applications by academic stream",
      xKey: "name",
      series: ["Applications", "Enrolled"],
      data: streamDistributionData,
    },
  ];

  // 4. Dynamic Insights
  const onboardingCollege = collegeRows.find((c) => c.status === "Onboarding");
  const topEnrolled = [...collegeRows].sort((a, b) => b.counts.enrolled - a.counts.enrolled)[0];

  const insights: Insight[] = [
    {
      title: "Institutional Intake & Capacity",
      body: `Across ${totals.colleges} colleges, the university has received ${formatNumber(totals.applications)} applications with ${formatNumber(totals.enrolled)} confirmed enrollments against an approved intake capacity of ${formatNumber(totals.capacity)} seats.${topEnrolled ? ` Leading enrollment: ${topEnrolled.name}.` : ""}`,
      evidence: "University Central Admissions Registry",
      tone: "brand",
    },
    {
      title: "AI Gateway Routing & Reliability",
      body: health.ai.requests > 0
        ? `The AI gateway has processed ${formatNumber(health.ai.requests)} requests with ${aiSuccessPct}% successful completions at an average latency of ${health.ai.avgMs}ms across ${connectedProviders} connected LLM provider(s).`
        : `AI gateway is operational with ${connectedProviders} ready provider(s). Student and faculty AI requests will automatically route through the university mesh with policy guardrails.`,
      evidence: "Central AI Observability Gateway",
      tone: health.ai.ok >= health.ai.requests * 0.95 ? "teal" : "amber",
    },
    {
      title: "Policy & Module Governance",
      body: health.switchedOff === 0
        ? "Every academic, exam, and career module is currently enabled university-wide across all role tiers."
        : `${health.switchedOff} module switches are currently toggled off to enforce specific institutional restrictions. Review Module Control to verify policy compliance.`,
      evidence: "Module Control & Role Permissions",
      tone: health.switchedOff === 0 ? "teal" : "neutral",
    },
  ];

  // 5. Dynamic Attention Queue
  const queue: QueueItem[] = [];

  if (onboardingCollege) {
    queue.push({
      title: `Finish onboarding ${onboardingCollege.name}`,
      meta: "Tenant provisioning & initial academic configuration",
      href: `/admin/colleges/${onboardingCollege.id}/edit`,
      tone: "brand",
    });
  } else {
    queue.push({
      title: "Manage university colleges",
      meta: `${totals.colleges} constituent & affiliated colleges`,
      href: "/admin/colleges",
      tone: "brand",
    });
  }

  if (health.switchedOff > 0) {
    queue.push({
      title: "Review restricted module switches",
      meta: `${health.switchedOff} switches off in Module Control`,
      href: "/admin/module-control",
      tone: "amber",
    });
  } else {
    queue.push({
      title: "University Module Access Matrix",
      meta: "All role modules enabled",
      href: "/admin/module-control",
      tone: "teal",
    });
  }

  queue.push({
    title: "AI Providers & Gateway Health",
    meta: `${connectedProviders} active provider(s) · ${health.ai.avgMs}ms latency`,
    href: "/admin/ai-providers",
    tone: "sky",
  });

  queue.push({
    title: "Inspect university security & audit log",
    meta: `${auditLogs.length} recent system activities recorded`,
    href: "/admin/audit-log",
    tone: "teal",
  });

  return {
    greeting,
    kpis,
    charts,
    insights,
    queue,
  };
}
