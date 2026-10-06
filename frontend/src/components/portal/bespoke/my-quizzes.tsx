"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { GRADE_SCALE, QuizResult, StudentQuiz, StudentQuizRow } from "@/lib/api/learning-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { Fi } from "@/components/ui/icon";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Progress, Spinner, toneForScore } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function MyQuizzesModule() {
  const [active, setActive] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["my-quizzes"], queryFn: () => apiFetch("/api/v1/quizzes", z.array(StudentQuizRow)) });
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const quizzes = list.data ?? [];
  const departments = useMemo(() => Array.from(new Set(quizzes.map((q) => q.department))).sort(), [quizzes]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      if (deptFilter !== "all" && q.department !== deptFilter) return false;
      if (statusFilter === "todo" && q.attempts > 0) return false;
      if (statusFilter === "passed" && (q.bestPercentage === null || q.bestPercentage < q.passMark)) return false;
      if (statusFilter === "cert" && !q.certificateEnabled) return false;

      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const matchTitle = q.title.toLowerCase().includes(s);
        const matchDept = q.department.toLowerCase().includes(s);
        const matchCourse = q.course.toLowerCase().includes(s);
        if (!matchTitle && !matchDept && !matchCourse) return false;
      }
      return true;
    });
  }, [quizzes, deptFilter, statusFilter, search]);

  if (active) return <QuizPlayer id={active} onExit={() => setActive(null)} />;
  if (list.isError) return <LoadError error={list.error} onRetry={() => void list.refetch()} />;
  if (list.isLoading || !list.data) return <TemplateSkeleton />;
  if (!list.data.length) return <EmptyState title="No quizzes published yet" body="Your faculty will publish department quizzes here." />;

  return (
    <div className="space-y-4">
      {/* Student Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-card">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <input
              type="text"
              placeholder="Search quizzes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface-2/40 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
            <span className="pointer-events-none absolute left-3 top-3 text-ink-3">
              <Fi name="search" />
            </span>
          </div>

          {/* Department dropdown */}
          <div className="w-full sm:w-auto">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-10 min-w-[240px] rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium leading-normal text-ink shadow-2xs transition-colors hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 cursor-pointer"
            >
              <option value="all">All departments ({quizzes.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d} ({quizzes.filter((q) => q.department === d).length})
                </option>
              ))}
            </select>
          </div>

          {/* Status filter buttons */}
          <div className="flex h-10 items-center gap-1 rounded-xl border border-line bg-surface-2/40 p-1 text-xs">
            {[
              { id: "all", label: "All" },
              { id: "todo", label: "To do" },
              { id: "passed", label: "Passed" },
              { id: "cert", label: "Certificates" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "h-full rounded-lg px-3 py-1 font-medium transition-colors",
                  statusFilter === tab.id ? "bg-brand text-white shadow-xs" : "text-ink-2 hover:text-ink",
                )}
              >
                {tab.label}
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

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_300px]">
        <div className="grid items-start gap-4 md:grid-cols-2">
          {!filteredQuizzes.length ? (
            <div className="col-span-2 py-16 text-center text-sm text-ink-3">
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
            filteredQuizzes.map((q) => {
              const done = q.bestPercentage !== null;
              const passed = done && (q.bestPercentage ?? 0) >= q.passMark;
              return (
                <Card key={q.id} className="card-hover flex flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{q.department}</Badge>
                    {q.certificateEnabled ? (
                      <Badge tone="gold">
                        <Fi name="diploma" /> Certificate
                      </Badge>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-semibold text-ink">{q.title}</h3>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-3">
                    <span>{q.questions} questions</span>
                    <span>{q.durationMin} min</span>
                    <span>Pass {q.passMark}%</span>
                  </p>
                  {done ? (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-ink-3">
                        <span>Best score</span>
                        <span className="font-medium text-ink">{q.bestPercentage}%</span>
                      </div>
                      <Progress value={q.bestPercentage ?? 0} tone={toneForScore(q.bestPercentage ?? 0)} className="mt-1" label="Best score" />
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                    {q.attempts < 3 ? (
                      <Button onClick={() => setActive(q.id)}>
                        <Fi name="play" /> {done ? `Retake (${3 - q.attempts} left)` : "Start quiz"}
                      </Button>
                    ) : (
                      <Badge tone="neutral">No attempts left</Badge>
                    )}
                    {q.certificateId ? (
                      <Link href={`/verify/${q.certificateId}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand hover:underline">
                        View certificate
                      </Link>
                    ) : passed ? null : done ? (
                      <span className="text-xs text-rose">Below pass mark</span>
                    ) : null}
                  </div>
                </Card>
              );
            })
          )}
        </div>
        <GradeScale />
      </div>
    </div>
  );
}

export function GradeScale() {
  return (
    <Card className="h-fit">
      <CardHeader title="Certificate grades" subtitle="Based on your marks in the quiz" />
      <CardBody>
        <ul className="space-y-2 text-sm">
          {GRADE_SCALE.map((g) => (
            <li key={g.grade} className="flex items-center gap-3">
              <span className={cn("flex size-9 items-center justify-center rounded-lg font-semibold", g.grade === "RA" ? "bg-rose-soft text-rose" : "bg-gold-soft text-gold")}>{g.grade}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{g.label}</span>
                <span className="text-xs text-ink-3">{g.range}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-3">3 attempts per quiz. Your best mark counts, and a higher mark re-issues the certificate.</p>
      </CardBody>
    </Card>
  );
}

export function QuizPlayer({ id, onExit, backLabel = "Back to quizzes" }: { id: string; onExit: () => void; backLabel?: string }) {
  const qc = useQueryClient();
  const quiz = useQuery({ queryKey: ["my-quiz", id], queryFn: () => apiFetch(`/api/v1/quizzes/${encodeURIComponent(id)}`, StudentQuiz), staleTime: Infinity });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const submit = useMutation({
    mutationFn: () => apiFetch(`/api/v1/quizzes/${encodeURIComponent(id)}/submit`, QuizResult, { method: "POST", body: { answers } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-quizzes"] });
      qc.invalidateQueries({ queryKey: ["my-certificates"] });
      qc.invalidateQueries({ queryKey: ["my-readiness"] });
      qc.invalidateQueries({ queryKey: ["my-courses"] });
      qc.invalidateQueries({ queryKey: ["my-course"] });
    },
  });

  if (quiz.data && secondsLeft === null) setSecondsLeft(quiz.data.durationMin * 60);

  useEffect(() => {
    if (secondsLeft === null || submit.data || submit.isPending || submit.isError) return;
    if (secondsLeft <= 0) {
      submit.mutate();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submit]);

  if (quiz.isLoading || !quiz.data) return quiz.error ? <EmptyState title="Quiz unavailable" body={quiz.error instanceof ApiError ? quiz.error.message : undefined} /> : <TemplateSkeleton />;
  const data = quiz.data;
  if (submit.data) return <Result quiz={data} result={submit.data} onExit={onExit} backLabel={backLabel} />;

  const q = data.questions[index]!;
  const answered = Object.keys(answers).length;
  const mm = Math.floor((secondsLeft ?? 0) / 60);
  const ss = String((secondsLeft ?? 0) % 60).padStart(2, "0");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <Card>
        <CardHeader title={data.title} subtitle={`Question ${index + 1} of ${data.questions.length}`} />
        <CardBody className="space-y-5">
          <p className="text-base font-medium leading-relaxed text-ink">{q.prompt}</p>
          <fieldset className="space-y-2">
            <legend className="sr-only">Options</legend>
            {q.options.map((opt, i) => (
              <label key={i} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm", answers[q.id] === i ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50")}>
                <input type="radio" name={q.id} className="mt-0.5 accent-[var(--brand)]" checked={answers[q.id] === i} onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))} />
                <span className="text-ink">{opt}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex justify-between gap-2">
            <Button variant="secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              Previous
            </Button>
            {index < data.questions.length - 1 ? (
              <Button onClick={() => setIndex((i) => i + 1)}>Next</Button>
            ) : (
              <Button variant="gold" disabled={submit.isPending} onClick={() => submit.mutate()}>
                {submit.isPending ? <Spinner /> : null} Submit quiz
              </Button>
            )}
          </div>
          {submit.isError ? (
            <p className="text-sm text-rose" role="alert">
              {submit.error instanceof ApiError ? submit.error.message : "Submission failed."}
            </p>
          ) : null}
        </CardBody>
      </Card>
      <div className="space-y-4">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Fi name="clock" /> Time left
          </p>
          <p className={cn("mt-1 text-3xl font-semibold tabular-nums", (secondsLeft ?? 0) < 60 ? "text-rose" : "text-ink")} aria-live="polite">
            {mm}:{ss}
          </p>
          <Progress value={(answered / data.questions.length) * 100} className="mt-3" label="Answered" />
          <p className="mt-1 text-xs text-ink-3">
            {answered} of {data.questions.length} answered · pass mark {data.passMark}%
          </p>
        </Card>
        <Card className="p-4">
          <div className="grid grid-cols-5 gap-2">
            {data.questions.map((qq, i) => (
              <button
                key={qq.id}
                onClick={() => setIndex(i)}
                aria-label={`Question ${i + 1}`}
                className={cn("h-9 rounded-lg text-sm font-medium", i === index ? "bg-brand text-white" : answers[qq.id] !== undefined ? "bg-teal-soft text-teal" : "bg-surface-2 text-ink-2")}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </Card>
        <Button variant="ghost" className="w-full" onClick={onExit}>
          Exit without submitting
        </Button>
      </div>
    </div>
  );
}

function Result({ quiz, result, onExit, backLabel }: { quiz: StudentQuiz; result: QuizResult; onExit: () => void; backLabel: string }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className={cn("flex flex-wrap items-center gap-6 px-6 py-6", result.passed ? "bg-brand-gradient text-white" : "bg-surface-2")}>
          <div className={cn("flex size-24 flex-col items-center justify-center rounded-2xl", result.passed ? "bg-white/15" : "bg-rose-soft text-rose")}>
            <span className="text-3xl font-bold">{result.grade}</span>
            <span className="text-[11px] uppercase tracking-wide opacity-80">grade</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm", result.passed ? "text-white/80" : "text-ink-3")}>{quiz.title}</p>
            <p className={cn("mt-1 text-3xl font-semibold", !result.passed && "text-ink")}>
              {result.score} / {result.total} · {result.percentage}%
            </p>
            <p className={cn("mt-1 text-sm", result.passed ? "text-white/90" : "text-ink-2")}>
              {result.passed ? `${result.gradeLabel} — you passed (pass mark ${result.passMark}%).` : `Below the pass mark of ${result.passMark}%. ${result.attemptsLeft > 0 ? `${result.attemptsLeft} attempt(s) left.` : "No attempts left."}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.certificateId ? (
              <Link href={`/verify/${result.certificateId}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-medium text-[#1b2233]">
                <Fi name="diploma" /> View certificate
              </Link>
            ) : null}
            <Button variant="secondary" onClick={onExit}>
              {backLabel}
            </Button>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Answer review" />
        <CardBody className="space-y-3">
          {result.review.map((r, i) => (
            <div key={r.id} className="rounded-xl border border-line p-4">
              <p className="flex items-start gap-2 text-sm font-medium text-ink">
                <Fi name={r.correct ? "check-circle" : "cross-circle"} className={cn("mt-0.5", r.correct ? "text-teal" : "text-rose")} />
                <span>
                  {i + 1}. {r.prompt}
                  <span className="sr-only">{r.correct ? " (correct)" : " (incorrect)"}</span>
                </span>
              </p>
              <p className="mt-1 pl-6 text-sm text-ink-3">
                Your answer: {r.given !== null ? r.options[r.given] : "Not answered"}
                {!r.correct ? <span className="text-teal"> · Correct: {r.options[r.answer]}</span> : null}
              </p>
              {r.explanation ? <p className="mt-1.5 pl-6 text-sm text-ink-2">{r.explanation}</p> : null}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
