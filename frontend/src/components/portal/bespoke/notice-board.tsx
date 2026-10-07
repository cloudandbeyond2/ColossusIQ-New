"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { Segmented, Tabs } from "@/components/ui/tabs";
import { ApiError, apiFetch } from "@/lib/api/client";
import { AUDIENCE_LABEL, NOTICE_CATEGORIES, NoticeBoard, type NoticeBody, type NoticeView } from "@/lib/api/notice-schemas";
import { cn } from "@/lib/utils";

const KEY = ["notice-board"] as const;
const Done = z.object({ ok: z.boolean() });
type Tab = "inbox" | "compose" | "sent";
type Filter = "all" | "unread" | "important" | "ack";

const PRIORITY_STYLE = { Urgent: { bar: "bg-rose", tone: "rose" }, Important: { bar: "bg-amber", tone: "amber" }, Normal: { bar: "bg-brand/40", tone: "neutral" } } as const;
const CATEGORY_ICON: Record<string, string> = { Academic: "book-alt", Examination: "edit", Event: "calendar", Placement: "briefcase", Holiday: "umbrella-beach", Fees: "money", "Hostel & Transport": "bus-alt", General: "megaphone" };
const blank = (): NoticeBody => ({ title: "", body: "", category: "Academic", priority: "Normal", audience: "students", department: "", year: 0, pinned: false, requiresAck: false, linkUrl: "", expiresOn: null });
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ROLE_LABEL: Record<string, string> = { faculty: "Faculty", hod: "HOD", placement: "Placement Office", incubation: "Incubation", institution: "Principal", admin: "University" };

/** Notice Board: important announcements for students and staff, with read and acknowledgement tracking. */
export function NoticeBoardModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/notice-board", NoticeBoard), refetchInterval: 60_000 });
  const [tab, setTab] = useState<Tab>("inbox");
  if (q.isPending) return <Skeleton className="h-[520px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const sent = d.notices.filter((n) => n.mine);
  const tabs: Array<{ id: Tab; label: string; count?: number; icon: React.ReactNode }> = [{ id: "inbox", label: "Notices", count: d.unread, icon: <Fi name="inbox" /> }];
  if (d.compose) tabs.push({ id: "compose", label: "New notice", icon: <Fi name="megaphone" /> }, { id: "sent", label: "Sent by me", count: sent.length || undefined, icon: <Fi name="paper-plane" /> });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs label="Notice board" tabs={tabs} value={tab} onChange={setTab} />
        {d.pendingAck ? (
          <button type="button" onClick={() => setTab("inbox")} className="inline-flex items-center gap-2 rounded-xl bg-rose-soft px-3 py-2 text-sm font-medium text-rose">
            <Fi name="exclamation" /> {d.pendingAck} notice{d.pendingAck === 1 ? "" : "s"} need your acknowledgement
          </button>
        ) : null}
      </div>
      {tab === "inbox" ? <Inbox notices={d.notices} /> : null}
      {tab === "compose" && d.compose ? <Composer compose={d.compose} onDone={() => setTab("sent")} /> : null}
      {tab === "sent" ? <Sent notices={sent} /> : null}
    </div>
  );
}

function useNoticeActions() {
  const qc = useQueryClient();
  const read = useMutation({
    mutationFn: ({ id, acknowledge }: { id: string; acknowledge: boolean }) => apiFetch(`/api/v1/notice-board/${id}/read`, Done, { method: "POST", body: { acknowledge } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/notice-board/${id}`, NoticeBoard, { method: "DELETE" }),
    onSuccess: (b) => qc.setQueryData(KEY, b),
  });
  return { read, remove };
}

function Inbox({ notices }: { notices: NoticeView[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const list = notices.filter(
    (n) =>
      (filter === "all" || (filter === "unread" && !n.read) || (filter === "important" && n.priority !== "Normal") || (filter === "ack" && n.requiresAck && !n.acknowledged && !n.mine)) &&
      (!category || n.category === category) &&
      (!needle || `${n.title} ${n.body}`.toLowerCase().includes(needle)),
  );
  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card className="h-fit p-3 lg:sticky lg:top-4">
        <label className="relative block">
          <span className="sr-only">Search notices</span>
          <Fi name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className={cn(inputClass, "pl-9")} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <nav className="mt-3 space-y-0.5 text-sm" aria-label="Filter notices">
          {(
            [
              ["all", "All notices", notices.length],
              ["unread", "Unread", notices.filter((n) => !n.read).length],
              ["important", "Important & urgent", notices.filter((n) => n.priority !== "Normal").length],
              ["ack", "To acknowledge", notices.filter((n) => n.requiresAck && !n.acknowledged && !n.mine).length],
            ] as Array<[Filter, string, number]>
          ).map(([id, label, count]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left", filter === id ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-surface-2")}>
              {label}
              <span className="text-xs text-ink-3">{count}</span>
            </button>
          ))}
        </nav>
        <p className="mb-1 mt-4 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Category</p>
        <div className="flex flex-wrap gap-1 px-1">
          {["", ...NOTICE_CATEGORIES].map((c) => (
            <button key={c || "all"} type="button" onClick={() => setCategory(c)} className={cn("rounded-full border px-2.5 py-1 text-xs", category === c ? "border-brand bg-brand text-white" : "border-line text-ink-2 hover:border-brand/40")}>
              {c || "All"}
            </button>
          ))}
        </div>
      </Card>
      <div className="space-y-3">
        {list.length ? list.map((n) => <NoticeCard key={n.id} n={n} />) : <EmptyState title={notices.length ? "Nothing matches" : "No notices yet"} body={notices.length ? "Try another filter." : "Announcements from your college and the university will appear here."} />}
      </div>
    </div>
  );
}

function NoticeCard({ n, preview = false }: { n: NoticeView; preview?: boolean }) {
  const { read, remove } = useNoticeActions();
  const [open, setOpen] = useState(n.priority !== "Normal" || n.pinned);
  const style = PRIORITY_STYLE[n.priority];
  const audience = [AUDIENCE_LABEL[n.audience], n.department, n.year ? `Year ${n.year}` : ""].filter(Boolean).join(" · ");
  const long = n.body.length > 280;
  const toggle = () => {
    setOpen((o) => !o);
    if (!preview && !n.read) read.mutate({ id: n.id, acknowledge: false });
  };
  return (
    <Card className={cn("relative overflow-hidden", !n.read && !preview && "ring-1 ring-brand/30", n.expired && "opacity-70")}>
      <span className={cn("absolute inset-y-0 left-0 w-1", style.bar)} aria-hidden />
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl", n.priority === "Urgent" ? "bg-rose-soft text-rose" : n.priority === "Important" ? "bg-amber-soft text-amber" : "bg-brand-soft text-brand")}>
              <Fi name={CATEGORY_ICON[n.category] ?? "megaphone"} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {n.pinned ? <Fi name="thumbtack" className="text-xs text-gold" /> : null}
                {!n.read && !preview ? <span className="size-2 rounded-full bg-brand" aria-label="Unread" /> : null}
                <h3 className="font-semibold text-ink">{n.title || "Notice title"}</h3>
              </div>
              <p className="mt-0.5 text-xs text-ink-3">
                {n.university ? "University" : (ROLE_LABEL[n.authorRole] ?? n.authorRole)} · {n.authorName} · {preview ? "now" : when(n.createdAt)} · {audience}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {n.university ? <Badge tone="gold">University</Badge> : null}
            {n.priority !== "Normal" ? <Badge tone={style.tone}>{n.priority}</Badge> : null}
            <Badge tone="neutral">{n.category}</Badge>
            {n.expired ? <Badge tone="neutral">Expired</Badge> : null}
          </div>
        </div>
        <div className={cn("mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-2", !open && long && "line-clamp-3")}>{n.body || "Your notice text appears here."}</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {long ? (
              <button type="button" onClick={toggle} className="font-medium text-brand hover:underline">
                {open ? "Show less" : "Read more"}
              </button>
            ) : !n.read && !preview ? (
              <button type="button" onClick={() => read.mutate({ id: n.id, acknowledge: false })} className="font-medium text-brand hover:underline">
                Mark as read
              </button>
            ) : null}
            {n.linkUrl ? (
              <a href={n.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                <Fi name="link-alt" /> Open link
              </a>
            ) : null}
            {n.expiresOn ? <span className="text-ink-3">Valid till {new Date(`${n.expiresOn}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span> : null}
            {n.stats ? (
              <span className="inline-flex items-center gap-1 text-ink-3">
                <Fi name="eye" /> Read by {n.stats.reads}
                {n.requiresAck ? ` · ${n.stats.acknowledged} acknowledged` : ""}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {n.requiresAck && !n.mine && !preview ? (
              n.acknowledged ? (
                <Badge tone="teal">
                  <Fi name="check" /> Acknowledged
                </Badge>
              ) : (
                <Button size="sm" onClick={() => read.mutate({ id: n.id, acknowledge: true })} disabled={read.isPending}>
                  {read.isPending ? <Spinner /> : <Fi name="check" />} I have read this
                </Button>
              )
            ) : null}
            {n.canDelete && !preview ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Remove this notice for everyone?")) remove.mutate(n.id);
                }}
                disabled={remove.isPending}
                aria-label="Remove notice"
              >
                <Fi name="trash" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Composer({ compose, onDone }: { compose: NonNullable<NoticeBoard["compose"]>; onDone: () => void }) {
  const qc = useQueryClient();
  const [b, setB] = useState<NoticeBody>(() => ({ ...blank(), audience: compose.audiences.includes("students") ? "students" : compose.audiences[0]! }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const set = <K extends keyof NoticeBody>(k: K, v: NoticeBody[K]) => setB((x) => ({ ...x, [k]: v }));
  const post = useMutation({
    mutationFn: () => apiFetch("/api/v1/notice-board", NoticeBoard, { method: "POST", body: b }),
    onSuccess: (r) => {
      qc.setQueryData(KEY, r);
      setB(blank());
      setErrors({});
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fields);
      setMessage(e instanceof ApiError ? e.message : "Could not post the notice.");
    },
  });
  const preview = useMemo<NoticeView>(() => ({ ...b, id: "preview", authorName: "You", authorRole: "", createdAt: new Date().toISOString(), university: compose.reach !== "This college", read: true, acknowledged: false, mine: true, canDelete: false, expired: false, stats: null }), [b, compose.reach]);
  const students = b.audience !== "staff";
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <Card>
        <CardHeader title="New notice" subtitle={`Goes to: ${compose.reach}`} />
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setMessage(null);
              post.mutate();
            }}
          >
            <Field label="Title" htmlFor="nb-title" error={errors.title}>
              <input id="nb-title" className={inputClass} maxLength={140} value={b.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Internal assessment II timetable" aria-invalid={!!errors.title} />
            </Field>
            <Field label="Notice" htmlFor="nb-body" error={errors.body} hint={`${b.body.length}/3000 · plain text, line breaks are kept`}>
              <textarea id="nb-body" className={cn(inputClass, "min-h-40")} maxLength={3000} value={b.body} onChange={(e) => set("body", e.target.value)} placeholder="What do students need to know, by when, and what should they do?" aria-invalid={!!errors.body} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="nb-cat">
                <select id="nb-cat" className={inputClass} value={b.category} onChange={(e) => set("category", e.target.value as NoticeBody["category"])}>
                  {NOTICE_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">Priority</p>
                <Segmented
                  label="Priority"
                  value={b.priority}
                  onChange={(v) => set("priority", v)}
                  options={[
                    { id: "Normal", label: "Normal" },
                    { id: "Important", label: "Important", tone: "text-amber" },
                    { id: "Urgent", label: "Urgent", tone: "text-rose" },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink">Who should see it</p>
              <Segmented label="Audience" value={b.audience} onChange={(v) => setB((x) => ({ ...x, audience: v, ...(v === "staff" ? { department: "", year: 0 } : {}) }))} options={compose.audiences.map((a) => ({ id: a, label: { everyone: "Everyone", students: "Students", staff: "Staff" }[a] }))} />
              {errors.audience ? <p className="text-xs text-rose">{errors.audience}</p> : null}
            </div>
            {students ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department" htmlFor="nb-dept" error={errors.department} hint={compose.departments.length ? undefined : "Applies to every department"}>
                  <select id="nb-dept" className={inputClass} value={b.department} onChange={(e) => set("department", e.target.value)} disabled={!compose.departments.length}>
                    <option value="">Every department</option>
                    {compose.departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Year of study" htmlFor="nb-year">
                  <select id="nb-year" className={inputClass} value={b.year} onChange={(e) => set("year", Number(e.target.value))}>
                    <option value={0}>Every year</option>
                    {[1, 2, 3, 4, 5].map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valid till (optional)" htmlFor="nb-exp" error={errors.expiresOn} hint="Hidden from readers after this date">
                <input id="nb-exp" type="date" className={inputClass} value={b.expiresOn ?? ""} onChange={(e) => set("expiresOn", e.target.value || null)} />
              </Field>
              <Field label="Link (optional)" htmlFor="nb-link" error={errors.linkUrl} hint="An https:// link, e.g. the circular PDF">
                <input id="nb-link" className={inputClass} value={b.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-ink-2">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={b.requiresAck} onChange={(e) => set("requiresAck", e.target.checked)} className="size-4 accent-brand" /> Ask readers to acknowledge
              </label>
              {compose.canPin ? (
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={b.pinned} onChange={(e) => set("pinned", e.target.checked)} className="size-4 accent-brand" /> Pin to the top
                </label>
              ) : null}
            </div>
            {message ? (
              <p role="alert" className="rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">
                {message}
              </p>
            ) : null}
            <Button type="submit" className="w-full sm:w-auto" disabled={post.isPending}>
              {post.isPending ? <Spinner /> : <Fi name="paper-plane" />} Post notice
            </Button>
          </form>
        </CardBody>
      </Card>
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink-3">Preview: how readers will see it</p>
        <NoticeCard n={preview} preview />
        <p className="text-xs text-ink-3">Unread notices also appear in each reader&apos;s notification bell. Urgent notices are shown first.</p>
      </div>
    </div>
  );
}

function Sent({ notices }: { notices: NoticeView[] }) {
  if (!notices.length) return <EmptyState title="You haven't posted a notice yet" body="Notices you post appear here with how many people have read and acknowledged them." />;
  return (
    <div className="space-y-3">
      {notices.map((n) => (
        <NoticeCard key={n.id} n={n} />
      ))}
    </div>
  );
}
