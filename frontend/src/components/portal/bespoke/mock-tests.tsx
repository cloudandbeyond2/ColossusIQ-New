"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Play, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { MockTest, MockTestSummary, TestResult } from "@/lib/api/schemas";
import { EvaluationCard } from "@/components/portal/evaluation-card";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Badge, Button, Card, CardBody, CardHeader, Progress, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function MockTestsModule() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["assessments"], queryFn: () => apiFetch("/api/v1/assessments", z.array(MockTestSummary)) });

  if (activeId) return <TestPlayer id={activeId} onExit={() => setActiveId(null)} />;
  if (list.isLoading || !list.data) return <TemplateSkeleton />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.data.map((t) => (
        <Card key={t.id} className="p-5">
          <div className="flex items-center justify-between">
            <Badge tone="brand">{t.subject}</Badge>
            <Badge tone={t.difficulty === "Adaptive" ? "gold" : "neutral"}>{t.difficulty}</Badge>
          </div>
          <h3 className="mt-3 font-sans text-base font-semibold text-ink">{t.title}</h3>
          <p className="mt-1 flex items-center gap-3 text-sm text-ink-3">
            <span>{t.questions} questions</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {t.durationMin} min
            </span>
            {t.lastScore !== null ? <span>Last score: {t.lastScore}%</span> : null}
          </p>
          <Button className="mt-4" onClick={() => setActiveId(t.id)}>
            <Play className="size-4" /> Start test
          </Button>
        </Card>
      ))}
    </div>
  );
}

function TestPlayer({ id, onExit }: { id: string; onExit: () => void }) {
  const test = useQuery({ queryKey: ["assessment", id], queryFn: () => apiFetch(`/api/v1/assessments/${encodeURIComponent(id)}`, MockTest) });
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const submit = useMutation({
    mutationFn: () => apiFetch(`/api/v1/assessments/${encodeURIComponent(id)}/submit`, TestResult, { method: "POST", body: { answers } }),
  });

  if (test.data && secondsLeft === null) setSecondsLeft(test.data.durationMin * 60);

  useEffect(() => {
    if (secondsLeft === null || submit.data || submit.isPending) return;
    if (secondsLeft <= 0) {
      submit.mutate();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submit]);

  if (test.isLoading || !test.data) return <TemplateSkeleton />;
  const data = test.data;

  if (submit.data) return <Results test={data} result={submit.data} answers={answers} onExit={onExit} />;

  const q = data.questions[index];
  if (!q) return null;
  const answered = data.questions.filter((qq) => answers[qq.id] !== undefined && answers[qq.id] !== "").length;
  const mm = Math.floor((secondsLeft ?? 0) / 60);
  const ss = String((secondsLeft ?? 0) % 60).padStart(2, "0");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <Card>
        <CardHeader title={data.title} subtitle={`Question ${index + 1} of ${data.questions.length} · ${q.marks} mark${q.marks > 1 ? "s" : ""}`} />
        <CardBody className="space-y-5">
          <p className="text-base font-medium leading-relaxed text-ink">{q.prompt}</p>
          {q.type === "mcq" && q.options ? (
            <fieldset className="space-y-2">
              <legend className="sr-only">Options</legend>
              {q.options.map((opt, i) => (
                <label key={opt} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm", answers[q.id] === i ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50")}>
                  <input type="radio" name={q.id} className="mt-0.5 accent-[var(--brand)]" checked={answers[q.id] === i} onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))} />
                  <span className="text-ink">{opt}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <div>
              <label htmlFor={`ans-${q.id}`} className="sr-only">
                Your answer
              </label>
              <textarea
                id={`ans-${q.id}`}
                rows={10}
                maxLength={8000}
                value={String(answers[q.id] ?? "")}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                className="w-full rounded-xl border border-line bg-bg p-4 text-sm leading-relaxed text-ink focus:border-brand focus:outline-none"
                placeholder="Write your answer. Define the concept, give an example relation, decompose it and justify the decomposition."
                spellCheck
              />
              <p className="mt-1 text-right text-xs text-ink-3">{String(answers[q.id] ?? "").trim().split(/\s+/).filter(Boolean).length} words</p>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <Button variant="secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              Previous
            </Button>
            {index < data.questions.length - 1 ? (
              <Button onClick={() => setIndex((i) => i + 1)}>Next</Button>
            ) : (
              <Button variant="gold" disabled={submit.isPending} onClick={() => submit.mutate()}>
                {submit.isPending ? <Spinner /> : null} Submit test
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
            <Clock className="size-4" /> Time left
          </p>
          <p className={cn("mt-1 font-serif text-3xl font-semibold tabular-nums", (secondsLeft ?? 0) < 60 ? "text-rose" : "text-ink")} aria-live="polite">
            {mm}:{ss}
          </p>
          <Progress value={(answered / data.questions.length) * 100} className="mt-3" label="Answered" />
          <p className="mt-1 text-xs text-ink-3">
            {answered} of {data.questions.length} answered
          </p>
        </Card>
        <Card className="p-4">
          <p className="mb-2 text-xs font-medium text-ink-3">Questions</p>
          <div className="grid grid-cols-5 gap-2">
            {data.questions.map((qq, i) => (
              <button
                key={qq.id}
                onClick={() => setIndex(i)}
                aria-label={`Question ${i + 1}`}
                className={cn(
                  "h-9 rounded-lg text-sm font-medium",
                  i === index ? "bg-brand text-on-brand" : answers[qq.id] !== undefined && answers[qq.id] !== "" ? "bg-teal-soft text-teal" : "bg-surface-2 text-ink-2",
                )}
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

function Results({ test, result, answers, onExit }: { test: MockTest; result: TestResult; answers: Record<string, number | string>; onExit: () => void }) {
  const hasMcq = test.questions.some((q) => q.type === "mcq");
  const descriptiveScore = result.descriptive.reduce((s, d) => s + (d.score ?? 0), 0);
  const descriptiveMax = result.descriptive.reduce((s, d) => s + (d.max ?? 0), 0);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-ink-3">{test.title}</p>
            <p className="mt-1 font-serif text-3xl font-semibold text-ink">
              {hasMcq ? (
                <>
                  MCQ: {result.mcqScore} / {result.mcqMax}
                  {result.descriptive.length ? <span className="text-lg text-ink-3"> · descriptive provisional: {descriptiveScore} / {descriptiveMax}</span> : null}
                </>
              ) : (
                <>
                  AI Score: {descriptiveScore} / {descriptiveMax}
                  <span className="text-lg text-ink-3"> · pending faculty review</span>
                </>
              )}
            </p>
          </div>
          <Button variant="secondary" onClick={onExit}>
            <RotateCcw className="size-4" /> Back to tests
          </Button>
        </div>
      </Card>

      {hasMcq ? (
        <Card>
          <CardHeader title="Answer review" />
          <CardBody className="space-y-4">
            {test.questions
              .filter((q) => q.type === "mcq")
              .map((q, i) => {
                const r = result.answers.find((a) => a.questionId === q.id);
                const given = answers[q.id];
                return (
                  <div key={q.id} className="rounded-xl border border-line p-4">
                    <p className="flex items-start gap-2 text-sm font-medium text-ink">
                      {r?.correct ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal" aria-label="Correct" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-rose" aria-label="Incorrect" />}
                      {i + 1}. {q.prompt}
                    </p>
                    <p className="mt-1 pl-6 text-sm text-ink-3">Your answer: {typeof given === "number" ? q.options?.[given] : "Not answered"}</p>
                    <p className="mt-2 pl-6 text-sm text-ink-2">{r?.explanation}</p>
                  </div>
                );
              })}
          </CardBody>
        </Card>
      ) : null}

      {result.descriptive.map((d) => (
        <EvaluationCard key={d.questionId} result={d} title={`Descriptive answer (${d.questionId.toUpperCase()}) — AI evaluation`} />
      ))}

      <Card>
        <CardHeader title="Recommended next actions" />
        <CardBody>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
            {result.nextActions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
