"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Info, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, EmptyState, inputClass, Skeleton, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { Catalogue, ExamDetail, MAX_TARGETS, type ExamGroup } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";
import { useOverview, useSaveTargets } from "./plan-tab";
import { EligibilityBadge, PREP_KEY, type TabProps } from "./shared";

export function CatalogueTab({ start, study, go, openExam }: TabProps & { openExam: string | null }) {
  const q = useQuery({ queryKey: [...PREP_KEY, "catalogue"], queryFn: () => apiFetch("/api/v1/exam-prep/catalogue", Catalogue) });
  const overview = useOverview();
  const save = useSaveTargets();
  const [group, setGroup] = useState<ExamGroup | "all" | "eligible">("all");
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(openExam);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const t = text.trim().toLowerCase();
    return (q.data?.exams ?? []).filter(
      (e) => (group === "all" || (group === "eligible" ? e.eligibility === "eligible" || e.eligibility === "eligible-final-year" : e.group === group)) && (!t || `${e.name} ${e.fullName} ${e.conductedBy}`.toLowerCase().includes(t))
    );
  }, [q.data, group, text]);

  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const targets = overview.data?.targets.map((t) => ({ examId: t.examId, date: t.date })) ?? [];
  const toggle = (id: string) => {
    setError(null);
    const has = targets.some((t) => t.examId === id);
    if (!has && targets.length >= MAX_TARGETS) return setError(`You can follow up to ${MAX_TARGETS} exams. Remove one first.`);
    save.mutate(has ? targets.filter((t) => t.examId !== id) : [...targets, { examId: id, date: null }], {
      onSuccess: () => void q.refetch(),
      onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save your targets."),
    });
  };
  const groupName = (id: ExamGroup) => q.data.groups.find((g) => g.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <Card className="flex items-start gap-3 p-4 text-sm text-ink-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <p>{q.data.disclaimer}</p>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Exam groups">
          {([["all", "All exams"], ["eligible", "I can apply"], ...q.data.groups.map((g) => [g.id, g.label])] as Array<[string, string]>).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={group === id} onClick={() => setGroup(id as typeof group)} className={cn("rounded-full px-3 py-1 text-xs font-medium", group === id ? "bg-brand text-white" : "bg-surface-2 text-ink-2 hover:bg-line")}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input aria-label="Search exams" className={cn(inputClass, "pl-9")} placeholder="Search exams…" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      ) : null}
      {!shown.length ? <EmptyState title="No exams match" body="Try another group or search word." /> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((e) => (
          <Card key={e.id} className={cn("flex flex-col p-5", e.isTarget && "ring-2 ring-brand")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{e.name}</p>
                <p className="text-xs text-ink-3">{groupName(e.group)}</p>
              </div>
              <EligibilityBadge value={e.eligibility} />
            </div>
            <p className="mt-2 flex-1 text-sm text-ink-2">{e.summary}</p>
            <p className="mt-2 text-xs text-ink-3">{e.eligibilityNote}</p>
            <p className="mt-2 text-xs text-ink-3">
              {e.hasTest ? `${e.totalQuestions} questions · ${e.durationMin} min${e.negativeMarking ? " · negative marking" : ""}` : "Admission on marks, no entrance test"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant={e.isTarget ? "secondary" : "primary"} onClick={() => toggle(e.id)} disabled={save.isPending}>
                <Star className={cn("h-4 w-4", e.isTarget && "fill-current text-gold")} aria-hidden="true" /> {e.isTarget ? "Following" : "Add to my targets"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                {open === e.id ? "Hide details" : "Pattern & syllabus"}
              </Button>
            </div>
            {open === e.id ? <ExamDetails id={e.id} start={start} study={study} go={go} /> : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ExamDetails({ id, start, study, go }: { id: string; start: TabProps["start"]; study: TabProps["study"]; go: TabProps["go"] }) {
  const q = useQuery({ queryKey: [...PREP_KEY, "exam", id], queryFn: () => apiFetch(`/api/v1/exam-prep/exams/${encodeURIComponent(id)}`, ExamDetail) });
  if (q.isPending)
    return (
      <div className="mt-4 grid place-items-center p-4">
        <Spinner />
      </div>
    );
  if (q.isError) return <p className="mt-4 text-sm text-rose">Could not load the exam details.</p>;
  const d = q.data;
  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
      <p className="text-ink-2">
        <span className="font-medium text-ink">{d.fullName}</span> · {d.conductedBy}
      </p>
      <p className="text-ink-2">
        <span className="font-medium text-ink">Qualification:</span> {d.qualification}
      </p>
      <p className="text-ink-2">
        <span className="font-medium text-ink">Age:</span> {d.ageNote}
      </p>
      {d.sections.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] text-xs">
            <thead className="text-left text-ink-3">
              <tr>
                <th className="py-1 pr-2 font-medium">Section</th>
                <th className="py-1 pr-2 font-medium">Qs</th>
                <th className="py-1 font-medium">Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.sections.map((s) => (
                <tr key={s.name}>
                  <td className="py-1.5 pr-2 text-ink">{s.name}</td>
                  <td className="py-1.5 pr-2 tabular-nums text-ink-2">{s.questions}</td>
                  <td className="py-1.5 tabular-nums text-ink-2">
                    +{s.marks}
                    {s.negative ? ` / −${s.negative}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {d.patternNote ? <p className="text-xs text-ink-3">{d.patternNote}</p> : null}
      {d.sections.length ? (
        <div>
          <p className="mb-1 text-xs font-medium text-ink">Study a topic (notes, then practice)</p>
          <div className="flex flex-wrap gap-1.5">
            {[...new Map(d.sections.flatMap((s) => s.topics).map((t) => [t.id, t])).values()].map((t) => (
              <button key={t.id} onClick={() => study(t.id)} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2 hover:bg-brand-soft hover:text-brand">
                {t.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {d.mock ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => start(`/api/v1/exam-prep/mocks/${encodeURIComponent(d.id)}/start`, { length: "short" }, "Take another mock")}>
              Short mock ({d.mock.questions} Qs, {d.mock.minutes} min)
            </Button>
            <Button size="sm" onClick={() => start(`/api/v1/exam-prep/mocks/${encodeURIComponent(d.id)}/start`, { length: "full" }, "Take another full mock")}>
              Full mock ({d.mock.full.questions} Qs, {d.mock.full.minutes} min)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => go("syllabus", { examId: d.id })}>
              Syllabus tracker
            </Button>
          </>
        ) : null}
        {d.officialSite ? (
          <a href={d.officialSite} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            Official website <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : (
          <Badge>Official site changes each year: search the exam name</Badge>
        )}
      </div>
    </div>
  );
}
