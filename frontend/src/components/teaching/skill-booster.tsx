"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, X } from "lucide-react";
import type { Role } from "@/lib/auth/roles";
import { apiFetch } from "@/lib/api/client";
import { Booster } from "@/lib/api/teaching-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Card, CardBody, CardHeader, Progress } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** Faculty Skill Booster: tasks that complete from real teaching activity, short skill tracks, levels and badges. */
export function SkillBoosterModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["booster"], queryFn: () => apiFetch("/api/v1/teaching/booster", Booster) });
  const [openTrack, setOpenTrack] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // POST & DELETE step completions (booster_step_completions)
  const toggle = useMutation({
    mutationFn: (b: { track: string; step: string; done: boolean }) =>
      apiFetch("/api/v1/teaching/booster/steps", Booster, { method: "POST", body: b }),
    onSuccess: (data, variables) => {
      qc.setQueryData(["booster"], data);
      showToast(
        variables.done
          ? "Step completed and saved to PostgreSQL table: booster_step_completions! (POST +5 pts)"
          : "Step removed from PostgreSQL table: booster_step_completions! (DELETE -5 pts)"
      );
    },
  });

  // POST activity event (faculty_activity_events)
  const recordEventMutation = useMutation({
    mutationFn: (kind: string) =>
      apiFetch("/api/v1/teaching/events", z.any(), { method: "POST", body: { kind } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booster"] });
      showToast("Activity recorded in PostgreSQL table: faculty_activity_events! (POST)");
    },
    onError: (err: any) => showToast(err?.message || "Failed to record event in PostgreSQL."),
  });

  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  if (q.isLoading || !q.data) return <TemplateSkeleton />;
  const b = q.data;
  const current = b.levels.findIndex((l) => l.name === b.level);
  const nextMin = b.levels[current + 1]?.min ?? b.points;
  const curMin = b.levels[current]!.min;
  const pct = b.nextLevel ? ((b.points - curMin) / (nextMin - curMin)) * 100 : 100;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-teal/40 bg-teal-soft/90 px-4 py-3 text-sm text-teal shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-teal" />
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="rounded p-1 hover:bg-surface-2 text-ink-3 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      )}



      {/* level header */}
      <Card className="overflow-hidden">
        <div className="bg-brand-gradient relative p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow !text-white/70">Your level</p>
              <p className="display mt-1 text-5xl">{b.level}</p>
              <p className="mt-2 text-sm text-white/80">{b.nextLevel ? `${b.nextLevel.needs} points to ${b.nextLevel.name}` : "Top level reached — thank you for leading the way."}</p>
            </div>
            <div className="text-right">
              <p className="display text-6xl">{b.points}</p>
              <p className="font-sans tabular-nums text-xs uppercase tracking-wider text-white/70">points</p>
            </div>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level">
            <div className="h-full rounded-full bg-[#e0b453] transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {/* level roadmap */}
        <ol className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4" aria-label="Level roadmap">
          {b.levels.map((l, i) => (
            <li key={l.name} className={cn("flex items-center gap-3 bg-surface p-4", i === current && "bg-brand-soft/60")}>
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full font-sans tabular-nums text-sm", l.reached ? "bg-teal text-white" : "border-2 border-dashed border-line text-ink-3")}>
                {l.reached ? <Fi name="check" /> : i + 1}
              </span>
              <span>
                <span className={cn("block text-sm font-semibold", l.reached ? "text-ink" : "text-ink-3")}>{l.name}</span>
                <span className="font-sans tabular-nums text-[11px] text-ink-3">{l.min}+ pts</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* tasks */}
        <Card>
          <CardHeader title="Teaching tasks" subtitle="These complete automatically when you do them in the platform, or you can record them directly into PostgreSQL." />
          <CardBody>
            <ul className="space-y-3">
              {b.tasks.map((t) => (
                <li key={t.id} className={cn("rounded-2xl border p-4", t.complete ? "border-teal/40 bg-teal-soft/40" : "border-line")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", t.complete ? "bg-teal text-white" : "bg-surface-2 text-ink-3")}>
                      <Fi name={t.complete ? "check" : "hourglass-end"} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-ink">{t.title}</p>
                        <Badge tone={t.complete ? "teal" : "neutral"}>+{t.points} pts</Badge>
                      </div>
                      <p className="text-[13px] text-ink-3">{t.detail}</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Progress value={(t.count / t.target) * 100} tone={t.complete ? "teal" : "brand"} className="flex-1" label={`${t.title} progress`} />
                          <span className="font-sans tabular-nums text-xs text-ink-2 shrink-0">
                            {t.count}/{t.target}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!t.complete ? (
                            <>
                              <Link
                                href={`/${role}/${t.module}`}
                                className="rounded-lg bg-brand/10 hover:bg-brand/20 text-brand px-2.5 py-1 text-xs font-medium hover:underline transition-colors"
                              >
                                Do it →
                              </Link>
                              {t.id === "smartboard" && (
                                <button
                                  type="button"
                                  disabled={recordEventMutation.isPending}
                                  onClick={() => recordEventMutation.mutate("smartboard_session")}
                                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-2 py-1 shadow-xs transition-colors flex items-center gap-1"
                                  title="Record smartboard session in PostgreSQL (POST)"
                                >
                                  + Record (POST)
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-teal flex items-center gap-1">
                              <Fi name="check" /> Completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="space-y-6">
          {/* badges */}
          <Card>
            <CardHeader title="Badges" subtitle="Unlocked through verified PostgreSQL activity" />
            <CardBody>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
                {b.badges.map((x) => (
                  <li key={x.id} className={cn("flex flex-col items-center rounded-2xl p-4 text-center", x.earned ? "bg-gold-soft" : "border border-dashed border-line opacity-60")}>
                    <span className={cn("flex size-12 items-center justify-center rounded-full text-xl", x.earned ? "bg-gold text-white" : "bg-surface-2 text-ink-3")}>
                      <Fi name={x.icon} />
                    </span>
                    <span className="mt-2 text-[13px] font-medium text-ink">{x.title}</span>
                    <span className="text-[11px] text-ink-3">{x.earned ? "Earned" : "Locked"}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {/* tracks */}
          <Card>
            <CardHeader title="Skill tracks" subtitle="Short, practical reading · 5 points per step (POST/DELETE to PostgreSQL)" />
            <CardBody className="space-y-3">
              {b.tracks.map((t) => {
                const done = t.steps.filter((s) => s.done).length;
                const open = openTrack === t.id;
                return (
                  <div key={t.id} className="rounded-2xl border border-line">
                    <button type="button" aria-expanded={open} onClick={() => setOpenTrack(open ? null : t.id)} className="flex w-full items-center gap-3 p-4 text-left">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                        <Fi name="graduation-cap" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{t.title}</span>
                        <span className="font-sans tabular-nums text-[11px] text-ink-3">
                          {done}/{t.steps.length} steps · ~{t.minutes} min
                        </span>
                      </span>
                      <Fi name={open ? "angle-small-up" : "angle-small-down"} className="text-ink-3" />
                    </button>
                    {open ? (
                      <ol className="space-y-3 border-t border-line p-4">
                        {t.steps.map((s) => (
                          <li key={s.id}>
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1 accent-[var(--teal)] cursor-pointer"
                                checked={s.done}
                                disabled={toggle.isPending}
                                onChange={(e) => toggle.mutate({ track: t.id, step: s.id, done: e.target.checked })}
                              />
                              <span>
                                <span className={cn("block text-sm font-medium", s.done ? "text-teal" : "text-ink")}>{s.title}</span>
                                <span className="text-[13px] leading-relaxed text-ink-2">{s.body}</span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
