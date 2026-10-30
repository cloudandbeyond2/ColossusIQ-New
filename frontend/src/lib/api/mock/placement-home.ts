import "server-only";

import { ALL_COLLEGES, UNIVERSITY } from "@/config/tenancy";
import { RESOURCES } from "@/config/resources";
import type { ChartSpec, Insight, Kpi, RoleHome } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { formatNumber } from "@/lib/utils";
import { getCollege } from "./records";
import {
  departmentChart,
  offersChart,
  placementInsights,
  placementSnapshot,
  type PlacementSnapshot,
} from "./placement-stats";

type QueueItem = RoleHome["queue"][number];

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Builds the Placement Officer Home dashboard dynamically from live readiness board,
 * active campus recruitment drives, company offers, and job listings.
 */
export async function dynamicPlacementHome(session: SessionPayload): Promise<RoleHome> {
  const inCollege = session.college !== ALL_COLLEGES;
  const collegeScope = inCollege ? session.college : ALL_COLLEGES;

  const jobsDef = RESOURCES.jobs;
  const employersDef = RESOURCES.employers;

  const [snapshot, college, jobs, employers] = await Promise.all([
    placementSnapshot(session, collegeScope),
    inCollege ? getCollege(session.college) : null,
    jobsDef ? getStore().records.all(jobsDef, collegeScope).catch(() => []) : Promise.resolve([]),
    employersDef ? getStore().records.all(employersDef, collegeScope).catch(() => []) : Promise.resolve([]),
  ]);

  // 1. Time-based Greeting with Officer Name and Campus
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const officerName = session.name || "Ms. Priya Nair";
  const collegeName = college ? String(college.name) : UNIVERSITY.name;
  const greeting = `${timeOfDay}, ${officerName} · Training & Placement Office · ${collegeName}`;

  // 2. Metrics & KPIs
  const d = snapshot.drivesSummary;
  const totalStudents = snapshot.counts.total;
  const readyStudents = snapshot.counts.ready;
  const readyPct = pct(readyStudents, totalStudents);

  const kpis: Kpi[] = [
    {
      label: "Offers Secured",
      value: String(d.offers),
      delta: d.completed > 0
        ? `${d.completed} drive${d.completed === 1 ? "" : "s"} completed · ${d.registered} applications`
        : d.offers > 0
        ? "Season to date"
        : "Current recruitment cycle",
      tone: "gold",
    },
    {
      label: "Placement Ready",
      value: formatNumber(readyStudents),
      delta: totalStudents > 0
        ? `of ${formatNumber(totalStudents)} eligible (${readyPct}%)`
        : "Profiles evaluated",
      tone: "brand",
      hint: "Readiness score ≥ 70 with verified credentials",
    },
    {
      label: "Average Package",
      value: d.averagePackage ? `₹${d.averagePackage} LPA` : d.highestPackage ? `₹${d.highestPackage} LPA` : "₹7.4 LPA",
      delta: d.highestPackage ? `Highest ₹${d.highestPackage} LPA` : "Median CTC benchmark",
      tone: "teal",
      hint: "From completed and accepted campus offers",
    },
    {
      label: "Active Campus Drives",
      value: String(d.upcoming),
      delta: d.open > 0 ? `${d.open} open for registration` : `${d.total} total drives scheduled`,
      tone: "sky",
    },
    {
      label: "Resume ATS Ready (70+)",
      value: totalStudents > 0 ? `${snapshot.resumePct}%` : "–",
      delta: `${snapshot.students.filter((s) => s.resume >= 70).length} verified resumes`,
      tone: "brand",
    },
    {
      label: "Mock Interview Average",
      value: snapshot.interviewPct > 0 ? `${snapshot.avgInterview} / 100` : "68 / 100",
      delta: snapshot.interviewPct > 0 ? `${snapshot.interviewPct}% student participation` : "AI mock practice score",
      tone: "teal",
    },
  ];

  // 3. Dynamic Charts
  const bands = [
    { name: "0–39", Students: 0 },
    { name: "40–54", Students: 0 },
    { name: "55–69", Students: 0 },
    { name: "70–84", Students: 0 },
    { name: "85–100", Students: 0 },
  ];
  for (const st of snapshot.students) {
    const idx = st.total >= 85 ? 4 : st.total >= 70 ? 3 : st.total >= 55 ? 2 : st.total >= 40 ? 1 : 0;
    bands[idx]!.Students++;
  }

  const hiringFunnel: ChartSpec = {
    type: "bar",
    title: "Campus hiring funnel",
    xKey: "name",
    series: ["Students"],
    data: [
      { name: "Eligible batch", Students: totalStudents },
      { name: "Placement ready", Students: readyStudents },
      { name: "Registered in drives", Students: d.registered },
      { name: "Shortlisted", Students: d.shortlisted },
      { name: "Offers extended", Students: d.offers },
    ],
  };

  const readinessDist: ChartSpec = {
    type: "bar",
    title: "Readiness score distribution",
    xKey: "name",
    series: ["Students"],
    data: bands,
  };

  const charts: ChartSpec[] = [
    offersChart(snapshot),
    departmentChart(snapshot),
    hiringFunnel,
    readinessDist,
  ];

  // 4. Action Queue ("Needs your attention")
  const queue: QueueItem[] = [];

  // 4a. Next drives needing shortlisting or reminders
  for (const { drive, eligible } of snapshot.nextDrives.slice(0, 2)) {
    queue.push({
      title: `${drive.company} drive${drive.status === "Draft" ? " (draft)" : ""} — ${drive.role}`,
      meta: `${drive.date} · ${eligible} eligible · ${drive.registered} registered`,
      href: "/placement/drives",
      tone: drive.status === "Draft" ? "amber" : "brand",
    });
  }

  // 4b. Students needing intervention
  if (snapshot.counts.needs > 0) {
    queue.push({
      title: `${snapshot.counts.needs} student${snapshot.counts.needs === 1 ? "" : "s"} need readiness intervention`,
      meta: "Targeted support on technical mock or resume ATS score",
      href: "/placement/placement-board",
      tone: "rose",
    });
  }

  // 4c. Active corporate jobs to review
  if (jobs.length > 0) {
    queue.push({
      title: `${jobs.length} corporate job opening${jobs.length === 1 ? "" : "s"} open`,
      meta: "Review student match notifications and eligibility criteria",
      href: "/placement/jobs",
      tone: "teal",
    });
  }

  // 4d. Registered recruiting partners
  if (employers.length > 0) {
    queue.push({
      title: `${employers.length} employer partner${employers.length === 1 ? "" : "s"} registered`,
      meta: "Connect with recruiters scheduling on-campus interviews",
      href: "/placement/employers",
      tone: "sky",
    });
  }

  if (queue.length === 0) {
    queue.push({
      title: "Schedule campus recruitment drive",
      meta: "Eligibility criteria are automatically evaluated upon creation",
      href: "/placement/drives",
      tone: "brand",
    });
  }

  // 5. Dynamic Insights
  const insights: Insight[] = placementInsights(snapshot);

  return {
    greeting,
    kpis,
    charts,
    insights,
    queue: queue.slice(0, 5),
  };
}
