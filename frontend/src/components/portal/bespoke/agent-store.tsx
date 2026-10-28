"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, inputClass, Skeleton } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { AgentStoreView, type AgentRow } from "@/lib/api/agent-store-schemas";
import { cn } from "@/lib/utils";

const KEY = ["agent-store"] as const;
const TONE: Record<string, "brand" | "teal" | "gold" | "sky"> = { Student: "brand", Faculty: "teal", Institution: "gold", Platform: "sky" };

/** Principal: switch the college's AI agents on or off. A switched-off agent stops answering in the portal. */
export function AgentStoreModule() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/agents/store", AgentStoreView) });
  const [audience, setAudience] = useState("All");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: (v: { agent: string; enabled: boolean }) => apiFetch("/api/v1/agents/store", AgentStoreView, { method: "PUT", body: v }),
    onMutate: () => setError(null),
    onSuccess: (data) => qc.setQueryData(KEY, data),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not update the agent. Try again."),
  });

  const agents = q.data?.agents;
  const audiences = useMemo(() => ["All", ...new Set((agents ?? []).map((a) => a.audience))], [agents]);
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (agents ?? []).filter((a) => (audience === "All" || a.audience === audience) && (!term || `${a.name} ${a.summary} ${a.usedIn.join(" ")}`.toLowerCase().includes(term)));
  }, [agents, audience, search]);

  if (q.isPending) return <Skeleton className="h-[480px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;

  const on = q.data.agents.filter((a) => a.enabled).length;

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">
            {on} of {q.data.agents.length} agents are on for your college
          </p>
          <p className="mt-0.5 text-xs text-ink-3">A switched-off agent stops answering for your students and staff. Core platform agents stay on.</p>
        </div>
        <Badge tone="sky">{q.data.provider}</Badge>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Audience">
          {audiences.map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={audience === a}
              onClick={() => setAudience(a)}
              className={cn("rounded-lg px-2.5 py-1 text-xs font-medium", audience === a ? "bg-brand text-white" : "bg-surface-2 text-ink-2 hover:bg-surface-3")}
            >
              {a}
            </button>
          ))}
        </div>
        <input className={cn(inputClass, "w-full sm:max-w-xs")} placeholder="Search agents..." aria-label="Search agents" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-ink">
          {error}
        </p>
      ) : null}

      {shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-3">No agents match your search.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((a) => (
            <AgentCard key={a.id} agent={a} busy={toggle.isPending && toggle.variables?.agent === a.id} onToggle={() => toggle.mutate({ agent: a.id, enabled: !a.enabled })} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, busy, onToggle }: { agent: AgentRow; busy: boolean; onToggle: () => void }) {
  return (
    <Card className={cn("flex flex-col p-5", !agent.enabled && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <Badge tone={TONE[agent.audience] ?? "brand"}>{agent.audience}</Badge>
        <Badge tone={agent.enabled ? "teal" : "neutral"}>{agent.locked ? "Always on" : agent.enabled ? "On" : "Off"}</Badge>
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink">{agent.name}</h3>
      <p className="mt-1 flex-1 text-xs text-ink-3">{agent.summary}</p>
      {agent.usedIn.length ? <p className="mt-2 text-[11px] text-ink-3">Used in {agent.usedIn.join(", ")}</p> : null}
      <div className="mt-4 border-t border-line/60 pt-3">
        <Button variant={agent.enabled ? "secondary" : "primary"} size="sm" disabled={agent.locked || busy} onClick={onToggle} aria-label={`${agent.enabled ? "Switch off" : "Switch on"} ${agent.name}`}>
          {busy ? "Saving..." : agent.enabled ? "Switch off" : "Switch on"}
        </Button>
      </div>
    </Card>
  );
}
