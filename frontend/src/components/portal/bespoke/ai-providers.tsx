"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Cpu, KeyRound, Star, Trash2, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, Field, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { ProvidersOverview, TestResult, type ProviderView } from "@/lib/api/ai-providers-schemas";
import { cn } from "@/lib/utils";

const KEY = ["ai-providers"] as const;
const date = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** AI Providers: keys, models, on/off switches and the default for Gemini, Claude and ChatGPT. */
export function AiProvidersModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/ai-providers", ProvidersOverview) });
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  if (q.isPending)
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const name = (id: string) => d.providers.find((p) => p.id === id)?.name ?? id;
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-ink-3">AI requests go to</p>
          <p className="text-lg font-semibold text-ink">{d.order.length ? d.order.map(name).join(" → ") : "No provider is switched on: AI features use built-in templates"}</p>
          <p className="text-xs text-ink-3">The default answers first; if it fails, the other switched-on providers are tried in order. Knowledge Base search and PDF reading always use Gemini.</p>
        </div>
        {!d.canEdit ? <Badge tone="amber">Switch to “All colleges” and confirm your sign-in code to make changes</Badge> : null}
      </Card>
      {!d.canStoreKeys ? (
        <Card className="border-amber p-4 text-sm text-ink-2">
          Keys cannot be saved here yet: set <code className="rounded bg-surface-2 px-1">MFA_ENCRYPTION_KEY</code> (32+ characters) on the server so they are stored encrypted, or put them in the environment variables shown on each card.
        </Card>
      ) : null}
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={cn("rounded-xl px-4 py-2 text-sm", message.tone === "error" ? "bg-rose-soft text-rose" : "bg-teal-soft text-teal")}>
          {message.text}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {d.providers.map((p) => (
          <ProviderCard key={p.id} p={p} canEdit={d.canEdit} canStoreKeys={d.canStoreKeys} say={setMessage} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({ p, canEdit, canStoreKeys, say }: { p: ProviderView; canEdit: boolean; canStoreKeys: boolean; say: (m: { tone: "ok" | "error"; text: string } | null) => void }) {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [model, setModel] = useState(p.model);
  const [test, setTest] = useState<TestResult | null>(null);
  const done = (text: string) => (o: ProvidersOverview) => {
    qc.setQueryData(KEY, o);
    say({ tone: "ok", text });
  };
  const fail = (e: unknown) => say({ tone: "error", text: e instanceof ApiError ? Object.values(e.fields)[0] ?? e.message : "Could not save. Try again." });
  const update = useMutation({ mutationFn: (body: Record<string, unknown>) => apiFetch(`/api/v1/ai-providers/${p.id}`, ProvidersOverview, { method: "PUT", body }), onError: fail });
  const makeDefault = useMutation({ mutationFn: () => apiFetch("/api/v1/ai-providers/default", ProvidersOverview, { method: "POST", body: { provider: p.id } }), onSuccess: done(`${p.name} is now the default AI provider.`), onError: fail });
  const removeKey = useMutation({ mutationFn: () => apiFetch(`/api/v1/ai-providers/${p.id}/key`, ProvidersOverview, { method: "DELETE" }), onSuccess: done(`Removed the saved ${p.name} key.`), onError: fail });
  const runTest = useMutation({ mutationFn: () => apiFetch(`/api/v1/ai-providers/${p.id}/test`, TestResult, { method: "POST", body: {} }), onSuccess: setTest, onError: fail });
  const busy = update.isPending || makeDefault.isPending || removeKey.isPending;

  return (
    <Card className={cn("flex flex-col gap-4 p-5", p.isDefault && "ring-2 ring-brand")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <Cpu className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-ink">{p.name}</p>
            <p className="text-xs text-ink-3">{p.vendor}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {p.isDefault ? (
            <Badge tone="brand">
              <Star className="h-3.5 w-3.5" aria-hidden="true" /> Default
            </Badge>
          ) : null}
          <Badge tone={p.usable ? "teal" : p.enabled ? "amber" : "neutral"}>{p.usable ? "Active" : p.enabled ? "On, no key" : "Off"}</Badge>
        </div>
      </div>

      <div className="rounded-xl bg-surface-2 p-3 text-sm">
        <p className="flex items-center gap-2 text-ink">
          <KeyRound className="h-4 w-4 text-ink-3" aria-hidden="true" />
          {p.keyHint ? <span className="font-mono">{p.keyHint}</span> : <span className="text-ink-3">No key</span>}
          {p.keySource === "environment" ? <Badge>from {p.envVar}</Badge> : p.keySource === "settings" ? <Badge tone="teal">saved here</Badge> : null}
        </p>
        {p.updatedAt ? (
          <p className="mt-1 text-xs text-ink-3">
            Changed {date(p.updatedAt)}
            {p.updatedBy ? ` by ${p.updatedBy}` : ""}
          </p>
        ) : null}
      </div>

      <label className="flex items-center justify-between gap-3 text-sm text-ink">
        <span>Use {p.name}</span>
        <button
          type="button"
          role="switch"
          aria-checked={p.enabled}
          aria-label={`Use ${p.name}`}
          disabled={!canEdit || busy}
          onClick={() => update.mutate({ enabled: !p.enabled }, { onSuccess: done(`${p.name} switched ${p.enabled ? "off" : "on"}.`) })}
          className={cn("relative h-6 w-11 rounded-full transition-colors disabled:opacity-50", p.enabled ? "bg-brand" : "bg-line")}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", p.enabled ? "left-[22px]" : "left-0.5")} />
        </button>
      </label>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!key.trim()) return;
          update.mutate({ apiKey: key.trim() }, { onSuccess: (o) => (setKey(""), done(`Saved the ${p.name} key. Use Test to check it.`)(o)) });
        }}
      >
        <Field label={p.keyHint ? "Replace API key" : "API key"} htmlFor={`key-${p.id}`} hint={p.keyFormat}>
          <input id={`key-${p.id}`} type="password" autoComplete="off" spellCheck={false} className={inputClass} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste the key" disabled={!canEdit || !canStoreKeys} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={!canEdit || !canStoreKeys || !key.trim() || busy}>
            {update.isPending ? <Spinner /> : null} Save key
          </Button>
          {p.keySource === "settings" ? (
            <Button type="button" size="sm" variant="ghost" disabled={!canEdit || busy} onClick={() => window.confirm(`Remove the saved ${p.name} key?`) && removeKey.mutate()}>
              <Trash2 className="h-4 w-4 text-rose" aria-hidden="true" /> Remove
            </Button>
          ) : null}
        </div>
      </form>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ model: model.trim() }, { onSuccess: done(`${p.name} will use ${model.trim()}.`) });
        }}
      >
        <Field label="Model" htmlFor={`model-${p.id}`} hint={`Default: ${p.defaultModel}`}>
          <input id={`model-${p.id}`} list={`models-${p.id}`} className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} disabled={!canEdit} />
        </Field>
        <datalist id={`models-${p.id}`}>
          {p.suggestedModels.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <Button type="submit" size="sm" variant="secondary" disabled={!canEdit || busy || !model.trim() || model.trim() === p.model}>
          Save model
        </Button>
      </form>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
        <Button size="sm" variant="secondary" onClick={() => runTest.mutate()} disabled={!p.keyHint || runTest.isPending}>
          {runTest.isPending ? <Spinner /> : <Zap className="h-4 w-4" aria-hidden="true" />} Test
        </Button>
        {!p.isDefault ? (
          <Button size="sm" onClick={() => makeDefault.mutate()} disabled={!canEdit || !p.keyHint || busy}>
            <Star className="h-4 w-4" aria-hidden="true" /> Make default
          </Button>
        ) : null}
      </div>
      {test ? (
        <p role="status" className={cn("flex items-start gap-2 text-sm", test.ok ? "text-teal" : "text-rose")}>
          {test.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          {test.message} {test.ms ? `(${(test.ms / 1000).toFixed(1)} s)` : ""}
        </p>
      ) : null}
    </Card>
  );
}
