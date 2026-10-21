"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import { RolesOverview, type ModuleClosedReason, type RoleRow } from "@/lib/api/roles-schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notices";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, IconChip, LinkButton, Progress, inputClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/api/schemas";

const SHORT: Record<Role, string> = {
  student: "Student",
  faculty: "Faculty",
  hod: "HOD",
  placement: "Placement",
  incubation: "Incubation",
  institution: "Principal",
  recruiter: "Recruiter",
  admin: "Admin",
};
const TONES: Record<Role, Tone> = { student: "brand", faculty: "gold", hod: "teal", placement: "sky", incubation: "amber", institution: "rose", recruiter: "neutral", admin: "brand" };
const ICONS: Record<Role, string> = {
  student: "user-graduate",
  faculty: "chalkboard-user",
  hod: "users-alt",
  placement: "briefcase",
  incubation: "rocket-lunch",
  institution: "school",
  recruiter: "handshake",
  admin: "shield-check",
};
const STATUS_TONE: Record<string, Tone> = { Active: "teal", Invited: "sky", Suspended: "rose" };
const REASON: Record<ModuleClosedReason, string> = {
  role: "Switched off in Module Control",
  college: "Module group is off for this college",
  stream: "Not part of this college's stream",
};
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/**
 * Roles & Permissions. The matrix is the set of permissions the API enforces; beside it are the live facts: who holds
 * each role now, which modules each role can really open, and the latest role and access changes. It re-checks every
 * 30 seconds and whenever the tab is shown again.
 */
export function RolesPermissionsModule() {
  const q = useQuery({
    queryKey: ["roles-permissions"],
    queryFn: () => apiFetch("/api/v1/roles-permissions", RolesOverview),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });
  const [selected, setSelected] = useState<Role>("institution");
  const [search, setSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);

  const data = q.data;
  const role = data?.roles.find((r) => r.id === selected) ?? data?.roles[0];
  const sets = useMemo(() => new Map((data?.roles ?? []).map((r) => [r.id, new Set(r.permissions)])), [data]);
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (data?.permissions ?? []).filter((p) => (!s || p.label.toLowerCase().includes(s) || p.key.includes(s)) && (!onlySelected || !role || sets.get(role.id)?.has(p.key)));
  }, [data, search, onlySelected, role, sets]);

  if (q.isLoading) return <TemplateSkeleton />;
  if (!data || !role) return <EmptyState title="Roles unavailable" body={q.error instanceof ApiError ? q.error.message : undefined} />;

  const busy = q.isFetching;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3" aria-live="polite">
        <span>
          {data.scopeLabel} · live · updated {new Date(q.dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <Button variant="secondary" onClick={() => void q.refetch()} disabled={busy}>
          <RefreshCw className={cn("size-3.5", busy && "animate-spin")} aria-hidden /> Refresh
        </Button>
      </div>

      {data.flags.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.flags.map((f, i) => (
            <Notice key={`${f.title}-${i}`} tone={f.tone === "amber" || f.tone === "rose" ? "amber" : f.tone === "teal" ? "teal" : "sky"}>
              <b className="text-ink">{f.title}.</b> {f.body}
            </Notice>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.roles.map((r) => {
          const on = r.id === role.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r.id)}
              aria-pressed={on}
              className={cn("card-hover rounded-2xl border bg-surface p-5 text-left transition-colors", on ? "border-brand ring-2 ring-brand/30" : "border-line")}
            >
              <div className="flex items-center gap-3">
                <IconChip tone={TONES[r.id]}>
                  <Fi name={ICONS[r.id]} />
                </IconChip>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.label}</p>
                  <p className="text-xs text-ink-3">{r.permissions.length} permissions</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-2">{r.description}</p>
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                <span>
                  <b className="tabular-nums text-ink">{r.users.total}</b> user{r.users.total === 1 ? "" : "s"}
                  {r.users.invited ? ` · ${r.users.invited} invited` : ""}
                </span>
                <span>
                  <b className="tabular-nums text-ink">{r.modules.open}</b> of {r.modules.granted} modules open
                </span>
              </p>
            </button>
          );
        })}
      </div>

      <RoleDetail role={role} canManageUsers={data.canManageUsers} />

      <Card className="overflow-hidden">
        <CardHeader
          title="Permission matrix"
          subtitle="Enforced by the API on every request; the interface hides what you can't use."
          action={
            data.canManageUsers ? (
              <LinkButton href="users" size="sm" variant="secondary">
                <Fi name="user-lock" /> Manage users
              </LinkButton>
            ) : undefined
          }
        />
        <CardBody className="p-0 pt-4">
          <div className="flex flex-wrap items-center gap-3 px-5 pb-4">
            <label htmlFor="rp-search" className="sr-only">
              Search permissions
            </label>
            <input id="rp-search" className={`${inputClass} max-w-xs`} placeholder="Search permissions" maxLength={60} value={search} onChange={(e) => setSearch(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
              Only what {role.label} can do
            </label>
            <span className="text-xs text-ink-3">
              {visible.length} of {data.permissions.length} permissions
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-y border-line bg-surface-2/60 text-[11px] uppercase tracking-wider text-ink-3">
                  <th scope="col" className="px-5 py-3 text-left font-semibold">
                    Permission
                  </th>
                  {data.roles.map((r) => (
                    <th key={r.id} scope="col" className={cn("px-2 py-3 text-center font-semibold", r.id === role.id && "bg-brand-soft/50 text-brand")}>
                      {SHORT[r.id]}
                      <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-ink-3">{r.users.total} user{r.users.total === 1 ? "" : "s"}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              {data.groups.map((g) => {
                const rows = visible.filter((p) => p.group === g);
                if (!rows.length) return null;
                return (
                  <tbody key={g}>
                    <tr>
                      <th colSpan={data.roles.length + 1} scope="colgroup" className="bg-brand-soft/50 px-5 py-2 text-left text-xs font-semibold text-brand">
                        {g}
                      </th>
                    </tr>
                    {rows.map((p) => (
                      <tr key={p.key} className="border-b border-line last:border-0 hover:bg-surface-2/40">
                        <th scope="row" className="px-5 py-2.5 text-left font-normal">
                          <span className="text-ink">{p.label}</span>
                          <span className="ml-2 font-mono text-[11px] text-ink-3">{p.key}</span>
                        </th>
                        {data.roles.map((r) => {
                          const has = sets.get(r.id)?.has(p.key) ?? false;
                          return (
                            <td key={r.id} className={cn("px-2 py-2.5 text-center", r.id === role.id && "bg-brand-soft/30")}>
                              <span
                                className={cn("inline-flex size-7 items-center justify-center rounded-lg text-xs", has ? "bg-teal-soft text-teal" : "text-line")}
                                aria-label={has ? `${r.label}: allowed` : `${r.label}: not allowed`}
                              >
                                <Fi name={has ? "check" : "minus-small"} />
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
            {visible.length === 0 ? <p className="px-5 py-8 text-center text-sm text-ink-3">No permission matches your search.</p> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recent role and access changes" subtitle="From the audit log" />
        <CardBody>
          {data.recent.length === 0 ? (
            <p className="text-sm text-ink-3">No role or access changes recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recent.map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{a.action}</span>
                    <span className="text-ink-3"> · {a.target}</span>
                  </span>
                  <span className="text-xs text-ink-3">
                    {a.actor} · {when(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Notice tone="teal">
        Role changes take effect on the user&apos;s next request and are written to the audit log. Only Platform Admins can grant the Platform Admin role — the API rejects any other attempt.
      </Notice>
    </div>
  );
}

function RoleDetail({ role, canManageUsers }: { role: RoleRow; canManageUsers: boolean }) {
  const { users, modules } = role;
  return (
    <Card>
      <CardHeader
        title={role.label}
        subtitle={role.description}
        action={
          canManageUsers ? (
            <LinkButton href="users" size="sm" variant="secondary">
              <Fi name="user-lock" /> Users
            </LinkButton>
          ) : undefined
        }
      />
      <CardBody className="grid gap-6 lg:grid-cols-3">
        <section aria-label="Accounts">
          <h3 className="text-sm font-semibold text-ink">Accounts</h3>
          <p className="mt-1 text-xs text-ink-3">
            {users.active} active · {users.invited} invited · {users.suspended} suspended{users.mfaOff ? ` · ${users.mfaOff} without MFA` : ""}
          </p>
          {role.members.length ? (
            <ul className="mt-3 space-y-2">
              {role.members.map((m, idx) => (
                <li key={`${m.name}-${m.department}-${idx}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{m.name}</span>
                    {m.department ? <span className="block truncate text-xs text-ink-3">{m.department}</span> : null}
                  </span>
                  <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>{m.status}</Badge>
                </li>
              ))}
              {users.total > role.members.length ? <li className="text-xs text-ink-3">and {users.total - role.members.length} more</li> : null}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-3">No accounts hold this role{role.id === "student" ? " here. Students sign in from their own records" : ""}.</p>
          )}
        </section>

        <section aria-label="Modules">
          <h3 className="text-sm font-semibold text-ink">
            Modules open: {modules.open} of {modules.granted}
          </h3>
          <ul className="mt-3 space-y-2.5">
            {modules.byGroup.map((g) => (
              <li key={g.group}>
                <div className="flex items-center justify-between text-xs text-ink-2">
                  <span>{g.group}</span>
                  <span className="tabular-nums">
                    {g.open}/{g.total}
                  </span>
                </div>
                <Progress value={g.total ? (g.open / g.total) * 100 : 0} tone={g.open === g.total ? "teal" : g.open === 0 ? "rose" : "amber"} className="mt-1" label={`${g.group} modules open`} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Closed modules">
          <h3 className="text-sm font-semibold text-ink">Granted but closed</h3>
          {modules.closed.length ? (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {modules.closed.map((m) => (
                <li key={m.slug} className="text-sm">
                  <span className="block text-ink">{m.title}</span>
                  <span className="block text-xs text-ink-3">
                    {m.group} · {REASON[m.reason]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-3">Every module this role is granted is open.</p>
          )}
        </section>
      </CardBody>
    </Card>
  );
}
