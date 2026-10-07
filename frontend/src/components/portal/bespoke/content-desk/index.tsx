"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { Segmented, Tabs } from "@/components/ui/tabs";
import { BLOOM_LEVELS, COURSE_OUTCOMES, DIFFICULTY_OPTIONS } from "@/config/resources";
import { ApiError, apiFetch } from "@/lib/api/client";
import { DeskOverview, EVENT_TYPES, KIND_LABEL, type ContentItem, type ContentKind, type CurrentAffairData, type EventData, type GenerateBody, type QuestionSetData, type Targets } from "@/lib/api/content-desk-schemas";
import { cn } from "@/lib/utils";
import { blankData, CurrentAffairEditor, EventEditor, QuestionSetEditor } from "./editors";

const KEY = ["content-desk"] as const;
type Tab = "review" | "create" | "published" | "all";
type Msg = { tone: "ok" | "error"; text: string } | null;

const KIND_ICON: Record<ContentKind, string> = { "current-affair": "newspaper", "question-set": "list-check", event: "calendar-star" };
const KIND_HINT: Record<ContentKind, string> = {
  "current-affair": "Daily news for competitive-exam preparation. Published items reach every student's Current Affairs feed and weekly quiz.",
  "question-set": "Questions with model answers for a subject. Approved questions are added to each college's Question Bank.",
  event: "Inter-college fests, workshops and university programmes. Published to each college's Campus Events.",
};
const STATUS_TONE = { Draft: "neutral", "In review": "amber", Published: "teal", Rejected: "rose", Withdrawn: "neutral" } as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** University Content Desk: AI or hand-written content, verified and published to colleges by the Super Admin. */
export function ContentDeskModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/content-desk", DeskOverview) });
  const [tab, setTab] = useState<Tab>("review");
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<Msg>(null);
  if (q.isPending) return <Skeleton className="h-[560px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const review = d.items.filter((i) => i.status === "In review" || i.status === "Draft");
  const published = d.items.filter((i) => i.status === "Published");
  const open = d.items.find((i) => i.id === openId) ?? null;
  const list = tab === "review" ? review : tab === "published" ? published : d.items;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="hourglass-end" label="Waiting for review" value={d.items.filter((i) => i.status === "In review").length} tone="amber" />
        <Stat icon="pencil" label="Drafts" value={d.items.filter((i) => i.status === "Draft").length} />
        <Stat icon="check-circle" label="Published" value={published.length} tone="teal" />
        <Stat icon="building" label="Colleges" value={d.colleges.filter((c) => c.status !== "Suspended").length} />
      </div>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={cn("rounded-xl px-4 py-2 text-sm", message.tone === "error" ? "bg-rose-soft text-rose" : "bg-teal-soft text-teal")}>
          {message.text}
        </p>
      ) : null}
      <Tabs
        label="Content desk"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setOpenId(null);
        }}
        tabs={[
          { id: "review", label: "Review queue", count: review.length, icon: <Fi name="inbox" /> },
          { id: "create", label: "Create", icon: <Fi name="magic-wand" /> },
          { id: "published", label: "Published", count: published.length, icon: <Fi name="globe" /> },
          { id: "all", label: "All items", icon: <Fi name="list" /> },
        ]}
      />
      {tab === "create" ? (
        <Create
          d={d}
          onCreated={(text) => {
            setMessage({ tone: "ok", text });
            setTab("review");
          }}
        />
      ) : open ? (
        <ItemPanel key={open.id + open.updatedAt} item={open} d={d} onClose={() => setOpenId(null)} say={setMessage} />
      ) : (
        <ItemList items={list} onOpen={setOpenId} empty={tab === "review" ? "Nothing waiting. Create content, or let AI draft some for you to verify." : "Nothing here yet."} />
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: number; tone?: "amber" | "teal" }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={cn("grid size-10 place-items-center rounded-xl text-lg", tone === "amber" ? "bg-amber-soft text-amber" : tone === "teal" ? "bg-teal-soft text-teal" : "bg-brand-soft text-brand")}>
        <Fi name={icon} />
      </span>
      <div>
        <p className="text-2xl font-semibold text-ink">{value}</p>
        <p className="text-xs text-ink-3">{label}</p>
      </div>
    </Card>
  );
}

function ItemList({ items, onOpen, empty }: { items: ContentItem[]; onOpen: (id: string) => void; empty: string }) {
  const [kind, setKind] = useState<ContentKind | "">("");
  const shown = items.filter((i) => !kind || i.kind === kind);
  return (
    <Card>
      <div className="flex flex-wrap gap-1 border-b border-line p-3">
        {(["", "current-affair", "question-set", "event"] as const).map((k) => (
          <button key={k || "all"} type="button" onClick={() => setKind(k)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", kind === k ? "border-brand bg-brand text-white" : "border-line text-ink-2 hover:border-brand/40")}>
            {k ? <Fi name={KIND_ICON[k]} /> : null}
            {k ? KIND_LABEL[k] : "Everything"}
          </button>
        ))}
      </div>
      {shown.length ? (
        <ul className="divide-y divide-line">
          {shown.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => onOpen(i.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/50">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Fi name={KIND_ICON[i.kind]} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{i.title}</span>
                  <span className="block text-xs text-ink-3">
                    {KIND_LABEL[i.kind]}
                    {i.kind === "question-set" ? ` · ${((i.data.items as unknown[]) ?? []).length} questions` : ""} · {i.createdBy} · {when(i.updatedAt)}
                    {i.status === "Published" ? ` · in ${i.reach} college${i.reach === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
                {i.source === "AI" ? (
                  <Badge tone="sky">
                    <Fi name="sparkles" /> AI draft
                  </Badge>
                ) : null}
                <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge>
                <Fi name="angle-small-right" className="text-ink-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-6">
          <EmptyState title="No items" body={empty} />
        </div>
      )}
    </Card>
  );
}

/* ── one item: edit, verify, publish ── */
function ItemPanel({ item, d, onClose, say }: { item: ContentItem; d: DeskOverview; onClose: () => void; say: (m: Msg) => void }) {
  const qc = useQueryClient();
  const [data, setData] = useState<Record<string, unknown>>(item.data);
  const [targets, setTargets] = useState<Targets>(item.targets);
  const [verified, setVerified] = useState(false);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const locked = item.status === "Published";
  const act = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: "POST" | "PUT" | "DELETE"; body?: unknown }) => apiFetch(`/api/v1/content-desk/${item.id}${path}`, DeskOverview, { method, body }),
    onSuccess: (r, v) => {
      qc.setQueryData(KEY, r);
      setErrors({});
      const text = { "/publish": "Published. It is now live in the chosen colleges.", "/withdraw": "Withdrawn from every college.", "/reject": "Rejected.", "": v.method === "DELETE" ? "Deleted." : "Saved." }[v.path] ?? "Done.";
      say({ tone: "ok", text });
      if (v.method === "DELETE" || v.path === "/publish" || v.path === "/reject") onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fields);
      say({ tone: "error", text: e instanceof ApiError ? e.message : "Something went wrong." });
    },
  });
  const busy = act.isPending;
  const save = () => act.mutate({ path: "", method: "PUT", body: { data, targets } });
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="min-w-0">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-3 hover:bg-surface-2" aria-label="Back to the list">
                <Fi name="arrow-small-left" />
              </button>
              {KIND_LABEL[item.kind]}
            </span>
          }
          subtitle={`${item.source === "AI" ? "Drafted by AI for " : "Created by "}${item.createdBy} · ${when(item.createdAt)}`}
          action={<Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>}
        />
        <CardBody>
          {item.source === "AI" && !locked ? (
            <p className="mb-4 flex items-start gap-2 rounded-xl bg-sky-soft px-3 py-2 text-sm text-ink-2">
              <Fi name="sparkles" className="mt-0.5 text-sky" /> AI drafted this. Check every fact, answer and option before publishing; edit anything that is wrong.
            </p>
          ) : null}
          {item.reviewNote ? <p className="mb-4 rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">Rejected: {item.reviewNote}</p> : null}
          {item.kind === "current-affair" ? <CurrentAffairEditor value={data as CurrentAffairData} onChange={(v) => setData(v)} errors={errors} disabled={locked} /> : null}
          {item.kind === "question-set" ? <QuestionSetEditor value={data as QuestionSetData} onChange={(v) => setData(v)} errors={errors} disabled={locked} /> : null}
          {item.kind === "event" ? <EventEditor value={data as EventData} onChange={(v) => setData(v)} errors={errors} disabled={locked} /> : null}
          {!locked ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={save} disabled={busy}>
                <Fi name="disk" /> Save changes
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Delete this item?")) act.mutate({ path: "", method: "DELETE" });
                }}
                disabled={busy}
              >
                <Fi name="trash" /> Delete
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="space-y-4 xl:sticky xl:top-4 xl:h-fit">
        <Card>
          <CardHeader title="Publish to" />
          <CardBody className="space-y-3">
            <TargetPicker value={targets} onChange={setTargets} colleges={d.colleges} disabled={locked} />
            {errors.targets ? <p className="text-xs text-rose">{errors.targets}</p> : null}
          </CardBody>
        </Card>
        {locked ? (
          <Card className="p-4">
            <p className="text-sm text-ink-2">
              Verified and published by <b className="text-ink">{item.verifiedBy}</b>
              {item.publishedAt ? ` on ${when(item.publishedAt)}` : ""}, live in {item.reach} college{item.reach === 1 ? "" : "s"}.
            </p>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Withdraw this from every college? Students will no longer see it.")) act.mutate({ path: "/withdraw", method: "POST" });
              }}
            >
              <Fi name="undo" /> Withdraw
            </Button>
          </Card>
        ) : (
          <Card className="p-4">
            <p className="text-sm font-medium text-ink">Verify and publish</p>
            <label className="mt-3 flex items-start gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-0.5 size-4 accent-teal" />
              {item.kind === "current-affair" ? "I checked these facts against the source and the question's answer is right." : item.kind === "question-set" ? "I checked every approved question and its model answer." : "I checked the date, venue and details."}
            </label>
            {errors.verified ? <p className="mt-1 text-xs text-rose">{errors.verified}</p> : null}
            <Button
              className="mt-3 w-full"
              disabled={!verified || busy || !d.canEdit}
              onClick={async () => {
                // Save the edits first, so what is published is exactly what is on screen.
                try {
                  await apiFetch(`/api/v1/content-desk/${item.id}`, DeskOverview, { method: "PUT", body: { data, targets } });
                } catch (e) {
                  if (e instanceof ApiError) setErrors(e.fields);
                  say({ tone: "error", text: e instanceof ApiError ? e.message : "Could not save." });
                  return;
                }
                act.mutate({ path: "/publish", method: "POST", body: { verified: true, targets } });
              }}
            >
              {busy ? <Spinner /> : <Fi name="paper-plane" />} Publish
            </Button>
            <div className="mt-4 border-t border-line pt-3">
              <input className={inputClass} placeholder="Reason, if you reject it" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} aria-label="Reason for rejecting" />
              <Button variant="ghost" className="mt-2 w-full text-rose" disabled={busy || note.trim().length < 3} onClick={() => act.mutate({ path: "/reject", method: "POST", body: { note } })}>
                Reject
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function TargetPicker({ value, onChange, colleges, disabled }: { value: Targets; onChange: (t: Targets) => void; colleges: DeskOverview["colleges"]; disabled?: boolean }) {
  const chosen = value === "all" ? [] : value;
  return (
    <div className="space-y-2">
      <Segmented label="Colleges" value={value === "all" ? "all" : "some"} onChange={(v) => !disabled && onChange(v === "all" ? "all" : colleges.filter((c) => c.status !== "Suspended").slice(0, 1).map((c) => c.id))} options={[{ id: "all", label: "Every college" }, { id: "some", label: "Choose" }]} />
      {value !== "all" ? (
        <ul className="max-h-60 space-y-1 overflow-auto pr-1">
          {colleges.map((c) => (
            <li key={c.id}>
              <label className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", c.status === "Suspended" ? "text-ink-3" : "text-ink-2 hover:bg-surface-2")}>
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  disabled={disabled || c.status === "Suspended"}
                  checked={chosen.includes(c.id)}
                  onChange={(e) => onChange(e.target.checked ? [...chosen, c.id] : chosen.filter((x) => x !== c.id))}
                />
                <span className="truncate">{c.name}</span>
                {c.status === "Suspended" ? <Badge tone="neutral">Suspended</Badge> : null}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-3">Every active college ({colleges.filter((c) => c.status !== "Suspended").length}).</p>
      )}
    </div>
  );
}

/* ── create: with AI or by hand ── */
function Create({ d, onCreated }: { d: DeskOverview; onCreated: (text: string) => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<ContentKind>("current-affair");
  const [mode, setMode] = useState<"ai" | "manual">(d.aiReady ? "ai" : "manual");
  const [manual, setManual] = useState<Record<string, unknown>>(blankData["current-affair"]());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (body: { path: string; body: unknown }) => apiFetch(`/api/v1/content-desk${body.path}`, DeskOverview, { method: "POST", body: body.body }),
    onSuccess: (r, v) => {
      qc.setQueryData(KEY, r);
      onCreated(v.path ? "AI drafts are ready in the review queue. Verify them before publishing." : "Draft saved to the review queue.");
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fields);
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    },
  });
  const pick = (k: ContentKind) => {
    setKind(k);
    setManual(blankData[k]());
    setErrors({});
    setError(null);
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {(["current-affair", "question-set", "event"] as const).map((k) => (
          <button key={k} type="button" onClick={() => pick(k)} aria-pressed={kind === k} className={cn("rounded-2xl border bg-surface p-4 text-left transition hover:border-brand/50", kind === k ? "border-brand ring-2 ring-brand/20" : "border-line")}>
            <span className="flex items-center gap-2 font-semibold text-ink">
              <Fi name={KIND_ICON[k]} className="text-brand" /> {KIND_LABEL[k]}
            </span>
            <span className="mt-1 block text-xs text-ink-3">{KIND_HINT[k]}</span>
          </button>
        ))}
      </div>
      <Card>
        <CardHeader
          title={mode === "ai" ? "Draft with AI" : "Write by hand"}
          subtitle={mode === "ai" ? "AI prepares drafts; they wait in the review queue until you verify and publish." : "Saved as a draft in the review queue."}
          action={<Segmented label="How" value={mode} onChange={setMode} options={[{ id: "ai", label: "With AI" }, { id: "manual", label: "By hand" }]} />}
        />
        <CardBody>
          {mode === "ai" && !d.aiReady ? (
            <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-ink-2">No AI provider is switched on. Add a key in AI Providers, or write this by hand.</p>
          ) : mode === "ai" ? (
            <AiForm key={kind} kind={kind} errors={errors} busy={create.isPending} onSubmit={(body) => create.mutate({ path: "/generate", body })} />
          ) : (
            <div className="space-y-4">
              {kind === "current-affair" ? <CurrentAffairEditor value={manual as CurrentAffairData} onChange={setManual} errors={errors} /> : null}
              {kind === "question-set" ? <QuestionSetEditor value={manual as QuestionSetData} onChange={setManual} errors={errors} /> : null}
              {kind === "event" ? <EventEditor value={manual as EventData} onChange={setManual} errors={errors} /> : null}
              <Button onClick={() => create.mutate({ path: "", body: { kind, data: manual, targets: "all" } })} disabled={create.isPending}>
                {create.isPending ? <Spinner /> : <Fi name="disk" />} Save draft
              </Button>
            </div>
          )}
          {error ? (
            <p role="alert" className="mt-3 rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">
              {error}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

function AiForm({ kind, errors, busy, onSubmit }: { kind: ContentKind; errors: Record<string, string>; busy: boolean; onSubmit: (b: GenerateBody) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [ca, setCa] = useState({ sourceText: "", sourceName: "", sourceUrl: "", date: today, count: 3 });
  const [qs, setQs] = useState({ subject: "", topics: "", count: 10, difficulty: "Mixed", bloom: "Mixed", co: "CO1", notes: "" });
  const [ev, setEv] = useState({ brief: "", type: "Seminar" as (typeof EVENT_TYPES)[number], date: today });
  const submit = () => {
    if (kind === "current-affair") onSubmit({ kind, ...ca });
    else if (kind === "question-set") onSubmit({ kind, subject: qs.subject, topics: qs.topics.split(/[,\n]/).map((t) => t.trim()).filter(Boolean), count: qs.count, difficulty: qs.difficulty as "Mixed", bloom: qs.bloom as "Mixed", co: qs.co as "CO1", notes: qs.notes });
    else onSubmit({ kind, ...ev });
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {kind === "current-affair" ? (
        <>
          <Field label="News text or official release" htmlFor="ai-src" error={errors.sourceText} hint="AI writes only from this text, so every item can be checked against it. Paste a PIB release or a news report.">
            <textarea id="ai-src" className={cn(inputClass, "min-h-40")} maxLength={8000} value={ca.sourceText} onChange={(e) => setCa({ ...ca, sourceText: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Source" htmlFor="ai-sn" error={errors.sourceName}>
              <input id="ai-sn" className={inputClass} value={ca.sourceName} onChange={(e) => setCa({ ...ca, sourceName: e.target.value })} placeholder="PIB" />
            </Field>
            <Field label="Link (optional)" htmlFor="ai-su" error={errors.sourceUrl}>
              <input id="ai-su" className={inputClass} value={ca.sourceUrl} onChange={(e) => setCa({ ...ca, sourceUrl: e.target.value })} placeholder="https://" />
            </Field>
            <Field label="News date" htmlFor="ai-d">
              <input id="ai-d" type="date" className={inputClass} value={ca.date} onChange={(e) => setCa({ ...ca, date: e.target.value })} />
            </Field>
            <Field label="Items" htmlFor="ai-n">
              <select id="ai-n" className={inputClass} value={ca.count} onChange={(e) => setCa({ ...ca, count: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
          </div>
        </>
      ) : null}
      {kind === "question-set" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject" htmlFor="ai-sub" error={errors.subject}>
              <input id="ai-sub" className={inputClass} value={qs.subject} onChange={(e) => setQs({ ...qs, subject: e.target.value })} placeholder="e.g. Database Management Systems" />
            </Field>
            <Field label="Topics" htmlFor="ai-top" error={errors.topics} hint="Comma-separated, up to 8">
              <input id="ai-top" className={inputClass} value={qs.topics} onChange={(e) => setQs({ ...qs, topics: e.target.value })} placeholder="Normalization, Transactions, Indexing" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Questions" htmlFor="ai-cnt">
              <input id="ai-cnt" type="number" min={3} max={20} className={inputClass} value={qs.count} onChange={(e) => setQs({ ...qs, count: Number(e.target.value) || 10 })} />
            </Field>
            <Field label="Difficulty" htmlFor="ai-dif">
              <select id="ai-dif" className={inputClass} value={qs.difficulty} onChange={(e) => setQs({ ...qs, difficulty: e.target.value })}>
                {["Mixed", ...DIFFICULTY_OPTIONS].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Bloom level" htmlFor="ai-bl">
              <select id="ai-bl" className={inputClass} value={qs.bloom} onChange={(e) => setQs({ ...qs, bloom: e.target.value })}>
                {["Mixed", ...BLOOM_LEVELS].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Course outcome" htmlFor="ai-co">
              <select id="ai-co" className={inputClass} value={qs.co} onChange={(e) => setQs({ ...qs, co: e.target.value })}>
                {COURSE_OUTCOMES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Syllabus or notes to stay within (optional)" htmlFor="ai-notes">
            <textarea id="ai-notes" className={cn(inputClass, "min-h-24")} maxLength={3000} value={qs.notes} onChange={(e) => setQs({ ...qs, notes: e.target.value })} />
          </Field>
        </>
      ) : null}
      {kind === "event" ? (
        <>
          <Field label="Brief" htmlFor="ai-brief" error={errors.brief} hint="What, for whom, how big, any constraints">
            <textarea id="ai-brief" className={cn(inputClass, "min-h-28")} maxLength={1500} value={ev.brief} onChange={(e) => setEv({ ...ev, brief: e.target.value })} placeholder="An inter-college AI hackathon for final-year students, 24 hours, teams of four, held on every campus" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="ai-ty">
              <select id="ai-ty" className={inputClass} value={ev.type} onChange={(e) => setEv({ ...ev, type: e.target.value as (typeof EVENT_TYPES)[number] })}>
                {EVENT_TYPES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Date" htmlFor="ai-ed">
              <input id="ai-ed" type="date" className={inputClass} value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} />
            </Field>
          </div>
        </>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? <Spinner /> : <Fi name="sparkles" />} {busy ? "Drafting… this can take a minute" : "Draft with AI"}
      </Button>
    </form>
  );
}
