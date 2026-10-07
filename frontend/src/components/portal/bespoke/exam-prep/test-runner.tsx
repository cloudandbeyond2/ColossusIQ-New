"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Clock, Flag, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, Progress, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { RoundResult, type Round } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D"];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** One timed test: a question navigator, sections, a whole-test countdown and auto-submit when time is up. */
export function TestRunner({ round, onDone, onExit }: { round: Round; onDone: (r: RoundResult) => void; onExit: () => void }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [left, setLeft] = useState(round.durationSec);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = useRef(false);

  const submit = useMutation({
    mutationFn: (a: Record<string, number | null>) => apiFetch(`/api/v1/exam-prep/rounds/${encodeURIComponent(round.id)}/submit`, RoundResult, { method: "POST", body: { answers: a } }),
    onSuccess: onDone,
    onError: (e) => {
      sent.current = false;
      setError(e instanceof ApiError ? e.message : "Could not submit. Check your connection and try again.");
    },
  });
  const send = useCallback(
    (a: Record<string, number | null>) => {
      if (sent.current) return;
      sent.current = true;
      submit.mutate(a);
    },
    [submit]
  );

  // Latest answers for the auto-submit timer, without restarting the timer on every click.
  const latest = useRef(answers);
  useEffect(() => {
    latest.current = answers;
  }, [answers]);
  useEffect(() => {
    const started = Date.now();
    const tick = window.setInterval(() => {
      const remaining = Math.max(0, round.durationSec - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(tick);
        send(latest.current);
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [round.durationSec, send]);

  const q = round.questions[idx]!;
  const section = round.sections?.find((s) => idx >= s.from && idx <= s.to) ?? null;
  const answered = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const choose = (k: number | null) => setAnswers((a) => ({ ...a, [q.id]: a[q.id] === k ? null : k }));

  if (submit.isPending || submit.isSuccess)
    return (
      <Card className="grid place-items-center gap-3 p-12">
        <Spinner />
        <p className="text-sm text-ink-3">Marking your answers…</p>
      </Card>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-ink">{round.title}</h2>
          <p className="text-xs text-ink-3">{round.note}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums", left <= 60 ? "bg-rose-soft text-rose" : "bg-surface-2 text-ink")} aria-live="polite" aria-label={`${clock(left)} left`}>
            <Clock className="h-4 w-4" aria-hidden="true" /> {clock(left)}
          </span>
          <Button variant="ghost" size="sm" onClick={onExit}>
            Leave
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm text-rose">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <Card className="p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-3">
            <span>
              Question {idx + 1} of {round.questions.length}
            </span>
            {section ? (
              <Badge tone="brand">
                {section.name} · +{section.marks}
                {section.negative ? ` / −${section.negative}` : ""}
              </Badge>
            ) : null}
          </div>
          <Progress value={(answered / round.questions.length) * 100} label="Questions answered" />
          <p className="mt-5 whitespace-pre-line text-base font-medium text-ink sm:text-lg">{q.prompt}</p>
          <div className="mt-4 grid gap-2" role="radiogroup" aria-label={`Answer for question ${idx + 1}`}>
            {q.options.map((o, k) => {
              const on = answers[q.id] === k;
              return (
                <button
                  key={k}
                  role="radio"
                  aria-checked={on}
                  onClick={() => choose(k)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm text-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                    on ? "border-brand bg-brand-soft" : "border-line hover:border-brand hover:bg-brand-soft/50"
                  )}
                >
                  <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-semibold", on ? "bg-brand text-white" : "bg-surface-2 text-ink-3")}>{LETTERS[k]}</span>
                  {o}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" size="sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous
            </Button>
            <Button variant="ghost" size="sm" disabled={answers[q.id] === undefined || answers[q.id] === null} onClick={() => setAnswers((a) => ({ ...a, [q.id]: null }))}>
              Clear answer
            </Button>
            {idx + 1 < round.questions.length ? (
              <Button size="sm" onClick={() => setIdx(idx + 1)}>
                Next <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setConfirm(true)}>
                <Flag className="h-4 w-4" aria-hidden="true" /> Finish
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-2 text-sm font-medium text-ink">
            {answered} of {round.questions.length} answered
          </p>
          {(round.sections ?? [{ name: "", from: 0, to: round.questions.length - 1, marks: 1, negative: 0 }]).map((s) => (
            <div key={s.name || "all"} className="mb-3">
              {s.name ? <p className="mb-1 truncate text-xs text-ink-3">{s.name}</p> : null}
              <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-6">
                {round.questions.slice(s.from, s.to + 1).map((x, j) => {
                  const i = s.from + j;
                  const done = answers[x.id] !== undefined && answers[x.id] !== null;
                  return (
                    <button
                      key={x.id}
                      onClick={() => setIdx(i)}
                      aria-label={`Question ${i + 1}${done ? ", answered" : ""}`}
                      aria-current={i === idx ? "step" : undefined}
                      className={cn("h-8 rounded-md text-xs font-medium tabular-nums", i === idx ? "ring-2 ring-brand" : "", done ? "bg-brand text-white" : "bg-surface-2 text-ink-2 hover:bg-line")}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <Button className="mt-2 w-full" onClick={() => setConfirm(true)}>
            Submit test
          </Button>
        </Card>
      </div>

      {confirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <Card className="w-full max-w-sm p-6">
            <h3 id="submit-title" className="text-lg font-semibold text-ink">
              Submit now?
            </h3>
            <p className="mt-2 text-sm text-ink-2">
              You have answered {answered} of {round.questions.length} questions.{" "}
              {round.sections?.some((s) => s.negative > 0) ? "Blank answers lose no marks; wrong ones do." : "Blank answers score zero."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Keep going
              </Button>
              <Button
                onClick={() => {
                  setConfirm(false);
                  send(answers);
                }}
              >
                Submit
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

/** Score, section split, peer percentile and an answer review with explanations. */
export function ResultView({ result, onAgain, onExit, againLabel }: { result: RoundResult; onAgain?: () => void; onExit: () => void; againLabel?: string }) {
  const [onlyWrong, setOnlyWrong] = useState(true);
  const shown = onlyWrong ? result.review.filter((r) => !r.correct) : result.review;
  const mins = Math.floor(result.seconds / 60);
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
          <div className="text-center md:text-left">
            <p className="text-sm text-ink-3">{result.title}</p>
            <p className="text-5xl font-semibold text-ink tabular-nums">
              {result.score}
              <span className="text-2xl text-ink-3">/{result.max}</span>
            </p>
            <p className="mt-1 text-sm text-ink-2">{result.percentage}%</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Correct" value={result.correct} tone="text-teal" />
            <Stat label="Wrong" value={result.wrong} tone="text-rose" />
            <Stat label="Skipped" value={result.skipped} tone="text-ink-2" />
            <Stat label="Time" value={`${mins}m ${result.seconds % 60}s`} tone="text-ink" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="gold">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> +{result.xp} XP
          </Badge>
          {result.percentile !== null ? <Badge tone="brand">Better than {result.percentile}% of {result.peers - 1} classmates&apos; attempts</Badge> : result.kind === "daily" || result.kind === "mock" ? <Badge>Percentile appears once 5 classmates have taken it</Badge> : null}
          {result.timedOut ? <Badge tone="amber">Submitted after time ran out</Badge> : null}
        </div>
      </Card>

      {result.sections?.length ? (
        <Card>
          <CardHeader title="Section-wise score" />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-ink-3">
                <tr>
                  <th className="px-4 py-2 font-medium">Section</th>
                  <th className="px-4 py-2 font-medium">Score</th>
                  <th className="px-4 py-2 font-medium">Right / wrong / blank</th>
                  <th className="px-4 py-2 font-medium">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.sections.map((s) => (
                  <tr key={s.name}>
                    <td className="px-4 py-2 text-ink">{s.name}</td>
                    <td className="px-4 py-2 tabular-nums text-ink">
                      {s.score} / {s.max}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-2">
                      {s.correct} / {s.wrong} / {s.skipped}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-2">{s.accuracy === null ? "—" : `${s.accuracy}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Review"
          subtitle={onlyWrong ? `${shown.length} to learn from` : `${shown.length} questions`}
          action={
            <Button variant="ghost" size="sm" onClick={() => setOnlyWrong(!onlyWrong)}>
              {onlyWrong ? "Show all" : "Show mistakes only"}
            </Button>
          }
        />
        <CardBody className="space-y-4">
          {!shown.length ? <p className="text-sm text-ink-2">No mistakes. Well done!</p> : null}
          {shown.map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-4">
              <p className="flex items-start gap-2 text-sm font-medium text-ink">
                {r.correct ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-label="Correct" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-rose" aria-label={r.given === null ? "Skipped" : "Wrong"} />}
                <span>
                  {r.id.slice(1)}. {r.prompt}
                </span>
              </p>
              <ul className="mt-2 grid gap-1 text-sm">
                {r.options.map((o, k) => (
                  <li key={k} className={cn("rounded-lg px-3 py-1.5", k === r.answer ? "bg-teal-soft text-teal" : k === r.given ? "bg-rose-soft text-rose" : "text-ink-2")}>
                    {LETTERS[k]}. {o}
                    {k === r.answer ? " ✓" : k === r.given ? " (your answer)" : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-2">{r.explanation}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the hub
        </Button>
        {onAgain ? <Button onClick={onAgain}>{againLabel ?? "Try another round"}</Button> : null}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 text-center">
      <p className={cn("text-xl font-semibold tabular-nums", tone)}>{value}</p>
      <p className="text-xs text-ink-3">{label}</p>
    </div>
  );
}
