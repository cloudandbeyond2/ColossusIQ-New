"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, School } from "lucide-react";
import { useState } from "react";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, inputClass, Progress, Skeleton } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { Syllabus, type TopicStatus } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";
import { useOverview } from "./plan-tab";
import { PREP_KEY, type TabProps } from "./shared";

const STATUS: Record<TopicStatus, { label: string; tone: "neutral" | "sky" | "amber" | "teal" }> = {
  "not-started": { label: "Not started", tone: "neutral" },
  studied: { label: "Studied", tone: "sky" },
  practised: { label: "Practised", tone: "amber" },
  strong: { label: "Strong", tone: "teal" },
};

/** Syllabus tracker: every topic of an exam with its study notes, practice and status. */
export function SyllabusTab({ start, study, examId }: TabProps & { examId: string | null }) {
  const overview = useOverview();
  const firstTarget = overview.data?.targets[0]?.examId ?? null;
  const [picked, setPicked] = useState<string | null>(examId);
  const id = picked ?? firstTarget ?? "ssc-cgl";
  const q = useQuery({ queryKey: [...PREP_KEY, "syllabus", id], queryFn: () => apiFetch(`/api/v1/exam-prep/syllabus/${encodeURIComponent(id)}`, Syllabus), staleTime: 0, refetchOnMount: "always" });

  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const exams = [...d.exams].sort((a, b) => Number(b.isTarget) - Number(a.isTarget));
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label htmlFor="syllabus-exam" className="text-sm text-ink-3">
              Syllabus for
            </label>
            <select id="syllabus-exam" className={cn(inputClass, "mt-1 max-w-sm")} value={id} onChange={(e) => setPicked(e.target.value)}>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.isTarget ? " (target)" : ""}
                </option>
              ))}
            </select>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex justify-between text-xs text-ink-3">
                  <span>Syllabus covered</span>
                  <span>{d.coverage}%</span>
                </div>
                <Progress value={d.coverage} label="Syllabus covered" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-ink-3">
                  <span>Topics strong</span>
                  <span>{d.mastery}%</span>
                </div>
                <Progress value={d.mastery} tone="teal" label="Topics strong" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS) as TopicStatus[]).map((s) => (
              <Badge key={s} tone={STATUS[s].tone}>
                {STATUS[s].label}: {d.counts[s]}
              </Badge>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-3">Study a topic&apos;s notes, then practise it. A topic becomes strong at 75% accuracy over 10 or more answers.</p>
      </Card>

      {d.sections.map((sec) => (
        <Card key={sec.name}>
          <CardHeader title={sec.name} subtitle={`${sec.questions} questions in the real paper`} />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {sec.topics.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {t.title}
                      {t.custom ? <Badge tone="brand">Added by your college</Badge> : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                      <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                      {t.answered ? `${t.accuracy}% of ${t.answered} answers` : "No answers yet"}
                      {t.notes === "faculty" ? (
                        <span className="inline-flex items-center gap-1 text-teal">
                          <School className="h-3.5 w-3.5" aria-hidden="true" /> faculty notes
                        </span>
                      ) : t.notes === "ai" ? (
                        <span className="inline-flex items-center gap-1 text-amber">
                          <Bot className="h-3.5 w-3.5" aria-hidden="true" /> AI notes
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => study(t.id)}>
                      Study
                    </Button>
                    <Button size="sm" onClick={() => start("/api/v1/exam-prep/practice", { topicId: t.id }, "Another drill")}>
                      Practise
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
