"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api/client";
import { ModuleData } from "@/lib/api/schemas";
import type { ModuleDef } from "@/config/modules";
import type { Role } from "@/lib/auth/roles";
import { LIVE_MODULES, LIVE_REFRESH_MS } from "@/lib/placement-cache";
import { Button, EmptyState } from "@/components/ui/primitives";
import { usePrefs } from "@/components/providers";
import { cn } from "@/lib/utils";
import { ModuleHeader } from "./module-header";
import { TemplateSkeleton } from "./shared";
import {
  CalendarTemplate,
  ChatTemplate,
  DashboardTemplate,
  GalleryTemplate,
  GeneratorTemplate,
  ListTemplate,
  ScorecardTemplate,
  SettingsTemplate,
  WorkflowTemplate,
} from "./templates";

export function ModuleView({ mod, role }: { mod: ModuleDef; role: Role }) {
  const { t } = usePrefs();
  const live = LIVE_MODULES.has(mod.slug);
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["module", mod.slug],
    queryFn: () => apiFetch(`/api/v1/modules/${encodeURIComponent(mod.slug)}`, ModuleData),
    // Live modules re-check on their own, when the tab is shown again and on every visit, never serving a stale page.
    ...(live ? { refetchInterval: LIVE_REFRESH_MS, refetchOnWindowFocus: true, refetchOnMount: "always" as const, staleTime: 0 } : {}),
  });

  return (
    <div>
      <ModuleHeader mod={mod} role={role} />
      {live && data ? (
        <div className="mb-4 flex items-center justify-end gap-3 text-xs text-ink-3" aria-live="polite">
          <span>Live · updated {new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} aria-hidden /> Refresh
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <TemplateSkeleton />
      ) : error ? (
        <EmptyState
          title={error instanceof ApiError && error.status === 403 ? "You don't have access to this module" : t("common.error")}
          body={error instanceof ApiError ? error.message : undefined}
          action={<Button onClick={() => void refetch()}>{t("common.retry")}</Button>}
        />
      ) : data ? (
        <Template data={data} mod={mod} />
      ) : null}
    </div>
  );
}

function Template({ data, mod }: { data: ModuleData; mod: ModuleDef }) {
  switch (data.template) {
    case "dashboard":
      return <DashboardTemplate data={data} />;
    case "list":
      return <ListTemplate data={data} mod={mod} />;
    case "workflow":
      return <WorkflowTemplate data={data} />;
    case "scorecard":
      return <ScorecardTemplate data={data} />;
    case "calendar":
      return <CalendarTemplate data={data} />;
    case "settings":
      return <SettingsTemplate data={data} mod={mod} />;
    case "gallery":
      return <GalleryTemplate data={data} />;
    case "chat":
      return <ChatTemplate data={data} mod={mod} />;
    case "generator":
      return <GeneratorTemplate data={data} mod={mod} />;
  }
}
