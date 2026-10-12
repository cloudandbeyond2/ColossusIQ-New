"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api/client";
import { MyReadiness, READINESS_WEIGHTS, type Readiness } from "@/lib/api/learning-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import { Badge, Card, CardBody, CardHeader, EmptyState, Progress, toneForScore } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/api/schemas";

const STATUS_TONE: Record<Readiness["status"], Tone> = { "Placement ready": "teal", "Almost ready": "amber", "Needs work": "rose" };

function Ring({ value, status }: { value: number; status: Readiness["status"] }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = status === "Placement ready" ? "var(--teal)" : status === "Almost ready" ? "var(--amber)" : "var(--rose)";
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-ink">{value}</span>
        <span className="text-xs text-ink-3">out of 100</span>
      </div>
    </div>
  );
}

export function PlacementReadinessModule() {
  const q = useQuery({ queryKey: ["my-readiness"], queryFn: () => apiFetch("/api/v1/placement/me", MyReadiness) });
  if (q.isLoading) return <TemplateSkeleton />;
  if (!q.data) return <EmptyState title="Readiness unavailable" body={q.error instanceof ApiError ? q.error.message : undefined} />;
  const { readiness: r, rules } = q.data;

  const parts = READINESS_WEIGHTS.map((w) => {
    const raw = r[w.key];
    const pct = w.key === "certificates" ? (Math.min(raw, 4) / 4) * 100 : raw;
    return { ...w, raw, pct, points: Math.round((pct * w.weight) / 100) };
  });
  const checks = [
    { ok: r.total >= rules.minTotal, text: `Total of ${rules.minTotal} or more`, now: `${r.total}` },
    { ok: r.quizAverage >= rules.minQuizAverage, text: `Quiz average of ${rules.minQuizAverage}% or more`, now: `${r.quizAverage}%`, href: "my-quizzes" },
    { ok: r.certificates >= rules.minCertificates, text: `At least ${rules.minCertificates} certificates`, now: `${r.certificates}`, href: "my-certificates" },
    { ok: r.interview >= rules.minInterview, text: `Mock interview score of ${rules.minInterview} or more`, now: `${r.interview}`, href: "interview" },
  ];

  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row">
        <Ring value={r.total} status={r.status} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <Badge tone={STATUS_TONE[r.status]} className="text-sm">
            {r.status}
          </Badge>
          <h2 className="mt-2 text-xl font-semibold text-ink">{r.status === "Placement ready" ? "You are placement ready." : "Your placement readiness"}</h2>
          <p className="mt-1 text-sm text-ink-2">
            One total built from your department quiz marks, earned certificates, aptitude, mock interview and resume. The placement cell sees the same number, so each step you complete
            here shows up on their board.
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="How your total is made" subtitle="Weighted score out of 100" />
          <CardBody className="space-y-4">
            {parts.map((p) => (
              <div key={p.key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-ink">
                    <Fi name={p.icon} className="text-brand" /> {p.label}
                    <span className="text-xs text-ink-3">× {p.weight}%</span>
                  </span>
                  <span className="tabular-nums text-ink-2">
                    {p.key === "certificates" ? `${p.raw} earned` : `${p.raw}%`} → <b className="text-ink">{p.points}</b> / {p.weight}
                  </span>
                </div>
                <Progress value={p.pct} tone={toneForScore(p.pct)} className="mt-1.5" label={p.label} />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Placement-ready checklist" />
          <CardBody>
            <ul className="space-y-3">
              {checks.map((c) => (
                <li key={c.text} className="flex items-start gap-3 text-sm">
                  <Fi name={c.ok ? "check-circle" : "circle"} className={cn("mt-0.5 text-lg", c.ok ? "text-teal" : "text-ink-3")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block", c.ok ? "text-ink" : "text-ink-2")}>{c.text}</span>
                    <span className="text-xs text-ink-3">Now: {c.now}</span>
                  </span>
                  {!c.ok && c.href ? (
                    <Link href={`/student/${c.href}`} className="text-xs font-medium text-brand hover:underline">
                      Improve
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
            {r.gaps.length ? (
              <div className="mt-5 rounded-xl bg-amber-soft p-4 text-sm">
                <p className="font-medium text-ink">Next steps</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">
                  {r.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-5 rounded-xl bg-teal-soft p-4 text-sm text-teal">All criteria met. You appear in the placement cell&apos;s shortlist.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
