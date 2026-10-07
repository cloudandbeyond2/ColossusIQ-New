"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Circle, Flame, Target, TrendingDown } from "lucide-react";
import { useState } from "react";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, inputClass, Progress, Skeleton } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { PrepOverview, type Target as TargetT } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";
import { accTone, EligibilityBadge, PREP_KEY, type TabProps } from "./shared";

export const useOverview = () => useQuery({ queryKey: [...PREP_KEY, "overview"], queryFn: () => apiFetch("/api/v1/exam-prep", PrepOverview), staleTime: 0, refetchOnMount: "always" });

export function useSaveTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targets: TargetT[]) => apiFetch("/api/v1/exam-prep/targets", PrepOverview, { method: "PUT", body: { targets } }),
    onSuccess: (o) => {
      qc.setQueryData([...PREP_KEY, "overview"], o);
      void qc.invalidateQueries({ queryKey: PREP_KEY });
    },
  });
}

export function PlanTab({ start, go }: TabProps) {
  const q = useOverview();
  const save = useSaveTargets();
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  if (q.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const current: TargetT[] = d.targets.map((t) => ({ examId: t.examId, date: t.date }));
  const top = Math.max(1, ...d.week.map((w) => w.rounds + (w.daily ? 1 : 0)));
  const saveDate = (examId: string) =>
    save.mutate(
      current.map((t) => (t.examId === examId ? { ...t, date: date || null } : t)),
      { onSuccess: () => setEditing(null), onError: (e) => setSaveError(e instanceof ApiError ? e.message : "Could not save the date.") }
    );

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-ink-3">
              {d.profile.degree} · {d.profile.year}
            </p>
            <p className="text-xl font-semibold text-ink">Your exam preparation guide</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-2">
              <Flame className={cn("h-4 w-4", d.streak.current ? "text-amber" : "text-ink-3")} aria-hidden="true" />
              {d.streak.current ? `${d.streak.current}-day practice streak` : "Start a streak today"} · best {d.streak.longest}
              {d.totals.accuracy !== null ? ` · ${d.totals.accuracy}% accuracy over ${d.totals.answered} questions` : ""}
            </p>
          </div>
          <div className="flex items-end gap-1.5" role="img" aria-label={`Practice in the last 7 days: ${d.week.map((w) => `${w.label} ${w.rounds + (w.daily ? 1 : 0)}`).join(", ")}`}>
            {d.week.map((w) => {
              const n = w.rounds + (w.daily ? 1 : 0);
              return (
                <div key={w.day} className="flex w-7 flex-col items-center gap-1">
                  <div className="flex h-14 w-full items-end rounded-md bg-surface-2">
                    <div className={cn("w-full rounded-md", w.daily ? "bg-brand" : "bg-brand/50")} style={{ height: `${n ? Math.max(14, (n / top) * 100) : 0}%` }} />
                  </div>
                  <span className="text-[10px] text-ink-3">{w.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="My target exams"
            subtitle="Up to 3. Enter the exam date you are aiming for, from the official notification."
            action={
              <Button size="sm" variant="secondary" onClick={() => go("catalogue")}>
                <Target className="h-4 w-4" aria-hidden="true" /> {d.targets.length ? "Change" : "Choose exams"}
              </Button>
            }
          />
          <CardBody className="space-y-3">
            {!d.targets.length ? <EmptyState title="No target exams yet" body="Open Exams & eligibility to see which exams you qualify for and add up to three targets." /> : null}
            {saveError ? (
              <p role="alert" className="text-sm text-rose">
                {saveError}
              </p>
            ) : null}
            {d.targets.map((t) => (
              <div key={t.examId} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <button className="text-left font-semibold text-ink hover:text-brand" onClick={() => go("catalogue", { examId: t.examId })}>
                      {t.name}
                    </button>
                    <p className="mt-0.5 text-xs text-ink-3">{t.eligibilityNote}</p>
                  </div>
                  <EligibilityBadge value={t.eligibility} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <CalendarDays className="h-4 w-4 text-ink-3" aria-hidden="true" />
                  {editing === t.examId ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`date-${t.examId}`}>
                        Exam date for {t.name}
                      </label>
                      <input id={`date-${t.examId}`} type="date" className={cn(inputClass, "h-8 w-auto")} value={date} onChange={(e) => setDate(e.target.value)} />
                      <Button size="sm" onClick={() => saveDate(t.examId)} disabled={save.isPending}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <>
                      <span className="text-ink-2">{t.date ? `${new Date(`${t.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${t.daysLeft! >= 0 ? `${t.daysLeft} days left` : "date passed"}` : "No date set"}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(t.examId);
                          setDate(t.date ?? "");
                          setSaveError(null);
                        }}
                      >
                        {t.date ? "Change date" : "Set date"}
                      </Button>
                    </>
                  )}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-ink-3">
                    <span>Readiness (estimate from your practice)</span>
                    <span>{t.readiness === null ? "Practise to see it" : `${t.readiness}/100`}</span>
                  </div>
                  <Progress value={t.readiness ?? 0} tone={t.readiness === null ? "neutral" : t.readiness >= 70 ? "teal" : t.readiness >= 45 ? "amber" : "rose"} label={`Readiness for ${t.name}`} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.sections.map((s) => (
                    <Badge key={s.name} tone={accTone(s.accuracy)}>
                      {s.name}: {s.accuracy === null ? "not practised" : `${s.accuracy}%`}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Today" subtitle="Small daily steps add up." />
          <CardBody className="space-y-2">
            {d.tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => (t.id === "drill" && t.topicId ? start("/api/v1/exam-prep/practice", { topicId: t.topicId }, "Another drill") : go(t.tab))}
                className="flex w-full items-start gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:border-brand hover:bg-brand-soft/40"
              >
                {t.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-label="Done" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" aria-label="To do" />}
                <span>
                  <span className={cn("block text-sm font-medium", t.done ? "text-ink-3 line-through" : "text-ink")}>{t.title}</span>
                  <span className="block text-xs text-ink-3">{t.detail}</span>
                </span>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Weak topics" subtitle="Topics with at least 5 answers and under 70% accuracy." />
          <CardBody>
            {!d.weakTopics.length ? (
              <p className="text-sm text-ink-2">Nothing flagged yet. Practise a few topics and your weakest ones appear here.</p>
            ) : (
              <ul className="space-y-2">
                {d.weakTopics.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm text-ink">
                      <TrendingDown className="h-4 w-4 text-rose" aria-hidden="true" /> {w.title}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-ink-3">
                        {w.accuracy}% of {w.answered}
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => start("/api/v1/exam-prep/practice", { topicId: w.id }, "Another drill")}>
                        Drill
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Your next 7 days" subtitle="A simple routine built from your targets and weak spots." />
          <CardBody>
            <ol className="space-y-1.5">
              {d.plan.map((p) => (
                <li key={p.day} className="grid grid-cols-[64px_1fr] gap-2 text-sm">
                  <span className="font-medium text-ink">{p.label}</span>
                  <span className="text-ink-2">{p.focus}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-ink-3">
              {d.totals.dailyTests} daily tests · {d.totals.mocks} mocks · {d.totals.rounds} practice rounds so far
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
