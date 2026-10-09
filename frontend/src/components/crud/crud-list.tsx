"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import type { ResourceDef, ResourceRecord } from "@/config/resources";
import type { ModuleDef } from "@/config/modules";
import type { Role } from "@/lib/auth/roles";
import { apiFetch, ApiError } from "@/lib/api/client";
import { CollegeOptions, RecordList } from "@/lib/api/schemas";
import { cleanText, mask } from "@/lib/security/sanitize";
import { ModuleHeader } from "@/components/modules/module-header";
import { Fi } from "@/components/ui/icon";
import { Badge, Button, Card, EmptyState, inputClass, LinkButton, Progress, Skeleton, toneForStatus } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "./confirm-delete";
import { formatDate, ValueView } from "./fields";
import { clearFlash, setFlash, useFlash } from "./flash";
import { QuestionAiDialog } from "./question-ai-dialog";

const PAGE_SIZE = 10;

export function CrudList({
  mod,
  role,
  resource,
  canManage,
  allColleges = false,
}: {
  mod: ModuleDef;
  role: Role;
  resource: ResourceDef;
  canManage: boolean;
  /** University Super Admin viewing every college: show a College column and filter. */
  allColleges?: boolean;
}) {
  const showCollege = allColleges && Boolean(resource.scoped);
  const [college, setCollege] = useState("");
  const collegeOptions = useQuery({
    queryKey: ["college-options"],
    queryFn: () => apiFetch("/api/v1/colleges/options", CollegeOptions),
    enabled: showCollege,
  });
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  // Dropdown filters such as "Role" (resource.filterFields), keyed by field name; "" = all.
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<ResourceRecord | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const flash = useFlash();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(cleanText(q, 80));
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (debounced) params.set("q", debounced);
  if (status) params.set("status", status);
  if (showCollege && college) params.set("college", college);
  const filterFields = (resource.filterFields ?? []).flatMap((name) => {
    const f = resource.fields.find((x) => x.name === name);
    return f?.options?.length ? [{ name, label: f.label.replace(/ \(.*\)$/, ""), options: f.options }] : [];
  });
  for (const f of filterFields) if (filters[f.name]) params.set(`filter.${f.name}`, filters[f.name]!);
  const filterKey = filterFields.map((f) => filters[f.name] ?? "").join("|");
  const filtering = Boolean(filterKey.replace(/\|/g, ""));
  const listKey = ["records", resource.key, debounced, status, college, filterKey, page] as const;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: listKey,
    queryFn: () => apiFetch(`/api/v1/records/${resource.key}?${params.toString()}`, RecordList),
    placeholderData: keepPreviousData,
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/records/${resource.key}/${encodeURIComponent(id)}`, z.object({ ok: z.literal(true) }), { method: "DELETE" }),
    onSuccess: (_d, id) => {
      setToDelete(null);
      setFlash(`${resource.singular} ${id} was deleted.`);
      void qc.invalidateQueries({ queryKey: ["records", resource.key] });
    },
  });

  const columns = useMemo(() => resource.fields.filter((f) => f.column), [resource]);
  const stats = resource.stats ?? [];
  const statusOptions = resource.fields.find((f) => f.name === resource.statusField)?.options ?? [];
  const totalAll = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const base = `/${role}/${mod.slug}`;

  return (
    <div>
      <ModuleHeader
        mod={mod}
        role={role}
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {resource.key === "questions" ? (
                <Button variant="secondary" size="lg" onClick={() => setAiOpen(true)}>
                  <Fi name="sparkles" /> Generate with AI
                </Button>
              ) : null}
              <LinkButton href={`${base}/new`} variant="gold" size="lg">
                <Fi name="plus" /> Add {resource.singular.toLowerCase()}
              </LinkButton>
            </div>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm text-white/85">
              <Fi name="lock" /> View only
            </span>
          )
        }
      />

      {flash ? (
        <div className="animate-fade-up mb-4 flex items-center justify-between gap-3 rounded-2xl border border-teal/30 bg-teal-soft px-4 py-3 text-sm text-ink" role="status">
          <span className="flex items-center gap-2">
            <Fi name="check-circle" className="text-teal" /> {flash}
          </span>
          <button onClick={clearFlash} aria-label="Dismiss" className="rounded-lg p-1 hover:bg-surface">
            <Fi name="cross-small" />
          </button>
        </div>
      ) : null}

      {/* Status summary chips double as filters */}
      {resource.statusField && data ? (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter by status">
          <StatusChip label="All" count={totalAll} active={status === ""} onClick={() => { setStatus(""); setPage(1); }} />
          {statusOptions.map((s) => (
            <StatusChip key={s} label={s} count={data.counts[s] ?? 0} active={status === s} onClick={() => { setStatus(s); setPage(1); }} />
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Fi name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3" />
            <label htmlFor="crud-search" className="sr-only">
              Search {resource.title}
            </label>
            <input id="crud-search" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} placeholder={`Search by name, ID or ${columns.find((c, i) => i > 0 && c.column !== "masked")?.label.replace(/ \(.*\)$/, "").toLowerCase() ?? "details"}…`} className={cn(inputClass, "pl-10")} />
          </div>
          {filterFields.map((f) => (
            <div key={f.name} className="sm:w-56">
              <label htmlFor={`crud-filter-${f.name}`} className="sr-only">
                Filter by {f.label.toLowerCase()}
              </label>
              <select
                id={`crud-filter-${f.name}`}
                value={filters[f.name] ?? ""}
                onChange={(e) => {
                  setFilters((cur) => ({ ...cur, [f.name]: e.target.value }));
                  setPage(1);
                }}
                className={inputClass}
              >
                <option value="">All {f.label.toLowerCase()}s</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {filtering ? (
            <button type="button" onClick={() => { setFilters({}); setPage(1); }} className="shrink-0 text-sm font-medium text-brand hover:underline">
              Clear filters
            </button>
          ) : null}
          {showCollege ? (
            <div className="relative sm:w-64">
              <Fi name="school" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3" />
              <label htmlFor="crud-college" className="sr-only">
                Filter by college
              </label>
              <select
                id="crud-college"
                value={college}
                onChange={(e) => {
                  setCollege(e.target.value);
                  setPage(1);
                }}
                className={cn(inputClass, "pl-10")}
              >
                <option value="">All colleges</option>
                {collegeOptions.data?.colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <p className="text-sm text-ink-3" aria-live="polite">
            {isFetching ? "Loading…" : data ? `${data.total} ${data.total === 1 ? "record" : "records"}` : ""}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6">
            <EmptyState title="Could not load records" body={error instanceof ApiError ? error.message : undefined} />
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={debounced || status || filtering ? "No matching records" : `No ${resource.title.toLowerCase()} yet`}
              body={debounced || status || filtering ? "Try a different search, status or filter." : undefined}
              action={canManage && !debounced && !status && !filtering ? <LinkButton href={`${base}/new`}><Fi name="plus" /> Add the first one</LinkButton> : undefined}
            />
          </div>
        ) : data ? (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/60 text-left text-[11px] uppercase tracking-wider text-ink-3">
                    <th scope="col" className="px-4 py-3 font-semibold">ID</th>
                    {showCollege ? (
                      <th scope="col" className="px-4 py-3 font-semibold">
                        College
                      </th>
                    ) : null}
                    {columns.map((c) => (
                      <th key={c.name} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                        {c.label.replace(/ \(.*\)$/, "")}
                      </th>
                    ))}
                    {stats.map((st) => (
                      <th key={st.name} scope="col" className={cn("whitespace-nowrap px-4 py-3 font-semibold", st.kind === "number" && "text-right")}>
                        {st.label}
                      </th>
                    ))}
                    <th scope="col" className="hidden px-4 py-3 font-semibold 2xl:table-cell">Updated</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id} className="group border-b border-line last:border-0 hover:bg-brand-soft/40">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-3">{r.id}</td>
                      {showCollege ? (
                        <td className="max-w-[180px] px-4 py-3">
                          <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-violet-soft px-2 py-1 text-xs font-medium text-violet">
                            <Fi name="school" className="shrink-0 text-[10px]" />
                            <span className="truncate">{String(r.collegeName ?? "—")}</span>
                          </span>
                        </td>
                      ) : null}
                      {columns.map((c, j) => (
                        <td key={c.name} className={cn("max-w-[220px] px-4 py-3 align-middle", j === 0 && "font-medium text-ink")}>
                          {j === 0 ? (
                            <Link href={`${base}/${encodeURIComponent(r.id)}`} className="hover:text-brand hover:underline">
                              <ValueView field={c} value={r[c.name]} />
                            </Link>
                          ) : c.column === "masked" ? (
                            // Contact details stay masked in lists (shoulder-surfing, screenshots); full value only on the detail page.
                            <span className="font-mono text-xs text-ink-2">{r[c.name] ? (String(r[c.name]).includes("•") ? String(r[c.name]) : mask(String(r[c.name]))) : "—"}</span>
                          ) : (
                            <ValueView field={c} value={r[c.name]} />
                          )}
                        </td>
                      ))}
                      {stats.map((st) => (
                        <td key={st.name} className={cn("px-4 py-3 align-middle", st.kind === "number" && "text-right tabular-nums")}>
                          <StatView kind={st.kind} label={st.label} value={r[st.name]} />
                        </td>
                      ))}
                      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-ink-3 2xl:table-cell">{formatDate(r.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <RowActions base={base} record={r} canManage={canManage} onDelete={() => { del.reset(); setToDelete(r); }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {data.items.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`${base}/${encodeURIComponent(r.id)}`} className="min-w-0">
                      <p className="truncate font-medium text-ink">{String(r[resource.titleField] ?? r.id)}</p>
                      <p className="font-mono text-xs text-ink-3">{r.id}</p>
                    </Link>
                    {resource.statusField ? <Badge tone={toneForStatus(String(r[resource.statusField]))}>{String(r[resource.statusField])}</Badge> : null}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-2">{[showCollege ? r.collegeName : null, ...resource.subtitleFields.map((f) => r[f])].filter(Boolean).join(" · ")}</p>
                  <div className="mt-3">
                    <RowActions base={base} record={r} canManage={canManage} onDelete={() => { del.reset(); setToDelete(r); }} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
              <span className="text-ink-3">
                Page {data.page} of {pages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                  <Fi name="angle-left" /> Prev
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                  Next <Fi name="angle-right" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>

      {aiOpen ? <QuestionAiDialog onClose={() => setAiOpen(false)} /> : null}
      <ConfirmDelete
        open={Boolean(toDelete)}
        recordId={toDelete?.id ?? ""}
        recordName={String(toDelete?.[resource.titleField] ?? "")}
        singular={resource.singular}
        warning={resource.deleteWarning}
        strong={resource.strongDeleteConfirm}
        busy={del.isPending}
        error={del.error instanceof ApiError ? del.error.message : del.error ? "Delete failed." : null}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
      />
    </div>
  );
}

/** A computed figure (read-only): a number, or a percentage bar. */
function StatView({ kind, label, value }: { kind: "number" | "progress"; label: string; value: unknown }) {
  const n = typeof value === "number" ? value : null;
  if (n === null) return <span className="text-ink-3">—</span>;
  if (kind === "number") return <span className="text-ink-2">{n.toLocaleString("en-IN")}</span>;
  return (
    <span className="flex min-w-[140px] items-center gap-2">
      <Progress value={n} tone={n >= 70 ? "teal" : n >= 55 ? "brand" : "gold"} className="flex-1" label={label} />
      <span className="w-9 text-right text-xs tabular-nums text-ink-2">{n}%</span>
    </span>
  );
}

function StatusChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all",
        active ? "bg-brand-gradient border-transparent text-white shadow-md shadow-brand/20" : "border-line bg-surface text-ink-2 hover:border-brand/40",
      )}
    >
      {label}
      <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-white/20" : "bg-surface-2 text-ink-3")}>{count}</span>
    </button>
  );
}

function RowActions({ base, record, canManage, onDelete }: { base: string; record: ResourceRecord; canManage: boolean; onDelete: () => void }) {
  const href = `${base}/${encodeURIComponent(record.id)}`;
  const btn = "flex size-8 items-center justify-center rounded-lg text-ink-3 transition-colors";
  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={href} className={cn(btn, "hover:bg-sky-soft hover:text-sky")} aria-label={`View ${record.id}`} title="View">
        <Fi name="eye" />
      </Link>
      {canManage ? (
        <>
          <Link href={`${href}/edit`} className={cn(btn, "hover:bg-brand-soft hover:text-brand")} aria-label={`Edit ${record.id}`} title="Edit">
            <Fi name="pencil" />
          </Link>
          <button onClick={onDelete} className={cn(btn, "hover:bg-rose-soft hover:text-rose")} aria-label={`Delete ${record.id}`} title="Delete">
            <Fi name="trash" />
          </button>
        </>
      ) : null}
    </div>
  );
}
