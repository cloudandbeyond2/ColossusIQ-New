import "server-only";

import type { ChartSpec, Insight, Kpi, RoleHome } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { formatNumber } from "@/lib/utils";
import {
  getInterviewsOverview,
  getShortlistsOverview,
  searchCandidates,
} from "./recruiter-store";

type QueueItem = RoleHome["queue"][number];

/**
 * Builds the Recruiter Home dashboard dynamically from live talent search candidates,
 * active shortlists, and scheduled candidate interviews.
 */
export async function dynamicRecruiterHome(session: SessionPayload): Promise<RoleHome> {
  const [talent, shortlistsData, interviewsData] = await Promise.all([
    searchCandidates(session),
    getShortlistsOverview(session),
    getInterviewsOverview(session),
  ]);

  const candidates = talent.candidates || [];
  const shortlists = shortlistsData.shortlists || [];
  const interviews = interviewsData.interviews || [];

  // 1. Time-based Greeting
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const recruiterName = session.name || "Rahul Mehta";
  const greeting = `${timeOfDay}, ${recruiterName} · TechNova Talent Workspace`;

  // 2. Metrics & KPIs
  const totalCandidates = talent.totalCandidates || candidates.length;
  const highReadinessCount = talent.highReadinessCount ?? candidates.filter((c) => c.readiness >= 80).length;
  const totalShortlisted = shortlistsData.totalShortlisted || shortlists.length;
  const scheduledInterviews = interviews.filter((i) => i.status === "Scheduled");
  const upcomingToday = interviewsData.upcomingTodayCount ?? interviews.filter((i) => i.status === "Scheduled" && i.dateTime.toLowerCase().includes("today")).length;
  const offersCount = shortlists.filter((s) => s.stage === "Offer Extended" || s.stage === "Hired").length;
  const hiredCount = shortlists.filter((s) => s.stage === "Hired").length;

  const kpis: Kpi[] = [
    {
      label: "Verified Profiles",
      value: formatNumber(totalCandidates),
      delta: `${highReadinessCount} job-ready (≥80%)`,
      tone: "brand",
      hint: "AI-verified credentials & projects",
    },
    {
      label: "Active Shortlists",
      value: String(totalShortlisted),
      delta: shortlistsData.inInterviewCount > 0
        ? `${shortlistsData.inInterviewCount} in interviews`
        : totalShortlisted > 0
        ? "Active pipeline"
        : "No shortlists yet",
      tone: "gold",
    },
    {
      label: "Scheduled Interviews",
      value: String(scheduledInterviews.length),
      delta: upcomingToday > 0
        ? `${upcomingToday} today`
        : interviewsData.thisWeekCount > 0
        ? `${interviewsData.thisWeekCount} this week`
        : scheduledInterviews.length > 0
        ? "Upcoming panels"
        : "None scheduled",
      tone: "sky",
    },
    {
      label: "Offers Extended",
      value: String(offersCount),
      delta: hiredCount > 0 ? `${hiredCount} hired` : offersCount > 0 ? "Pending acceptance" : "Season to date",
      tone: "teal",
    },
  ];

  // 3. Dynamic Charts
  // Chart 1: Candidates by Readiness Band (Histogram)
  const bands = [
    { name: "50–59", min: 50, max: 59 },
    { name: "60–69", min: 60, max: 69 },
    { name: "70–79", min: 70, max: 79 },
    { name: "80–89", min: 80, max: 89 },
    { name: "90+", min: 90, max: 100 },
  ];

  const readinessData = bands.map((b) => ({
    name: b.name,
    Candidates: candidates.filter((c) => c.readiness >= b.min && c.readiness <= b.max).length,
  }));

  const readinessChart: ChartSpec = {
    type: "bar",
    title: "Candidates by readiness band",
    xKey: "name",
    series: ["Candidates"],
    data: readinessData,
  };

  // Chart 2: Pipeline by Stage or Department Breakdown
  const stages = [
    "Shortlisted",
    "Technical Assessment",
    "Technical Interview",
    "HR Round",
    "Offer Extended",
    "Hired",
  ];

  const stageData = stages.map((stg) => ({
    name: stg.replace("Technical ", "Tech "),
    Candidates: shortlists.filter((s) => s.stage === stg).length,
  }));

  // Fallback to department distribution if no candidates in pipeline yet
  const deptMap = new Map<string, number>();
  for (const c of candidates) {
    const shortDept = c.department.replace(/Engineering|Department of/gi, "").trim();
    deptMap.set(shortDept, (deptMap.get(shortDept) ?? 0) + 1);
  }
  const deptData = [...deptMap.entries()]
    .map(([name, Candidates]) => ({ name: name.length > 15 ? `${name.slice(0, 13)}…` : name, Candidates }))
    .sort((a, b) => b.Candidates - a.Candidates)
    .slice(0, 6);

  const pipelineChart: ChartSpec = totalShortlisted > 0
    ? {
        type: "bar",
        title: "Hiring pipeline conversion",
        xKey: "name",
        series: ["Candidates"],
        data: stageData,
      }
    : {
        type: "bar",
        title: "Talent pool by department",
        xKey: "name",
        series: ["Candidates"],
        data: deptData.length > 0 ? deptData : [{ name: "No records", Candidates: 0 }],
      };

  // 4. Attention Queue
  const queue: QueueItem[] = [];

  const pendingFeedbackCount = interviewsData.pendingFeedbackCount ?? interviews.filter((i) => i.status === "Completed" && i.recommendation === "Pending Evaluation").length;
  if (pendingFeedbackCount > 0) {
    queue.push({
      title: `Submit feedback for ${pendingFeedbackCount} interview${pendingFeedbackCount > 1 ? "s" : ""}`,
      meta: "Rubric score & hire recommendation pending",
      href: "/recruiter/recruiter-interviews",
      tone: "amber",
    });
  }

  if (upcomingToday > 0) {
    const todaySlot = interviews.find((i) => i.status === "Scheduled" && i.dateTime.toLowerCase().includes("today"));
    queue.push({
      title: `${upcomingToday} interview${upcomingToday > 1 ? "s" : ""} scheduled today`,
      meta: todaySlot ? `${todaySlot.candidateName} · ${todaySlot.round} (${todaySlot.dateTime.split(", ")[1] || todaySlot.dateTime})` : "Review panel schedule & meet links",
      href: "/recruiter/recruiter-interviews",
      tone: "sky",
    });
  }

  if (shortlistsData.inAssessmentCount > 0) {
    queue.push({
      title: `Review ${shortlistsData.inAssessmentCount} candidate${shortlistsData.inAssessmentCount > 1 ? "s" : ""} in Technical Assessment`,
      meta: "Assessment results ready for stage transition",
      href: "/recruiter/shortlists",
      tone: "brand",
    });
  }

  if (queue.length < 3 && talent.availableForHireCount > 0) {
    queue.push({
      title: `Explore ${talent.availableForHireCount} verified candidate${talent.availableForHireCount > 1 ? "s" : ""}`,
      meta: `${highReadinessCount} high-readiness candidates available for shortlisting`,
      href: "/recruiter/talent-search",
      tone: "teal",
    });
  }

  if (queue.length < 3) {
    queue.push({
      title: "Schedule candidate interview panels",
      meta: "Coordinate technical and cultural assessment rounds",
      href: "/recruiter/recruiter-interviews",
      tone: "gold",
    });
  }

  // 5. Dynamic Insights
  const avgReadiness = candidates.length
    ? Math.round(candidates.reduce((sum, c) => sum + (c.readiness || 0), 0) / candidates.length)
    : 78;

  const insights: Insight[] = [
    {
      title: "Talent Pool Readiness Index",
      body: `Average candidate readiness across the pool is ${avgReadiness}%. ${highReadinessCount} candidates meet or exceed the 80% benchmark with verified project repositories and academic scores.`,
      evidence: "Verified student profile evaluations",
      tone: "brand",
    },
  ];

  if (totalShortlisted > 0) {
    const activeRoles = new Set(shortlists.map((s) => s.roleRequisition));
    const roleList = [...activeRoles].slice(0, 2).join(", ");
    insights.push({
      title: "Active Requisitions & Pipeline",
      body: `You have ${totalShortlisted} candidate${totalShortlisted === 1 ? "" : "s"} in review across ${activeRoles.size} active role${activeRoles.size === 1 ? "" : "s"}${roleList ? ` (${roleList}${activeRoles.size > 2 ? ", …" : ""})` : ""}. ${shortlistsData.inInterviewCount} are progressing through active interview rounds.`,
      evidence: "Shortlists and interview status tracking",
      tone: "teal",
    });
  } else {
    insights.push({
      title: "Profiles are verified, not ranked",
      body: "Candidate readiness is measured across academics, technical projects, and assessments. Shortlist candidates directly from Talent Search to track them in your pipeline.",
      evidence: "ColossusIQ verified readiness policy",
      tone: "sky",
    });
  }

  return {
    greeting,
    department: "Talent Acquisition",
    kpis,
    charts: [readinessChart, pipelineChart],
    insights,
    queue,
  };
}
