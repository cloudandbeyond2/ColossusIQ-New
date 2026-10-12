"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { RecordEnvelope, ResourceRecordSchema, UniversityOverview } from "@/lib/api/schemas";
import { RESOURCES, type RecordValue } from "@/config/resources";
import { TOGGLEABLE_GROUPS } from "@/config/tenancy";
import { STREAM_DEFS, STREAMS, streamOfType, type Stream } from "@/config/streams";
import { ChartCard } from "@/components/charts/chart-card";
import { KpiGrid, TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import { RefreshCw, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, LinkButton, Spinner, toneForStatus } from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/utils";
import { PlatformPanel } from "./platform-panel";
import { InstitutionalSetupWizard } from "./institutional-setup-wizard";

type College = UniversityOverview["colleges"][number];

export function UniversityHome() {
  const router = useRouter();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [streamFilter, setStreamFilter] = useState<Stream | "all">("all");
  const { data, isLoading, isRefetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["university-overview"],
    queryFn: () => apiFetch("/api/v1/university/overview", UniversityOverview),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // Step into a college: re-scope the session, then open its admissions.
  const enter = useMutation({
    mutationFn: (id: string) => apiFetch("/api/v1/auth/scope", z.object({ college: z.string() }), { method: "POST", body: { college: id } }),
    onSuccess: () => {
      qc.clear();
      router.push("/admin/admissions");
      router.refresh();
    },
  });

  // Suspend / reactivate: read the latest version, then update status (optimistic-concurrency safe).
  const toggle = useMutation({
    mutationFn: async (c: College) => {
      const { record } = await apiFetch(`/api/v1/records/colleges/${c.id}`, RecordEnvelope);
      const data = Object.fromEntries(RESOURCES.colleges!.fields.map((f) => [f.name, record[f.name] ?? null])) as Record<string, RecordValue>;
      data.status = c.status === "Suspended" ? "Active" : "Suspended";
      return apiFetch(`/api/v1/records/colleges/${c.id}`, ResourceRecordSchema, { method: "PUT", body: { data, version: record.version } });
    },
    onSuccess: (rec) => {
      setNotice(`${String(rec.name)} is now ${String(rec.status).toLowerCase()}.${rec.status === "Suspended" ? " All of its users have been signed out." : ""}`);
      void qc.invalidateQueries({ queryKey: ["university-overview"] });
      void qc.invalidateQueries({ queryKey: ["college-options"] });
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Could not change the college status."),
  });

  if (isLoading) return <TemplateSkeleton />;
  if (error || !data) return <p className="text-sm text-rose">{error instanceof ApiError ? error.message : "Could not load the university overview."}</p>;

  const t = data.totals;
  const byStream = STREAMS.map((s) => {
    const cs = data.colleges.filter((c) => streamOfType(c.type) === s);
    return {
      stream: s,
      colleges: cs.length,
      applications: cs.reduce((a, c) => a + c.counts.applications, 0),
      enrolled: cs.reduce((a, c) => a + c.counts.enrolled, 0),
      staff: cs.reduce((a, c) => a + c.counts.staff, 0),
      capacity: cs.reduce((a, c) => a + c.capacity, 0),
    };
  }).filter((x) => x.colleges > 0);
  const visibleColleges = data.colleges.filter((c) => streamFilter === "all" || streamOfType(c.type) === streamFilter);
  const comparison = {
    type: "bar" as const,
    title: "College comparison",
    xKey: "name",
    series: ["Applications", "Enrolled", "Active staff"],
    data: data.colleges.map((c) => ({ name: c.name.split(" ").slice(0, 2).join(" "), Applications: c.counts.applications, Enrolled: c.counts.enrolled, "Active staff": c.counts.staff })),
  };
  const statusMix = {
    type: "donut" as const,
    title: "Colleges by status",
    xKey: "name",
    series: ["value"],
    data: [
      { name: "Active", value: t.active },
      { name: "Onboarding", value: t.onboarding },
      { name: "Suspended", value: t.suspended },
    ].filter((d) => d.value > 0),
  };

  return (
    <div className="space-y-6">
      <InstitutionalSetupWizard />
      <section className="bg-hero-glow relative overflow-hidden rounded-3xl px-6 py-7 text-white shadow-lg shadow-brand/20 sm:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden />
        <Fi name="building" className="pointer-events-none absolute -bottom-8 right-6 text-[160px] text-white/[0.06]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <Fi name="shield-check" /> University Super Admin
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/20 px-2.5 py-0.5 text-xs font-medium text-teal backdrop-blur-sm">
                <span className="size-2 rounded-full bg-teal animate-pulse" /> Live (30s polling)
              </span>
              {dataUpdatedAt ? (
                <span className="text-[11px] text-white/60">
                  Synced {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">{data.university}</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-white/75">
              One university, {t.colleges} colleges. Each college&apos;s data is isolated; you can work across all of them or step into one using the college switcher.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => void refetch()}
              disabled={isRefetching}
              className="bg-white/15 text-white hover:bg-white/25 border-none backdrop-blur-sm"
              title="Sync metrics in real-time"
            >
              <RefreshCw className={cn("size-4 mr-1.5", isRefetching && "animate-spin")} />
              {isRefetching ? "Syncing..." : "Sync live"}
            </Button>
            <LinkButton href="/admin/colleges/new" variant="gold" size="lg">
              <Fi name="plus" /> Add college
            </LinkButton>
            <LinkButton href="/admin/colleges" size="lg" className="bg-white/15 text-white hover:bg-white/25">
              Manage colleges
            </LinkButton>
          </div>
        </div>
      </section>

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-teal/30 bg-teal-soft px-4 py-3 text-sm text-ink" role="status">
          <span className="flex items-center gap-2">
            <Fi name="check-circle" className="text-teal" /> {notice}
          </span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="rounded-lg p-1 hover:bg-surface">
            <Fi name="cross-small" />
          </button>
        </div>
      ) : null}

      <KpiGrid
        kpis={[
          { label: "Colleges", value: String(t.colleges), delta: `${t.active} active · ${t.onboarding} onboarding${t.suspended ? ` · ${t.suspended} suspended` : ""}`, tone: "brand" },
          { label: "Total Enrolled", value: formatNumber(t.enrolled), hint: `${t.capacity > 0 ? Math.round((t.enrolled / t.capacity) * 100) : 0}% seat fill rate`, delta: `${formatNumber(t.applications)} applications`, tone: "teal" },
          { label: "Sanctioned intake", value: formatNumber(t.capacity), hint: "Approved annual capacity", tone: "sky" },
          { label: "Academic Departments", value: String(t.departments ?? 0), hint: `${formatNumber(t.courses)} active courses`, tone: "gold" },
          { label: "Applications (current cycle)", value: formatNumber(t.applications), delta: `${t.enrolled} enrolled`, tone: "amber" },
          { label: "Active staff", value: formatNumber(t.staff), hint: `${formatNumber(t.users)} user accounts`, tone: "neutral" },
        ]}
      />

      <PlatformPanel />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink">By stream</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {byStream.map((x) => (
            <button
              key={x.stream}
              onClick={() => setStreamFilter((f) => (f === x.stream ? "all" : x.stream))}
              aria-pressed={streamFilter === x.stream}
              className={cn(
                "card-hover rounded-2xl border bg-surface p-5 text-left shadow-card",
                streamFilter === x.stream ? "border-brand ring-2 ring-brand/20" : "border-line",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="bg-brand-gradient flex size-10 items-center justify-center rounded-xl text-lg text-gold">
                  <Fi name={STREAM_DEFS[x.stream].icon} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{STREAM_DEFS[x.stream].label}</p>
                  <p className="truncate text-[11px] text-ink-3">{STREAM_DEFS[x.stream].regulator}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["Colleges", x.colleges],
                    ["Applications", x.applications],
                    ["Intake", formatNumber(x.capacity)],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="rounded-lg bg-surface-2/70 py-1.5">
                    <dd className="font-semibold text-ink">{v}</dd>
                    <dt className="text-[10px] uppercase tracking-wide text-ink-3">{label}</dt>
                  </div>
                ))}
              </dl>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">
            Colleges{streamFilter !== "all" ? ` · ${STREAM_DEFS[streamFilter].label}` : ""}
            {streamFilter !== "all" ? (
              <button onClick={() => setStreamFilter("all")} className="ml-3 text-sm font-normal text-brand hover:underline">
                Show all
              </button>
            ) : null}
          </h2>
          <Link href="/admin/colleges" className="text-sm font-medium text-brand hover:underline">
            View all
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleColleges.map((c) => (
            <Card key={c.id} className={cn("card-hover flex flex-col p-5", c.status === "Suspended" && "border-rose/30 bg-rose-soft/20")}>
              <div className="flex items-start gap-3">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl text-lg", c.status === "Suspended" ? "bg-rose-soft text-rose" : "bg-brand-gradient text-gold")}>
                  <Fi name={STREAM_DEFS[streamOfType(c.type)].icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/colleges/${c.id}`} className="block truncate font-semibold text-ink hover:text-brand hover:underline" title={c.name}>
                    {c.name}
                  </Link>
                  <p className="text-xs text-ink-3">
                    {c.type} · {c.city} · <span className="font-mono">{c.id}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {STREAM_DEFS[streamOfType(c.type)].regulator}
                  </p>
                </div>
                <Badge tone={toneForStatus(c.status)}>{c.status}</Badge>
              </div>

              <dl className="mt-4 grid grid-cols-5 gap-1.5 text-center">
                {(
                  [
                    ["Apps", c.counts.applications],
                    ["Enrolled", c.counts.enrolled],
                    ["Staff", c.counts.staff],
                    ["Depts", c.counts.departments ?? 0],
                    ["Courses", c.counts.courses],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="rounded-xl bg-surface-2/70 px-1 py-2">
                    <dd className="text-base font-semibold text-ink sm:text-lg">{v}</dd>
                    <dt className="text-[9px] uppercase tracking-wide text-ink-3 sm:text-[10px]">{label}</dt>
                  </div>
                ))}
              </dl>

              <div className="mt-4">
                <p className="mb-1.5 text-xs text-ink-3">
                  Module areas enabled: {c.modules.length}/{TOGGLEABLE_GROUPS.length} · {c.plan}
                </p>
                <div className="flex flex-wrap gap-1">
                  {TOGGLEABLE_GROUPS.map((g) => (
                    <span key={g} className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", c.modules.includes(g) ? "bg-teal-soft text-teal" : "bg-surface-2 text-ink-3 line-through")}>
                      {g}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button size="sm" disabled={enter.isPending} onClick={() => enter.mutate(c.id)}>
                  {enter.isPending && enter.variables === c.id ? <Spinner /> : <Fi name="sign-in-alt" />} Enter college
                </Button>
                <LinkButton href={`/admin/colleges/${c.id}/edit`} size="sm" variant="secondary">
                  <Fi name="settings" /> Configure
                </LinkButton>
                {c.status !== "Onboarding" ? (
                  <Button
                    size="sm"
                    variant={c.status === "Suspended" ? "secondary" : "ghost"}
                    className={c.status === "Suspended" ? "" : "text-rose hover:bg-rose-soft hover:text-rose"}
                    disabled={toggle.isPending}
                    onClick={() => {
                      if (c.status === "Suspended" || window.confirm(`Suspend ${c.name}? All of its users will be signed out immediately.`)) toggle.mutate(c);
                    }}
                  >
                    {toggle.isPending && toggle.variables?.id === c.id ? <Spinner /> : <Fi name={c.status === "Suspended" ? "play" : "pause"} />}
                    {c.status === "Suspended" ? "Reactivate" : "Suspend"}
                  </Button>
                ) : (
                  <LinkButton href={`/admin/colleges/${c.id}/edit`} size="sm" variant="ghost">
                    <Fi name="rocket-lunch" /> Finish onboarding
                  </LinkButton>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard spec={comparison} />
        <ChartCard spec={statusMix} />
      </div>

      <Card>
        <CardHeader title="Recent university activity" subtitle="From the audit log" action={<LinkButton href="/admin/audit-log" size="sm" variant="secondary">Full audit log</LinkButton>} />
        <CardBody>
          {data.recentAudit.length ? (
            <ul className="divide-y divide-line text-sm">
              {data.recentAudit.map((a) => (
                <li key={a.at + a.target} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="text-ink">
                    {a.action} · <span className="text-ink-2">{a.target}</span>
                  </span>
                  <span className="text-xs text-ink-3">
                    {a.actor} · {new Date(a.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">No activity yet this session. College changes, scope switches and record edits will appear here.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
