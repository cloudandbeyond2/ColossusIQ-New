"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flag, Mic, RotateCcw, SkipForward, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Progress, Skeleton, Spinner, inputClass, toneForScore } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { MAX_ANSWER, MAX_QUESTIONS, MIN_QUESTIONS, VIVA_LEVELS, VIVA_MODES, VivaOverview, VivaSession, type VivaLevel, type VivaMode } from "@/lib/api/viva-schemas";
import { cn } from "@/lib/utils";
import { Modal, problemOf } from "./assignments-shared";

const KEY = ["viva"] as const;
const Ok = z.object({ ok: z.boolean() });
const MODE_HELP: Record<VivaMode, string> = {
  Subject: "Questions from one of your own subjects and its syllabus units.",
  Project: "The examiner questions you about your own project, like a project review.",
  Technical: "Any technical topic you choose, for interview-style questions.",
};
const LEVEL_HELP: Record<VivaLevel, string> = {
  Friendly: "Fundamentals, with hints in the feedback.",
  Standard: "A normal university viva.",
  Tough: "Probing: reasons, edge cases and trade-offs.",
};
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const scoreTone = (n: number) => toneForScore(n * 10);

export function VivaModule() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/viva", VivaOverview), staleTime: 0, refetchOnMount: "always" });
  const [view, setView] = useState<VivaSession | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; title: string } | null>(null);
  const [seed, setSeed] = useState<VivaSession["setup"] | null>(null);

  const open = async (id: string) => {
    setLoadingId(id);
    setLoadFailed(false);
    try {
      setView(await apiFetch(`/api/v1/viva/sessions/${encodeURIComponent(id)}`, VivaSession));
    } catch {
      setLoadFailed(true);
    } finally {
      setLoadingId(null);
    }
  };
  const finished = (s: VivaSession) => {
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

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        {view ? (
          <Report
            s={view}
            onBack={() => {
              setView(null);
              setSeed(null);
            }}
            onRetry={() => {
              setSeed(view.setup);
              setView(null);
            }}
          />
        ) : o.active ? (
          <Session key={`${o.active.id}-${o.active.turns.length}`} a={o.active} onFinished={finished} />
        ) : (
          <Setup key={seed ? JSON.stringify(seed) : "new"} o={o} seed={seed} />
        )}
        {loadFailed ? <p className="mt-3 text-sm text-rose-600" role="alert">Could not open that viva. Try again.</p> : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Your vivas" subtitle="Only completed vivas are counted" action={<Badge tone={o.aiLive ? "teal" : "neutral"}>{o.aiLive ? "AI examiner" : "Built-in questions"}</Badge>} />
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Completed", String(o.stats.sessions)],
                ["Best score", o.stats.best === null ? "–" : `${o.stats.best}%`],
                ["Average", o.stats.average === null ? "–" : `${o.stats.average}%`],
                ["Latest", o.stats.last === null ? "–" : `${o.stats.last}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-surface-2 p-3">
                  <dt className="text-xs text-ink-3">{k}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="History" subtitle="Newest first" />
          <CardBody className="space-y-2">
            {o.history.length === 0 ? (
              <EmptyState title="No vivas yet" body="Finish your first viva and it will appear here with its report." />
            ) : (
              o.history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
                  <button type="button" onClick={() => void open(h.id)} className="min-w-0 flex-1 text-left" disabled={loadingId !== null}>
                    <p className="truncate text-sm font-medium text-ink">{h.title}</p>
                    <p className="text-xs text-ink-3">
                      {h.mode} · {h.level} · {shortDate(h.finishedAt)} · {h.answered}/{h.total} answered
                    </p>
                  </button>
                  {loadingId === h.id ? <Spinner /> : <Badge tone={h.score === null ? "neutral" : toneForScore(h.score)}>{h.score === null ? "Not marked" : `${h.score}%`}</Badge>}
                  <button type="button" onClick={() => setRemoving({ id: h.id, title: h.title })} className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-rose-600" aria-label={`Delete ${h.title}`}>
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
    mutationFn: () => apiFetch(`/api/v1/viva/sessions/${encodeURIComponent(item.id)}`, Ok, { method: "DELETE" }),
    onSuccess: () => onDone(item.id),
  });
  const { message } = problemOf(del.error, "Could not delete it. Try again.");
  return (
    <Modal title="Delete this viva?" onClose={onClose}>
      <p className="text-sm text-ink-2">“{item.title}” and its report will be removed from your history. This cannot be undone.</p>
      {message ? <p className="mt-3 text-sm text-rose-600" role="alert">{message}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={() => del.mutate()} disabled={del.isPending}>{del.isPending ? "Deleting…" : "Delete"}</Button>
      </div>
    </Modal>
  );
}

/* ───────────────────────────── setup ───────────────────────────── */
function Setup({ o, seed }: { o: VivaOverview; seed: VivaSession["setup"] | null }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    mode: (seed?.mode ?? "Subject") as VivaMode,
    level: (seed?.level ?? "Standard") as VivaLevel,
    questions: seed?.questions ?? 5,
    subject: seed?.subject ?? o.subjects[0]?.code ?? "",
    topic: seed?.topic ?? "",
    brief: seed?.brief ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const pickMode = (m: VivaMode) => setF((x) => ({ ...x, mode: m, topic: m === "Project" && !x.topic ? o.project.name : x.topic }));

  const start = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/viva/sessions", VivaSession, {
        method: "POST",
        timeoutMs: 60_000,
        body: { mode: f.mode, level: f.level, questions: f.questions, subject: f.mode === "Project" ? "" : f.subject, topic: f.topic, brief: f.mode === "Project" ? f.brief : "" },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
  const { fields, message } = problemOf(start.error, "Could not start the viva. Try again.");
  const unit = o.subjects.find((s) => s.code === f.subject);

  return (
    <Card>
      <CardHeader title="Start a viva" subtitle="Answer one question at a time, like a real examiner sitting across from you" />
      <CardBody>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            start.mutate();
          }}
        >
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Type of viva</p>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Type of viva">
              {VIVA_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={f.mode === m}
                  onClick={() => pickMode(m)}
                  className={cn("rounded-xl border p-3 text-left transition", f.mode === m ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-line hover:bg-surface-2")}
                >
                  <span className="block text-sm font-semibold text-ink">{m}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">{MODE_HELP[m]}</span>
                </button>
              ))}
            </div>
          </div>

          {f.mode !== "Project" ? (
            <Field label={f.mode === "Subject" ? "Subject" : "Subject (optional)"} htmlFor="viva-subject" error={fields.subject}>
              <select id="viva-subject" className={inputClass} value={f.subject} onChange={(e) => set("subject", e.target.value)}>
                {f.mode === "Technical" ? <option value="">No particular subject</option> : null}
                {o.subjects.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field
            label={f.mode === "Project" ? "Project title" : f.mode === "Subject" ? "Focus on a unit (optional)" : "Topic"}
            htmlFor="viva-topic"
            error={fields.topic}
            hint={f.mode === "Subject" && unit ? `Units: ${unit.units.slice(0, 5).join(", ")}` : undefined}
          >
            <input id="viva-topic" className={inputClass} value={f.topic} maxLength={120} onChange={(e) => set("topic", e.target.value)} placeholder={f.mode === "Project" ? "Your project's name" : f.mode === "Technical" ? "e.g. REST APIs, SQL indexing, React hooks" : "Leave blank to cover the whole subject"} />
          </Field>

          {f.mode === "Project" ? (
            <Field label="What does it do? (optional)" htmlFor="viva-brief" error={fields.brief} hint="A few sentences help the examiner ask about your real project, not a generic one.">
              <textarea id="viva-brief" className={cn(inputClass, "min-h-24")} value={f.brief} maxLength={600} onChange={(e) => set("brief", e.target.value)} />
            </Field>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Level" htmlFor="viva-level" hint={LEVEL_HELP[f.level]}>
              <select id="viva-level" className={inputClass} value={f.level} onChange={(e) => set("level", e.target.value as VivaLevel)}>
                {VIVA_LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Number of questions" htmlFor="viva-n" error={fields.questions}>
              <select id="viva-n" className={inputClass} value={f.questions} onChange={(e) => set("questions", Number(e.target.value))}>
                {Array.from({ length: MAX_QUESTIONS - MIN_QUESTIONS + 1 }, (_, i) => MIN_QUESTIONS + i).map((n) => (
                  <option key={n} value={n}>
                    {n} questions
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <p className="text-xs text-ink-3">
            {o.aiLive
              ? "The AI examiner marks each answer out of 10 and may ask follow-ups. AI marks are practice feedback, not an official grade, so check important points with your faculty."
              : "The AI examiner is off right now. You will get questions from your syllabus, but answers will not be marked."}
          </p>
          {message ? <p className="text-sm text-rose-600" role="alert">{message}</p> : null}
          <Button type="submit" disabled={start.isPending || (f.mode === "Subject" && !f.subject)}>
            {start.isPending ? (
              <>
                <Spinner /> Preparing your examiner…
              </>
            ) : (
              <>
                <Mic className="size-4" /> Start viva
              </>
            )}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

/* ───────────────────────────── a viva in progress ───────────────────────────── */
function Session({ a, onFinished }: { a: VivaSession; onFinished: (s: VivaSession) => void }) {
  const qc = useQueryClient();
  const cur = a.turns[a.turns.length - 1]!;
  const done = a.turns.filter((t) => t.n < cur.n);
  const [text, setText] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);

  const send = useMutation({
    mutationFn: (skip: boolean) => apiFetch(`/api/v1/viva/sessions/${encodeURIComponent(a.id)}/answer`, VivaSession, { method: "POST", timeoutMs: 90_000, body: { n: cur.n, answer: skip ? "" : text.trim(), skip } }),
    onSuccess: (s) => {
      if (s.status === "done") onFinished(s);
      else void qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const end = useMutation({
    mutationFn: async () => {
      const o = await apiFetch(`/api/v1/viva/sessions/${encodeURIComponent(a.id)}/end`, VivaOverview, { method: "POST" });
      const h = o.history.find((x) => x.id === a.id);
      return h ? apiFetch(`/api/v1/viva/sessions/${encodeURIComponent(a.id)}`, VivaSession) : null;
    },
    onSuccess: (s) => {
      setConfirmEnd(false);
      if (s) onFinished(s);
      else void qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const { fields, message } = problemOf(send.error, "Could not send your answer. Try again.");
  const busy = send.isPending || end.isPending;
  const pct = Math.round((done.length / a.total) * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{a.title}</p>
              <p className="text-xs text-ink-3">
                {a.mode} viva · {a.level}
                {a.aiLive ? "" : " · answers are not marked"}
              </p>
            </div>
            <Badge tone="brand">
              Question {cur.n} of {a.total}
            </Badge>
          </div>
          <Progress value={pct} label="Viva progress" />
        </CardBody>
      </Card>

      {done.map((t) => (
        <Card key={t.n}>
          <CardBody className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-ink">
                <span className="mr-2 text-ink-3">Q{t.n}</span>
                {t.question}
              </p>
              {t.score === null ? null : <Badge tone={scoreTone(t.score)}>{t.score}/10</Badge>}
            </div>
            <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm text-ink-2">{t.skipped ? "You skipped this question." : t.answer}</p>
            {t.feedback && !t.skipped ? <p className="whitespace-pre-wrap text-sm text-ink-2">{t.feedback}</p> : null}
          </CardBody>
        </Card>
      ))}

      <Card className="border-brand/40">
        <CardBody className="space-y-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Badge tone={cur.kind === "follow-up" ? "gold" : "brand"}>{cur.kind === "follow-up" ? "Follow-up" : "Examiner"}</Badge>
              <span className="text-xs text-ink-3">Question {cur.n}</span>
            </div>
            <p className="text-base font-medium leading-relaxed text-ink">{cur.question}</p>
          </div>
          <Field label="Your answer" htmlFor="viva-answer" error={fields.answer} hint={`${text.length}/${MAX_ANSWER} · Ctrl+Enter to send`}>
            <textarea
              id="viva-answer"
              className={cn(inputClass, "min-h-36")}
              value={text}
              maxLength={MAX_ANSWER}
              disabled={busy}
              placeholder="Answer as you would out loud: define it, give an example, say why."
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim() && !busy) send.mutate(false);
              }}
            />
          </Field>
          {message ? <p className="text-sm text-rose-600" role="alert">{message}</p> : null}
          {end.isError ? <p className="text-sm text-rose-600" role="alert">Could not end the viva. Try again.</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => send.mutate(false)} disabled={busy || !text.trim()}>
              {send.isPending ? (
                <>
                  <Spinner /> {a.aiLive ? "The examiner is marking your answer…" : "Sending…"}
                </>
              ) : cur.n >= a.total ? (
                "Submit and finish"
              ) : (
                "Submit answer"
              )}
            </Button>
            <Button variant="secondary" onClick={() => send.mutate(true)} disabled={busy}>
              <SkipForward className="size-4" /> Skip
            </Button>
            <Button variant="ghost" onClick={() => setConfirmEnd(true)} disabled={busy} className="ml-auto">
              <Flag className="size-4" /> End viva
            </Button>
          </div>
        </CardBody>
      </Card>

      {confirmEnd ? (
        <Modal title="End this viva?" onClose={() => setConfirmEnd(false)}>
          <p className="text-sm text-ink-2">
            {done.length > 0 ? `You have answered ${done.length} of ${a.total} questions. You will get a report for those.` : "You have not answered any question yet, so nothing will be saved."}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmEnd(false)}>Keep going</Button>
            <Button variant="danger" onClick={() => end.mutate()} disabled={end.isPending}>{end.isPending ? "Ending…" : "End viva"}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── the report ───────────────────────────── */
function Report({ s, onBack, onRetry }: { s: VivaSession; onBack: () => void; onRetry: () => void }) {
  const r = s.report;
  const list = (title: string, items: string[]) =>
    items.length === 0 ? null : (
      <div>
        <h4 className="mb-1 text-sm font-semibold text-ink">{title}</h4>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={s.title} subtitle={`${s.mode} viva · ${s.level} · ${s.finishedAt ? shortDate(s.finishedAt) : ""}`} action={<Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Back</Button>} />
        <CardBody className="space-y-5">
          {r ? (
            <>
              <div className="flex flex-wrap items-center gap-5">
                <div>
                  <p className="text-xs text-ink-3">Overall</p>
                  <p className="text-4xl font-semibold tabular-nums text-ink">{r.overall === null ? "–" : `${r.overall}%`}</p>
                </div>
                <div className="min-w-48 flex-1 space-y-1">
                  <Badge tone={r.overall === null ? "neutral" : toneForScore(r.overall)}>{r.verdict}</Badge>
                  {r.overall === null ? null : <Progress value={r.overall} label="Overall score" />}
                  <p className="text-xs text-ink-3">
                    {r.answered} of {s.total} answered · {r.marked} marked
                  </p>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink-2">{r.summary}</p>
              <div className="grid gap-5 md:grid-cols-2">
                {list("What went well", r.strengths)}
                {list("What to improve", r.improvements)}
              </div>
              {list("Topics to revise", r.revise)}
              <p className="text-xs text-ink-3">Marks are the plain average of the marks the examiner gave each answer. They are practice feedback, not an official grade.</p>
            </>
          ) : (
            <p className="text-sm text-ink-2">This viva has no report.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onBack}>New viva</Button>
            <Button variant="secondary" onClick={onRetry}>
              <RotateCcw className="size-4" /> Same setup again
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Question by question" />
        <CardBody className="space-y-2">
          {s.turns.map((t) => (
            <details key={t.n} className="rounded-lg border border-line p-3">
              <summary className="flex cursor-pointer items-start justify-between gap-3 text-sm font-medium text-ink">
                <span>
                  <span className="mr-2 text-ink-3">Q{t.n}</span>
                  {t.question}
                </span>
                {t.score === null ? null : <Badge tone={scoreTone(t.score)}>{t.score}/10</Badge>}
              </summary>
              <div className="mt-3 space-y-2">
                <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm text-ink-2">{t.skipped ? "You skipped this question." : t.answer}</p>
                {t.feedback && !t.skipped ? <p className="whitespace-pre-wrap text-sm text-ink-2">{t.feedback}</p> : null}
              </div>
            </details>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
