"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Brain, Check, Flame, Gamepad2, Trophy, Wind, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, Progress, Skeleton, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { MAX_MEMORY_LEVEL, PlayResult, RefreshOverview, Round, RoundResult, type ActivityCard, type QuizActivity } from "@/lib/api/refresh-zone-schemas";
import { cn } from "@/lib/utils";

const KEY = ["refresh-zone"] as const;
const LETTERS = ["A", "B", "C", "D"];
const TONE_BG: Record<ActivityCard["tone"], string> = {
  brand: "bg-brand-soft text-brand",
  gold: "bg-gold-soft text-gold",
  teal: "bg-teal-soft text-teal",
  rose: "bg-rose-soft text-rose",
  amber: "bg-amber-soft text-amber",
  sky: "bg-sky-soft text-sky",
};

type View = { kind: "home" } | { kind: "quiz"; activity: QuizActivity } | { kind: "memory" } | { kind: "breathing" };

export function RefreshZoneModule() {
  const [view, setView] = useState<View>({ kind: "home" });
  const qc = useQueryClient();
  const back = () => {
    void qc.invalidateQueries({ queryKey: KEY });
    setView({ kind: "home" });
  };
  if (view.kind === "quiz") return <QuizGame activity={view.activity} onExit={back} />;
  if (view.kind === "memory") return <MemoryGame onExit={back} />;
  if (view.kind === "breathing") return <Breathing onExit={back} />;
  return <Home onPlay={(a) => setView(a.kind === "quiz" ? { kind: "quiz", activity: a.id as QuizActivity } : { kind: a.kind })} />;
}

/* ───────────────────────────── home ───────────────────────────── */
function Home({ onPlay }: { onPlay: (a: ActivityCard) => void }) {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/refresh-zone", RefreshOverview), staleTime: 0, refetchOnMount: "always" });
  if (q.isPending)
    return (
      <div className="space-y-6">
        <Skeleton className="h-36" />
        <Skeleton className="h-64" />
      </div>
    );
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const top = Math.max(1, ...d.week.map((w) => w.plays));
  const accuracy = d.totals.answered ? Math.round((d.totals.correct / d.totals.answered) * 100) : null;
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm text-ink-3">Today&apos;s breaks</p>
            <p className="text-3xl font-semibold text-ink">
              {d.today.plays} <span className="text-base font-normal text-ink-3">of {d.today.goal}</span>
            </p>
            <Progress value={(Math.min(d.today.plays, d.today.goal) / d.today.goal) * 100} className="mt-2 max-w-sm" label="Daily break goal" />
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
              <Flame className={cn("h-4 w-4", d.streak.current ? "text-amber" : "text-ink-3")} aria-hidden="true" />
              {d.streak.current ? `${d.streak.current}-day streak` : "No streak yet. Play one game today."} · best {d.streak.longest}
              {accuracy !== null ? ` · ${accuracy}% correct overall` : ""}
            </p>
          </div>
          <div className="flex items-end gap-2" role="img" aria-label={`Breaks in the last 7 days: ${d.week.map((w) => `${w.label} ${w.plays}`).join(", ")}`}>
            {d.week.map((w) => (
              <div key={w.day} className="flex w-8 flex-col items-center gap-1">
                <div className="flex h-16 w-full items-end rounded-md bg-surface-2">
                  <div className="w-full rounded-md bg-brand" style={{ height: `${w.plays ? Math.max(12, (w.plays / top) * 100) : 0}%` }} />
                </div>
                <span className="text-[10px] text-ink-3">{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {d.activities.map((a) => (
          <Card key={a.id} className="flex flex-col p-5">
            <div className="flex items-start gap-3">
              <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", TONE_BG[a.tone])} aria-hidden="true">
                {a.kind === "memory" ? <Brain className="h-5 w-5" /> : a.kind === "breathing" ? <Wind className="h-5 w-5" /> : <Gamepad2 className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-ink">{a.title}</p>
                <Badge tone={a.tone}>{a.tag}</Badge>
              </div>
            </div>
            <p className="mt-3 flex-1 text-sm text-ink-2">{a.description}</p>
            {a.note ? <p className="mt-2 text-xs text-ink-3">{a.note}</p> : null}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-3">
                {a.plays ? (
                  <>
                    <Trophy className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                    {a.kind === "quiz" ? `Best ${a.best}%` : a.kind === "memory" ? `Best level ${a.best}` : `${a.best} min of calm`} · played {a.plays}×
                  </>
                ) : (
                  "Not played yet"
                )}
              </p>
              <Button size="sm" disabled={!a.available} onClick={() => onPlay(a)}>
                Play
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Shell({ title, onExit, children }: { title: string; onExit: () => void; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Button>
      </div>
      {children}
    </div>
  );
}

/* ───────────────────────────── quiz games ───────────────────────────── */
function QuizGame({ activity, onExit }: { activity: QuizActivity; onExit: () => void }) {
  const [round, setRound] = useState<Round | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const start = useMutation({
    mutationFn: () => apiFetch("/api/v1/refresh-zone/rounds", Round, { method: "POST", body: { activity } }),
    onSuccess: (r) => {
      setRound(r);
      setResult(null);
      setError(null);
      setAttempt((n) => n + 1);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not start a round."),
  });
  const submit = useMutation({
    mutationFn: (answers: Record<string, number>) => apiFetch(`/api/v1/refresh-zone/rounds/${encodeURIComponent(round!.id)}/submit`, RoundResult, { method: "POST", body: { answers } }),
    onSuccess: setResult,
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save your score."),
  });

  // Ask for the first round when the page opens (the request is made from the effect's callback chain, not by setting state here).
  useEffect(() => {
    start.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = round?.title ?? (activity === "subject" ? "Subject quiz battle" : activity === "aptitude" ? "Aptitude sprint" : "Vocabulary power");
  return (
    <Shell title={title} onExit={onExit}>
      {error ? (
        <Card className="space-y-3 p-5">
          <p role="alert" className="text-sm text-rose">
            {error}
          </p>
          <Button variant="secondary" onClick={() => start.mutate()}>
            Try again
          </Button>
        </Card>
      ) : result ? (
        <Result result={result} onAgain={() => start.mutate()} onExit={onExit} busy={start.isPending} />
      ) : round && !submit.isPending ? (
        <Questions key={attempt} round={round} onDone={(a) => submit.mutate(a)} />
      ) : (
        <Card className="grid place-items-center p-12">
          <Spinner />
        </Card>
      )}
    </Shell>
  );
}

function Questions({ round, onDone }: { round: Round; onDone: (answers: Record<string, number>) => void }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const q = round.questions[idx]!;
  const choose = (k: number | null) => {
    const next = k === null ? answers : { ...answers, [q.id]: k };
    setAnswers(next);
    if (idx + 1 >= round.questions.length) onDone(next);
    else setIdx(idx + 1);
  };
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between text-sm text-ink-3">
        <span>
          Question {idx + 1} of {round.questions.length}
        </span>
        <Countdown key={q.id} seconds={round.secondsPerQuestion} onTimeout={() => choose(null)} />
      </div>
      <Progress value={(idx / round.questions.length) * 100} label="Round progress" />
      <p className="mt-5 text-lg font-medium text-ink">{q.prompt}</p>
      <div className="mt-4 grid gap-2">
        {q.options.map((o, k) => (
          <button key={k} onClick={() => choose(k)} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-left text-sm text-ink transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-semibold text-ink-3">{LETTERS[k]}</span>
            {o}
          </button>
        ))}
      </div>
      <div className="mt-4 text-right">
        <Button variant="ghost" size="sm" onClick={() => choose(null)}>
          Skip
        </Button>
      </div>
    </Card>
  );
}

function Countdown({ seconds, onTimeout }: { seconds: number; onTimeout: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const tick = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    const done = window.setTimeout(onTimeout, seconds * 1000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, [seconds, onTimeout]);
  return (
    <span className={cn("tabular-nums", left <= 5 && "font-semibold text-rose")} aria-label={`${left} seconds left`}>
      {left}s
    </span>
  );
}

function Result({ result, onAgain, onExit, busy }: { result: RoundResult; onAgain: () => void; onExit: () => void; busy: boolean }) {
  const wrong = result.review.filter((r) => !r.correct);
  return (
    <div className="space-y-4">
      <Card className="p-6 text-center">
        <p className="text-sm text-ink-3">You scored</p>
        <p className="text-5xl font-semibold text-ink">
          {result.score}
          <span className="text-2xl text-ink-3">/{result.total}</span>
        </p>
        <p className="mt-1 text-sm text-ink-2">
          {result.percentage}% · your best is {result.best}%
        </p>
        {result.newBest ? (
          <p className="mt-2">
            <Badge tone="gold">New personal best</Badge>
          </p>
        ) : null}
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={onAgain} disabled={busy}>
            {busy ? <Spinner /> : null} Play again
          </Button>
          <Button variant="secondary" onClick={onExit}>
            Done
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title={wrong.length ? "Review what you missed" : "Perfect round"} subtitle={wrong.length ? `${wrong.length} to look at again` : "Nothing to review."} />
        <CardBody className="space-y-4">
          {wrong.map((r) => (
            <div key={r.id} className="text-sm">
              <p className="font-medium text-ink">{r.prompt}</p>
              <p className="mt-1 flex items-start gap-2 text-rose">
                <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {r.given === null ? "No answer" : `Your answer: ${r.options[r.given]}`}
              </p>
              <p className="mt-1 flex items-start gap-2 text-teal">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {r.options[r.answer]}
              </p>
              {r.explanation ? <p className="mt-1 text-xs text-ink-3">{r.explanation}</p> : null}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

/* ───────────────────────────── memory matrix ───────────────────────────── */
type Phase = "ready" | "show" | "input" | "over" | "won";
const randomCell = () => Math.floor(Math.random() * 9);

function MemoryGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState(1);
  const [seq, setSeq] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [typed, setTyped] = useState(0);
  const [saved, setSaved] = useState<PlayResult | null>(null);
  const report = useMutation({
    mutationFn: (cleared: number) => apiFetch("/api/v1/refresh-zone/memory", PlayResult, { method: "POST", body: { level: cleared } }),
    onSuccess: setSaved,
  });

  useEffect(() => {
    if (phase !== "show") return;
    const timers: number[] = [];
    seq.forEach((cell, i) => {
      timers.push(window.setTimeout(() => setLit(cell), 500 + i * 800));
      timers.push(window.setTimeout(() => setLit(null), 500 + i * 800 + 550));
    });
    timers.push(window.setTimeout(() => setPhase("input"), 500 + seq.length * 800));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [phase, seq]);

  const begin = (lv: number, prev: number[] = []) => {
    setLevel(lv);
    setSeq([...prev, ...Array.from({ length: lv + 2 - prev.length }, randomCell)]);
    setTyped(0);
    setSaved(null);
    setPhase("show");
  };
  const press = (cell: number) => {
    if (phase !== "input") return;
    setLit(cell);
    window.setTimeout(() => setLit(null), 180);
    if (cell !== seq[typed]) {
      setPhase("over");
      report.mutate(level - 1);
      return;
    }
    if (typed + 1 < seq.length) {
      setTyped(typed + 1);
      return;
    }
    if (level >= MAX_MEMORY_LEVEL) {
      setPhase("won");
      report.mutate(level);
      return;
    }
    setPhase("show");
    setTyped(0);
    window.setTimeout(() => begin(level + 1, seq), 600);
  };

  const ended = phase === "over" || phase === "won";
  return (
    <Shell title="Memory matrix" onExit={onExit}>
      <Card className="p-6">
        <p className="text-center text-sm text-ink-2" aria-live="polite">
          {phase === "ready" ? "Watch the squares light up, then repeat the order." : phase === "show" ? `Level ${level}: watch closely…` : phase === "input" ? `Level ${level}: your turn (${typed} of ${seq.length})` : phase === "won" ? "You cleared every level. Impressive." : `Game over. You cleared level ${Math.max(0, level - 1)}.`}
        </p>
        <div className="mx-auto mt-5 grid w-64 grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, i) => (
            <button
              key={i}
              aria-label={`Square ${i + 1}`}
              disabled={phase !== "input"}
              onClick={() => press(i)}
              className={cn("aspect-square rounded-xl border border-line transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand", lit === i ? "bg-brand" : "bg-surface-2", phase === "input" && "hover:bg-brand-soft")}
            />
          ))}
        </div>
        {ended && saved ? <p className="mt-4 text-center text-sm text-ink-2">{saved.newBest ? "New personal best: " : "Your best: level "}{saved.best}</p> : null}
        <div className="mt-5 flex justify-center gap-2">
          {phase === "ready" || ended ? <Button onClick={() => begin(1)}>{ended ? "Play again" : "Start"}</Button> : null}
          {ended ? (
            <Button variant="secondary" onClick={onExit}>
              Done
            </Button>
          ) : null}
        </div>
      </Card>
    </Shell>
  );
}

/* ───────────────────────────── breathing ───────────────────────────── */
const PATTERNS = {
  box: { label: "Box breathing (4-4-4-4)", steps: [["Breathe in", 4], ["Hold", 4], ["Breathe out", 4], ["Hold", 4]] },
  calm: { label: "Calming breath (4-7-8)", steps: [["Breathe in", 4], ["Hold", 7], ["Breathe out", 8]] },
} as const;
type PatternId = keyof typeof PATTERNS;

function breathState(steps: ReadonlyArray<readonly [string, number]>, t: number): { label: string; full: boolean } {
  let at = t % steps.reduce((n, s) => n + s[1], 0);
  for (const [i, [name, secs]] of steps.entries()) {
    if (at < secs) return { label: name, full: name === "Breathe in" || (name === "Hold" && steps[i - 1]?.[0] === "Breathe in") };
    at -= secs;
  }
  return { label: steps[0]![0], full: false };
}

function Breathing({ onExit }: { onExit: () => void }) {
  const [pattern, setPattern] = useState<PatternId>("box");
  const [minutes, setMinutes] = useState(1);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [done, setDone] = useState<PlayResult | null>(null);
  const total = minutes * 60;
  const report = useMutation({
    mutationFn: (seconds: number) => apiFetch("/api/v1/refresh-zone/breathing", PlayResult, { method: "POST", body: { seconds } }),
    onSuccess: setDone,
  });

  const running = elapsed !== null && elapsed < total;
  const { mutate: saveBreak } = report;
  useEffect(() => {
    if (!running) return;
    let n = 0;
    const t = window.setInterval(() => {
      n++;
      setElapsed(n);
      if (n >= total) {
        window.clearInterval(t);
        saveBreak(total);
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [running, total, saveBreak]);

  const { label, full } = breathState(PATTERNS[pattern].steps, elapsed ?? 0);
  const finished = elapsed !== null && elapsed >= total;

  return (
    <Shell title="Breathing break" onExit={onExit}>
      <Card className="p-6 text-center">
        {elapsed === null ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-2">Sit comfortably, relax your shoulders and follow the circle.</p>
            <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Breathing pattern">
              {(Object.keys(PATTERNS) as PatternId[]).map((p) => (
                <button key={p} role="radio" aria-checked={pattern === p} onClick={() => setPattern(p)} className={cn("rounded-full border px-4 py-1.5 text-sm", pattern === p ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2")}>
                  {PATTERNS[p].label}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-2" role="radiogroup" aria-label="Length">
              {[1, 2, 3].map((m) => (
                <button key={m} role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={cn("rounded-full border px-4 py-1.5 text-sm", minutes === m ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2")}>
                  {m} min
                </button>
              ))}
            </div>
            <Button onClick={() => setElapsed(0)}>Begin</Button>
          </div>
        ) : finished ? (
          <div className="space-y-3">
            <p className="text-lg font-medium text-ink">Well done.</p>
            <p className="text-sm text-ink-2">{done ? `${done.best} minutes of calm so far.` : "Saving your break…"}</p>
            <div className="flex justify-center gap-2">
              <Button
                onClick={() => {
                  setElapsed(0);
                  setDone(null);
                }}
              >
                Again
              </Button>
              <Button variant="secondary" onClick={onExit}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto grid h-56 w-56 place-items-center">
              <div className={cn("grid place-items-center rounded-full bg-sky-soft text-sky motion-safe:transition-all motion-safe:duration-[3000ms] motion-safe:ease-in-out", full ? "h-52 w-52" : "h-28 w-28")}>
                <p className="text-lg font-medium" aria-live="polite">
                  {label}
                </p>
              </div>
            </div>
            <p className="text-sm text-ink-3">{Math.max(0, total - (elapsed ?? 0))}s left</p>
            <Button variant="secondary" onClick={() => setElapsed(null)}>
              Stop
            </Button>
          </div>
        )}
      </Card>
    </Shell>
  );
}
