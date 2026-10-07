"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { CA_CATEGORIES, CaFeed, CaItem, SOURCE_HOSTS, type CaCategory } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";

const KEY = ["current-affairs"] as const;
const LETTERS = ["A", "B", "C", "D"];
const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

interface Draft {
  date: string;
  category: CaCategory;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  tags: string[];
  status: "Draft" | "Published";
  withMcq: boolean;
  question: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
}
const empty = (): Draft => ({ date: today(), category: "National", headline: "", summary: "", sourceName: "", sourceUrl: "", tags: [], status: "Published", withMcq: true, question: "", options: ["", "", "", ""], answer: 0, explanation: "" });
const fromItem = (x: CaItem): Draft => ({
  date: x.date,
  category: x.category,
  headline: x.headline,
  summary: x.summary,
  sourceName: x.sourceName,
  sourceUrl: x.sourceUrl,
  tags: x.tags,
  status: x.status,
  withMcq: !!x.mcq,
  question: x.mcq?.question ?? "",
  options: (x.mcq?.options ?? ["", "", "", ""]) as Draft["options"],
  answer: x.mcq?.answer ?? 0,
  explanation: x.mcq?.explanation ?? "",
});
const body = (d: Draft) => ({
  date: d.date,
  category: d.category,
  headline: d.headline,
  summary: d.summary,
  sourceName: d.sourceName,
  sourceUrl: d.sourceUrl,
  tags: d.tags,
  status: d.status,
  mcq: d.withMcq ? { question: d.question, options: d.options, answer: d.answer, explanation: d.explanation } : null,
});

/** Staff desk: curate daily current-affairs items (and an optional quiz question) for students' exam preparation. */
export function CurrentAffairsDeskModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/current-affairs", CaFeed) });
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "Published" | "Draft">("all");

  const save = useMutation({
    mutationFn: (v: { id: string | null; draft: Draft }) => apiFetch(v.id ? `/api/v1/current-affairs/${encodeURIComponent(v.id)}` : "/api/v1/current-affairs", CaItem, { method: v.id ? "PUT" : "POST", body: body(v.draft) }),
    onSuccess: (x) => {
      setEditing(null);
      setErrors({});
      setMessage(x.status === "Published" ? "Published to students." : "Saved as a draft.");
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setMessage(e.message);
      } else setMessage("Could not save. Try again.");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/current-affairs/${encodeURIComponent(id)}`, z.object({ ok: z.boolean() }), { method: "DELETE" }),
    onSuccess: () => {
      setMessage("Deleted.");
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => setMessage(e instanceof ApiError ? e.message : "Could not delete."),
  });

  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const items = d.items.filter((x) => filter === "all" || x.status === filter);
  const examName = (id: string) => d.exams.find((e) => e.id === id)?.name ?? id;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Published" value={d.items.filter((x) => x.status === "Published").length} />
        <Tile label="Drafts" value={d.items.filter((x) => x.status === "Draft").length} />
        <Tile label="Quiz questions this week" value={d.weekly.questions} hint="Students need at least 3 for the weekly quiz" />
      </div>
      {message ? (
        <p role="status" className="rounded-xl bg-surface-2 px-4 py-2 text-sm text-ink-2">
          {message}
        </p>
      ) : null}
      {!d.canEdit ? <Card className="p-4 text-sm text-ink-2">Switch into a college (and confirm your sign-in code) to add or change items.</Card> : null}

      {editing ? (
        <Editor
          draft={editing.draft}
          exams={d.exams}
          errors={errors}
          busy={save.isPending}
          onChange={(draft) => setEditing({ ...editing, draft })}
          onCancel={() => {
            setEditing(null);
            setErrors({});
          }}
          onSave={() => save.mutate(editing)}
          isNew={!editing.id}
        />
      ) : (
        <Card>
          <CardHeader
            title="Items"
            subtitle="Newest first. Students see published items dated today or earlier."
            action={
              d.canEdit ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setMessage(null);
                    setEditing({ id: null, draft: empty() });
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> New item
                </Button>
              ) : null
            }
          />
          <div className="flex gap-1 border-b border-line px-4 pb-3" role="tablist" aria-label="Status">
            {(["all", "Published", "Draft"] as const).map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-xs font-medium", filter === f ? "bg-brand text-white" : "text-ink-3 hover:bg-surface-2")}>
                {f === "all" ? "All" : f === "Draft" ? "Drafts" : f}
              </button>
            ))}
          </div>
          <CardBody className="p-0">
            {!items.length ? (
              <div className="p-6">
                <EmptyState title="Nothing here yet" body="Add a short daily item: a headline, two or three lines of context and, ideally, one quiz question." />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((x) => (
                  <li key={x.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                        <span>{x.date}</span>
                        <Badge tone="brand">{x.category}</Badge>
                        <Badge tone={x.status === "Published" ? "teal" : "neutral"}>{x.status}</Badge>
                        {x.mcq ? <Badge tone="gold">Quiz question</Badge> : null}
                        {x.tags.map((t) => (
                          <Badge key={t}>{examName(t)}</Badge>
                        ))}
                      </div>
                      <p className="font-medium text-ink">{x.headline}</p>
                      <p className="line-clamp-2 text-sm text-ink-2">{x.summary}</p>
                      {x.sourceUrl ? (
                        <a href={x.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                          {x.sourceName || "Source"} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                      {x.author ? <p className="text-xs text-ink-3">By {x.author}</p> : null}
                    </div>
                    {d.canEdit ? (
                      <div className="flex items-start gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setMessage(null);
                            setEditing({ id: x.id, draft: fromItem(x) });
                          }}
                          aria-label={`Edit ${x.headline}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => window.confirm("Delete this item? Students will no longer see it.") && remove.mutate(x.id)} aria-label={`Delete ${x.headline}`}>
                          <Trash2 className="h-4 w-4 text-rose" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-sm text-ink-2">{label}</p>
      {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </Card>
  );
}

function Editor({ draft, exams, errors, busy, isNew, onChange, onCancel, onSave }: { draft: Draft; exams: Array<{ id: string; name: string }>; errors: Record<string, string>; busy: boolean; isNew: boolean; onChange: (d: Draft) => void; onCancel: () => void; onSave: () => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  return (
    <Card>
      <CardHeader title={isNew ? "New current-affairs item" : "Edit item"} subtitle="Plain text only. Keep it factual and cite an official or reputable source." />
      <CardBody>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <Field label="Date" htmlFor="ca-date" error={errors.date}>
            <input id="ca-date" type="date" className={inputClass} value={draft.date} onChange={(e) => set("date", e.target.value)} required />
          </Field>
          <Field label="Category" htmlFor="ca-cat" error={errors.category}>
            <select id="ca-cat" className={inputClass} value={draft.category} onChange={(e) => set("category", e.target.value as CaCategory)}>
              {CA_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label={`Headline (${draft.headline.length}/140)`} htmlFor="ca-head" error={errors.headline}>
              <input id="ca-head" className={inputClass} maxLength={140} value={draft.headline} onChange={(e) => set("headline", e.target.value)} required />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={`Summary (${draft.summary.length}/600)`} htmlFor="ca-sum" error={errors.summary} hint="Two to four sentences: what happened, why it matters, the facts an exam might ask.">
              <textarea id="ca-sum" className={cn(inputClass, "min-h-28")} maxLength={600} value={draft.summary} onChange={(e) => set("summary", e.target.value)} required />
            </Field>
          </div>
          <Field label="Source name" htmlFor="ca-src" error={errors.sourceName}>
            <input id="ca-src" className={inputClass} maxLength={80} placeholder="e.g. PIB, The Hindu" value={draft.sourceName} onChange={(e) => set("sourceName", e.target.value)} />
          </Field>
          <Field label="Source link (optional)" htmlFor="ca-url" error={errors.sourceUrl} hint={`https only, from government sites or: ${SOURCE_HOSTS.filter((h) => h.includes(".com") || h.includes(".org")).slice(0, 5).join(", ")} …`}>
            <input id="ca-url" type="url" className={inputClass} maxLength={300} placeholder="https://pib.gov.in/…" value={draft.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} />
          </Field>
          <fieldset className="md:col-span-2">
            <legend className="mb-1 text-sm font-medium text-ink">Useful for (optional)</legend>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {exams.map((e) => {
                const on = draft.tags.includes(e.id);
                return (
                  <button type="button" key={e.id} aria-pressed={on} onClick={() => set("tags", on ? draft.tags.filter((t) => t !== e.id) : [...draft.tags, e.id].slice(0, 8))} className={cn("rounded-full px-2.5 py-1 text-xs", on ? "bg-brand text-white" : "bg-surface-2 text-ink-2 hover:bg-line")}>
                    {e.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-3 rounded-xl border border-line p-4 md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" checked={draft.withMcq} onChange={(e) => set("withMcq", e.target.checked)} /> Add a quiz question (used in the weekly quiz)
            </label>
            {draft.withMcq ? (
              <>
                <Field label="Question" htmlFor="ca-q" error={errors.mcq}>
                  <input id="ca-q" className={inputClass} maxLength={300} value={draft.question} onChange={(e) => set("question", e.target.value)} />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  {draft.options.map((o, k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="radio" name="ca-answer" checked={draft.answer === k} onChange={() => set("answer", k)} aria-label={`Option ${LETTERS[k]} is correct`} />
                      <span className="w-4 text-xs font-semibold text-ink-3">{LETTERS[k]}</span>
                      <input
                        className={inputClass}
                        maxLength={120}
                        placeholder={`Option ${LETTERS[k]}`}
                        value={o}
                        onChange={(e) => {
                          const next = [...draft.options] as Draft["options"];
                          next[k] = e.target.value;
                          set("options", next);
                        }}
                        aria-label={`Option ${LETTERS[k]}`}
                      />
                    </label>
                  ))}
                </div>
                <p className="text-xs text-ink-3">Select the radio button next to the correct option.</p>
                <Field label="Explanation (shown after the quiz)" htmlFor="ca-exp">
                  <input id="ca-exp" className={inputClass} maxLength={300} value={draft.explanation} onChange={(e) => set("explanation", e.target.value)} />
                </Field>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={draft.status === "Published"} onChange={(e) => set("status", e.target.checked ? "Published" : "Draft")} /> Publish to students
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner /> : null} {draft.status === "Published" ? "Publish" : "Save draft"}
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
