"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, BookOpenCheck, Bot, CheckCircle2, Lightbulb, School, Sigma, Target } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton, Spinner } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { TopicNotes } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";
import { PREP_KEY } from "./shared";

const SOURCE: Record<TopicNotes["source"], { label: string; tone: "teal" | "amber" | "neutral"; icon: React.ReactNode }> = {
  faculty: { label: "Written by your faculty", tone: "teal", icon: <School className="h-3.5 w-3.5" aria-hidden="true" /> },
  ai: { label: "AI-generated: verify with your textbook", tone: "amber", icon: <Bot className="h-3.5 w-3.5" aria-hidden="true" /> },
  "built-in": { label: "ColossusIQ notes", tone: "neutral", icon: <BookOpenCheck className="h-3.5 w-3.5" aria-hidden="true" /> },
};

/** A topic's study notes: learn first, then practise. */
export function NotesView({ topicId, onBack, onPractise, error, busy }: { topicId: string; onBack: () => void; onPractise: (topicId: string) => void; error: string | null; busy: boolean }) {
  const key = [...PREP_KEY, "notes", topicId];
  const q = useQuery({ queryKey: key, queryFn: () => apiFetch(`/api/v1/exam-prep/topics/${encodeURIComponent(topicId)}/notes`, TopicNotes), staleTime: 60_000 });
  const qc = useQueryClient();
  const [showSolution, setShowSolution] = useState(false);
  const mark = useMutation({
    mutationFn: (studied: boolean) => apiFetch(`/api/v1/exam-prep/topics/${encodeURIComponent(topicId)}/studied`, z.object({ studied: z.boolean() }), { method: "POST", body: { studied } }),
    onSuccess: (r) => {
      qc.setQueryData(key, (old: TopicNotes | undefined) => (old ? { ...old, studied: r.studied } : old));
      void qc.invalidateQueries({ queryKey: [...PREP_KEY, "syllabus"] });
    },
  });

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
      </Button>
      {q.data ? (
        <div className="flex flex-wrap gap-2">
          <Button variant={q.data.studied ? "secondary" : "primary"} size="sm" onClick={() => mark.mutate(!q.data.studied)} disabled={mark.isPending}>
            <CheckCircle2 className={cn("h-4 w-4", q.data.studied && "text-teal")} aria-hidden="true" /> {q.data.studied ? "Studied" : "Mark as studied"}
          </Button>
          <Button size="sm" onClick={() => onPractise(topicId)} disabled={busy}>
            {busy ? <Spinner /> : <Target className="h-4 w-4" aria-hidden="true" />} Practise 10 questions
          </Button>
        </div>
      ) : null}
    </div>
  );

  if (q.isPending)
    return (
      <div className="space-y-4">
        {header}
        <Card className="flex items-center gap-3 p-5 text-sm text-ink-2">
          <Spinner /> Preparing your notes… (the first time a topic is opened this can take a few seconds)
        </Card>
        <Skeleton className="h-64" />
      </div>
    );
  if (q.isError)
    return (
      <div className="space-y-4">
        {header}
        <LoadError error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );
  const n = q.data;
  const src = SOURCE[n.source];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {header}
      {error ? (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm text-rose">
          {error}
        </p>
      ) : null}
      <Card className="p-6">
        <p className="text-sm text-ink-3">{n.family}</p>
        <h2 className="text-2xl font-semibold text-ink">{n.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={src.tone}>
            {src.icon} {src.label}
          </Badge>
          {n.author ? <span className="text-xs text-ink-3">by {n.author}</span> : null}
          {n.answered ? <Badge tone={n.accuracy !== null && n.accuracy >= 75 ? "teal" : "amber"}>{`Your accuracy: ${n.accuracy}% of ${n.answered}`}</Badge> : <Badge>Not practised yet</Badge>}
        </div>
        <p className="mt-4 whitespace-pre-line text-ink-2">{n.summary}</p>
      </Card>

      <Card>
        <CardHeader title="Key points" />
        <CardBody>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
            {n.keyPoints.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {n.formulas.length ? (
        <Card>
          <CardHeader title="Formulas & rules" />
          <CardBody>
            <ul className="grid gap-2 sm:grid-cols-2">
              {n.formulas.map((f, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm text-ink">
                  <Sigma className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" /> {f}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {n.example ? (
        <Card>
          <CardHeader title="Worked example" />
          <CardBody className="space-y-3 text-sm">
            <p className="whitespace-pre-line font-medium text-ink">{n.example.problem}</p>
            {showSolution ? (
              <p className="whitespace-pre-line rounded-xl bg-teal-soft px-4 py-3 text-ink">{n.example.solution}</p>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setShowSolution(true)}>
                Try it, then show the solution
              </Button>
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {n.mistakes.length ? (
          <Card>
            <CardHeader title="Common mistakes" />
            <CardBody>
              <ul className="space-y-2 text-sm text-ink">
                {n.mistakes.map((m, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose" aria-hidden="true" /> {m}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
        {n.tips.length ? (
          <Card>
            <CardHeader title="Exam tips" />
            <CardBody>
              <ul className="space-y-2 text-sm text-ink">
                {n.tips.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-ink-2">Read it once, mark it as studied, then test yourself. Topics you get right 75% of the time (10+ answers) become strong in your syllabus.</p>
        <Button onClick={() => onPractise(topicId)} disabled={busy}>
          Practise now
        </Button>
      </Card>
    </div>
  );
}
