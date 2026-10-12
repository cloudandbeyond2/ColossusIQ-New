"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Calendar, FileText, GraduationCap, Sparkles, UserCheck, Users } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { RoleHome } from "@/lib/api/schemas";
import { ChartCard } from "@/components/charts/chart-card";
import { InsightList, KpiGrid, TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import { Card, CardHeader, LinkButton, Progress, toneBar } from "@/components/ui/primitives";
import { safeNextPath } from "@/lib/security/redirect";
import { cn, formatNumber } from "@/lib/utils";

const SHORTCUTS = [
  { title: "Admissions", href: "/institution/admissions", icon: GraduationCap, desc: "Student application pipeline & enrollment" },
  { title: "Staff Directory", href: "/institution/staff", icon: Users, desc: "Teaching & administrative faculty records" },
  { title: "Departments", href: "/institution/departments", icon: Building2, desc: "Academic departments & performance" },
  { title: "Courses & Curriculum", href: "/institution/courses", icon: BookOpen, desc: "Active & draft courses across semesters" },
  { title: "Campus Events", href: "/institution/events", icon: Calendar, desc: "Seminars, workshops & campus calendar" },
  { title: "User Accounts", href: "/institution/users", icon: UserCheck, desc: "Role assignments & security credentials" },
  { title: "RAG Knowledge Base", href: "/institution/knowledge-base", icon: Sparkles, desc: "Institutional guidelines & AI syllabus grounding" },
  { title: "Reports & Audits", href: "/institution/reports", icon: FileText, desc: "Accreditation, academic & placement reports" },
];

export function InstitutionHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["home", "institution"],
    queryFn: () => apiFetch("/api/v1/home/institution", RoleHome),
  });

  if (isLoading || !data) return <TemplateSkeleton />;

  const college = data.college;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <section className="bg-hero-glow relative overflow-hidden rounded-3xl px-6 py-7 text-white shadow-lg shadow-brand/20 sm:px-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:28px_28px]"
          aria-hidden
        />
        <Fi name="school" className="pointer-events-none absolute -bottom-8 right-6 text-[160px] text-white/[0.06]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <Fi name="building" /> College Command Center
              </span>
              {college?.code ? (
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
                  Affiliation #{college.code}
                </span>
              ) : null}
              {college?.city ? (
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
                  {college.city}
                </span>
              ) : null}
              {college?.type ? (
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
                  {college.type}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">{data.greeting}</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-white/80">
              {college?.principal ? `${college.principal} · ` : ""}
              Live institutional command center with real-time analytics across admissions, faculty, academic departments, courses and readiness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/institution/admissions/new" variant="gold" size="lg">
              <Fi name="plus" /> New Admission
            </LinkButton>
            <LinkButton href="/institution/departments" size="lg" className="bg-white/15 text-white hover:bg-white/25">
              Departments
            </LinkButton>
            <LinkButton href="/institution/staff" size="lg" className="bg-white/15 text-white hover:bg-white/25">
              Staff Roster
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Real-time KPI Cards */}
      <KpiGrid kpis={data.kpis} />

      {/* Dynamic Charts & Attention Queue */}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {data.charts.map((c) => (
            <ChartCard key={c.title} spec={c} />
          ))}
        </div>
        <Card className="h-fit">
          <CardHeader title="Needs your attention" subtitle={`${data.queue.length} actionable items`} />
          <ul className="divide-y divide-line p-2">
            {data.queue.map((q) => (
              <li key={q.title}>
                <Link
                  href={safeNextPath(q.href, "/institution")}
                  className="group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface-2"
                >
                  <span className={cn("h-9 w-1 shrink-0 rounded-full", toneBar[q.tone])} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink transition-colors group-hover:text-brand">
                      {q.title}
                    </span>
                    <span className="block text-xs text-ink-3">{q.meta}</span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Live Academic Departments Snapshot */}
      {data.departments && data.departments.length > 0 ? (
        <Card>
          <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Academic Departments Snapshot</h2>
              <p className="text-xs text-ink-3">Live staffing, student enrolment and placement readiness across departments</p>
            </div>
            <LinkButton href="/institution/departments" variant="secondary" size="sm">
              View all departments <ArrowRight className="size-3.5" />
            </LinkButton>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2/60 text-xs font-semibold uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Head of Department</th>
                  <th className="px-5 py-3 text-right">Faculty</th>
                  <th className="px-5 py-3 text-right">Students</th>
                  <th className="px-5 py-3 text-right">Programmes</th>
                  <th className="px-5 py-3 min-w-44">Placement Readiness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.departments.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-surface-2/40">
                    <td className="px-5 py-3.5 font-medium text-ink">
                      <Link href={`/institution/departments/${d.id}`} className="hover:text-brand hover:underline">
                        {d.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-ink-2">{d.head || "—"}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-ink">{formatNumber(d.faculty)}</td>
                    <td className="px-5 py-3.5 text-right text-ink-2">{formatNumber(d.students)}</td>
                    <td className="px-5 py-3.5 text-right text-ink-2">{d.programmes ?? 1}</td>
                    <td className="px-5 py-3.5">
                      {d.students > 0 ? (
                        <div className="flex items-center gap-3">
                          <Progress
                            value={d.readiness}
                            tone={d.readiness >= 75 ? "teal" : d.readiness >= 60 ? "brand" : "amber"}
                            className="flex-1"
                          />
                          <span className="w-10 text-right text-xs font-semibold text-ink">{d.readiness}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-3">No active cohort</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* AI Institutional Insights */}
      <InsightList insights={data.insights} />

      {/* Quick Access Module Hub */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink">Management Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group relative flex flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand/30 hover:shadow-sm"
              >
                <div>
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-surface-2 text-ink group-hover:bg-brand-soft group-hover:text-brand transition-colors">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-ink group-hover:text-brand transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs text-ink-3 line-clamp-2">{item.desc}</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-brand">
                  Open module <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
