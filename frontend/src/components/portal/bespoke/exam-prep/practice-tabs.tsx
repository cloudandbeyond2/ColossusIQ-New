"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpenText, CheckCircle2, Clock, Flame, Timer } from "lucide-react";
import { useState } from "react";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Progress, Skeleton } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { DailyStatus, EnglishHome, GROUP_LABEL, MockList, TopicList } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";
import { accTone, PREP_KEY, type TabProps } from "./shared";

const Loading = () => (
  <div className="space-y-4">
    <Skeleton className="h-32" />
    <Skeleton className="h-64" />
  </div>
);

/* ───────────────────────────── daily aptitude test ───────────────────────────── */
export function DailyTab({ start }: TabProps) {
  const q = useQuery({ queryKey: [...PREP_KEY, "daily"], queryFn: () => apiFetch("/api/v1/exam-prep/daily", DailyStatus), staleTime: 0, refetchOnMount: "always" });
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm text-ink-3">{new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
            <p className="text-2xl font-semibold text-ink">Daily aptitude test</p>
            <p className="mt-1 text-sm text-ink-2">
              {d.questions} questions in {d.minutes} minutes: quantitative aptitude, reasoning and English. Everyone in your college gets the same test today, so you can compare notes after.
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
              <Flame className={cn("h-4 w-4", d.streak.current ? "text-amber" : "text-ink-3")} aria-hidden="true" />
              {d.streak.current ? `${d.streak.current}-day test streak` : "No streak yet"} · best {d.streak.longest}
            </p>
          </div>
          <div className="text-center">
            {d.done ? (
              <div className="space-y-1">
                <CheckCircle2 className="mx-auto h-10 w-10 text-teal" aria-hidden="true" />
                <p className="font-medium text-ink">Done for today</p>
                {d.last ? (
                  <p className="text-sm text-ink-2">
                    {d.last.score}/{d.last.max} · {d.last.percentage}%{d.last.percentile !== null ? ` · better than ${d.last.percentile}%` : ""}
                  </p>
                ) : null}
                <p className="text-xs text-ink-3">A new test opens at midnight.</p>
              </div>
            ) : (
              <Button size="lg" onClick={() => start("/api/v1/exam-prep/daily/start")}>
                <Timer className="h-5 w-5" aria-hidden="true" /> Start today&apos;s test
              </Button>
            )}
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Last 14 days" subtitle="Your score in each daily test." />
        <CardBody>
          <div className="flex items-end gap-1.5 overflow-x-auto" role="img" aria-label={`Daily test scores: ${d.history.map((h) => `${h.label} ${h.percentage ?? "missed"}`).join(", ")}`}>
            {d.history.map((h) => (
              <div key={h.day} className="flex w-8 shrink-0 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-ink-3">{h.percentage ?? ""}</span>
                <div className="flex h-24 w-full items-end rounded-md bg-surface-2">
                  {h.percentage !== null ? <div className={cn("w-full rounded-md", h.percentage >= 70 ? "bg-teal" : h.percentage >= 40 ? "bg-amber" : "bg-rose")} style={{ height: `${Math.max(6, h.percentage)}%` }} /> : null}
                </div>
                <span className="text-[10px] text-ink-3">{h.label}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ───────────────────────────── topic practice ───────────────────────────── */
export function PracticeTab({ start, study }: TabProps) {
  const q = useQuery({ queryKey: [...PREP_KEY, "topics"], queryFn: () => apiFetch("/api/v1/exam-prep/topics", TopicList) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-2">Study a topic&apos;s notes, then take a 10-question drill with explanations. Your accuracy per topic feeds your weak-topic list, syllabus tracker and readiness.</p>
      {q.data.families.map((f) => (
        <Card key={f.family}>
          <CardHeader title={f.family} />
          <CardBody>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {f.topics.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                    <p className="text-xs text-ink-3">
                      {t.items}
                      {t.answered ? ` · ${t.answered} answered` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {t.accuracy !== null ? <Badge tone={accTone(t.accuracy)}>{t.accuracy}%</Badge> : null}
                    <Button size="sm" variant="ghost" onClick={() => study(t.id)}>
                      Study
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => start("/api/v1/exam-prep/practice", { topicId: t.id }, "Another drill")}>
                      Practise
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/* ───────────────────────────── practice mocks ───────────────────────────── */
export function MocksTab({ start }: TabProps) {
  const q = useQuery({ queryKey: [...PREP_KEY, "mocks"], queryFn: () => apiFetch("/api/v1/exam-prep/mocks", MockList) });
  const [all, setAll] = useState(false);
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const mocks = [...q.data.mocks].sort((a, b) => Number(b.isTarget) - Number(a.isTarget));
  const shown = all ? mocks : mocks.filter((m) => m.isTarget || m.attempts > 0).length ? mocks.filter((m) => m.isTarget || m.attempts > 0) : mocks.slice(0, 6);
  return (
    <div className="space-y-5">
      <Card className="flex items-start gap-3 p-4 text-sm text-ink-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <p>Every mock follows the exam&apos;s real sections and marking, including negative marking. Choose a <strong>short mock</strong> (up to 10 questions per section, time scaled) for daily practice, or a <strong>full-length mock</strong> with the real paper&apos;s size and time before the exam. Your result shows section scores, accuracy and where you stand among classmates.</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((m) => (
          <Card key={m.examId} className={cn("flex flex-col p-5", m.isTarget && "ring-2 ring-brand")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{m.name}</p>
                <p className="text-xs text-ink-3">{GROUP_LABEL[m.group]}</p>
              </div>
              {m.isTarget ? <Badge tone="brand">Target</Badge> : null}
            </div>
            <p className="mt-2 flex-1 text-sm text-ink-2">{m.negative ? "Negative marking as in the real exam" : "No negative marking"}</p>
            <p className="mt-1 text-xs text-ink-3">{m.attempts ? `${m.attempts} attempt${m.attempts > 1 ? "s" : ""} · best ${m.best}%` : "Not attempted yet"}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button size="sm" variant="secondary" onClick={() => start(`/api/v1/exam-prep/mocks/${encodeURIComponent(m.examId)}/start`, { length: "short" }, "Take another mock")}>
                Short · {m.questions} Qs · {m.minutes} min
              </Button>
              <Button size="sm" onClick={() => start(`/api/v1/exam-prep/mocks/${encodeURIComponent(m.examId)}/start`, { length: "full" }, "Take another full mock")}>
                Full · {m.full.questions} Qs · {m.full.minutes} min
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {!all && shown.length < mocks.length ? (
        <div className="text-center">
          <Button variant="secondary" onClick={() => setAll(true)}>
            Show all {mocks.length} exams
          </Button>
        </div>
      ) : null}
      <Card>
        <CardHeader title="Your recent mocks" />
        <CardBody>
          {!q.data.history.length ? (
            <EmptyState title="No mocks yet" body="Take your first practice mock to see your scores here." />
          ) : (
            <ul className="divide-y divide-line">
              {q.data.history.map((h) => (
                <li key={h.at} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-ink">
                    {h.name} <span className="text-xs text-ink-3">· {new Date(h.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </span>
                  <span className="flex w-40 items-center gap-2">
                    <Progress value={Math.max(0, h.percentage)} tone={h.percentage >= 60 ? "teal" : h.percentage >= 35 ? "amber" : "rose"} label={`${h.name} score`} />
                    <span className="w-10 text-right tabular-nums text-ink-2">{h.percentage}%</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ───────────────────────────── English ───────────────────────────── */
export function EnglishTab({ start }: TabProps) {
  const q = useQuery({ queryKey: [...PREP_KEY, "english"], queryFn: () => apiFetch("/api/v1/exam-prep/english", EnglishHome) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const w = q.data.word;
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <p className="flex items-center gap-2 text-sm text-ink-3">
          <BookOpenText className="h-4 w-4" aria-hidden="true" /> Word of the day
        </p>
        <p className="mt-1 text-3xl font-semibold text-ink">{w.word}</p>
        <p className="mt-1 text-ink-2">{w.meaning}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {w.synonym ? <Badge tone="teal">Similar: {w.synonym}</Badge> : null}
          {w.antonym ? <Badge tone="rose">Opposite: {w.antonym}</Badge> : null}
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {q.data.kinds.map((k) => (
          <Card key={k.id} className="flex flex-col p-5">
            <p className="font-medium text-ink">{k.title}</p>
            <p className="mt-1 flex-1 text-sm text-ink-2">{k.description}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-ink-3">{k.accuracy !== null ? `${k.accuracy}% of ${k.answered}` : "Not tried yet"}</span>
              <Button size="sm" variant="secondary" onClick={() => start("/api/v1/exam-prep/english/rounds", { kind: k.id }, "Another round")}>
                Start
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
