"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { GenerateResult, MAX_SET_QUESTIONS, StudioNote, StudioOverview, StudioSet, type NoteContent } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";

const KEY = ["prep-content"] as const;
const LETTERS = ["A", "B", "C", "D"];
type Tab = "sets" | "notes";
interface Q {
  prompt: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
}
const blankQ = (): Q => ({ prompt: "", options: ["", "", "", ""], answer: 0, explanation: "" });

/** Exam Prep Studio: staff add question sets and study notes that flow into students' Competitive Exam Prep Hub. */
export function ExamPrepStudioModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/prep-content", StudioOverview) });
  const [tab, setTab] = useState<Tab>("sets");
  const [message, setMessage] = useState<string | null>(null);
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Published question sets" value={d.sets.filter((x) => x.status === "Published").length} hint={`${d.sets.reduce((n, x) => n + (x.status === "Published" ? x.questions.length : 0), 0)} questions reaching students`} />
        <Tile label="Topic notes by faculty" value={d.notes.filter((x) => x.source === "faculty").length} />
        <Tile label="AI notes to review" value={d.notes.filter((x) => x.source === "ai").length} hint={d.aiAvailable ? "AI drafting is on" : "AI drafting is off: built-in drafts are used"} />
      </div>
      {!d.canEdit ? <Card className="p-4 text-sm text-ink-2">Switch into a college (and confirm your sign-in code) to add or change content.</Card> : null}
      {message ? (
        <p role="status" className="rounded-xl bg-surface-2 px-4 py-2 text-sm text-ink-2">
          {message}
        </p>
      ) : null}
      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1" role="tablist" aria-label="Studio sections">
        {(
          [
            ["sets", "Question sets"],
            ["notes", "Study notes"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("rounded-xl px-3 py-1.5 text-sm font-medium", tab === id ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
            {label}
          </button>
        ))}
      </div>
      {tab === "sets" ? <SetsPanel d={d} say={setMessage} /> : <NotesPanel d={d} say={setMessage} />}
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

function useGenerate() {
  return useMutation({ mutationFn: (body: unknown) => apiFetch("/api/v1/prep-content/generate", GenerateResult, { method: "POST", body }) });
}
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/* ───────────────────────────── question sets ───────────────────────────── */
interface SetDraft {
  id: string | null;
  title: string;
  topicId: string;
  newTopic: string;
  examIds: string[];
  section: string;
  status: "Draft" | "Published";
  questions: Q[];
}
const NEW = "__new__";

function SetsPanel({ d, say }: { d: StudioOverview; say: (m: string | null) => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<SetDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (x: SetDraft) =>
      apiFetch(x.id ? `/api/v1/prep-content/sets/${encodeURIComponent(x.id)}` : "/api/v1/prep-content/sets", StudioSet, {
        method: x.id ? "PUT" : "POST",
        body: { title: x.title, topicId: x.topicId === NEW ? null : x.topicId, newTopic: x.topicId === NEW ? x.newTopic : "", examIds: x.examIds, section: x.section, status: x.status, questions: x.questions },
      }),
    onSuccess: (r) => {
      setDraft(null);
      setErrors({});
      say(r.status === "Published" ? `Published “${r.title}”: ${r.questions.length} questions now reach students.` : `Saved “${r.title}” as a draft.`);
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fields);
      say(errorText(e, "Could not save the set."));
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/prep-content/sets/${encodeURIComponent(id)}`, z.object({ ok: z.boolean() }), { method: "DELETE" }),
    onSuccess: () => {
      say("Deleted.");
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => say(errorText(e, "Could not delete.")),
  });
  const examName = (id: string) => d.exams.find((e) => e.id === id)?.name ?? id;

  if (draft) return <SetEditor d={d} draft={draft} setDraft={setDraft} errors={errors} busy={save.isPending} onSave={() => save.mutate(draft)} onCancel={() => setDraft(null)} say={say} />;
  return (
    <Card>
      <CardHeader
        title="Question sets"
        subtitle="Exam-style questions for any syllabus topic, or a new topic your college teaches. Published questions appear in drills and mocks."
        action={
          d.canEdit ? (
            <Button size="sm" onClick={() => setDraft({ id: null, title: "", topicId: "", newTopic: "", examIds: [], section: "", status: "Published", questions: [blankQ()] })}>
              <Plus className="h-4 w-4" aria-hidden="true" /> New set
            </Button>
          ) : null
        }
      />
      <CardBody className="p-0">
        {!d.sets.length ? (
          <div className="p-6">
            <EmptyState title="No question sets yet" body="Add previous-year-style questions for an exam, or a set for a topic your students find hard." />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {d.sets.map((x) => (
              <li key={x.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-ink">{x.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    <Badge tone={x.status === "Published" ? "teal" : "neutral"}>{x.status}</Badge>
                    <Badge tone="brand">{x.topicTitle}</Badge>
                    <span>{x.questions.length} questions</span>
                    {x.examIds.map((e) => (
                      <Badge key={e}>{examName(e)}</Badge>
                    ))}
                    {x.section ? <span>· {x.section}</span> : null}
                    <span>· by {x.author}</span>
                  </div>
                </div>
                {d.canEdit ? (
                  <div className="flex items-start gap-1">
                    <Button size="sm" variant="ghost" aria-label={`Edit ${x.title}`} onClick={() => setDraft({ id: x.id, title: x.title, topicId: x.topicId, newTopic: x.topicId.startsWith("c-") ? x.topicTitle : "", examIds: x.examIds, section: x.section, status: x.status, questions: x.questions.map((q) => ({ prompt: q.prompt, options: [...q.options] as Q["options"], answer: q.answer, explanation: q.explanation })) })}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${x.title}`} onClick={() => window.confirm("Delete this question set? Its questions leave students' drills and mocks.") && remove.mutate(x.id)}>
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
  );
}

function TopicSelect({ d, value, onChange, id, allowNew }: { d: StudioOverview; value: string; onChange: (v: string) => void; id: string; allowNew: boolean }) {
  const groups = useMemo(() => {
    const m = new Map<string, Array<{ id: string; title: string }>>();
    for (const t of d.topics) m.set(t.family, [...(m.get(t.family) ?? []), t]);
    return [...m.entries()];
  }, [d.topics]);
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a topic…</option>
      {allowNew ? <option value={NEW}>+ A new topic for my college</option> : null}
      {groups.map(([family, topics]) => (
        <optgroup key={family} label={family}>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function SetEditor({ d, draft, setDraft, errors, busy, onSave, onCancel, say }: { d: StudioOverview; draft: SetDraft; setDraft: (x: SetDraft) => void; errors: Record<string, string>; busy: boolean; onSave: () => void; onCancel: () => void; say: (m: string | null) => void }) {
  const gen = useGenerate();
  const [count, setCount] = useState(10);
  const set = <K extends keyof SetDraft>(k: K, v: SetDraft[K]) => setDraft({ ...draft, [k]: v });
  const sections = [...new Set(d.exams.filter((e) => draft.examIds.includes(e.id)).flatMap((e) => e.sections))];
  const setQ = (i: number, q: Q) => set("questions", draft.questions.map((x, j) => (j === i ? q : x)));
  const isNew = draft.topicId === NEW;
  const draftQuestions = () => {
    say(null);
    gen.mutate(
      { kind: "questions", topicId: isNew || !draft.topicId ? null : draft.topicId, topicTitle: isNew ? draft.newTopic : "", count },
      {
        onSuccess: (r) => {
          const add = (r.questions ?? []).map((q) => ({ prompt: q.prompt, options: [...q.options] as Q["options"], answer: q.answer, explanation: q.explanation }));
          const keep = draft.questions.filter((q) => q.prompt.trim());
          setDraft({ ...draft, questions: [...keep, ...add].slice(0, MAX_SET_QUESTIONS) });
          say(r.message);
        },
        onError: (e) => say(errorText(e, "Could not draft questions.")),
      }
    );
  };
  return (
    <Card>
      <CardHeader title={draft.id ? "Edit question set" : "New question set"} subtitle="Every question needs four different options and one correct answer. Check AI drafts before publishing." />
      <CardBody>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Set title" htmlFor="set-title" error={errors.title}>
              <input id="set-title" className={inputClass} maxLength={120} placeholder="e.g. SSC CGL 2025 GA practice, set 1" value={draft.title} onChange={(e) => set("title", e.target.value)} required />
            </Field>
            <Field label="Topic" htmlFor="set-topic" error={errors.topicId}>
              <TopicSelect d={d} id="set-topic" value={draft.topicId} onChange={(v) => set("topicId", v)} allowNew />
            </Field>
            {isNew ? (
              <Field label="New topic name" htmlFor="set-new" error={errors.newTopic} hint="It is added to the syllabus of the exam section you choose below.">
                <input id="set-new" className={inputClass} maxLength={80} placeholder="e.g. Government schemes 2026" value={draft.newTopic} onChange={(e) => set("newTopic", e.target.value)} />
              </Field>
            ) : null}
            <Field label={isNew ? "Exam section (required to publish a new topic)" : "Exam section (optional)"} htmlFor="set-section" error={errors.section}>
              <select id="set-section" className={inputClass} value={draft.section} onChange={(e) => set("section", e.target.value)} disabled={!sections.length}>
                <option value="">{sections.length ? "Choose a section…" : "Pick an exam first"}</option>
                {sections.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">Exams (up to 10)</legend>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {d.exams.map((e) => {
                const on = draft.examIds.includes(e.id);
                return (
                  <button type="button" key={e.id} aria-pressed={on} onClick={() => setDraft({ ...draft, examIds: on ? draft.examIds.filter((x) => x !== e.id) : [...draft.examIds, e.id].slice(0, 10), section: "" })} className={cn("rounded-full px-2.5 py-1 text-xs", on ? "bg-brand text-white" : "bg-surface-2 text-ink-2 hover:bg-line")}>
                    {e.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2 p-3">
            <Field label="How many to draft" htmlFor="gen-count">
              <input id="gen-count" type="number" min={3} max={20} className={cn(inputClass, "w-24")} value={count} onChange={(e) => setCount(Math.max(3, Math.min(20, Number(e.target.value) || 10)))} />
            </Field>
            <Button type="button" variant="secondary" onClick={draftQuestions} disabled={gen.isPending || (!draft.topicId || (isNew && draft.newTopic.trim().length < 3))}>
              {gen.isPending ? <Spinner /> : d.aiAvailable ? <Sparkles className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />} {d.aiAvailable ? "Draft with AI" : "Add from question bank"}
            </Button>
            <p className="text-xs text-ink-3">{d.aiAvailable ? "The AI writes a draft for you to check and edit." : "AI drafting is off: built-in topics can start from their question bank."}</p>
          </div>

          {errors.questions ? <p className="text-sm text-rose">{errors.questions}</p> : null}
          <ol className="space-y-3">
            {draft.questions.map((q, i) => (
              <li key={i} className="rounded-xl border border-line p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">Question {i + 1}</span>
                  <Button type="button" size="sm" variant="ghost" aria-label={`Remove question ${i + 1}`} onClick={() => set("questions", draft.questions.filter((_, j) => j !== i))} disabled={draft.questions.length === 1}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <textarea aria-label={`Question ${i + 1}`} className={cn(inputClass, "min-h-16")} maxLength={600} value={q.prompt} onChange={(e) => setQ(i, { ...q, prompt: e.target.value })} placeholder="Question text" />
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="radio" name={`ans-${i}`} checked={q.answer === k} onChange={() => setQ(i, { ...q, answer: k })} aria-label={`Option ${LETTERS[k]} is correct for question ${i + 1}`} />
                      <span className="w-4 text-xs font-semibold text-ink-3">{LETTERS[k]}</span>
                      <input
                        className={inputClass}
                        maxLength={300}
                        value={o}
                        aria-label={`Question ${i + 1} option ${LETTERS[k]}`}
                        onChange={(e) => {
                          const opts = [...q.options] as Q["options"];
                          opts[k] = e.target.value;
                          setQ(i, { ...q, options: opts });
                        }}
                      />
                    </label>
                  ))}
                </div>
                <input aria-label={`Explanation for question ${i + 1}`} className={cn(inputClass, "mt-2")} maxLength={600} value={q.explanation} onChange={(e) => setQ(i, { ...q, explanation: e.target.value })} placeholder="Explanation shown after the test (recommended)" />
              </li>
            ))}
          </ol>
          <Button type="button" variant="secondary" size="sm" onClick={() => set("questions", [...draft.questions, blankQ()].slice(0, MAX_SET_QUESTIONS))} disabled={draft.questions.length >= MAX_SET_QUESTIONS}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a question
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
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

/* ───────────────────────────── study notes ───────────────────────────── */
interface NoteDraft {
  topicId: string;
  status: "Draft" | "Published";
  summary: string;
  keyPoints: string;
  formulas: string;
  problem: string;
  solution: string;
  mistakes: string;
  tips: string;
}
const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const toDraft = (topicId: string, n: NoteContent, status: "Draft" | "Published" = "Published"): NoteDraft => ({ topicId, status, summary: n.summary, keyPoints: n.keyPoints.join("\n"), formulas: n.formulas.join("\n"), problem: n.example?.problem ?? "", solution: n.example?.solution ?? "", mistakes: n.mistakes.join("\n"), tips: n.tips.join("\n") });

function NotesPanel({ d, say }: { d: StudioOverview; say: (m: string | null) => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const gen = useGenerate();
  const save = useMutation({
    mutationFn: (x: NoteDraft) =>
      apiFetch("/api/v1/prep-content/notes", StudioNote, {
        method: "POST",
        body: { topicId: x.topicId, status: x.status, summary: x.summary, keyPoints: lines(x.keyPoints), formulas: lines(x.formulas), example: x.problem.trim() && x.solution.trim() ? { problem: x.problem, solution: x.solution } : null, mistakes: lines(x.mistakes), tips: lines(x.tips) },
      }),
    onSuccess: (r) => {
      setDraft(null);
      setErrors({});
      say(r.status === "Published" ? `Published notes for ${r.topicTitle}. Students now see them as faculty notes.` : `Saved notes for ${r.topicTitle} as a draft.`);
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fields);
      say(errorText(e, "Could not save the notes."));
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/prep-content/notes/${encodeURIComponent(id)}`, z.object({ ok: z.boolean() }), { method: "DELETE" }),
    onSuccess: () => {
      say("Deleted. Students see the built-in notes again.");
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const startFrom = (topicId: string) =>
    gen.mutate(
      { kind: "notes", topicId },
      {
        onSuccess: (r) => {
          if (r.notes) setDraft(toDraft(topicId, r.notes));
          say(r.message);
        },
        onError: (e) => say(errorText(e, "Could not draft notes.")),
      }
    );

  if (draft) {
    const f = <K extends keyof NoteDraft>(k: K, v: NoteDraft[K]) => setDraft({ ...draft, [k]: v });
    const area = (k: "keyPoints" | "formulas" | "mistakes" | "tips", label: string, hint: string) => (
      <Field label={label} htmlFor={`n-${k}`} error={errors[k]} hint={hint}>
        <textarea id={`n-${k}`} className={cn(inputClass, "min-h-24")} value={draft[k]} onChange={(e) => f(k, e.target.value)} />
      </Field>
    );
    return (
      <Card>
        <CardHeader title={`Study notes: ${d.topics.find((t) => t.id === draft.topicId)?.title ?? draft.topicId}`} subtitle="Plain text. One item per line in the lists. Saving replaces any earlier notes for this topic." />
        <CardBody>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(draft);
            }}
          >
            <div className="md:col-span-2">
              <Field label={`Overview (${draft.summary.length}/1200)`} htmlFor="n-summary" error={errors.summary}>
                <textarea id="n-summary" className={cn(inputClass, "min-h-20")} maxLength={1200} value={draft.summary} onChange={(e) => f("summary", e.target.value)} required />
              </Field>
            </div>
            {area("keyPoints", "Key points", "One per line, up to 15")}
            {area("formulas", "Formulas & rules", "One per line (leave empty for fact topics)")}
            <Field label="Worked example: problem" htmlFor="n-problem">
              <textarea id="n-problem" className={cn(inputClass, "min-h-20")} maxLength={600} value={draft.problem} onChange={(e) => f("problem", e.target.value)} />
            </Field>
            <Field label="Worked example: solution" htmlFor="n-solution">
              <textarea id="n-solution" className={cn(inputClass, "min-h-20")} maxLength={1200} value={draft.solution} onChange={(e) => f("solution", e.target.value)} />
            </Field>
            {area("mistakes", "Common mistakes", "One per line")}
            {area("tips", "Exam tips", "One per line")}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={draft.status === "Published"} onChange={(e) => f("status", e.target.checked ? "Published" : "Draft")} /> Publish to students
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? <Spinner /> : null} {draft.status === "Published" ? "Publish notes" : "Save draft"}
                </Button>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {d.canEdit ? <NewNote d={d} busy={gen.isPending} onStart={startFrom} /> : null}
      <Card>
        <CardHeader title="Notes in your college" subtitle="Faculty notes replace the built-in or AI notes for their topic. AI notes were written when a student first opened a topic; review and approve them here." />
        <CardBody className="p-0">
          {!d.notes.length ? (
            <div className="p-6">
              <EmptyState title="No notes yet" body="Students see built-in notes until you or the AI add notes for a topic." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {d.notes.map((n) => (
                <li key={n.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{n.topicTitle}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                      {n.source === "ai" ? (
                        <Badge tone="amber">
                          <Bot className="h-3.5 w-3.5" aria-hidden="true" /> AI, not yet reviewed
                        </Badge>
                      ) : (
                        <Badge tone="teal">Faculty</Badge>
                      )}
                      <Badge tone={n.status === "Published" ? "teal" : "neutral"}>{n.status}</Badge>
                      <span>{n.keyPoints.length} key points</span>
                      {n.source === "faculty" ? <span>· by {n.author}</span> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-2">{n.summary}</p>
                  </div>
                  {d.canEdit ? (
                    <div className="flex items-start gap-1">
                      <Button size="sm" variant={n.source === "ai" ? "primary" : "ghost"} onClick={() => setDraft(toDraft(n.topicId, n, n.status))}>
                        {n.source === "ai" ? "Review" : <Pencil className="h-4 w-4" aria-label={`Edit notes for ${n.topicTitle}`} />}
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={`Delete notes for ${n.topicTitle}`} onClick={() => window.confirm("Delete these notes?") && remove.mutate(n.id)}>
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
    </div>
  );
}

function NewNote({ d, busy, onStart }: { d: StudioOverview; busy: boolean; onStart: (topicId: string) => void }) {
  const [topic, setTopic] = useState("");
  return (
    <Card className="flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[240px] flex-1">
        <Field label="Write notes for a topic" htmlFor="note-topic">
          <TopicSelect d={d} id="note-topic" value={topic} onChange={setTopic} allowNew={false} />
        </Field>
      </div>
      <Button onClick={() => onStart(topic)} disabled={!topic || busy}>
        {busy ? <Spinner /> : d.aiAvailable ? <Sparkles className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />} {d.aiAvailable ? "Start from an AI draft" : "Start from the built-in notes"}
      </Button>
    </Card>
  );
}
