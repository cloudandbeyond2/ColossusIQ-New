"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { EvaluationQueueItem } from "@/lib/api/schemas";
import { mask } from "@/lib/security/sanitize";
import { EvaluationCard } from "@/components/portal/evaluation-card";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Badge, Button, Card, CardBody, CardHeader, Field, inputClass, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const AuditRow = z.object({ at: z.string(), actor: z.string(), action: z.string(), target: z.string() });

export function EvaluationReviewModule() {
  const qc = useQueryClient();
  const queue = useQuery({ queryKey: ["eval-queue"], queryFn: () => apiFetch("/api/v1/evaluations/queue", z.array(EvaluationQueueItem)) });
  const audit = useQuery({ queryKey: ["audit-recent"], queryFn: () => apiFetch("/api/v1/audit/recent", z.array(AuditRow)) });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [override, setOverride] = useState({ score: "", reason: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"evaluations" | "all">("evaluations");
  const [showAllAudit, setShowAllAudit] = useState(false);
  const [showFullAnswer, setShowFullAnswer] = useState(false);

  const isEvalAction = (action: string) => {
    const lower = action.toLowerCase();
    return (
      lower.includes("score") ||
      lower.includes("evaluat") ||
      lower.includes("override") ||
      lower.includes("approve") ||
      lower.includes("assessment") ||
      lower.includes("handwritten") ||
      lower.includes("rubric")
    );
  };

  const filteredAudit = useMemo(() => {
    if (!audit.data) return [];
    if (filterMode === "all") return audit.data;
    return audit.data.filter((a) => isEvalAction(a.action));
  }, [audit.data, filterMode]);

  const visibleAudit = showAllAudit ? filteredAudit : filteredAudit.slice(0, 5);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["eval-queue"] });
    void qc.invalidateQueries({ queryKey: ["audit-recent"] });
  };
  const approve = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/evaluations/${encodeURIComponent(id)}/approve`, EvaluationQueueItem, { method: "POST" }),
    onSuccess: refresh,
  });
  const doOverride = useMutation({
    mutationFn: (v: { id: string; finalScore: number; reason: string }) =>
      apiFetch(`/api/v1/evaluations/${encodeURIComponent(v.id)}/override`, EvaluationQueueItem, { method: "POST", body: { finalScore: v.finalScore, reason: v.reason } }),
    onSuccess: () => {
      setOverride({ score: "", reason: "" });
      refresh();
    },
    onError: (e) => setFormError(e instanceof ApiError ? e.message : "Override failed."),
  });

  if (queue.isLoading || !queue.data) return <TemplateSkeleton />;
  const items = queue.data;
  const item = items.find((i) => i.id === selectedId) ?? items[0];
  const isLongAnswer = (item?.answer?.length ?? 0) > 140 || (item?.answer?.split("\n").length ?? 0) > 4;

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <Card className="h-fit">
        <CardHeader title="Review queue" subtitle={`${items.filter((i) => i.status === "pending").length} pending`} />
        <ul className="p-2">
          {items.map((i) => (
            <li key={i.id}>
              <button
                onClick={() => {
                  setSelectedId(i.id);
                  setFormError(null);
                  setShowFullAnswer(false);
                }}
                className={cn("w-full rounded-lg px-3 py-3 text-left", item?.id === i.id ? "bg-brand-soft" : "hover:bg-surface-2")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{i.student}</span>
                  <Badge tone={i.status === "pending" ? (i.result.reviewRequired ? "amber" : "brand") : "teal"}>
                    {i.status === "pending" ? (i.result.reviewRequired ? "Low confidence" : "Pending") : i.status === "approved" ? "Approved" : "Overridden"}
                  </Badge>
                </div>
                <p className="mt-0.5 font-mono text-xs text-ink-3">{mask(i.rollNo)}</p>
                <p className="mt-1 text-xs text-ink-2">
                  AI: {i.result.score}/{i.result.max} · conf. {i.result.confidence.toFixed(2)}
                  {i.finalScore !== null ? ` · Final: ${i.finalScore}` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {item ? (
        <div className="space-y-6">
          <Card>
            <CardHeader title={item.assessment} subtitle={item.question} />
            <CardBody>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Student answer</p>
              <div
                className="relative rounded-lg bg-surface-2 transition-all"
                style={!showFullAnswer && isLongAnswer ? { maxHeight: "180px", overflow: "hidden" } : undefined}
              >
                <p className="whitespace-pre-wrap p-4 text-sm leading-relaxed text-ink">
                  {item.answer}
                </p>
                {!showFullAnswer && isLongAnswer ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-lg bg-gradient-to-t from-surface-2 via-surface-2/90 to-transparent" />
                ) : null}
              </div>
              {isLongAnswer ? (
                <div className="mt-2.5 flex justify-center">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowFullAnswer((prev) => !prev)}
                    className="text-xs cursor-pointer"
                  >
                    {showFullAnswer ? (
                      <>
                        <ChevronUp className="mr-1 size-3.5" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-1 size-3.5" />
                        Show more
                      </>
                    )}
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>
          <EvaluationCard result={item.result} />
          <Card>
            <CardHeader title="Your decision" subtitle="Teachers always have the final say" />
            <CardBody>
              {item.status !== "pending" ? (
                <p className="text-sm text-teal">
                  {item.status === "approved" ? "Approved" : "Overridden"} — final score {item.finalScore} / {item.result.max}. Recorded in the audit log.
                </p>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm text-ink-2">Accept the AI-suggested score of {item.result.score} / {item.result.max}.</p>
                    <Button variant="primary" disabled={approve.isPending} onClick={() => approve.mutate(item.id)}>
                      {approve.isPending ? <Spinner /> : null} Approve AI score
                    </Button>
                  </div>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setFormError(null);
                      const score = Number(override.score);
                      if (!Number.isFinite(score) || score < 0 || score > item.result.max) return setFormError(`Enter a score between 0 and ${item.result.max}.`);
                      if (override.reason.trim().length < 5) return setFormError("A reason (5+ characters) is required for the audit trail.");
                      doOverride.mutate({ id: item.id, finalScore: score, reason: override.reason.trim().slice(0, 500) });
                    }}
                  >
                    <Field label={`Override score (0–${item.result.max})`} htmlFor="ov-score">
                      <input id="ov-score" type="number" step="0.5" min={0} max={item.result.max} className={inputClass} value={override.score} onChange={(e) => setOverride({ ...override, score: e.target.value })} />
                    </Field>
                    <Field label="Reason" htmlFor="ov-reason" error={formError ?? undefined}>
                      <textarea id="ov-reason" rows={2} maxLength={500} className={inputClass} value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} />
                    </Field>
                    <Button type="submit" variant="secondary" disabled={doOverride.isPending}>
                      {doOverride.isPending ? <Spinner /> : null} Override score
                    </Button>
                  </form>
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Audit trail"
              subtitle="Recorded evaluation decisions and oversight actions"
              action={
                <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("evaluations");
                      setShowAllAudit(false);
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-colors",
                      filterMode === "evaluations" ? "bg-surface text-brand shadow-xs" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    Evaluation only ({audit.data?.filter((a) => isEvalAction(a.action)).length ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("all");
                      setShowAllAudit(false);
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-colors",
                      filterMode === "all" ? "bg-surface text-brand shadow-xs" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    All activity ({audit.data?.length ?? 0})
                  </button>
                </div>
              }
            />
            <CardBody>
              {filteredAudit.length > 0 ? (
                <div className="space-y-3">
                  <ul className="max-h-64 overflow-y-auto divide-y divide-line pr-1 text-sm">
                    {visibleAudit.map((a, idx) => {
                      const isApproved = a.action.toLowerCase().includes("approved") || a.action.toLowerCase().includes("approve");
                      const isOverride = a.action.toLowerCase().includes("override");
                      const tone = isApproved ? "teal" : isOverride ? "amber" : "neutral";
                      return (
                        <li key={`${a.at}-${a.target}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <div className="flex items-center gap-2">
                            <Badge tone={tone}>{a.action}</Badge>
                            <span className="text-ink-2 font-mono text-xs">{a.target}</span>
                          </div>
                          <span className="text-xs text-ink-3">
                            {a.actor} · {new Date(a.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {filteredAudit.length > 5 ? (
                    <div className="border-t border-line pt-2 text-center">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowAllAudit((prev) => !prev)}
                        className="text-xs"
                      >
                        {showAllAudit ? (
                          <>
                            <ChevronUp className="mr-1 size-3.5" />
                            Show recent 5
                          </>
                        ) : (
                          <>
                            <ChevronDown className="mr-1 size-3.5" />
                            Show all ({filteredAudit.length})
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-ink-3">
                  <History className="mx-auto mb-2 size-6 opacity-40" />
                  <p>No {filterMode === "evaluations" ? "evaluation decisions" : "activity"} recorded yet in this session.</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
