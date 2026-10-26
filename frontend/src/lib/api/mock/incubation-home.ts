import "server-only";
import { INCUBATION_STAGES } from "@/lib/api/incubation-schemas";
import type { ChartSpec, Insight, Kpi, RoleHome } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { getCollege } from "./records";
import { formatInr, incubationCollege, parseInr } from "./incubation-common";
import { incubationData } from "./incubation-data";
import { getFundingReadinessOverview } from "./funding-readiness-store";

type QueueItem = RoleHome["queue"][number];

/** The Incubation Head's home, built from the college's own ventures, startups and mentors. */
export async function dynamicIncubationHome(session: SessionPayload): Promise<RoleHome> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const [ventures, startups, mentors, assignments, sessions, funding, c] = await Promise.all([
    data.ventures(college),
    data.startups(college),
    data.mentors(college),
    data.assignments(college),
    data.sessionCounts(college),
    getFundingReadinessOverview(session),
    getCollege(college),
  ]);
  const collegeName = String(c?.name ?? "College");

  const mentored = new Set(assignments.map((a) => a.ventureId));
  const unmentored = ventures.filter((v) => !mentored.has(v.id) && (!v.mentorName || v.mentorName === "Unassigned"));
  const inReview = ventures.filter((v) => v.stage === "Incubation Review");
  const incubated = ventures.filter((v) => v.stage === "Incubated").length;
  const available = mentors.filter((m) => m.availability === "Available").length;
  const totalSessions = Object.values(sessions).reduce((a, n) => a + n, 0);
  const grants = ventures.reduce((a, v) => a + parseInr(v.grantAmount), 0);
  const raised = startups.reduce((a, s) => a + parseInr(s.fundingRaised), 0);
  const unevaluated = funding.allVentures.filter((v) => v.readinessScore === 0).length;

  const kpis: Kpi[] = [
    { label: "Ventures in pipeline", value: String(ventures.length), delta: `${incubated} incubated`, tone: "brand" },
    { label: "Startups in portfolio", value: String(startups.length), delta: raised > 0 ? `${formatInr(raised)} raised` : "No funding recorded", tone: "teal" },
    { label: "Mentors", value: String(mentors.length), delta: mentors.length ? `${available} available` : "None invited yet", tone: "gold" },
    { label: "Funding-ready", value: String(funding.angelReadyCount), delta: funding.allVentures.length ? `of ${funding.allVentures.length} startups` : "No startups yet", tone: "sky" },
    { label: "Seed grants approved", value: grants > 0 ? formatInr(grants) : "—", delta: "Across the pipeline", tone: grants > 0 ? "teal" : "neutral" },
    { label: "Mentor sessions logged", value: String(totalSessions), delta: "All time", tone: "brand" },
  ];

  const stageChart: ChartSpec = {
    type: "bar",
    title: "Pipeline by stage",
    xKey: "name",
    series: ["Ventures"],
    data: INCUBATION_STAGES.map((stg) => ({ name: stg, Ventures: ventures.filter((v) => v.stage === stg).length })),
  };
  const domains = new Map<string, number>();
  for (const d of [...ventures.map((v) => v.domain), ...startups.map((s) => s.domain)]) domains.set(d, (domains.get(d) ?? 0) + 1);
  const domainChart: ChartSpec = {
    type: "donut",
    title: "Ventures and startups by domain",
    xKey: "name",
    series: ["value"],
    data: domains.size ? [...domains].map(([name, value]) => ({ name, value })) : [{ name: "None yet", value: 0 }],
  };

  const queue: QueueItem[] = [];
  if (inReview.length) queue.push({ title: `${inReview.length} venture${inReview.length > 1 ? "s" : ""} awaiting incubation review`, meta: inReview.slice(0, 3).map((v) => v.name).join(", "), href: "/incubation/incubation-pipeline", tone: "brand" });
  if (unmentored.length) queue.push({ title: `Assign mentors to ${unmentored.length} venture${unmentored.length > 1 ? "s" : ""}`, meta: mentors.length ? "No mentor assigned yet" : "Invite mentors first", href: "/incubation/mentors", tone: "amber" });
  if (unevaluated) queue.push({ title: `${unevaluated} startup${unevaluated > 1 ? "s" : ""} not yet scored for funding readiness`, meta: "Score the six readiness dimensions", href: "/incubation/funding-readiness", tone: "sky" });
  if (!ventures.length && !startups.length) queue.push({ title: "Add your first venture", meta: "Start in the Incubation Pipeline", href: "/incubation/incubation-pipeline", tone: "brand" });
  if (!mentors.length) queue.push({ title: "Invite your first mentor", meta: "Build the mentor network", href: "/incubation/mentors", tone: "gold" });

  const insights: Insight[] = [];
  const open = INCUBATION_STAGES.filter((s) => s !== "Incubated").map((s) => ({ s, n: ventures.filter((v) => v.stage === s).length }));
  const busiest = [...open].sort((a, b) => b.n - a.n)[0];
  if (busiest && busiest.n > 0 && ventures.length >= 3) {
    insights.push({
      title: `Most ventures are at ${busiest.s}`,
      body: `${busiest.n} of ${ventures.length} ventures are at this stage. Check whether they need mentor time or a review slot to move on.`,
      evidence: "Incubation pipeline, all cohorts",
      tone: "amber",
    });
  }
  const evaluated = funding.allVentures.filter((v) => v.readinessScore > 0);
  if (evaluated.length) {
    insights.push({
      title: "Funding readiness",
      body: `Average readiness is ${funding.averageReadinessScore}% across ${evaluated.length} scored startup${evaluated.length > 1 ? "s" : ""}; ${funding.angelReadyCount} ${funding.angelReadyCount === 1 ? "is" : "are"} ready for angel or VC conversations, with ${funding.criticalGapsCount} investor gap${funding.criticalGapsCount === 1 ? "" : "s"} noted.`,
      evidence: "Funding readiness evaluations",
      tone: funding.angelReadyCount > 0 ? "teal" : "sky",
    });
  }
  if (!insights.length) {
    insights.push({ title: "Nothing to report yet", body: "Insights appear here once ventures, startups and mentors have been added.", evidence: "No incubation records yet", tone: "sky" });
  }

  return { greeting: `${collegeName} — Innovation & Incubation`, kpis, charts: [stageChart, domainChart], insights, queue };
}
