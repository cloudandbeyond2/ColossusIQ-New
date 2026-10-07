"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Fi, ModuleIcon } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import type { IconName } from "@/config/modules";
import { ApiError, apiFetch } from "@/lib/api/client";
import { ModuleControlOverview, type ControlModule } from "@/lib/api/module-control-schemas";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

const KEY = ["module-control"] as const;
const pk = (slug: string, role: Role) => `${slug}|${role}`;

/** Module Control (Super Admin): switch modules on or off for each role, university-wide. */
export function ModuleControlModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/module-control", ModuleControlOverview) });
  // Kept here: the matrix remounts with fresh data after a save, and the confirmation must survive that.
  const [message, setMessage] = useState<Message | null>(null);
  if (q.isPending) return <Skeleton className="h-[640px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return <Matrix key={q.data.disabled.join(",")} d={q.data} message={message} setMessage={setMessage} />;
}

type Message = { tone: "ok" | "error"; text: string };

function Matrix({ d, message, setMessage }: { d: ModuleControlOverview; message: Message | null; setMessage: (m: Message | null) => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(() => new Set(d.disabled));
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [focus, setFocus] = useState<Role | "">("");
  const [preview, setPreview] = useState<Role>("student");
  const locked = useMemo(() => new Set(d.locked), [d.locked]);
  const saved = useMemo(() => new Set(d.disabled), [d.disabled]);
  const changes = useMemo(() => [...draft].filter((k) => !saved.has(k)).length + [...saved].filter((k) => !draft.has(k)).length, [draft, saved]);

  const save = useMutation({
    mutationFn: () => apiFetch("/api/v1/module-control", ModuleControlOverview, { method: "PUT", body: { disabled: [...draft] } }),
    onSuccess: (r) => {
      qc.setQueryData(KEY, r);
      setMessage({ tone: "ok", text: `Saved. ${r.disabled.length ? `${r.disabled.length} module switch${r.disabled.length === 1 ? " is" : "es are"} off across all roles.` : "Every module is on for every role it is granted to."}` });
    },
    onError: (e) => setMessage({ tone: "error", text: e instanceof ApiError ? e.message : "Could not save module access." }),
  });

  const roles = focus ? d.roles.filter((r) => r.id === focus) : d.roles;
  const needle = search.trim().toLowerCase();
  const visible = d.modules.filter((m) => (!group || m.group === group) && (!focus || m.roles.includes(focus)) && (!needle || `${m.title} ${m.slug} ${m.description}`.toLowerCase().includes(needle)));
  const byGroup = d.groups.map((g) => ({ g, mods: visible.filter((m) => m.group === g) })).filter((x) => x.mods.length);

  const editable = (m: ControlModule, r: Role) => d.canEdit && m.roles.includes(r) && !locked.has(pk(m.slug, r));
  const setMany = (pairs: string[], on: boolean) =>
    setDraft((prev) => {
      const next = new Set(prev);
      for (const k of pairs) {
        if (on) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  const pairsFor = (mods: ControlModule[], rs: Role[]) => mods.flatMap((m) => rs.filter((r) => editable(m, r)).map((r) => pk(m.slug, r)));

  const stats = d.roles.map((r) => {
    const granted = d.modules.filter((m) => m.roles.includes(r.id));
    const on = granted.filter((m) => !draft.has(pk(m.slug, r.id))).length;
    return { ...r, granted: granted.length, on };
  });
  const previewMenu = d.groups.map((g) => ({ g, mods: d.modules.filter((m) => m.group === g && m.roles.includes(preview) && !draft.has(pk(m.slug, preview))) })).filter((x) => x.mods.length);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setFocus((f) => (f === s.id ? "" : s.id))}
            className={cn("rounded-2xl border bg-surface p-4 text-left transition hover:border-brand/50", focus === s.id ? "border-brand ring-2 ring-brand/20" : "border-line")}
            aria-pressed={focus === s.id}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">{s.label}</p>
              <Badge tone={s.on === s.granted ? "teal" : s.on === 0 ? "rose" : "amber"}>
                {s.on}/{s.granted}
              </Badge>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${s.granted ? (s.on / s.granted) * 100 : 0}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-3">{s.on === s.granted ? "Every module on" : `${s.granted - s.on} switched off`}</p>
          </button>
        ))}
      </div>

      {!d.canEdit ? (
        <Card className="flex items-center gap-3 border-amber p-4 text-sm text-ink-2">
          <Fi name="lock" className="text-amber" /> Switch to “All colleges” and confirm your sign-in code to change module access. You can still browse and preview.
        </Card>
      ) : null}
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={cn("rounded-xl px-4 py-2 text-sm", message.tone === "error" ? "bg-rose-soft text-rose" : "bg-teal-soft text-teal")}>
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search modules</span>
              <Fi name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input className={cn(inputClass, "pl-9")} placeholder="Search modules…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <label>
              <span className="sr-only">Area</span>
              <select className={inputClass} value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">All areas</option>
                {d.groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Role</span>
              <select className={inputClass} value={focus} onChange={(e) => setFocus(e.target.value as Role | "")}>
                <option value="">All roles</option>
                {d.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            {d.canEdit ? (
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => setMany(pairsFor(visible, roles.map((r) => r.id)), true)}>
                  All on
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setMany(pairsFor(visible, roles.map((r) => r.id)), false)}>
                  All off
                </Button>
              </div>
            ) : null}
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr>
                  <th className="border-b border-line px-4 py-2 text-left font-medium text-ink-3">Module</th>
                  {roles.map((r) => (
                    <th key={r.id} className="border-b border-line px-2 py-2 text-center text-xs font-medium text-ink-3">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byGroup.map(({ g, mods }) => (
                  <GroupRows key={g} group={g} mods={mods} roles={roles.map((r) => r.id)} draft={draft} locked={locked} editable={editable} onToggle={(k, on) => setMany([k], on)} onGroup={(on) => setMany(pairsFor(mods, roles.map((r) => r.id)), on)} canEdit={d.canEdit} />
                ))}
                {!byGroup.length ? (
                  <tr>
                    <td colSpan={roles.length + 1} className="px-4 py-10 text-center text-ink-3">
                      No modules match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="h-fit xl:sticky xl:top-4">
          <CardHeader title="Menu preview" subtitle="What this role sees, with your unsaved changes" />
          <CardBody className="space-y-3">
            <select className={inputClass} value={preview} onChange={(e) => setPreview(e.target.value as Role)} aria-label="Preview role">
              {d.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
              {previewMenu.length ? (
                previewMenu.map(({ g, mods }) => (
                  <div key={g}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{g}</p>
                    <ul className="space-y-0.5">
                      {mods.map((m) => (
                        <li key={m.slug} className="flex items-center gap-2 rounded-lg px-2 py-1 text-ink-2">
                          <ModuleIcon name={m.icon as IconName} className="text-ink-3" />
                          <span className="truncate">{m.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-3">This role would see only its home page.</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {changes ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-surface p-4 shadow-xl">
          <p className="text-sm text-ink">
            <b>{changes}</b> unsaved change{changes === 1 ? "" : "s"}. Saving applies them to every college at once and records them in the audit log.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setDraft(new Set(d.disabled))} disabled={save.isPending}>
              Discard
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !d.canEdit}>
              {save.isPending ? <Spinner /> : <Fi name="disk" />} Save changes
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupRows({
  group,
  mods,
  roles,
  draft,
  locked,
  editable,
  onToggle,
  onGroup,
  canEdit,
}: {
  group: string;
  mods: ControlModule[];
  roles: Role[];
  draft: Set<string>;
  locked: Set<string>;
  editable: (m: ControlModule, r: Role) => boolean;
  onToggle: (key: string, on: boolean) => void;
  onGroup: (on: boolean) => void;
  canEdit: boolean;
}) {
  return (
    <>
      <tr>
        <td colSpan={roles.length + 1} className="border-b border-line bg-surface-2/60 px-4 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              {group} <span className="font-normal normal-case">· {mods.length}</span>
            </span>
            {canEdit ? (
              <span className="flex gap-2 text-xs">
                <button type="button" className="text-brand hover:underline" onClick={() => onGroup(true)}>
                  On
                </button>
                <button type="button" className="text-ink-3 hover:underline" onClick={() => onGroup(false)}>
                  Off
                </button>
              </span>
            ) : null}
          </div>
        </td>
      </tr>
      {mods.map((m) => (
        <tr key={m.slug} className="hover:bg-surface-2/40">
          <td className="border-b border-line px-4 py-2">
            <div className="flex items-center gap-2.5">
              <ModuleIcon name={m.icon as IconName} className="text-ink-3" />
              <div className="min-w-0">
                <p className="truncate font-medium text-ink" title={m.description}>
                  {m.title}
                </p>
                <p className="text-[11px] text-ink-3">{m.phase}</p>
              </div>
            </div>
          </td>
          {roles.map((r) => {
            const k = pk(m.slug, r);
            if (!m.roles.includes(r))
              return (
                <td key={r} className="border-b border-line text-center text-ink-3/50" aria-label="Not available to this role">
                  ·
                </td>
              );
            if (locked.has(k))
              return (
                <td key={r} className="border-b border-line text-center" title="Always on for the Super Admin">
                  <Fi name="lock" className="text-ink-3" />
                </td>
              );
            const on = !draft.has(k);
            return (
              <td key={r} className="border-b border-line text-center">
                <Switch on={on} disabled={!editable(m, r)} label={`${m.title} for ${r}`} onChange={(v) => onToggle(k, v)} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function Switch({ on, disabled, label, onChange }: { on: boolean; disabled: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60", on ? "bg-teal" : "bg-line")}
    >
      <span className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}
