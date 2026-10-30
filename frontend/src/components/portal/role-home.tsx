"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { RoleHome } from "@/lib/api/schemas";
import { ROLE_META, type Role } from "@/lib/auth/roles";
import { ChartCard } from "@/components/charts/chart-card";
import { InsightList, KpiGrid, TemplateSkeleton } from "@/components/modules/shared";
import { Button, Card, CardHeader, LinkButton, PageHeader, toneBar } from "@/components/ui/primitives";
import { safeNextPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils";
import { Fi } from "@/components/ui/icon";
import { NoticeStrip } from "./notice-strip";

export function RoleHomeView({ role }: { role: Exclude<Role, "student"> }) {
  const { data, isLoading, refetch, isRefetching, dataUpdatedAt } = useQuery({
    queryKey: ["home", role],
    queryFn: () => apiFetch(`/api/v1/home/${role}`, RoleHome),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  if (isLoading || !data) return <TemplateSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <span>{ROLE_META[role].label}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/15 px-2 py-0.5 text-[11px] font-medium text-teal">
              <span className="size-1.5 rounded-full bg-teal animate-pulse" /> Live
            </span>
            {dataUpdatedAt ? (
              <span className="text-[11px] text-ink-3">
                · Synced {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            ) : null}
            {data.department ? (
              <>
                <span className="text-ink-4">/</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold normal-case tracking-normal text-brand ring-1 ring-inset ring-brand/20">
                  <Fi name="book-alt" className="text-xs" />
                  {data.department.startsWith("Department of") ? data.department : `Dept of ${data.department}`}
                </span>
              </>
            ) : null}
          </div>
        }
        title={data.greeting}
        description={
          data.department && role === "hod"
            ? `Department intelligence, faculty, academics and placement readiness for ${data.department.startsWith("Department of") ? data.department : `Department of ${data.department}`}.`
            : ROLE_META[role].description
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refetch()}
              disabled={isRefetching}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={cn("size-3.5", isRefetching && "animate-spin")} />
              {isRefetching ? "Syncing..." : "Sync live"}
            </Button>
            {role === "placement" ? (
              <>
                <LinkButton href="/placement/drives" size="sm" variant="primary">
                  <Fi name="briefcase" /> Campus Drives
                </LinkButton>
                <LinkButton href="/placement/placement-board" size="sm" variant="secondary">
                  <Fi name="chart" /> Placement Board
                </LinkButton>
              </>
            ) : null}
          </div>
        }
      />
      {role === "placement" ? (
        <div className="relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/10 via-brand-soft/20 to-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-brand/25">
                <Fi name="briefcase" className="text-xl" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand">Placement Command Center</span>
                  <span className="size-1.5 rounded-full bg-teal animate-pulse" />
                  <span className="text-xs text-ink-3">Live Campus Recruitment</span>
                </div>
                <h2 className="text-lg font-bold text-ink sm:text-xl">
                  Training & Placement Operations
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/placement/placement-board"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink shadow-sm hover:bg-surface-2 transition-colors"
              >
                <Fi name="users" className="text-sm text-ink-3" />
                Readiness Board
              </Link>
              <Link
                href="/placement/drives"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-medium text-white shadow-sm shadow-brand/20 hover:brightness-105 transition-all"
              >
                <Fi name="calendar" className="text-sm" />
                Drives Schedule
              </Link>
              <Link
                href="/placement/placement-analytics"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink shadow-sm hover:bg-surface-2 transition-colors"
              >
                <Fi name="chart" className="text-sm text-ink-3" />
                Analytics
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      {role === "hod" && data.department ? (
        <div className="relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/10 via-brand-soft/20 to-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-brand/25">
                <Fi name="building" className="text-xl" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand">Department Oversight</span>
                  <span className="size-1.5 rounded-full bg-teal animate-pulse" />
                  <span className="text-xs text-ink-3">Live Department Portal</span>
                </div>
                <h2 className="text-lg font-bold text-ink sm:text-xl">
                  {data.department.startsWith("Department of") ? data.department : `Department of ${data.department}`}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/hod/department-faculty"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink shadow-sm hover:bg-surface-2 transition-colors"
              >
                <Fi name="users" className="text-sm text-ink-3" />
                Faculty Roster
              </Link>
              <Link
                href="/hod/department-skills"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-medium text-white shadow-sm shadow-brand/20 hover:brightness-105 transition-all"
              >
                <Fi name="chart" className="text-sm" />
                Department Skills
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      <NoticeStrip role={role} />
      <KpiGrid kpis={data.kpis} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {data.charts.map((c) => (
            <ChartCard key={c.title} spec={c} />
          ))}
        </div>
        <Card className="h-fit">
          <CardHeader title="Needs your attention" />
          <ul className="p-3">
            {data.queue.map((q) => (
              <li key={q.title}>
                <Link href={safeNextPath(q.href, `/${role}`)} className="group flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-surface-2">
                  <span className={cn("h-9 w-1 rounded-full", toneBar[q.tone])} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{q.title}</span>
                    <span className="block text-xs text-ink-3">{q.meta}</span>
                  </span>
                  <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <InsightList insights={data.insights} />
    </div>
  );
}
