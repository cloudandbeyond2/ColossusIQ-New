"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Newspaper } from "lucide-react";
import { useMemo, useState } from "react";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, EmptyState, Skeleton } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { CA_CATEGORIES, CaFeed, type CaCategory } from "@/lib/api/exam-prep-schemas";
import { cn } from "@/lib/utils";
import type { TabProps } from "./shared";

export const CA_KEY = ["current-affairs"] as const;
const longDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function CurrentAffairsFeed({ start }: TabProps) {
  const q = useQuery({ queryKey: CA_KEY, queryFn: () => apiFetch("/api/v1/current-affairs", CaFeed), staleTime: 0, refetchOnMount: "always" });
  const [cat, setCat] = useState<CaCategory | "all">("all");
  const byDate = useMemo(() => {
    const items = (q.data?.items ?? []).filter((x) => cat === "all" || x.category === cat);
    const m = new Map<string, typeof items>();
    for (const x of items) m.set(x.date, [...(m.get(x.date) ?? []), x]);
    return [...m.entries()];
  }, [q.data, cat]);

  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const examName = (id: string) => d.exams.find((e) => e.id === id)?.name ?? id;
  const canQuiz = !d.weekly.done && d.weekly.questions >= 3;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-ink-3">Week {d.weekly.week.slice(-2)}</p>
            <p className="text-lg font-semibold text-ink">Weekly current-affairs quiz</p>
            <p className="text-sm text-ink-2">
              {d.weekly.done
                ? `Done this week${d.weekly.last !== null ? `: you scored ${d.weekly.last}%` : ""}. A new quiz opens on Monday.`
                : d.weekly.questions >= 3
                  ? `${d.weekly.questions} questions from the last 7 days. One attempt per week.`
                  : "Opens once your college has published at least 3 questions this week."}
            </p>
          </div>
          <Button disabled={!canQuiz} onClick={() => start("/api/v1/exam-prep/ca-quiz/start")}>
            Take the quiz
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Categories">
        {(["all", ...CA_CATEGORIES] as const).map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={cn("rounded-full px-3 py-1 text-xs font-medium", cat === c ? "bg-brand text-white" : "bg-surface-2 text-ink-2 hover:bg-line")}>
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>

      {!byDate.length ? <EmptyState title="No current affairs yet" body="Your faculty publish short daily updates here for competitive-exam preparation." /> : null}
      {byDate.map(([date, items]) => (
        <section key={date} aria-label={longDate(date)} className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-2">{longDate(date)}</h3>
          {items.map((x) => (
            <Card key={x.id}>
              <CardBody className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{x.category}</Badge>
                  {x.tags.map((t) => (
                    <Badge key={t}>{examName(t)}</Badge>
                  ))}
                </div>
                <p className="flex items-start gap-2 font-semibold text-ink">
                  <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" /> {x.headline}
                </p>
                <p className="whitespace-pre-line text-sm text-ink-2">{x.summary}</p>
                {x.sourceUrl ? (
                  <a href={x.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                    {x.sourceName || "Source"} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : x.sourceName ? (
                  <p className="text-xs text-ink-3">Source: {x.sourceName}</p>
                ) : null}
                {x.mcq ? <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">Quiz question this week: {x.mcq.question}</p> : null}
              </CardBody>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}
