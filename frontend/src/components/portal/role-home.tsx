"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { RoleHome } from "@/lib/api/schemas";
import { ROLE_META, type Role } from "@/lib/auth/roles";
import { ChartCard } from "@/components/charts/chart-card";
import { InsightList, KpiGrid, TemplateSkeleton } from "@/components/modules/shared";
import { Card, CardHeader, PageHeader, toneBar } from "@/components/ui/primitives";
import { safeNextPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils";
import { NoticeStrip } from "./notice-strip";

export function RoleHomeView({ role }: { role: Exclude<Role, "student"> }) {
  const { data, isLoading } = useQuery({
    queryKey: ["home", role],
    queryFn: () => apiFetch(`/api/v1/home/${role}`, RoleHome),
  });

  if (isLoading || !data) return <TemplateSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={ROLE_META[role].label} title={data.greeting} description={ROLE_META[role].description} />
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
