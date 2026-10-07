"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Fi } from "@/components/ui/icon";
import { Badge, Card, CardBody, CardHeader, LinkButton, Skeleton } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { PlatformHealth } from "@/lib/api/module-control-schemas";
import { cn } from "@/lib/utils";

const LINKS: Array<[string, string, string]> = [
  ["module-control", "Module Control", "apps"],
  ["ai-providers", "AI Providers", "microchip-ai"],
  ["users", "Users", "users"],
  ["roles-permissions", "Roles & Permissions", "lock"],
  ["security-settings", "Security", "shield-check"],
  ["ai-governance", "AI Governance", "chart-line-up"],
  ["integrations", "Integrations", "plug-connection"],
  ["audit-log", "Audit log", "time-past"],
];

/** Super Admin home: AI providers, module access by role, database and quick links. */
export function PlatformPanel() {
  const q = useQuery({ queryKey: ["platform-health"], queryFn: () => apiFetch("/api/v1/platform-health", PlatformHealth), refetchInterval: 60_000 });
  if (q.isPending) return <Skeleton className="h-72" />;
  if (q.isError) return null;
  const d = q.data;
  const rate = d.ai.requests ? Math.round((d.ai.ok / d.ai.requests) * 100) : null;
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card>
        <CardHeader title="AI providers" subtitle={d.ai.requests ? `${d.ai.requests} requests · ${rate}% answered · ${d.ai.avgMs} ms average` : "No AI requests since the server started"} action={<LinkButton href="/admin/ai-providers" size="sm" variant="secondary">Manage</LinkButton>} />
        <CardBody className="space-y-2">
          {d.providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className={cn("size-2 rounded-full", p.tone === "teal" ? "bg-teal" : p.tone === "amber" ? "bg-amber" : "bg-line")} />
                {p.name}
                {p.isDefault ? <Fi name="star" solid className="text-xs text-gold" /> : null}
              </span>
              <Badge tone={p.tone}>{p.state}</Badge>
            </div>
          ))}
          <p className="flex items-center gap-2 pt-1 text-xs text-ink-3">
            <Fi name="database" /> {d.database === "postgres" ? "PostgreSQL with row-level security" : "In-memory demo data store"}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Module access by role" subtitle={d.switchedOff ? `${d.switchedOff} switch${d.switchedOff === 1 ? "" : "es"} off university-wide` : "Every module is on for every role"} action={<LinkButton href="/admin/module-control" size="sm" variant="secondary">Control</LinkButton>} />
        <CardBody className="space-y-2.5">
          {d.access.map((a) => (
            <div key={a.role}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-2">{a.label}</span>
                <span className={cn("font-medium", a.on < a.granted ? "text-amber" : "text-ink-3")}>
                  {a.on}/{a.granted}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className={cn("h-full rounded-full", a.on < a.granted ? "bg-amber" : "bg-teal")} style={{ width: `${a.granted ? (a.on / a.granted) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Platform controls" subtitle="Everything the Super Admin runs" />
        <CardBody className="grid grid-cols-2 gap-2">
          {LINKS.map(([slug, label, icon]) => (
            <Link key={slug} href={`/admin/${slug}`} className="flex items-center gap-2 rounded-xl border border-line px-2.5 py-2 text-xs leading-tight text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand">
              <Fi name={icon} className="shrink-0 text-base" />
              <span>{label}</span>
            </Link>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
