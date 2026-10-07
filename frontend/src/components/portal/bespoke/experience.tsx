"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Check, Clock, ExternalLink, Filter, Pencil, Plus, RotateCcw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, EmptyState, Field, Skeleton, Spinner, inputClass } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { EXPERIENCE_CATEGORIES, ExperienceItem, ExperienceOverview, type ExperienceStatus } from "@/lib/api/experience-schemas";
import { cn } from "@/lib/utils";
import { Modal, problemOf } from "./assignments-shared";

const KEY = ["experience"] as const;
const ExperienceOverviewOk = z.object({ ok: z.boolean() });
const TONE: Record<ExperienceStatus, "teal" | "amber" | "rose"> = { Verified: "teal", Pending: "amber", Rejected: "rose" };
const STATUS_LABEL: Record<ExperienceStatus, string> = { Verified: "Verified", Pending: "Waiting for verification", Rejected: "Needs changes" };
const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function ExperienceModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/experience", ExperienceOverview), staleTime: 0, refetchOnMount: "always" });
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return q.data.canReview ? <Review data={q.data} /> : <Mine data={q.data} />;
}

function Tiles({ s, labels }: { s: ExperienceOverview["summary"]; labels: [string, string, string, string] }) {
  const v = [s.total, s.verified, s.pending, s.rejected];
  const meta = [
    { label: labels[0], count: v[0], icon: Award, tone: "text-brand", bg: "bg-brand/10 border-brand/20" },
    { label: labels[1], count: v[1], icon: ShieldCheck, tone: "text-teal", bg: "bg-teal/10 border-teal/20" },
    { label: labels[2], count: v[2], icon: Clock, tone: "text-amber", bg: "bg-amber/10 border-amber/20" },
    { label: labels[3], count: v[3], icon: RotateCcw, tone: "text-rose", bg: "bg-rose/10 border-rose/20" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {meta.map((m) => {
        const Icon = m.icon;
        return (
          <Card key={m.label} className="p-5 transition-shadow hover:shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink-3">{m.label}</p>
              <div className={cn("flex size-9 items-center justify-center rounded-xl border", m.bg)}>
                <Icon className={cn("size-4.5", m.tone)} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{m.count}</p>
          </Card>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── student ───────────────────────────── */
function Mine({ data }: { data: ExperienceOverview }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState<"All" | ExperienceStatus>("All");
  const [editing, setEditing] = useState<ExperienceItem | "new" | null>(null);
  const [removing, setRemoving] = useState<ExperienceItem | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/experience/${encodeURIComponent(id)}`, ExperienceOverviewOk, { method: "DELETE" }),
    onSuccess: () => {
      setRemoving(null);
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const shown = data.items.filter((x) => (category === "All" || x.category === category) && (status === "All" || x.status === status) && `${x.title} ${x.organisation} ${x.role}`.toLowerCase().includes(text.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <Tiles s={data.summary} labels={["Activities", "Verified", "Waiting", "Need changes"]} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input aria-label="Search activities" className={cn(inputClass, "pl-9")} placeholder="Search your activities…" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <select aria-label="Category" className={cn(inputClass, "w-auto")} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>All</option>
            {EXPERIENCE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Status" className={cn(inputClass, "w-auto")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="All">Any status</option>
            <option value="Verified">Verified</option>
            <option value="Pending">Waiting</option>
            <option value="Rejected">Needs changes</option>
          </select>
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add activity
          </Button>
        </div>
        <CardBody className="p-0">
          {!data.items.length ? (
            <div className="p-6">
              <EmptyState title="Your passport is empty" body="Add volunteering, leadership roles, competitions, conferences or club work. A faculty member verifies each one, and verified entries are what employers can trust." />
            </div>
          ) : !shown.length ? (
            <p className="p-6 text-sm text-ink-3">Nothing matches those filters.</p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((x) => (
                <li key={x.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{x.title}</p>
                      <Badge tone="neutral">{x.category}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-2">{[x.role, x.organisation].filter(Boolean).join(" · ") || "No role or organisation added"}</p>
                    <p className="text-xs text-ink-3">{x.period}</p>
                    {x.description ? <p className="mt-2 text-sm text-ink-2">{x.description}</p> : null}
                    {x.link ? (
                      <a href={x.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline">
                        Evidence <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={TONE[x.status]}>{STATUS_LABEL[x.status]}</Badge>
                      {x.status === "Verified" ? (
                        <span className="text-xs text-ink-3">
                          by {x.reviewerName} ({x.reviewerRole}){x.reviewedAt ? `, ${date(x.reviewedAt)}` : ""}
                        </span>
                      ) : null}
                    </div>
                    {x.status === "Rejected" && x.reviewNote ? (
                      <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-ink-2">
                        <span className="font-medium">{x.reviewerName} says:</span> {x.reviewNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(x)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-rose hover:bg-rose-soft" aria-label={`Delete ${x.title}`} onClick={() => setRemoving(x)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      {editing ? <ActivityDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {removing ? (
        <Modal title="Remove this activity?" onClose={() => setRemoving(null)}>
          <p className="text-sm text-ink-2">
            “{removing.title}” will be removed from your passport{removing.status === "Verified" ? ", including its verification" : ""}. This cannot be undone.
          </p>
          {remove.isError ? (
            <p role="alert" className="mt-3 text-sm text-rose">
              Could not remove it. Try again.
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(removing.id)}>
              {remove.isPending ? <Spinner /> : null} Remove
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}


function ActivityDialog({ item, onClose }: { item: ExperienceItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title: item?.title ?? "",
    category: item?.category ?? EXPERIENCE_CATEGORIES[0]!,
    organisation: item?.organisation ?? "",
    role: item?.role ?? "",
    startMonth: item?.startMonth ?? "",
    endMonth: item?.endMonth ?? "",
    ongoing: item ? item.endMonth === null : false,
    description: item?.description ?? "",
    link: item?.link ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: () =>
      apiFetch(item ? `/api/v1/experience/${encodeURIComponent(item.id)}` : "/api/v1/experience", ExperienceItem, {
        method: item ? "PUT" : "POST",
        body: { title: f.title, category: f.category, organisation: f.organisation, role: f.role, startMonth: f.startMonth, endMonth: f.ongoing ? null : f.endMonth || f.startMonth, description: f.description, link: f.link },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
  });
  const { fields, message } = problemOf(save.error, "Could not save. Try again.");
  const resets = item && item.status !== "Pending";
  return (
    <Modal title={item ? "Edit activity" : "Add an activity"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="What did you do?" htmlFor="ex-title" error={fields.title}>
          <input id="ex-title" className={inputClass} maxLength={120} required value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Blood donation camp coordinator" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="ex-cat" error={fields.category}>
            <select id="ex-cat" className={inputClass} value={f.category} onChange={(e) => set("category", e.target.value as typeof f.category)}>
              {EXPERIENCE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Your role" htmlFor="ex-role" error={fields.role}>
            <input id="ex-role" className={inputClass} maxLength={100} value={f.role} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Volunteer, Team lead" />
          </Field>
        </div>
        <Field label="Organisation or event" htmlFor="ex-org" error={fields.organisation}>
          <input id="ex-org" className={inputClass} maxLength={120} value={f.organisation} onChange={(e) => set("organisation", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Started" htmlFor="ex-start" error={fields.startMonth}>
            <input id="ex-start" type="month" required max={currentMonth()} className={inputClass} value={f.startMonth} onChange={(e) => set("startMonth", e.target.value)} />
          </Field>
          <Field label="Ended" htmlFor="ex-end" error={fields.endMonth}>
            <input id="ex-end" type="month" disabled={f.ongoing} min={f.startMonth || undefined} max={currentMonth()} className={inputClass} value={f.ongoing ? "" : f.endMonth} onChange={(e) => set("endMonth", e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" className="accent-[var(--brand)]" checked={f.ongoing} onChange={(e) => set("ongoing", e.target.checked)} /> I am still doing this
        </label>
        <Field label="What did you achieve? (optional)" htmlFor="ex-desc" error={fields.description} hint="Numbers help: people reached, funds raised, position won.">
          <textarea id="ex-desc" rows={3} maxLength={1000} className={inputClass} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Evidence link (optional)" htmlFor="ex-link" error={fields.link} hint="A certificate, event page or post the verifier can open.">
          <input id="ex-link" type="url" maxLength={500} className={inputClass} value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://" />
        </Field>
        {resets ? <p className="rounded-lg bg-amber-soft px-3 py-2 text-sm text-ink-2">Saving changes sends this activity back for verification.</p> : null}
        {message ? (
          <p role="alert" className="text-sm text-rose">
            {message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null} {item ? "Save changes" : "Add to passport"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────────── faculty / HOD ───────────────────────────── */
function Review({ data }: { data: ExperienceOverview }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"Pending" | "Verified" | "Rejected" | "All">("Pending");
  const [category, setCategory] = useState("All");
  const [text, setText] = useState("");
  const [deciding, setDeciding] = useState<{ item: ExperienceItem; decision: "Verified" | "Rejected" } | null>(null);
  const [removing, setRemoving] = useState<ExperienceItem | null>(null);

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/experience/${encodeURIComponent(id)}`, ExperienceOverviewOk, { method: "DELETE" }),
    onSuccess: () => {
      setRemoving(null);
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });

  const shown = data.items.filter((x) => {
    const matchesTab = tab === "All" || x.status === tab;
    const matchesCat = category === "All" || x.category === category;
    const matchesText = `${x.studentName} ${x.rollNo} ${x.title} ${x.organisation} ${x.role}`.toLowerCase().includes(text.trim().toLowerCase());
    return matchesTab && matchesCat && matchesText;
  });

  const tabs = [
    ["Pending", data.summary.pending, "To verify"],
    ["Verified", data.summary.verified, "Verified History"],
    ["Rejected", data.summary.rejected, "Sent back"],
    ["All", data.summary.total, "All Activities"],
  ] as const;

  return (
    <div className="space-y-6">
      <Tiles s={data.summary} labels={["Activities in college", "Verified", "Waiting for you", "Sent back"]} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Status">
            {tabs.map(([t, n, label]) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === t ? "bg-brand text-white shadow-xs" : "text-ink-3 hover:bg-surface-2 hover:text-ink"
                )}
              >
                {label} · {n}
              </button>
            ))}
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
              <input
                aria-label="Search"
                className={cn(inputClass, "pl-9 text-xs")}
                placeholder="Search student, roll number, activity, club…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="size-3.5 text-ink-3" aria-hidden="true" />
              <select
                aria-label="Filter by Category"
                className={cn(inputClass, "w-auto text-xs py-1.5")}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {EXPERIENCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <CardBody className="p-0">
          {!shown.length ? (
            <div className="p-8 text-center">
              <EmptyState
                title={tab === "Pending" ? "Nothing to verify" : tab === "Verified" ? "No verified activities yet" : "No matching activities"}
                body={
                  tab === "Pending"
                    ? "When students submit co-curricular activities, they will appear here for verification."
                    : "Try adjusting your search keywords or category filter."
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((x) => (
                <li key={x.id} className="p-5 transition-colors hover:bg-surface-2/40">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 font-bold text-brand text-xs ring-2 ring-brand/20">
                        {x.studentName ? x.studentName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : "ST"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{x.studentName}</span>
                          {x.rollNo ? <Badge tone="neutral" className="text-[11px] font-mono">{x.rollNo}</Badge> : null}
                          <span className="text-xs text-ink-3">· submitted {date(x.createdAt)}</span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-ink">{x.title}</h3>
                          <Badge tone="neutral">{x.category}</Badge>
                          <Badge tone={TONE[x.status]}>
                            {x.status === "Rejected" ? "Sent back" : x.status === "Pending" ? "To verify" : "Verified"}
                          </Badge>
                        </div>

                        <p className="mt-1 text-sm text-ink-2">
                          <span className="font-medium text-ink">{x.role}</span>
                          {x.organisation ? ` · ${x.organisation}` : ""}
                          <span className="text-ink-3"> ({x.period})</span>
                        </p>

                        {x.description ? (
                          <div className="mt-3 rounded-xl border border-line bg-surface-2/60 p-3 text-sm text-ink-2">
                            <p className="font-medium text-xs text-ink-3 uppercase tracking-wider mb-1">Key Achievement / Impact</p>
                            {x.description}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {x.link ? (
                            <a
                              href={x.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-brand shadow-xs transition hover:bg-surface-2"
                            >
                              <ExternalLink className="size-3.5" aria-hidden="true" />
                              View Evidence Certificate
                            </a>
                          ) : (
                            <span className="text-xs text-ink-3">No certificate link attached</span>
                          )}

                          {x.status !== "Pending" && x.reviewedAt ? (
                            <span className="text-xs text-ink-3">
                              {x.status === "Verified" ? "Verified" : "Sent back"} by {x.reviewerName} ({x.reviewerRole}) on {date(x.reviewedAt)}
                              {x.reviewNote ? ` — "${x.reviewNote}"` : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:self-start">
                      {x.status !== "Verified" ? (
                        <Button
                          size="sm"
                          onClick={() => setDeciding({ item: x, decision: "Verified" })}
                          className="gap-1.5 bg-teal hover:bg-teal/90 text-white border-transparent"
                        >
                          <Check className="size-4" /> Verify
                        </Button>
                      ) : null}
                      {x.status !== "Rejected" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDeciding({ item: x, decision: "Rejected" })}
                          className="gap-1.5"
                        >
                          <RotateCcw className="size-3.5 text-rose" /> Send back
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${x.title}`}
                        onClick={() => setRemoving(x)}
                        className="text-ink-3 hover:text-rose hover:bg-rose-soft"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {deciding ? <DecisionDialog {...deciding} onClose={() => setDeciding(null)} /> : null}

      {removing ? (
        <Modal title="Delete activity entry?" onClose={() => setRemoving(null)}>
          <p className="text-sm text-ink-2">
            Are you sure you want to permanently delete <strong className="text-ink">“{removing.title}”</strong> submitted by <strong className="text-ink">{removing.studentName}</strong>? This action cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate(removing.id)}
            >
              {removeMutation.isPending ? <Spinner /> : <Trash2 className="size-4" />} Delete entry
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function DecisionDialog({ item, decision, onClose }: { item: ExperienceItem; decision: "Verified" | "Rejected"; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => apiFetch(`/api/v1/experience/${encodeURIComponent(item.id)}/review`, ExperienceItem, { method: "POST", body: { decision, note } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
  });
  const { fields, message } = problemOf(save.error, "Could not save your decision. Try again.");
  return (
    <Modal title={decision === "Verified" ? "Verify this activity" : "Send back to the student"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">{item.studentName}</span>: {item.title} ({item.period})
        </p>
        <Field label={decision === "Verified" ? "Note for the student (optional)" : "What should the student fix?"} htmlFor="ex-note" error={fields.note}>
          <textarea id="ex-note" rows={3} maxLength={500} required={decision === "Rejected"} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {message ? (
          <p role="alert" className="text-sm text-rose">
            {message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={decision === "Verified" ? "primary" : "danger"} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null} {decision === "Verified" ? "Verify" : "Send back"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
