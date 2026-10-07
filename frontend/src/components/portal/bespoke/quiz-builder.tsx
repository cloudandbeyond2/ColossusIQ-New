"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { GeneratedQuiz, LearningContext, QUIZ_DIFFICULTY, QuizResults, StaffQuizDetail, StaffQuizRow, type BankQuestion } from "@/lib/api/learning-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { AiLabel } from "@/components/ui/notices";
import { Fi } from "@/components/ui/icon";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Progress, Spinner, inputClass, toneForScore, toneForStatus } from "@/components/ui/primitives";
import { ConfirmDelete } from "@/components/crud/confirm-delete";
import { cn } from "@/lib/utils";

const PLACEMENT_DEPT = "Training & Placement";
const LETTERS = ["A", "B", "C", "D"];

export function QuizBuilderModule() {
  const ctx = useQuery({ queryKey: ["learning-context"], queryFn: () => apiFetch("/api/v1/learning/context", LearningContext) });
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [resultsId, setResultsId] = useState<string | null>(null);

  if (ctx.isLoading) return <TemplateSkeleton />;
  if (ctx.isError) return <LoadError error={ctx.error} onRetry={() => void ctx.refetch()} />;
  if (!ctx.data?.stream) return <EmptyState title="Choose a college first" body="Quizzes belong to one college. Switch into a college from the top bar." />;

  if (resultsId) return <ResultsView quizId={resultsId} onBack={() => setResultsId(null)} />;

  return building ? (
    <Builder
      ctx={ctx.data}
      quizId={editingQuizId}
      onDone={() => {
        setBuilding(false);
        setEditingQuizId(null);
      }}
    />
  ) : (
    <QuizList
      onNew={() => {
        setEditingQuizId(null);
        setBuilding(true);
      }}
      onEdit={(id) => {
        setEditingQuizId(id);
        setBuilding(true);
      }}
      onResults={setResultsId}
    />
  );
}

function QuizList({ onNew, onEdit, onResults }: { onNew: () => void; onEdit: (id: string) => void; onResults: (id: string) => void }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["quizzes"], queryFn: () => apiFetch("/api/v1/quizzes", z.array(StaffQuizRow)) });
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<StaffQuizRow | null>(null);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/v1/quizzes/${encodeURIComponent(id)}/status`, z.object({ id: z.string(), status: z.string() }), { method: "POST", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quizzes"] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Update failed."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/quizzes/${encodeURIComponent(id)}?force=1`, z.object({ ok: z.boolean() }), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      setToDelete(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Delete failed."),
  });

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const rows = list.data ?? [];

  const departments = useMemo(() => Array.from(new Set(rows.map((r) => r.department))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (deptFilter !== "all" && r.department !== deptFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchDept = r.department.toLowerCase().includes(q);
        const matchCourse = r.course.toLowerCase().includes(q);
        if (!matchTitle && !matchDept && !matchCourse) return false;
      }
      return true;
    });
  }, [rows, deptFilter, statusFilter, search]);

  const totals = useMemo(() => ({
    published: rows.filter((r) => r.status === "Published").length,
    attempts: rows.reduce((s, r) => s + r.attempts, 0),
    avg: rows.filter((r) => r.attempts).length ? Math.round(rows.filter((r) => r.attempts).reduce((s, r) => s + r.average, 0) / rows.filter((r) => r.attempts).length) : 0,
  }), [rows]);

  if (list.isError) return <LoadError error={list.error} onRetry={() => void list.refetch()} />;
  if (list.isLoading || !list.data) return <TemplateSkeleton />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Quizzes", value: rows.length, icon: "test" },
          { label: "Published", value: totals.published, icon: "paper-plane" },
          { label: "Attempts", value: totals.attempts, icon: "users" },
          { label: "Average score", value: `${totals.avg}%`, icon: "chart-histogram" },
        ].map((k) => (
          <Card key={k.label} className="p-5">
            <p className="flex items-center gap-2 text-sm text-ink-3">
              <Fi name={k.icon} /> {k.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-ink">{k.value}</p>
          </Card>
        ))}
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose">
          {error}
        </p>
      ) : null}
      <Card>
        <CardHeader
          title="Department quizzes"
          subtitle="Server-scored · students never receive the answer key"
          className="pb-5"
          action={
            <Button onClick={onNew}>
              <Fi name="sparkles" /> New AI quiz
            </Button>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line bg-surface-2/40 px-6 py-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <input
                type="text"
                placeholder="Search quizzes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
              />
              <span className="pointer-events-none absolute left-3 top-3 text-ink-3">
                <Fi name="search" />
              </span>
            </div>

            {/* Department Filter */}
            <div className="w-full sm:w-auto">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-10 min-w-[240px] rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium leading-normal text-ink shadow-2xs transition-colors hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 cursor-pointer"
              >
                <option value="all">All departments ({rows.length})</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d} ({rows.filter((r) => r.department === d).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Pills */}
            <div className="flex h-10 items-center gap-1 rounded-xl border border-line bg-surface p-1 text-xs">
              {["all", "Published", "Draft", "Closed"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "h-full rounded-lg px-3 py-1 font-medium transition-colors",
                    statusFilter === s ? "bg-brand text-white shadow-xs" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>

          {search || deptFilter !== "all" || statusFilter !== "all" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setDeptFilter("all");
                setStatusFilter("all");
              }}
              className="text-xs text-ink-3 hover:text-ink"
            >
              Reset filters
            </Button>
          ) : null}
        </div>
        <CardBody className="overflow-x-auto">
          {!filteredRows.length ? (
            <div className="py-12 text-center text-sm text-ink-3">
              <p>No quizzes match your selected filters.</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-brand"
                onClick={() => {
                  setSearch("");
                  setDeptFilter("all");
                  setStatusFilter("all");
                }}
              >
                Reset filters
              </Button>
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="py-2 pr-3 font-medium">Quiz</th>
                  <th className="py-2 pr-3 font-medium">Questions</th>
                  <th className="py-2 pr-3 font-medium">Pass mark</th>
                  <th className="py-2 pr-3 font-medium">Students</th>
                  <th className="py-2 pr-3 font-medium">Average</th>
                  <th className="py-2 pr-3 font-medium">Pass rate</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-ink">{r.title}</p>
                      <p className="text-xs text-ink-3">
                        {r.department} · {r.durationMin} min {r.certificateEnabled ? "· certificate" : ""}
                      </p>
                    </td>
                    <td className="py-3 pr-3">{r.questions}</td>
                    <td className="py-3 pr-3">{r.passMark}%</td>
                    <td className="py-3 pr-3">{r.students}</td>
                    <td className="py-3 pr-3">{r.attempts ? <Badge tone={toneForScore(r.average)}>{r.average}%</Badge> : "—"}</td>
                    <td className="py-3 pr-3">{r.students ? `${r.passRate}%` : "—"}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={toneForStatus(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => onResults(r.id)}>
                          <Fi name="chart-histogram" /> Results
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => onEdit(r.id)}>
                          <Fi name="pencil" /> Edit
                        </Button>
                        {r.status !== "Published" ? (
                          <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: r.id, status: "Published" })}>
                            Publish
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: r.id, status: "Closed" })}>
                            Close
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-rose hover:bg-rose-soft" aria-label={`Delete ${r.title}`} onClick={() => setToDelete(r)}>
                          <Fi name="trash" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {toDelete ? (
        <ConfirmDelete
          open={Boolean(toDelete)}
          recordId={toDelete.id}
          recordName={toDelete.title}
          singular="Quiz"
          warning="Deleting this quiz will also permanently remove all student attempts and attempt answers."
          busy={remove.isPending}
          error={remove.error instanceof ApiError ? remove.error.message : null}
          onCancel={() => setToDelete(null)}
          onConfirm={() => remove.mutate(toDelete.id)}
        />
      ) : null}
    </div>
  );
}

function Builder({ ctx, quizId, onDone }: { ctx: LearningContext; quizId?: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const departments = [...ctx.departments, PLACEMENT_DEPT];
  const [meta, setMeta] = useState({ title: "", department: departments[0] ?? "", course: "", topic: "", notes: "", difficulty: "Mixed" as (typeof QUIZ_DIFFICULTY)[number], count: 8, passMark: 50, durationMin: 20, certificateEnabled: true });
  const [questions, setQuestions] = useState<Array<BankQuestion & { review?: boolean }>>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<"Draft" | "Published" | "Closed">("Draft");

  const detail = useQuery({
    queryKey: ["quiz-detail", quizId],
    queryFn: () => apiFetch(`/api/v1/quizzes/${encodeURIComponent(quizId!)}`, StaffQuizDetail),
    enabled: Boolean(quizId),
  });

  // Fill the form once when the saved quiz arrives (adjusting state while rendering, not in an effect).
  const [loadedFrom, setLoadedFrom] = useState<typeof detail.data>(undefined);
  if (detail.data && loadedFrom !== detail.data) {
    const d = detail.data;
    setLoadedFrom(d);
    setMeta({
      title: d.title,
      department: d.department,
      course: d.course,
      topic: "",
      notes: "",
      difficulty: "Mixed",
      count: d.questions.length,
      passMark: d.passMark,
      durationMin: d.durationMin,
      certificateEnabled: d.certificateEnabled,
    });
    setExistingStatus(d.status);
    setQuestions(d.questions.map((q) => ({ ...q, review: q.review ?? false })));
  }

  const gen = useMutation({
    mutationFn: () => apiFetch("/api/v1/quizzes/generate", GeneratedQuiz, { method: "POST", body: { department: meta.department, topic: meta.topic.trim() || undefined, count: meta.count, difficulty: meta.difficulty, notes: meta.notes.trim() || undefined } }),
    onSuccess: (r) => {
      setQuestions(r.questions.map((q, i) => ({ ...q, review: i >= r.fromBank })));
      const parts = [
        r.aiCount ? `${r.aiCount} question(s) written by AI — read each one and check the answer key` : "",
        r.fromBank ? `${r.fromBank} from the curated ${meta.department} bank` : "",
        r.templated ? `${r.templated} template question(s) — edit them before publishing` : "",
      ].filter(Boolean);
      setInfo(`${parts.join(" · ")}.${r.aiFailed ? " The AI could not write questions this time, so the built-in bank was used. Try again." : ""}`);
      setError(null);
      if (!meta.title) setMeta((m) => ({ ...m, title: `${m.department}${m.topic ? ` — ${m.topic}` : ""} quiz` }));
      if (!meta.course) setMeta((m) => ({ ...m, course: m.topic || m.department }));
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Generation failed."),
  });

  const save = useMutation({
    mutationFn: (status: "Draft" | "Published") =>
      apiFetch(quizId ? `/api/v1/quizzes/${encodeURIComponent(quizId)}` : "/api/v1/quizzes", z.object({ id: z.string() }), {
        method: quizId ? "PUT" : "POST",
        body: {
          title: meta.title,
          department: meta.department,
          course: meta.course,
          passMark: meta.passMark,
          durationMin: meta.durationMin,
          certificateEnabled: meta.certificateEnabled,
          status,
          questions: questions.map(({ prompt, options, answer, explanation }) => ({ prompt, options, answer, explanation })),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      if (quizId) qc.invalidateQueries({ queryKey: ["quiz-detail", quizId] });
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setError(e.message);
      } else setError("Could not save.");
    },
  });

  const update = (i: number, patch: Partial<BankQuestion>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch, review: false } : q)));
  const setM = <K extends keyof typeof meta>(k: K, v: (typeof meta)[K]) => setMeta((m) => ({ ...m, [k]: v }));
  const unreviewed = questions.filter((q) => q.review).length;

  if (quizId && detail.isLoading) return <TemplateSkeleton />;
  if (quizId && detail.isError) return <LoadError error={detail.error} onRetry={() => void detail.refetch()} />;

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <Card className="h-fit">
        <CardHeader title={quizId ? "Edit quiz settings" : "Quiz settings"} action={<Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>} />
        <CardBody className="space-y-4">
          <Field label="Department" htmlFor="q-dept">
            <select id="q-dept" className={inputClass} value={meta.department} onChange={(e) => setM("department", e.target.value)}>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Topic (optional)" htmlFor="q-topic" hint="e.g. Normalization, Cardiac cycle">
            <input id="q-topic" className={inputClass} maxLength={100} value={meta.topic} onChange={(e) => setM("topic", e.target.value)} />
          </Field>
          <Field label="Number of questions" htmlFor="q-count">
            <input id="q-count" type="number" min={3} max={20} className={inputClass} value={meta.count} onChange={(e) => setM("count", Math.max(3, Math.min(20, Number(e.target.value) || 3)))} />
          </Field>
          <Field label="Difficulty" htmlFor="q-diff">
            <select id="q-diff" className={inputClass} value={meta.difficulty} onChange={(e) => setM("difficulty", e.target.value as (typeof QUIZ_DIFFICULTY)[number])}>
              {QUIZ_DIFFICULTY.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Your notes (optional)" htmlFor="q-notes" hint="Paste a syllabus or lecture notes and the questions stay within them.">
            <textarea id="q-notes" rows={4} maxLength={4000} className={inputClass} value={meta.notes} onChange={(e) => setM("notes", e.target.value)} />
          </Field>
          <Button className="w-full" disabled={gen.isPending} onClick={() => gen.mutate()}>
            {gen.isPending ? <Spinner /> : <Fi name="sparkles" />} {questions.length ? "Regenerate questions" : "Generate questions"}
          </Button>
          <hr className="border-line" />
          <Field label="Quiz title" htmlFor="q-title" error={errors.title}>
            <input id="q-title" className={inputClass} maxLength={120} value={meta.title} onChange={(e) => setM("title", e.target.value)} />
          </Field>
          <Field label="Course / subject" htmlFor="q-course" error={errors.course}>
            <input id="q-course" className={inputClass} maxLength={100} value={meta.course} onChange={(e) => setM("course", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pass mark %" htmlFor="q-pass">
              <input id="q-pass" type="number" min={30} max={90} className={inputClass} value={meta.passMark} onChange={(e) => setM("passMark", Math.max(30, Math.min(90, Number(e.target.value) || 30)))} />
            </Field>
            <Field label="Minutes" htmlFor="q-min">
              <input id="q-min" type="number" min={5} max={120} className={inputClass} value={meta.durationMin} onChange={(e) => setM("durationMin", Math.max(5, Math.min(120, Number(e.target.value) || 5)))} />
            </Field>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
            <input type="checkbox" className="mt-0.5 accent-[var(--brand)]" checked={meta.certificateEnabled} onChange={(e) => setM("certificateEnabled", e.target.checked)} />
            <span>
              <span className="font-medium text-ink">Issue mark-based certificate</span>
              <span className="block text-xs text-ink-3">Students who pass get a signed certificate graded O / A+ / A / B / C.</span>
            </span>
          </label>
        </CardBody>
      </Card>

      <div className="min-w-0 space-y-4">
        {info ? (
          <Card className="flex flex-wrap items-center gap-3 p-4 text-sm text-ink-2">
            <AiLabel /> {info}
          </Card>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-xl border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose">
            {error}
          </p>
        ) : null}
        {!questions.length ? (
          <EmptyState title="No questions yet" body="Choose a department and generate. You can edit every question, option, answer key and explanation before publishing." />
        ) : (
          questions.map((q, i) => (
            <Card key={i} className={cn("p-5", q.review && "border-amber/50")}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">Question {i + 1}</p>
                <div className="flex items-center gap-2">
                  {q.review ? (
                    <Button size="sm" variant="secondary" onClick={() => update(i, {})}>
                      <Fi name="check" /> Mark reviewed
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>
                    <Fi name="trash" />
                  </Button>
                </div>
              </div>
              <label htmlFor={`qp-${i}`} className="sr-only">
                Question {i + 1} prompt
              </label>
              <textarea id={`qp-${i}`} rows={2} maxLength={400} className={inputClass} value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((o, k) => (
                  <div key={k} className={cn("flex items-center gap-2 rounded-xl border px-2 py-1.5", q.answer === k ? "border-teal bg-teal-soft" : "border-line")}>
                    <input
                      type="radio"
                      name={`ans-${i}`}
                      aria-label={`Mark option ${LETTERS[k]} correct`}
                      className="accent-[var(--teal)]"
                      checked={q.answer === k}
                      onChange={() => update(i, { answer: k })}
                    />
                    <span className="text-xs font-semibold text-ink-3">{LETTERS[k]}</span>
                    <input
                      aria-label={`Option ${LETTERS[k]}`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none"
                      maxLength={200}
                      value={o}
                      onChange={(e) => {
                        const next = [...q.options] as BankQuestion["options"];
                        next[k] = e.target.value;
                        update(i, { options: next });
                      }}
                    />
                  </div>
                ))}
              </div>
              <label htmlFor={`qe-${i}`} className="mt-3 block text-xs text-ink-3">
                Explanation shown after submission
              </label>
              <input id={`qe-${i}`} maxLength={400} className={cn(inputClass, "mt-1")} value={q.explanation} onChange={(e) => update(i, { explanation: e.target.value })} />
            </Card>
          ))
        )}
        {questions.length ? (
          <Card className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-ink-2">
              {questions.length} questions{unreviewed ? <span className="text-amber"> · {unreviewed} still marked for review</span> : null}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={save.isPending || questions.length < 3} onClick={() => save.mutate("Draft")}>
                {quizId && existingStatus === "Draft" ? "Save draft" : quizId ? "Save as draft" : "Save draft"}
              </Button>
              <Button variant="gold" disabled={save.isPending || questions.length < 3 || unreviewed > 0} title={unreviewed ? "Review every flagged question first" : undefined} onClick={() => save.mutate("Published")}>
                {save.isPending ? <Spinner /> : <Fi name="paper-plane" />} {quizId ? "Save & publish" : "Publish quiz"}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function ResultsView({ quizId, onBack }: { quizId: string; onBack: () => void }) {
  const res = useQuery({ queryKey: ["quiz-results", quizId], queryFn: () => apiFetch(`/api/v1/quizzes/${encodeURIComponent(quizId)}/results`, QuizResults) });
  if (res.isError) return <LoadError error={res.error} onRetry={() => void res.refetch()} />;
  if (res.isLoading || !res.data) return <TemplateSkeleton />;
  const r = res.data;
  const top = Math.max(1, ...r.distribution.map((d) => d.count));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{r.quiz.title}</h2>
          <p className="text-sm text-ink-3">
            {r.quiz.questions} questions · pass mark {r.quiz.passMark}% · <Badge tone={toneForStatus(r.quiz.status)}>{r.quiz.status}</Badge>
          </p>
        </div>
        <Button variant="secondary" onClick={onBack}>
          <Fi name="arrow-left" /> Back to quizzes
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Students", value: r.summary.students },
          { label: "Attempts", value: r.summary.attempts },
          { label: "Pass rate", value: r.summary.students ? `${r.summary.passRate}%` : "—" },
          { label: "Average score", value: r.summary.attempts ? `${r.summary.average}%` : "—" },
        ].map((k) => (
          <Card key={k.label} className="p-5">
            <p className="text-sm text-ink-3">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{k.value}</p>
          </Card>
        ))}
      </div>

      {!r.summary.attempts ? (
        <EmptyState title="No attempts yet" body={r.quiz.status === "Published" ? "Results appear here as soon as students submit the quiz." : "Publish the quiz so students can attempt it."} />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Best score per student" subtitle={`Highest ${r.summary.highest}% · lowest ${r.summary.lowest}%`} />
              <CardBody className="space-y-3">
                {r.distribution.map((d) => (
                  <div key={d.label} className="flex items-center gap-3 text-sm">
                    <span className="w-16 shrink-0 text-ink-3">{d.label}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-line/60" aria-hidden="true">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(d.count / top) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right font-medium text-ink">{d.count}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Hardest questions" subtitle="Lowest share of correct answers first" />
              <CardBody className="space-y-3">
                {[...r.questions]
                  .filter((q) => q.correctPct !== null)
                  .sort((a, b) => (a.correctPct ?? 0) - (b.correctPct ?? 0))
                  .slice(0, 4)
                  .map((q) => (
                    <div key={q.number} className="text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-ink">
                          Q{q.number}. {q.prompt}
                        </span>
                        <span className="shrink-0 font-medium text-ink">{q.correctPct}%</span>
                      </div>
                      <Progress value={q.correctPct ?? 0} />
                    </div>
                  ))}
                {!r.questions.some((q) => q.correctPct !== null) ? <p className="text-sm text-ink-3">Question-level results appear once students submit answers to the current version of the quiz.</p> : null}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Students" subtitle="Best attempt counts for the pass mark and the certificate" />
            <CardBody className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                    <th className="py-2 pr-3 font-medium">Student</th>
                    <th className="py-2 pr-3 font-medium">Attempts</th>
                    <th className="py-2 pr-3 font-medium">Best</th>
                    <th className="py-2 pr-3 font-medium">Latest</th>
                    <th className="py-2 pr-3 font-medium">Result</th>
                    <th className="py-2 font-medium">Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {r.students.map((s, i) => (
                    <tr key={`${s.name}-${i}`} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-ink">{s.name}</td>
                      <td className="py-2.5 pr-3">{s.attempts}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={toneForScore(s.best)}>{s.best}%</Badge>
                      </td>
                      <td className="py-2.5 pr-3">{s.latest}%</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={s.passed ? "teal" : "rose"}>{s.passed ? "Passed" : "Not yet"}</Badge>
                      </td>
                      <td className="py-2.5">{s.certificate ? "Issued" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Every question" subtitle="How the class answered. The correct option is marked." />
            <CardBody className="space-y-5">
              {r.questions.map((q) => (
                <div key={q.number}>
                  <p className="text-sm font-medium text-ink">
                    Q{q.number}. {q.prompt}
                  </p>
                  <p className="mb-2 text-xs text-ink-3">{q.correctPct === null ? "No answers recorded" : `${q.correctPct}% correct · ${q.answered} answered`}</p>
                  <ul className="space-y-1">
                    {q.options.map((o, k) => (
                      <li key={k} className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-sm", k === q.answer ? "border-teal bg-teal-soft" : "border-line")}>
                        <span className="min-w-0 truncate">
                          <span className="mr-2 font-semibold text-ink-3">{LETTERS[k]}</span>
                          {o}
                          {k === q.answer ? <span className="ml-2 text-xs font-medium text-teal">correct</span> : null}
                        </span>
                        <span className="shrink-0 text-xs text-ink-3">{q.optionCounts[k] ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
