"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Code2,
  ExternalLink,
  Globe,
  Layers,
  Sparkles,
  Users,
} from "lucide-react";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { Project } from "@/lib/api/schemas";
import { ChartView } from "@/components/charts/chart-card";
import { TemplateSkeleton } from "@/components/modules/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Progress,
  toneClasses,
  toneForScore,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function ProjectReviewModule() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch("/api/v1/projects", z.array(Project)),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeProject = useMemo(() => {
    if (!projects || projects.length === 0) return null;
    if (selectedId) {
      const found = projects.find((p) => p.id === selectedId);
      if (found) return found;
    }
    // Default to the project that has a review, or the first one
    return (
      projects.find((p) => p.review && (p.review.architecture > 0 || p.review.testing > 0)) ||
      projects[0]!
    );
  }, [projects, selectedId]);

  if (isLoading) return <TemplateSkeleton />;

  if (!projects || projects.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed">
        <EmptyState
          title="No student projects submitted yet"
          body="Projects created by students or assigned to your department will appear here for AI & faculty review."
        />
      </Card>
    );
  }

  const p = activeProject || projects[0]!;
  const rev = p.review || {
    architecture: 80,
    documentation: 75,
    codeQuality: 78,
    testing: 72,
    innovation: 85,
  };

  const arch = rev.architecture || 75;
  const doc = rev.documentation || 70;
  const code = rev.codeQuality || 75;
  const test = rev.testing || 70;
  const innov = rev.innovation || 80;
  const pres = Math.round((arch + doc + code + test + innov) / 5);

  const dimensions = [
    { name: "Architecture", score: arch, target: 75 },
    { name: "Documentation", score: doc, target: 75 },
    { name: "Code quality", score: code, target: 75 },
    { name: "Test coverage", score: test, target: 70 },
    { name: "Innovation", score: innov, target: 70 },
    { name: "Presentation", score: pres, target: 75 },
  ];

  const overall = Math.round(dimensions.reduce((a, b) => a + b.score, 0) / dimensions.length);

  const radarSpec = {
    type: "radar" as const,
    title: `${p.title} — review report`,
    xKey: "name",
    series: ["Current", "Target"],
    data: dimensions.map((d) => ({ name: d.name, Current: d.score, Target: d.target })),
  };

  // Strengths
  const strengths: string[] = [];
  if (innov >= 80) strengths.push(`High innovation index (${innov}%) in ${p.domain}`);
  if (arch >= 80) strengths.push("Robust modular system architecture verified");
  if (test >= 80) strengths.push(`Strong testing benchmark (${test}%) meets criteria`);
  if (code >= 80) strengths.push("Clean codebase structure and repository practices");
  if (strengths.length === 0) strengths.push("Active milestone deliverables submitted for faculty review");

  // Gaps
  const gaps: string[] = [];
  if (test < 75) gaps.push(`Automated test coverage is at ${test}% (target 75%)`);
  if (doc < 75) gaps.push("Architecture documentation requires updated IEEE citations");
  if (gaps.length === 0) gaps.push("Maintain commit consistency before final capstone sign-off");

  // Plan
  const plan: string[] = [];
  if (rev.facultyFeedback) {
    plan.push(`Faculty Guide Directive: "${rev.facultyFeedback}"`);
  }
  plan.push("Verify edge telemetry and battery failover bench tests");
  plan.push("Rehearse capstone defense with AI Viva Simulator");

  return (
    <div className="space-y-6">
      {/* MULTI-PROJECT TEAM SELECTOR HEADER */}
      <Card className="p-4 bg-surface-2 border-line">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal">
                Department Projects Evaluation
              </span>
              <Badge tone="teal">{projects.length} Total Projects</Badge>
            </div>
            <h2 className="text-sm font-medium text-ink">
              Select a student project to review AI evaluation & faculty rubric scorecards:
            </h2>
          </div>

          <div className="min-w-64">
            <select
              value={p.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink focus:border-brand focus:outline-none shadow-xs"
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.title} ({proj.stage} · {proj.progress}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TEAM MEMBERS & ARTIFACT PILLS FOR THE SELECTED PROJECT */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3 text-xs text-ink-2">
          <div className="flex flex-wrap items-center gap-2">
            <Users className="size-4 text-teal" />
            <span className="font-semibold text-ink">Team:</span>
            <span>{p.team.join(", ")}</span>
            <span className="text-ink-3">·</span>
            <span className="text-ink-3">Mentor: {p.mentor}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={p.stage === "Portfolio" || p.stage === "Demo" ? "teal" : "gold"}>
              Stage: {p.stage} ({p.progress}%)
            </Badge>

            <Link
              href="/faculty/projects"
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-teal hover:border-teal/40 transition-colors"
            >
              <span>Grade in Project Hub</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </Card>

      {/* RADAR CHART & DIMENSIONS */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title={`${p.title} — review report`}
            subtitle="Dimension-level view — no single number decides outcomes"
          />
          <div className="px-3 pb-4">
            <ChartView spec={radarSpec} height={310} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Dimensions" subtitle={`Overall ${overall}%`} />
          <CardBody className="space-y-4">
            {dimensions.map((d) => (
              <div key={d.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-ink">{d.name}</span>
                  <span className="tabular-nums text-ink-2">
                    {d.score}
                    <span className="text-ink-3"> / target {d.target}</span>
                  </span>
                </div>
                <div className="relative">
                  <Progress
                    value={d.score}
                    tone={d.score >= d.target ? "teal" : toneForScore(d.score)}
                    label={d.name}
                  />
                  <span
                    className="absolute top-[-2px] h-3 w-0.5 bg-ink"
                    style={{ left: `${d.target}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* STRENGTHS, GAPS, IMPROVEMENT PLAN */}
      <div className="grid gap-6 md:grid-cols-3">
        <ListCard title="Strengths" items={strengths} tone="teal" />
        <ListCard title="Gaps" items={gaps} tone="amber" />
        <ListCard title="Improvement plan" items={plan} tone="brand" numbered />
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
  tone,
  numbered,
}: {
  title: string;
  items: string[];
  tone: "teal" | "amber" | "brand";
  numbered?: boolean;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={it} className="flex gap-2.5 text-sm text-ink-2">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  toneClasses[tone]
                )}
              >
                {numbered ? i + 1 : <CheckCircle2 className="size-3.5" aria-hidden />}
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
