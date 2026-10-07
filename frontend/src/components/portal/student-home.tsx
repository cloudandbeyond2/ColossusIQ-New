"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Calendar, CalendarClock, Flame, GraduationCap, Sparkles, Target, Trophy } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { StudentDashboard } from "@/lib/api/schemas";
import { usePrefs } from "@/components/providers";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { AiLabel } from "@/components/ui/notices";
import { Badge, Card, CardBody, CardHeader, LinkButton, Progress, toneForScore } from "@/components/ui/primitives";
import { TemplateSkeleton } from "@/components/modules/shared";
import { cn } from "@/lib/utils";

const KIND_TONE: Record<string, string> = { class: "bg-brand", study: "bg-sky", project: "bg-gold", career: "bg-teal" };

export function StudentHome() {
  const { t } = usePrefs();
  const { data, isLoading } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: () => apiFetch("/api/v1/students/me/dashboard", StudentDashboard),
  });

  if (isLoading || !data) return <TemplateSkeleton />;

  const hour = new Date().getHours();
  const greet = hour < 12 ? t("home.morning") : hour < 17 ? t("home.afternoon") : t("home.evening");

  return (
    <div className="space-y-6">
      {/* Hero — personal AI command center */}
      <section className="bg-notebook relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-ink-3">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className="mt-1 text-3xl font-semibold text-ink sm:text-4xl">
              {greet}, {data.name} 👋
            </h1>

            {/* Department and Academic Year information */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <GraduationCap className="size-4 text-brand" aria-hidden />
                <span>{data.department || "Computer Science & Engineering"}</span>
              </span>
              <span className="text-line-2" aria-hidden>•</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink">
                <Calendar className="size-3 text-ink-3" aria-hidden />
                <span>{data.year || "3rd Year"}</span>
                {data.semester ? (
                  <span className="font-normal text-ink-3">· Sem {data.semester}</span>
                ) : null}
              </span>
              {data.degree && (
                <>
                  <span className="hidden text-line-2 sm:inline" aria-hidden>•</span>
                  <span className="hidden text-xs text-ink-3 sm:inline">{data.degree}</span>
                </>
              )}
              {data.rollNo && (
                <>
                  <span className="hidden text-line-2 md:inline" aria-hidden>•</span>
                  <span className="hidden rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-3 md:inline">
                    {data.rollNo}
                  </span>
                </>
              )}
            </div>
            <div className="mt-4 rounded-xl border border-gold/30 bg-gold-soft/60 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber">
                <Sparkles className="size-4" aria-hidden /> Your AI Mentor · {t("home.priorities", { n: data.priorities })}
              </p>
              <div className="mt-1 text-ink">
                <SafeMarkdown>{data.recommendation}</SafeMarkdown>
              </div>
              <AiLabel />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <LinkButton href="/student/courses">
                {t("home.continue")} <ArrowRight className="size-4" />
              </LinkButton>
              <LinkButton href="/student/daily-plan" variant="secondary">
                {t("home.plan")}
              </LinkButton>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:w-80 lg:grid-cols-1">
            <Stat icon={<Flame className="size-4" />} label="Learning streak" value={`${data.streak} days`} tone="text-rose" />
            <Stat icon={<Trophy className="size-4" />} label="XP" value={data.xp.toLocaleString("en-IN")} tone="text-amber" />
            <Stat icon={<CalendarClock className="size-4" />} label={data.examCountdown.exam} value={`${data.examCountdown.days} days`} tone="text-brand" />
          </div>
        </div>
      </section>

      {/* Readiness */}
      <div className="grid gap-6 md:grid-cols-3">
        <MeterCard title="Academic" items={[["Semester progress", data.academic.semesterProgress], ["Exam readiness", data.academic.examReadiness]]} href="/student/academic-tracker" />
        <MeterCard title="Skills" items={[["Technical", data.skills.technical], ["Communication", data.skills.communication], ["Interview", data.skills.interview]]} href="/student/skill-graph" />
        <MeterCard title="Career" items={[["Career readiness", data.careerReadiness]]} href="/student/readiness" footer="Readiness is shown per dimension — see the full breakdown." />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Today" subtitle="Synced from your timetable and study plan" action={<LinkButton href="/student/daily-plan" variant="ghost" size="sm">Open planner</LinkButton>} />
          <CardBody>
            {data.today.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">No classes scheduled for today.</p>
            ) : (
              <ol className="space-y-2">
                {data.today.map((it, i) => (
                  <li key={`${it.time}-${i}`} className="flex items-center gap-4 rounded-lg border border-line px-4 py-3">
                    <span className="w-12 text-sm font-semibold tabular-nums text-ink-2">{it.time}</span>
                    <span className={cn("h-7 w-1 rounded-full", KIND_TONE[it.kind] ?? "bg-ink-3")} aria-hidden />
                    <span className="text-sm text-ink">{it.title}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Project" action={<Badge tone="gold">AI Review</Badge>} />
            <CardBody>
              <p className="font-medium text-ink">{data.project.name}</p>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={data.project.progress} tone="gold" label="Project progress" />
                <span className="text-sm tabular-nums text-ink-2">{data.project.progress}%</span>
              </div>
              <Link href="/student/projects" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                Open Project Hub <ArrowRight className="size-3.5" />
              </Link>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Upcoming" />
            <CardBody className="pt-3">
              {data.upcoming.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-3">No upcoming events or deadlines scheduled.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.upcoming.map((u, i) => (
                    <li key={`${u.title}-${i}`} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-ink">{u.title}</span>
                      <span className="text-ink-3">{u.when}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Weak topics to fix" subtitle={`Exam in ${data.examCountdown.days} days · ${data.examCountdown.syllabusCovered}% of syllabus covered`} action={<LinkButton href="/student/mock-tests" size="sm">Take adaptive test</LinkButton>} />
        <CardBody>
          {data.weakTopics.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-6 text-center">
              <p className="text-sm font-medium text-ink">No weak topics identified yet</p>
              <p className="mt-1 text-xs text-ink-3">
                Complete course quizzes and module assessments to generate personalized diagnostic focus areas.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {data.weakTopics.map((w, i) => (
                <div key={`${w.subject}-${w.topic}-${i}`} className="rounded-xl border border-line p-4">
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-rose" aria-hidden />
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{w.subject}</p>
                  </div>
                  <p className="mt-1 font-medium text-ink">{w.topic}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Progress value={w.mastery} tone={toneForScore(w.mastery)} label={`${w.topic} mastery`} />
                    <span className="text-xs tabular-nums text-ink-2">{w.mastery}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className={cn("flex items-center gap-1.5 text-xs font-medium", tone)}>
        {icon}
        <span className="truncate text-ink-3">{label}</span>
      </p>
      <p className="mt-1 font-serif text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function MeterCard({ title, items, href, footer }: { title: string; items: Array<[string, number]>; href: string; footer?: string }) {
  return (
    <Card>
      <CardHeader title={title} action={<Link href={href} className="text-xs font-medium text-brand hover:underline">Details</Link>} />
      <CardBody className="space-y-4">
        {items.map(([label, v]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-ink-2">{label}</span>
              <span className="font-semibold tabular-nums text-ink">{v}%</span>
            </div>
            <Progress value={v} tone={toneForScore(v)} label={label} />
          </div>
        ))}
        {footer ? <p className="text-xs text-ink-3">{footer}</p> : null}
      </CardBody>
    </Card>
  );
}
