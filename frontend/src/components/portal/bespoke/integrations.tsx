"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, Field, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { IntegrationsOverview, TestResult, type IntegrationView } from "@/lib/api/integration-schemas";
import { fieldsOf, INTEGRATIONS, type IntegrationDef, type IntegrationField } from "@/lib/integrations/catalog";
import { cn } from "@/lib/utils";

const KEY = ["integrations"] as const;
const STATUS_TONE = { Connected: "teal", Saved: "sky", Incomplete: "amber", Off: "neutral", "Not set up": "neutral" } as const;
const STATUS_HELP: Record<string, string> = {
  Connected: "Working: the last connection test passed.",
  Saved: "Saved and switched on. Run a connection test to confirm it works.",
  Incomplete: "Some required settings are missing.",
  Off: "Configured but switched off.",
  "Not set up": "Not configured yet.",
};
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Integrations & Setup: storage, email, WhatsApp, SMS, payments, SSO, online classes and the ERP webhook. */
export function IntegrationsModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/integrations", IntegrationsOverview) });
  const [selected, setSelected] = useState(INTEGRATIONS[0]!.id);
  if (q.isPending) return <Skeleton className="h-[600px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const viewOf = (id: string) => d.integrations.find((i) => i.id === id)!;
  const working = d.integrations.filter((i) => i.status === "Connected").length;
  const categories = [...new Set(INTEGRATIONS.map((i) => i.category))];
  const def = INTEGRATIONS.find((i) => i.id === selected)!;
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-ink-3">Connected services</p>
          <p className="text-2xl font-semibold text-ink">
            {working} <span className="text-base font-normal text-ink-3">of {d.integrations.length} working</span>
          </p>
          <p className="mt-1 max-w-xl text-xs text-ink-3">Settings are stored encrypted and tested here. Each module starts sending through a service as it is connected to it; until then it keeps working as it does today.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(["Connected", "Saved", "Incomplete", "Off", "Not set up"] as const).map((s) => {
            const n = d.integrations.filter((i) => i.status === s).length;
            return n ? (
              <Badge key={s} tone={STATUS_TONE[s]}>
                {n} {s.toLowerCase()}
              </Badge>
            ) : null;
          })}
        </div>
      </Card>
      {!d.canEdit ? (
        <Card className="flex items-start gap-3 border-amber p-4 text-sm text-ink-2">
          <Fi name="lock" className="mt-0.5 text-amber" />
          <p>Integrations apply to the whole university. The University Super Admin sets them up at “All colleges” after confirming the sign-in code; here you can see what is connected.</p>
        </Card>
      ) : null}
      {d.canEdit && !d.canStoreSecrets ? (
        <Card className="flex items-start gap-3 border-amber p-4 text-sm text-ink-2">
          <Fi name="shield-exclamation" className="mt-0.5 text-amber" />
          <p>
            Secrets cannot be saved here yet: set <code className="rounded bg-surface-2 px-1">MFA_ENCRYPTION_KEY</code> (32+ characters) on the server so they are stored encrypted, or put them in the environment variables shown under each field.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit p-2 lg:sticky lg:top-4">
          <nav aria-label="Integrations">
            {categories.map((c) => (
              <div key={c} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{c}</p>
                {INTEGRATIONS.filter((i) => i.category === c).map((i) => {
                  const v = viewOf(i.id);
                  return (
                    <button key={i.id} type="button" onClick={() => setSelected(i.id)} aria-current={selected === i.id} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition", selected === i.id ? "bg-brand-soft" : "hover:bg-surface-2")}>
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", selected === i.id ? "bg-brand text-white" : "bg-surface-2 text-ink-2")}>
                        <Fi name={i.icon} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{i.name}</span>
                        <span className="block truncate text-xs text-ink-3">{v.provider ? (i.providers.find((p) => p.id === v.provider)?.name ?? v.provider) : "Not set up"}</span>
                      </span>
                      <span className={cn("size-2.5 shrink-0 rounded-full", v.status === "Connected" ? "bg-teal" : v.status === "Saved" ? "bg-sky" : v.status === "Incomplete" ? "bg-amber" : "bg-line")} title={v.status} />
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </Card>
        <Detail key={`${def.id}:${viewOf(def.id).source}`} def={def} view={viewOf(def.id)} canEdit={d.canEdit} canStoreSecrets={d.canStoreSecrets} />
      </div>
    </div>
  );
}

function Detail({ def, view, canEdit, canStoreSecrets }: { def: IntegrationDef; view: IntegrationView; canEdit: boolean; canStoreSecrets: boolean }) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState(view.provider ?? def.providers[0]!.id);
  const [enabled, setEnabled] = useState(view.provider ? view.enabled : true);
  const [values, setValues] = useState<Record<string, string>>(view.values);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [clear, setClear] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [test, setTest] = useState<TestResult | null>(view.lastTest);
  const p = def.providers.find((x) => x.id === provider)!;
  const fields = fieldsOf(def, provider);
  const switched = provider !== view.provider;

  const save = useMutation({
    mutationFn: () => apiFetch(`/api/v1/integrations/${def.id}`, IntegrationsOverview, { method: "PUT", body: { provider, enabled, values: Object.fromEntries(fields.filter((f) => f.kind !== "secret").map((f) => [f.key, values[f.key] || (f.kind === "select" ? (f.options?.[0] ?? "") : "")])), secrets, clear } }),
    onSuccess: (r) => {
      qc.setQueryData(KEY, r);
      void qc.invalidateQueries({ queryKey: ["platform-health"] });
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fields);
      setMessage({ tone: "error", text: e instanceof ApiError ? e.message : "Could not save." });
    },
  });
  const runTest = useMutation({
    mutationFn: () => apiFetch(`/api/v1/integrations/${def.id}/test`, TestResult, { method: "POST" }),
    onSuccess: (r) => {
      setTest(r);
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => setTest({ ok: false, message: e instanceof ApiError ? e.message : "The test could not run.", ms: 0 }),
  });
  const reset = useMutation({
    mutationFn: () => apiFetch(`/api/v1/integrations/${def.id}`, IntegrationsOverview, { method: "DELETE" }),
    onSuccess: (r) => qc.setQueryData(KEY, r),
  });
  const busy = save.isPending || runTest.isPending || reset.isPending;

  return (
    <Card className="min-w-0">
      <CardBody className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-xl text-brand">
              <Fi name={def.icon} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">{def.name}</h2>
              <p className="max-w-2xl text-sm text-ink-2">{def.description}</p>
            </div>
          </div>
          <div className="text-right">
            <Badge tone={STATUS_TONE[view.status]}>{view.status}</Badge>
            <p className="mt-1 max-w-[220px] text-xs text-ink-3">{STATUS_HELP[view.status]}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-ink-3">For</span>
          {def.usedBy.map((u) => (
            <span key={u} className="rounded-full border border-line px-2 py-0.5 text-ink-2">
              {u}
            </span>
          ))}
        </div>
        {view.source === "environment" ? (
          <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm text-ink-2">These settings come from the server&apos;s environment variables. Saving here overrides them.</p>
        ) : null}

        {canEdit ? (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Provider</legend>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {def.providers.map((x) => (
                  <label key={x.id} className={cn("cursor-pointer rounded-xl border p-3 transition", provider === x.id ? "border-brand bg-brand-soft/40 ring-2 ring-brand/20" : "border-line hover:border-brand/40")}>
                    <input type="radio" name={`prov-${def.id}`} className="sr-only" checked={provider === x.id} onChange={() => setProvider(x.id)} />
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{x.name}</span>
                      {provider === x.id ? <Fi name="check-circle" className="text-brand" /> : null}
                    </span>
                    <span className="mt-1 block text-xs text-ink-3">{x.blurb}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {fields.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {fields.map((f) => (
                  <FieldInput
                    key={f.key}
                    f={f}
                    value={values[f.key] ?? ""}
                    onChange={(v) => setValues({ ...values, [f.key]: v })}
                    secret={switched ? null : (view.secrets[f.key] ?? null)}
                    cleared={clear.includes(f.key)}
                    newSecret={secrets[f.key] ?? ""}
                    onSecret={(v) => setSecrets({ ...secrets, [f.key]: v })}
                    onClear={() => setClear([...clear, f.key])}
                    error={errors[f.key]}
                    canStoreSecrets={canStoreSecrets}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">Nothing to configure for this option.</p>
            )}
            {p.docs ? (
              <a href={p.docs} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <Fi name="book-alt" /> How to get these settings from {p.name}
              </a>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
              <label className="inline-flex items-center gap-3 text-sm text-ink">
                <button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled(!enabled)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", enabled ? "bg-teal" : "bg-line")}>
                  <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-[22px]" : "translate-x-0.5")} />
                </button>
                {enabled ? "Switched on" : "Switched off"}
              </label>
              <div className="flex flex-wrap gap-2">
                {view.source === "saved" ? (
                  <Button variant="ghost" disabled={busy} onClick={() => window.confirm(`Forget the saved ${def.name} settings? Environment variables, if any, will apply.`) && reset.mutate()}>
                    Reset
                  </Button>
                ) : null}
                <Button variant="secondary" disabled={busy || !view.provider || switched || !p.testable} onClick={() => runTest.mutate()} title={!p.testable ? "This provider is checked on first use" : switched ? "Save first" : undefined}>
                  {runTest.isPending ? <Spinner /> : <Fi name="pulse" />} Test connection
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => {
                    setMessage(null);
                    setErrors({});
                    save.mutate(undefined, { onSuccess: () => (setMessage({ tone: "ok", text: "Saved." }), setSecrets({}), setClear([])) });
                  }}
                >
                  {save.isPending ? <Spinner /> : <Fi name="disk" />} Save
                </Button>
              </div>
            </div>
            {message ? (
              <p role={message.tone === "error" ? "alert" : "status"} className={cn("rounded-xl px-4 py-2 text-sm", message.tone === "error" ? "bg-rose-soft text-rose" : "bg-teal-soft text-teal")}>
                {message.text}
              </p>
            ) : null}
            {test ? (
              <div className={cn("flex items-start gap-3 rounded-xl px-4 py-3 text-sm", test.ok ? "bg-teal-soft text-ink" : "bg-rose-soft text-ink")} role="status">
                <Fi name={test.ok ? "check-circle" : "cross-circle"} className={cn("mt-0.5", test.ok ? "text-teal" : "text-rose")} />
                <div>
                  <p>{test.message}</p>
                  <p className="text-xs text-ink-3">
                    {test.ms ? `${test.ms} ms` : ""}
                    {"at" in test && typeof test.at === "string" ? ` · ${when(test.at)}` : ""}
                  </p>
                </div>
              </div>
            ) : null}
            {view.updatedBy ? (
              <p className="text-xs text-ink-3">
                Last changed by {view.updatedBy}
                {view.updatedAt ? ` on ${when(view.updatedAt)}` : ""}.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-ink-2">{view.provider ? `Provider: ${def.providers.find((x) => x.id === view.provider)?.name ?? view.provider}.` : "Not set up yet."}</p>
        )}
      </CardBody>
    </Card>
  );
}

function FieldInput({
  f,
  value,
  onChange,
  secret,
  cleared,
  newSecret,
  onSecret,
  onClear,
  error,
  canStoreSecrets,
}: {
  f: IntegrationField;
  value: string;
  onChange: (v: string) => void;
  secret: { hint: string; fromEnv: boolean } | null;
  cleared: boolean;
  newSecret: string;
  onSecret: (v: string) => void;
  onClear: () => void;
  error?: string;
  canStoreSecrets: boolean;
}) {
  const id = `int-${f.key}`;
  const [replacing, setReplacing] = useState(false);
  const [show, setShow] = useState(false);
  const envHint = f.env ? `or set ${f.env} on the server` : undefined;
  const wide = f.kind === "textarea" || (f.kind === "secret" && (f.max ?? 0) > 1000);
  if (f.kind === "secret") {
    const has = secret && !cleared;
    return (
      <div className={cn(wide && "md:col-span-2")}>
        <Field label={`${f.label}${f.required ? "" : ""}`} htmlFor={id} error={error} hint={f.help ?? envHint}>
          {has && !replacing ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2">
              <Fi name="lock" className="text-ink-3" />
              <span className="font-mono text-sm text-ink">{secret.hint}</span>
              <span className="text-xs text-ink-3">{secret.fromEnv ? "from the environment" : "saved, encrypted"}</span>
              <span className="ml-auto flex gap-2 text-xs">
                <button type="button" className="font-medium text-brand hover:underline" onClick={() => setReplacing(true)} disabled={!canStoreSecrets}>
                  Replace
                </button>
                {!secret.fromEnv ? (
                  <button type="button" className="text-ink-3 hover:text-rose" onClick={onClear}>
                    Remove
                  </button>
                ) : null}
              </span>
            </div>
          ) : wide ? (
            <textarea id={id} className={cn(inputClass, "min-h-28 font-mono text-xs")} value={newSecret} onChange={(e) => onSecret(e.target.value)} autoComplete="off" spellCheck={false} disabled={!canStoreSecrets} placeholder={canStoreSecrets ? f.placeholder : "Set MFA_ENCRYPTION_KEY to store secrets here"} />
          ) : (
            <div className="relative">
              <input id={id} type={show ? "text" : "password"} className={cn(inputClass, "pr-10 font-mono")} value={newSecret} onChange={(e) => onSecret(e.target.value)} autoComplete="new-password" spellCheck={false} disabled={!canStoreSecrets} placeholder={canStoreSecrets ? (f.placeholder ?? (cleared ? "Will be removed when you save" : "")) : "Set MFA_ENCRYPTION_KEY to store secrets here"} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink" aria-label={show ? "Hide" : "Show"}>
                <Fi name={show ? "eye-crossed" : "eye"} />
              </button>
            </div>
          )}
        </Field>
      </div>
    );
  }
  return (
    <div className={cn(wide && "md:col-span-2")}>
      <Field label={f.label} htmlFor={id} error={error} hint={f.help ?? envHint}>
        {f.kind === "select" ? (
          <select id={id} className={inputClass} value={value || f.options?.[0] || ""} onChange={(e) => onChange(e.target.value)}>
            {f.options?.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input id={id} type={f.kind === "number" ? "number" : f.kind === "email" ? "email" : f.kind === "url" ? "url" : "text"} className={inputClass} value={value} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
        )}
      </Field>
    </div>
  );
}
