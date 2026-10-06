"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquareQuote, Play, RotateCcw, Send, SkipForward, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ChartView } from "@/components/charts/chart-card";
import { LoadError } from "@/components/ui/load-error";
import { AiLabel, Notice } from "@/components/ui/notices";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Progress, Skeleton, Spinner, inputClass, toneForScore } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { DIMENSIONS, IV_MAX, IV_MIN, IvOverview, IvSession, MAX_ANSWER, type IvMode } from "@/lib/api/interview-schemas";
import { cn } from "@/lib/utils";
import { Modal, problemOf } from "./assignments-shared";

const KEY = ["interview"] as const;
const Ok = z.object({ ok: z.boolean() });
const MODES: Array<{ id: IvMode; label: string; desc: string }> = [
  { id: "technical", label: "Technical", desc: "Your projects, fundamentals and design trade-offs" },
  { id: "hr", label: "HR", desc: "Motivation, fit, strengths and career goals" },
  { id: "behavioral", label: "Behavioural", desc: "Real situations, answered in STAR order" },
];
const modeLabel = (m: IvMode) => MODES.find((x) => x.id === m)?.label ?? m;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function InterviewModule() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/interview", IvOverview), staleTime: 0, refetchOnMount: "always" });
  const [view, setView] = useState<IvSession | null>(null);
  const [seed, setSeed] = useState<{ mode: IvMode; role: string; questions: number } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; title: string } | null>(null);

  const open = async (id: string) => {
    setLoadingId(id);
    setLoadFailed(false);
    try {
      setView(await apiFetch(`/api/v1/interview/sessions/${encodeURIComponent(id)}`, IvSession));
    } catch {
      setLoadFailed(true);
    } finally {
      setLoadingId(null);
    }
  };
  const finished = (s: IvSession) => {
    setView(s);
    void qc.invalidateQueries({ queryKey: KEY });
  };

  if (q.isPending) {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Skeleton className="h-[28rem]" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const o = q.data;
  const trend = [...o.history].reverse().map((h) => ({ name: shortDate(h.finishedAt), Score: h.overall }));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        {view?.scorecard ? (
          <Report
            s={view}
            onBack={() => {
              setView(null);
              setSeed(null);
            }}
            onRetry={() => {
              setSeed({ mode: view.mode, role: view.role, questions: view.total });
              setView(null);
            }}
          />
        ) : o.active ? (
          <Session key={`${o.active.id}-${o.active.turns.length}`} a={o.active} onFinished={finished} />
        ) : (
          <Setup key={seed ? JSON.stringify(seed) : "new"} o={o} seed={seed} />
        )}
        {loadFailed ? (
          <p className="mt-3 text-sm text-rose" role="alert">
            Could not open that interview. Try again.
          </p>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Your interviews" subtitle="Finished interviews only" action={<Badge tone={o.aiLive ? "teal" : "neutral"}>{o.aiLive ? "AI interviewer" : "Built-in questions"}</Badge>} />
          <CardBody className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Completed", String(o.stats.sessions)],
                ["Best score", o.stats.best === null ? "–" : String(o.stats.best)],
                ["Average", o.stats.average === null ? "–" : String(o.stats.average)],
                ["Latest", o.stats.last === null ? "–" : String(o.stats.last)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-surface-2 p-3">
                  <dt className="text-xs text-ink-3">{k}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {trend.length >= 2 ? <ChartView spec={{ type: "line", title: "Score over time", xKey: "name", series: ["Score"], data: trend }} height={160} /> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="History" subtitle="Newest first" />
          <CardBody className="space-y-2">
            {o.history.length === 0 ? (
              <EmptyState title="No interviews yet" body="Finish your first interview and its scorecard will appear here." />
            ) : (
              o.history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
                  <button type="button" onClick={() => void open(h.id)} className="min-w-0 flex-1 text-left" disabled={loadingId !== null}>
                    <p className="truncate text-sm font-medium text-ink">
                      {modeLabel(h.mode)}
                      {h.role ? ` · ${h.role}` : ""}
                    </p>
                    <p className="text-xs text-ink-3">
                      {shortDate(h.finishedAt)} · {h.answered}/{h.total} answered{h.countsForReadiness ? "" : " · not counted"}
                    </p>
                  </button>
                  {loadingId === h.id ? <Spinner /> : <Badge tone={toneForScore(h.overall)}>{h.overall}</Badge>}
                  <button type="button" onClick={() => setRemoving({ id: h.id, title: `${modeLabel(h.mode)} interview` })} className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-rose" aria-label={`Delete ${modeLabel(h.mode)} interview of ${shortDate(h.finishedAt)}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {removing ? (
        <RemoveDialog
          item={removing}
          onClose={() => setRemoving(null)}
          onDone={(id) => {
            setRemoving(null);
            if (view?.id === id) setView(null);
            void qc.invalidateQueries({ queryKey: KEY });
          }}
        />
      ) : null}
    </div>
  );
}

function RemoveDialog({ item, onClose, onDone }: { item: { id: string; title: string }; onClose: () => void; onDone: (id: string) => void }) {
  const del = useMutation({
    mutationFn: () => apiFetch(`/api/v1/interview/sessions/${encodeURIComponent(item.id)}`, Ok, { method: "DELETE" }),
    onSuccess: () => onDone(item.id),
  });
  const { message } = problemOf(del.error, "Could not delete it. Try again.");
  return (
    <Modal title="Delete this interview?" onClose={onClose}>
      <p className="text-sm text-ink-2">The {item.title.toLowerCase()} and its scorecard will be removed from your history. Placement Readiness keeps the score it already counted.</p>
      {message ? (
        <p className="mt-3 text-sm text-rose" role="alert">
          {message}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={() => del.mutate()} disabled={del.isPending}>
          {del.isPending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}

/* ───────────────────────────── setup ───────────────────────────── */
function Setup({ o, seed }: { o: IvOverview; seed: { mode: IvMode; role: string; questions: number } | null }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<IvMode>(seed?.mode ?? "technical");
  const [role, setRole] = useState(seed?.role ?? "");
  const [questions, setQuestions] = useState(seed?.questions ?? 5);
  const start = useMutation({
    mutationFn: () => apiFetch("/api/v1/interview/sessions", IvSession, { method: "POST", timeoutMs: 60_000, body: { mode, role, questions } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
  const { fields, message } = problemOf(start.error, "Could not start the interview. Try again.");

  return (
    <Card>
      <CardHeader title="Start a mock interview" subtitle="One question at a time. Each answer is marked and the next question follows from it." />
      <CardBody>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            start.mutate();
          }}
        >
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Type of interview</p>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Type of interview">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={cn("rounded-xl border p-3 text-left transition", mode === m.id ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line hover:bg-surface-2")}
                >
                  <span className="block text-sm font-semibold text-ink">{m.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Role you are preparing for (optional)" htmlFor="iv-role" error={fields.role} hint="For example: Backend developer, Data analyst, Hospital administrator">
              <input id="iv-role" className={inputClass} value={role} maxLength={60} onChange={(e) => setRole(e.target.value)} />
            </Field>
            <Field label="Questions" htmlFor="iv-count" error={fields.questions}>
              <select id="iv-count" className={inputClass} value={questions} onChange={(e) => setQuestions(Number(e.target.value))}>
                {Array.from({ length: IV_MAX - IV_MIN + 1 }, (_, i) => IV_MIN + i).map((n) => (
                  <option key={n} value={n}>
                    {n} questions
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">
            {o.context.hasResume ? (
              <p>
                Questions are based on your saved resume
                {o.context.projects.length ? ` (projects: ${o.context.projects.slice(0, 3).join(", ")})` : ""} and this semester&apos;s subjects.
              </p>
            ) : (
              <p>
                Questions are based on this semester&apos;s subjects. <Link href="/student/resume" className="font-medium text-brand underline">Save your resume</Link> and the interviewer will ask about your own projects too.
              </p>
            )}
          </div>

          {!o.aiLive ? <Notice tone="amber">The AI interviewer is off, so questions come from a built-in bank and answers are scored from the text only (length, structure, filler words). Correctness is not checked.</Notice> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={start.isPending}>
              {start.isPending ? <Spinner /> : <Play className="size-4" />} {start.isPending ? "Preparing your first question…" : "Start mock interview"}
            </Button>
            {o.stats.sessions > 0 ? <span className="text-xs text-ink-3">Your best so far: {o.stats.best}</span> : null}
          </div>
          {message ? (
            <p className="text-sm text-rose" role="alert">
              {message}
            </p>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}

/* ───────────────────────────── a running interview ───────────────────────────── */
function Session({ a, onFinished }: { a: IvSession; onFinished: (s: IvSession) => void }) {
  const qc = useQueryClient();
  const cur = a.turns[a.turns.length - 1]!;
  const prev = [...a.turns].reverse().find((t) => t.n < cur.n && (t.answer !== null || t.skipped));
  const answered = a.turns.filter((t) => t.answer !== null || t.skipped).length;
  const [answer, setAnswer] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));

  const send = useMutation({
    mutationFn: (skip: boolean) =>
      apiFetch(`/api/v1/interview/sessions/${encodeURIComponent(a.id)}/answer`, IvSession, {
        method: "POST",
        timeoutMs: 75_000,
        body: { n: cur.n, answer: skip ? "" : answer.trim(), skip, seconds: Math.min(3600, Math.round((Date.now() - startedAt) / 1000)) },
      }),
    onSuccess: (s) => {
      if (s.status === "done") onFinished(s);
      else void qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const end = useMutation({
    mutationFn: () => apiFetch(`/api/v1/interview/sessions/${encodeURIComponent(a.id)}/end`, IvOverview, { method: "POST", body: {} }),
    onSuccess: async () => {
      setConfirmEnd(false);
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const sendProblem = problemOf(send.error, "Could not send your answer. Try again.");
  const endProblem = problemOf(end.error, "Could not end the interview. Try again.");
  const busy = send.isPending || end.isPending;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader
          title={`Question ${cur.n} of ${a.total}`}
          subtitle={`${modeLabel(a.mode)} interview${a.role ? ` · ${a.role}` : ""}`}
          action={cur.kind === "follow-up" ? <Badge tone="gold">Follow-up</Badge> : undefined}
        />
        <CardBody className="space-y-4">
          <div className="flex gap-3 rounded-xl bg-brand-soft p-4">
            <MessageSquareQuote className="size-5 shrink-0 text-brand" aria-hidden />
            <p className="text-base font-medium text-ink">{cur.question}</p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (answer.trim()) send.mutate(false);
            }}
          >
            <label htmlFor="iv-answer" className="sr-only">
              Your answer
            </label>
            <textarea
              id="iv-answer"
              rows={8}
              maxLength={MAX_ANSWER}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={busy}
              className={cn(inputClass, "leading-relaxed")}
              placeholder="Type your answer as you would say it…"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs tabular-nums text-ink-3">
                {answer.length}/{MAX_ANSWER} · {clock(seconds)} on this question
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => send.mutate(true)} disabled={busy}>
                  <SkipForward className="size-4" /> Skip
                </Button>
                <Button type="submit" disabled={!answer.trim() || busy}>
                  {send.isPending ? <Spinner /> : <Send className="size-4" />} {send.isPending ? "Marking…" : cur.n >= a.total ? "Finish interview" : "Submit answer"}
                </Button>
              </div>
            </div>
            {sendProblem.message ? (
              <p className="text-sm text-rose" role="alert">
                {sendProblem.message}
              </p>
            ) : null}
          </form>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card className="space-y-3 p-5">
          <Progress value={(answered / a.total) * 100} label="Interview progress" />
          <p className="text-xs text-ink-3">
            {answered} of {a.total} answered
          </p>
          <Button variant="secondary" size="sm" onClick={() => setConfirmEnd(true)} disabled={busy || answered === 0}>
            <Square className="size-4" /> End and see my scorecard
          </Button>
          {answered === 0 ? <p className="text-xs text-ink-3">Answer at least one question to end early.</p> : null}
        </Card>
        {prev ? (
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">Feedback on your last answer</p>
            <p className="mt-1 text-sm text-ink-2">{prev.feedback}</p>
            {prev.scores ? <DimChips scores={prev.scores} /> : null}
            {prev.byAi ? <AiLabel className="mt-3" /> : null}
          </Card>
        ) : null}
      </div>

      {confirmEnd ? (
        <Modal title="End the interview now?" onClose={() => setConfirmEnd(false)}>
          <p className="text-sm text-ink-2">
            You have answered {answered} of {a.total} questions. Your scorecard will use only those answers.
            {answered < Math.ceil(a.total / 2) ? " Because that is fewer than half, it will not count towards Placement Readiness." : ""}
          </p>
          {endProblem.message ? (
            <p className="mt-3 text-sm text-rose" role="alert">
              {endProblem.message}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
              Keep going
            </Button>
            <Button onClick={() => end.mutate()} disabled={end.isPending}>
              {end.isPending ? "Ending…" : "End interview"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function DimChips({ scores }: { scores: Record<string, number> }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {DIMENSIONS.filter((d) => scores[d] !== undefined).map((d) => (
        <Badge key={d} tone={toneForScore(scores[d]!)}>
          {d} {scores[d]}
        </Badge>
      ))}
    </div>
  );
}

/* ───────────────────────────── scorecard ───────────────────────────── */
function Report({ s, onBack, onRetry }: { s: IvSession; onBack: () => void; onRetry: () => void }) {
  const sc = s.scorecard!;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw className="size-4" /> Practise again
        </Button>
      </div>

      {sc.endedEarly ? <Notice tone="amber">{sc.countsForReadiness ? "You ended this interview early, so the scorecard covers only the answers you gave." : "You ended this interview before half the questions, so it is shown here but not counted towards Placement Readiness."}</Notice> : null}
      {!sc.aiMarked ? <Notice tone="sky">These marks come from the text only (length, structure, filler words, hedging). Technical correctness was not checked.</Notice> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-6">
          <p className="text-sm text-ink-3">
            Interview readiness · {modeLabel(s.mode)}
            {s.role ? ` · ${s.role}` : ""}
          </p>
          <p className="mt-1 font-serif text-5xl font-semibold text-ink">{sc.overall}</p>
          <Progress value={sc.overall} tone={toneForScore(sc.overall)} className="mt-3" label="Overall" />
          <p className="mt-4 text-sm text-ink-2">{sc.summary}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-sm font-semibold text-teal">Strong areas</p>
              {sc.strengths.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {sc.strengths.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">Nothing stood out yet. Keep practising.</p>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-amber">Recommended practice</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                {sc.improvements.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
          {sc.aiMarked ? <AiLabel className="mt-5" /> : null}
          <p className="mt-3 text-xs text-ink-3">Confidence indicators are coaching hints counted from your wording, not a judgement about you.</p>
        </Card>
        <Card>
          <CardHeader title="Dimensions" />
          <div className="px-3 pb-4">
            <ChartView spec={{ type: "radar", title: "Interview dimensions", xKey: "name", series: ["Score"], data: sc.dimensions.map((d) => ({ name: d.name, Score: d.score })) }} height={300} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Transcript & feedback" subtitle={`${sc.answered} of ${s.total} answered`} />
        <CardBody className="space-y-4">
          {s.turns.map((t) => (
            <div key={t.n} className="rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-ink">
                Q{t.n}. {t.question}
              </p>
              {t.skipped ? <p className="mt-2 text-sm italic text-ink-3">Skipped</p> : <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{t.answer}</p>}
              {t.feedback ? <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">{t.feedback}</p> : null}
              {t.scores ? <DimChips scores={t.scores} /> : null}
              {t.seconds > 0 && !t.skipped ? <p className="mt-2 text-xs text-ink-3">Answered in {clock(t.seconds)}</p> : null}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
