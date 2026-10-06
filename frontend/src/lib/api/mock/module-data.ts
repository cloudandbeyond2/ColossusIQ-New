import "server-only";
import type {
  CalendarData,
  ChartSpec,
  ChatData,
  Column,
  DashboardData,
  GalleryData,
  GeneratorData,
  Insight,
  Kpi,
  ListData,
  ModuleData,
  ScorecardData,
  SettingsData,
  WorkflowData,
} from "@/lib/api/schemas";
import { findModule, type ModuleDef } from "@/config/modules";
import { TENANTS, hashString, personName, seeded } from "./fixtures";
import { ADMISSION_FLOW, RESOURCES } from "@/config/resources";
import type { ResourceRecord } from "@/config/resources";
import type { Stream } from "@/config/streams";
import { ALL_COLLEGES } from "@/config/tenancy";
import { getStore, dataBackend } from "@/lib/data";
import { db } from "@/lib/data/postgres/db";
import { collegeStream } from "./records";
import { dynamicBiAnalytics } from "./bi-analytics";
import { getCollegeClubs } from "./clubs";
import { getCollegeSports } from "./sports";
import { getCollegeCalendar } from "./academic-calendar";
import { getStudentsList } from "./students-store";
import { kbStore } from "./knowledge-store";
import type { SessionPayload } from "@/lib/auth/session";
import {
  generateDynamicAcademicTracker,
  generateDynamicAchievements,
  generateDynamicAlumni,
  generateDynamicCareer,
  generateDynamicCertifications,
  generateDynamicCommunication,
  generateDynamicDailyPlan,
  generateDynamicExamPrep,
  generateDynamicExperience,
  generateDynamicHackathons,
  generateDynamicJobs,
  generateDynamicMissionPlanner,
  generateDynamicPassport,
  generateDynamicReadiness,
  generateDynamicRefreshZone,
  generateDynamicSkillGraph,
  generateDynamicStartupHub,
  generateDynamicStudyTwin,
  generateDynamicTeamFinder,
} from "./student-profile";

/** Live data a builder may need, fetched once per request. */
interface ScopeData {
  stream: Stream | null;
  admissions: ResourceRecord[];
  session?: SessionPayload;
}
import {
  aicteCompliance,
  cbcsElectives,
  competencyLogbook,
  hospitalDashboard,
  naacReadiness,
  nmcCompliance,
  osceStations,
  relabelSubjects,
} from "./stream-content";

/* ── small builders ─────────────────────────────── */
type Tone = Kpi["tone"];
const k = (label: string, value: string, delta?: string, tone: Tone = "brand", hint?: string): Kpi => ({ label, value, delta, tone, hint });
const ins = (title: string, body: string, evidence: string, tone: Tone = "brand"): Insight => ({ title, body, evidence, tone });
const col = (key: string, label: string, kind: Column["kind"] = "text"): Column => ({ key, label, kind });
const MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

function trend(seed: string, series: string[], base = 60, spread = 20, labels = MONTHS) {
  const rnd = seeded(hashString(seed));
  return labels.map((name, i) => {
    const row: Record<string, string | number> = { name };
    series.forEach((s, j) => {
      row[s] = Math.round(base + i * 2 + (rnd() - 0.5) * spread - j * 6);
    });
    return row;
  });
}
function cats(seed: string, names: string[], series: string[], base = 60, spread = 30) {
  const rnd = seeded(hashString(seed));
  return names.map((name) => {
    const row: Record<string, string | number> = { name };
    series.forEach((s) => (row[s] = Math.round(base + (rnd() - 0.5) * spread)));
    return row;
  });
}
const chart = (type: ChartSpec["type"], title: string, data: ChartSpec["data"], series: string[]): ChartSpec => ({ type, title, data, series, xKey: "name" });

const dashboard = (kpis: Kpi[], charts: ChartSpec[], insights: Insight[]): DashboardData => ({ template: "dashboard", kpis, charts, insights });
const list = (columns: Column[], rows: ListData["rows"], filterKey?: string, primaryAction?: string): ListData => ({ template: "list", columns, rows, filterKey, primaryAction });
const stagesOf = (title: string, steps: Array<[string, string, string[]?]>, activeIndex: number): WorkflowData => ({
  template: "workflow",
  title,
  stages: steps.map(([t, d, items], i) => ({ title: t, description: d, items: items ?? [], status: i < activeIndex ? "done" : i === activeIndex ? "active" : "todo" })),
});
const score = (headline: string, dims: Array<[string, number, number]>, strengths: string[], gaps: string[], plan: string[]): ScorecardData => ({
  template: "scorecard",
  headline,
  overall: Math.round(dims.reduce((a, [, s]) => a + s, 0) / dims.length),
  dimensions: dims.map(([name, s, target]) => ({ name, score: s, target })),
  strengths,
  gaps,
  plan,
});
const gallery = (items: Array<[string, string, string, string, Tone?, number?]>): GalleryData => ({
  template: "gallery",
  items: items.map(([title, description, tag, meta, tone, progress]) => ({ title, description, tag, meta, tone: tone ?? "brand", progress })),
});

function rows<T extends Record<string, string | number>>(n: number, seed: string, make: (i: number, r: () => number) => T): T[] {
  const r = seeded(hashString(seed));
  return Array.from({ length: n }, (_, i) => make(i, r));
}
const pick = <T,>(arr: readonly T[], r: () => number): T => arr[Math.floor(r() * arr.length)] as T;

/* ── per-module data ─────────────────────────────── */
/** Admission insights are computed live from the admissions store, so they move as records change. */
function admissionInsights(_collegeScope: string, live: ScopeData): DashboardData {
  // Tenant isolation: the store only returns the caller's college ("all" is the university-wide view).
  const rows = live.admissions;
  const count = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).length;
  const reached = (stage: string) => count((r) => ADMISSION_FLOW.indexOf(String(r.status) as (typeof ADMISSION_FLOW)[number]) >= ADMISSION_FLOW.indexOf(stage as (typeof ADMISSION_FLOW)[number]));
  const enrolled = count((r) => r.status === "Enrolled");
  const applied = reached("Applied");
  const avg = rows.length ? rows.reduce((a, r) => a + (typeof r.hscPercent === "number" ? r.hscPercent : 0), 0) / rows.length : 0;
  const byProgram = new Map<string, number>();
  for (const r of rows) {
    const program = String(r.program).replace(/^(B\.E\.|B\.Tech|M\.E\.) /, "");
    byProgram.set(program, (byProgram.get(program) ?? 0) + 1);
  }
  const byCategory = new Map<string, number>();
  for (const r of rows) byCategory.set(String(r.category), (byCategory.get(String(r.category)) ?? 0) + 1);
  return dashboard(
    [
      k("Applications", String(rows.length), "Current cycle", "brand"),
      k("Enrolled", String(enrolled), applied ? `${Math.round((enrolled / applied) * 100)}% of applicants` : undefined, "teal"),
      k("Offers pending", String(count((r) => r.status === "Offer sent")), undefined, "gold"),
      k("Average 12th %", avg.toFixed(1), undefined, "sky"),
    ],
    [
      chart("bar", "Admission funnel", ADMISSION_FLOW.map((s) => ({ name: s.replace("Documents verified", "Docs verified"), Applicants: reached(s) })), ["Applicants"]),
      chart("donut", "Community / category mix", [...byCategory].map(([name, value]) => ({ name, value })), ["value"]),
      chart("bar", "Demand by programme", [...byProgram].sort((a, b) => b[1] - a[1]).map(([name, v]) => ({ name: name.split(" ").slice(0, 2).join(" "), Applications: v })), ["Applications"]),
      chart("line", "Applications per week", trend("adm-w", ["Applications"], 40, 20, ["W1", "W2", "W3", "W4", "W5", "W6"]), ["Applications"]),
    ],
    [
      ins("Document verification is the bottleneck", "Applicants stall most between Applied and Documents verified. Consider a verification help desk.", `${reached("Applied") - reached("Documents verified")} of ${reached("Applied")} applicants not yet verified`, "amber"),
      ins("Scholarship interest", `${count((r) => r.scholarship === true)} applicants requested scholarship support.`, "Admissions records · scholarship flag", "sky"),
    ],
  );
}

const DATA: Record<string, (collegeScope: string, live: ScopeData) => ModuleData | Promise<ModuleData>> = {
  "admission-insights": admissionInsights,
  "competency-logbook": competencyLogbook,
  osce: osceStations,
  "hospital-dashboard": hospitalDashboard,
  "nmc-compliance": nmcCompliance,
  "naac-readiness": naacReadiness,
  "aicte-compliance": aicteCompliance,
  "cbcs-electives": (_scope, live) => cbcsElectives(live.stream),
  "bi-analytics": async (scope, live) => {
    const session = live.session ?? { college: scope, sub: "demo-institution", role: "institution" as const, name: "Principal", tenant: "TNTU", mfa: true, exp: 0 };
    const res = await dynamicBiAnalytics(session, scope !== "all" ? scope : undefined);
    return {
      template: "dashboard",
      kpis: res.kpis,
      charts: res.charts,
      insights: res.insights,
    };
  },
  "academic-tracker": (scope, live) => generateDynamicAcademicTracker(live.session ?? { college: scope, sub: "demo-student" }),
  "exam-prep": (scope, live) => generateDynamicExamPrep(scope, live.session),
  "class-analytics": () =>
    dashboard(
      [k("Class average", "0%", undefined, "teal"), k("At-risk students", "0", undefined, "amber"), k("Assignments pending", "0", undefined, "brand"), k("AI-assisted lessons", "0", undefined, "sky")],
      [
        chart("bar", "Topic mastery", [{ category: "General", Mastery: 0 }], ["Mastery"]),
        chart("line", "Assessment trend", [{ category: "Current", Average: 0 }], ["Average"]),
      ],
      [],
    ),
  "department-academics": async (collegeScope) => {
    if (dataBackend() === "postgres") {
      const t = db();
      const collegePublicId = collegeScope && collegeScope !== "all" ? collegeScope : undefined;
      const courses = await t.course.findMany({
        where: {
          ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
        },
      });
      const activeCourses = courses.filter((c) => c.status === "Active").length;
      return dashboard(
        [
          k("Active courses", String(activeCourses), undefined, "teal"),
          k("Average marks", "0.0", undefined, "teal"),
          k("Pass percentage", "0%", undefined, "teal"),
          k("Course completion", "0%", undefined, "brand"),
        ],
        [
          chart("bar", "Pass % by subject", courses.length > 0 ? courses.map((c) => ({ category: c.code, "Pass %": 0 })) : [{ category: "None", "Pass %": 0 }], ["Pass %"]),
          chart("line", "Semester averages", [{ category: "Current", Average: 0 }], ["Average"]),
        ],
        [],
      );
    }
    return dashboard(
      [
        k("Active courses", "0", undefined, "teal"),
        k("Average marks", "0.0", undefined, "teal"),
        k("Pass percentage", "0%", undefined, "teal"),
        k("Course completion", "0%", undefined, "brand"),
      ],
      [
        chart("bar", "Pass % by subject", [{ category: "None", "Pass %": 0 }], ["Pass %"]),
        chart("line", "Semester averages", [{ category: "Current", Average: 0 }], ["Average"]),
      ],
      [],
    );
  },
  "department-skills": async (collegeScope) => {
    if (dataBackend() === "postgres") {
      const t = db();
      const collegePublicId = collegeScope && collegeScope !== "all" ? collegeScope : undefined;
      const [studentsCount, certsCount] = await Promise.all([
        t.student.count({
          where: {
            status: "Active",
            ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
          },
        }),
        t.certificate.count({
          where: {
            ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
          },
        }),
      ]);
      return dashboard(
        [
          k("Students profiled", String(studentsCount), undefined, "brand"),
          k("Job-ready (any role)", "0%", undefined, "teal"),
          k("Top gap", "None", undefined, "sky"),
          k("Certifications earned", String(certsCount), "This year", "gold"),
        ],
        [
          chart("bar", "Industry demand vs student readiness", [{ category: "Active", Demand: 0, Readiness: 0 }], ["Demand", "Readiness"]),
          chart("radar", "Skill distribution", [{ category: "Core", Current: 0 }], ["Current"]),
        ],
        [],
      );
    }
    return dashboard(
      [
        k("Students profiled", "0", undefined, "brand"),
        k("Job-ready (any role)", "0%", undefined, "teal"),
        k("Top gap", "None", undefined, "sky"),
        k("Certifications earned", "0", "This year", "gold"),
      ],
      [
        chart("bar", "Industry demand vs student readiness", [{ category: "Active", Demand: 0, Readiness: 0 }], ["Demand", "Readiness"]),
        chart("radar", "Skill distribution", [{ category: "Core", Current: 0 }], ["Current"]),
      ],
      [],
    );
  },
  "placement-analytics": async (collegeScope) => {
    if (dataBackend() === "postgres") {
      const t = db();
      const collegePublicId = collegeScope && collegeScope !== "all" ? collegeScope : undefined;
      const college = collegePublicId ? await t.college.findUnique({ where: { publicId: collegePublicId } }) : null;
      const colId = college?.id;

      const students = await t.student.findMany({
        where: {
          status: "Active",
          ...(colId ? { collegeId: colId } : {}),
        },
        include: {
          department: true,
          resumeAnalyses: true,
          interviewSessions: true,
        },
      });

      const totalStudents = students.length;
      if (totalStudents === 0) {
        return dashboard(
          [
            k("Placement readiness", "0%", undefined, "teal"),
            k("Offers", "0", "Season to date", "gold"),
            k("Resume completion", "0%", undefined, "brand"),
            k("Mock interview participation", "0%", undefined, "teal"),
          ],
          [
            chart("bar", "Offers by department", [{ category: "No active records", Offers: 0 }], ["Offers"]),
            chart("line", "Average interview score", [{ category: "Current", Score: 0 }], ["Score"]),
          ],
          [],
        );
      }

      let resumesCount = 0;
      let interviewsCount = 0;
      let totalScore = 0;
      let scoreCount = 0;
      const deptOffers: Record<string, number> = {};

      for (const s of students) {
        if (s.resumeAnalyses.length > 0) resumesCount++;
        if (s.interviewSessions.length > 0) interviewsCount++;
        for (const intv of s.interviewSessions) {
          if (intv.overallScore) {
            totalScore += intv.overallScore;
            scoreCount++;
          }
        }
        const deptName = s.department.name.replace(/Engineering|Department of/gi, "").trim();
        deptOffers[deptName] = (deptOffers[deptName] || 0);
      }

      const resumePct = Math.round((resumesCount / totalStudents) * 100);
      const interviewPct = Math.round((interviewsCount / totalStudents) * 100);
      const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
      const readinessPct = Math.round((resumePct + interviewPct) / 2);

      const deptChartData = Object.entries(deptOffers).map(([dept, count]) => ({
        category: dept,
        Offers: count,
      }));

      return dashboard(
        [
          k("Placement readiness", `${readinessPct}%`, undefined, "teal"),
          k("Offers", "0", "Season to date", "gold"),
          k("Resume completion", `${resumePct}%`, undefined, "brand"),
          k("Mock interview participation", `${interviewPct}%`, undefined, "teal"),
        ],
        [
          chart("bar", "Offers by department", deptChartData.length > 0 ? deptChartData : [{ category: "Active", Offers: 0 }], ["Offers"]),
          chart("line", "Average interview score", [{ category: "Average", Score: avgScore }], ["Score"]),
        ],
        [],
      );
    }

    return dashboard(
      [
        k("Placement readiness", "0%", undefined, "teal"),
        k("Offers", "0", "Season to date", "gold"),
        k("Resume completion", "0%", undefined, "brand"),
        k("Mock interview participation", "0%", undefined, "teal"),
      ],
      [
        chart("bar", "Offers by department", [{ category: "None", Offers: 0 }], ["Offers"]),
        chart("line", "Average interview score", [{ category: "Current", Score: 0 }], ["Score"]),
      ],
      [],
    );
  },
  "ai-governance": () =>
    dashboard(
      [k("Registered models", "0", undefined, "brand"), k("Prompt versions", "0", undefined, "sky"), k("Human reviews pending", "0", undefined, "amber"), k("Groundedness", "100%", undefined, "teal")],
      [
        chart("line", "Quality metrics", [{ category: "Safety", Groundedness: 100, Relevance: 100, Safety: 100 }], ["Groundedness", "Relevance", "Safety"]),
        chart("bar", "Monthly AI cost (₹ '000)", [{ category: "Core", Cost: 0 }], ["Cost"]),
      ],
      [],
    ),

  /* ── lists ── */
  "course-management": async (collegeScope) => {
    if (dataBackend() === "postgres") {
      const t = db();
      const collegePublicId = collegeScope && collegeScope !== "all" ? collegeScope : undefined;
      const courses = await t.course.findMany({
        where: {
          ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
        },
        include: { department: true, term: true },
        orderBy: { code: "asc" },
      });
      return list(
        [col("code", "Code"), col("title", "Course"), col("faculty", "Faculty"), col("sem", "Semester"), col("progress", "Syllabus", "progress"), col("status", "Status", "badge")],
        courses.map((c) => ({
          code: c.code,
          title: c.title,
          faculty: c.facultyName || "TBD",
          sem: `Sem ${c.term?.name ?? "1"}`,
          progress: c.status === "Active" ? 100 : 50,
          status: c.status,
        })),
        "status",
        "Add course",
      );
    }
    return list(
      [col("code", "Code"), col("title", "Course"), col("faculty", "Faculty"), col("sem", "Semester"), col("progress", "Syllabus", "progress"), col("status", "Status", "badge")],
      [],
      "status",
      "Add course",
    );
  },
  assignments: () =>
    list(
      [col("title", "Assignment"), col("course", "Course"), col("due", "Due"), col("submitted", "Submitted", "progress"), col("status", "Status", "badge")],
      [],
      "status",
      "New assignment",
    ),
  "team-finder": (scope, live) => generateDynamicTeamFinder(live.session ?? { college: scope, sub: "demo-student" }),
  hackathons: (scope, live) => generateDynamicHackathons(live.session ?? { college: scope, sub: "demo-student" }),
  events: async (collegeScope) => {
    if (dataBackend() === "postgres") {
      const t = db();
      const collegePublicId = collegeScope && collegeScope !== "all" ? collegeScope : undefined;
      const events = await t.event.findMany({
        where: {
          ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
        },
        orderBy: { eventDate: "asc" },
      });
      return list(
        [col("event", "Event"), col("type", "Type", "badge"), col("date", "Date"), col("venue", "Venue"), col("registered", "Registered", "number")],
        events.map((e) => ({
          event: e.title,
          type: e.type,
          date: e.eventDate.toISOString().split("T")[0]!,
          venue: e.venue || "Campus",
          registered: 0,
        })),
        "type",
        "Create event",
      );
    }
    return list(
      [col("event", "Event"), col("type", "Type", "badge"), col("date", "Date"), col("venue", "Venue"), col("registered", "Registered", "number")],
      [],
      "type",
      "Create event",
    );
  },
  clubs: (collegeScope) => {
    const items = getCollegeClubs(collegeScope);
    return list(
      [col("club", "Club"), col("category", "Category", "badge"), col("members", "Members", "number"), col("lead", "Student lead"), col("next", "Next activity")],
      items.map((c) => ({
        club: c.name,
        category: c.category,
        members: c.membersCount,
        lead: c.lead,
        next: c.meetingSchedule,
      })),
      "category",
      "Start a club",
    );
  },
  sports: (collegeScope) => {
    const items = getCollegeSports(collegeScope);
    return list(
      [col("sport", "Sport"), col("team", "Team"), col("coach", "Coach"), col("event", "Upcoming"), col("status", "Status", "badge")],
      items.map((s) => ({
        sport: s.sport,
        team: s.team,
        coach: s.coach,
        event: s.event,
        status: s.status,
      })),
      "status",
      "Register",
    );
  },
  experience: (scope, live) => generateDynamicExperience(live.session ?? { college: scope, sub: "demo-student" }),
  alumni: (scope, live) => generateDynamicAlumni(live.session ?? { college: scope, sub: "demo-student" }),
  "my-classes": () =>
    list(
      [col("section", "Section"), col("course", "Course"), col("students", "Students", "number"), col("attendance", "Attendance", "progress"), col("avg", "Avg. score", "progress"), col("next", "Next class")],
      [],
      undefined,
      "Take attendance"
    ),
  students: async (collegeScope) => {
    const all = await getStudentsList({ collegeId: collegeScope });
    return list(
      [
        col("name", "Student"),
        col("roll", "Roll no.", "masked"),
        col("section", "Section"),
        col("cgpa", "CGPA", "number"),
        col("readiness", "Career readiness", "progress"),
        col("signal", "Support signal", "badge"),
      ],
      all.map((s) => ({
        id: s.id,
        name: s.name,
        roll: s.roll,
        section: s.section,
        cgpa: s.cgpa,
        readiness: s.readiness,
        signal: s.signal,
      })),
      "section",
      "Import students"
    );
  },
  "early-warning": async (collegeScope) => {
    if (dataBackend() === "postgres") {
      const all = await getStudentsList({ collegeId: collegeScope });
      if (all.length > 0) {
        const ewStudents = all.slice(0, 10);
        const signalOptions = [
          "Declining scores (3 assessments)",
          "Missed 4 assignments",
          "Reduced engagement (−60%)",
          "Repeated failed quizzes in OS",
          "Skill stagnation for 6 weeks",
        ];
        const recOptions = [
          "Faculty check-in",
          "Peer tutoring",
          "Counsellor conversation",
          "Remedial class",
        ];
        const statusOptions = ["Pending review", "In progress", "Resolved"];

        return list(
          [
            col("student", "Student"),
            col("roll", "Roll no.", "masked"),
            col("signals", "Signals observed"),
            col("since", "Since"),
            col("recommendation", "Support recommendation"),
            col("status", "Review", "badge"),
          ],
          ewStudents.map((s, idx) => ({
            id: s.id,
            student: s.name,
            roll: s.roll,
            signals: signalOptions[idx % signalOptions.length]!,
            since: `${2 + (idx % 5)} weeks`,
            recommendation: recOptions[idx % recOptions.length]!,
            status: statusOptions[idx % statusOptions.length]!,
          })),
          "status"
        );
      }
      return list(
        [
          col("student", "Student"),
          col("roll", "Roll no.", "masked"),
          col("signals", "Signals observed"),
          col("since", "Since"),
          col("recommendation", "Support recommendation"),
          col("status", "Review", "badge"),
        ],
        [],
        "status"
      );
    }
    return list(
      [
        col("student", "Student"),
        col("roll", "Roll no.", "masked"),
        col("signals", "Signals observed"),
        col("since", "Since"),
        col("recommendation", "Support recommendation"),
        col("status", "Review", "badge"),
      ],
      rows(7, "ew", (i, r) => ({
        student: personName(i + 5),
        roll: `21CS${String(1100 + i * 17)}`,
        signals: pick(
          [
            "Declining scores (3 assessments)",
            "Missed 4 assignments",
            "Reduced engagement (−60%)",
            "Repeated failed quizzes in OS",
            "Skill stagnation for 6 weeks",
          ],
          r
        ),
        since: `${2 + Math.floor(r() * 5)} weeks`,
        recommendation: pick(
          [
            "Faculty check-in",
            "Peer tutoring",
            "Counsellor conversation",
            "Remedial class",
          ],
          r
        ),
        status: pick(["Pending review", "In progress", "Resolved"], r),
      })),
      "status"
    );
  },
  "department-faculty": async (collegeScope) => {
    if (dataBackend() === "postgres") {
      const t = db();
      const collegePublicId = collegeScope && collegeScope !== "all" ? collegeScope : undefined;
      const staffList = await t.staff.findMany({
        where: {
          staffType: "Teaching",
          ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
        },
        include: { department: true, designation: true },
        orderBy: { fullName: "asc" },
      });
      return list(
        [col("name", "Faculty"), col("designation", "Designation"), col("department", "Department"), col("load", "Teaching load (hrs/wk)", "number"), col("ai", "AI adoption", "badge")],
        staffList.map((s, idx) => ({
          name: s.fullName,
          designation: s.designation?.name || "Faculty",
          department: s.department.name,
          load: 12 + (idx % 6),
          ai: "Active",
        })),
        "ai",
        "Add faculty",
      );
    }
    return list(
      [col("name", "Faculty"), col("designation", "Designation"), col("department", "Department"), col("load", "Teaching load (hrs/wk)", "number"), col("ai", "AI adoption", "badge")],
      [],
      "ai",
      "Add faculty",
    );
  },
  drives: () =>
    list(
      [col("company", "Company"), col("role", "Role"), col("ctc", "CTC (LPA)", "number"), col("date", "Drive date"), col("eligible", "Eligible", "number"), col("status", "Status", "badge")],
      [],
      "status",
      "Schedule drive",
    ),
  jobs: (scope, live) => generateDynamicJobs(live.session ?? { college: scope, sub: "demo-student" }),
  employers: () =>
    list(
      [col("company", "Employer"), col("sector", "Sector", "badge"), col("hires", "Hires (3 yrs)", "number"), col("contact", "Contact"), col("status", "Relationship", "badge")],
      [],
      "sector",
      "Add employer",
    ),
  startups: () =>
    list(
      [col("name", "Venture"), col("domain", "Domain", "badge"), col("founders", "Founders"), col("stage", "Stage", "badge"), col("readiness", "Readiness", "progress")],
      [],
      "stage",
      "Add venture",
    ),
  mentors: () =>
    list(
      [col("name", "Mentor"), col("type", "Type", "badge"), col("expertise", "Expertise"), col("mentees", "Mentees", "number"), col("availability", "Availability", "badge")],
      [],
      "type",
      "Invite mentor",
    ),
  "knowledge-base": async (collegeScope) => {
    const store = kbStore();
    const docs = await store.list(collegeScope);
    return list(
      [
        col("doc", "Document"),
        col("type", "Type", "badge"),
        col("owner", "Owner"),
        col("updated", "Updated"),
        col("chunks", "Indexed chunks", "number"),
        col("status", "Status", "badge"),
      ],
      docs.map((d) => ({
        doc: d.title,
        type: d.type,
        owner: d.owner || "Administration",
        updated: new Date(d.updatedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        chunks: d.chunkCount ?? 0,
        status: d.status,
      })),
      "type",
      "Upload document"
    );
  },
  reports: () =>
    list(
      [
        col("report", "Report"),
        col("scope", "Scope"),
        col("period", "Period"),
        col("format", "Formats", "badge"),
        col("generated", "Last generated"),
      ],
      [],
      undefined,
      "Generate report"
    ),
  "talent-search": () =>
    list(
      [col("candidate", "Candidate"), col("college", "College"), col("dept", "Department"), col("skills", "Verified skills"), col("projects", "Projects", "number"), col("readiness", "Readiness", "progress")],
      [],
      "dept",
    ),
  shortlists: () =>
    list(
      [col("candidate", "Candidate"), col("role", "Role"), col("stage", "Stage", "badge"), col("assessment", "Assessment", "progress"), col("updated", "Updated")],
      [],
      "stage",
    ),
  users: async (collegeScope) => {
    if (dataBackend() === "postgres") {
      const t = db();
      const collegePublicId = collegeScope && collegeScope !== "all" ? collegeScope : undefined;
      const users = await t.user.findMany({
        where: {
          status: "Active",
          ...(collegePublicId ? { roleAssignments: { some: { college: { publicId: collegePublicId } } } } : {}),
        },
        include: { roleAssignments: true },
        take: 50,
      });
      return list(
        [col("name", "Name"), col("email", "Email", "masked"), col("role", "Role", "badge"), col("tenant", "Tenant"), col("mfa", "MFA", "badge"), col("last", "Last active")],
        users.map((u) => ({
          name: u.fullName,
          email: u.email,
          role: u.roleAssignments[0]?.role ?? "User",
          tenant: "ColossusIQ",
          mfa: u.mfaRequired ? "Enabled" : "Not enrolled",
          last: "Active",
        })),
        "role",
        "Invite user",
      );
    }
    return list(
      [col("name", "Name"), col("email", "Email", "masked"), col("role", "Role", "badge"), col("tenant", "Tenant"), col("mfa", "MFA", "badge"), col("last", "Last active")],
      [],
      "role",
      "Invite user",
    );
  },
  billing: () =>
    list([col("tenant", "Tenant"), col("plan", "Plan", "badge"), col("seats", "Active seats", "number"), col("ai", "AI usage (₹)", "number"), col("renewal", "Renewal"), col("status", "Status", "badge")],
      TENANTS.map((t, i) => ({ tenant: t.name, plan: t.plan, seats: t.students, ai: 18000 + i * 7300, renewal: `Jun ${2027}`, status: t.status === "Pilot" ? "Trial" : "Paid" })),
      "plan"),
  "ai-observability": () =>
    list([col("time", "Time"), col("tenant", "Tenant"), col("agent", "Agent", "badge"), col("model", "Model"), col("prompt", "Prompt ver."), col("tokens", "Tokens", "number"), col("latency", "Latency (ms)", "number"), col("confidence", "Confidence", "progress")],
      rows(14, "obs", (i, r) => ({ time: `14:${String(59 - i * 3).padStart(2, "0")}`, tenant: pick(["AIT", "TNTU", "Kaveri", "Malabar"], r), agent: pick(["Mentor", "Tutor", "Evaluation", "Interview", "Knowledge"], r), model: pick(["reasoning-large", "chat-fast", "vision-ocr", "embed-v3"], r), prompt: `v${10 + Math.floor(r() * 6)}`, tokens: Math.round(400 + r() * 4000), latency: Math.round(300 + r() * 2600), confidence: Math.round(60 + r() * 39) })),
      "agent"),
  "audit-log": async (scope, live) => {
    const isSuperAdmin = live.session?.role === "admin";
    const effectiveScope = isSuperAdmin ? scope : (live.session?.college ?? scope);
    const entries = await getStore().audit.recent(100, effectiveScope);

    return list(
      [
        col("time", "Time"),
        col("actor", "Actor"),
        col("action", "Action", "badge"),
        col("target", "Target"),
        ...(isSuperAdmin && (effectiveScope === ALL_COLLEGES || effectiveScope === "all")
          ? [col("college", "Scope", "badge")]
          : []),
      ],
      entries.map((e) => ({
        time: new Date(e.at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        actor: e.actor,
        action: e.action,
        target: e.target,
        ...(isSuperAdmin && (effectiveScope === ALL_COLLEGES || effectiveScope === "all")
          ? { college: e.collegeId ?? "University" }
          : {}),
      })),
      "action",
    );
  },
  "developer-api": () =>
    list([col("name", "Key name"), col("scopes", "Scopes"), col("tenant", "Tenant"), col("created", "Created"), col("lastUsed", "Last used"), col("status", "Status", "badge")],
      [["ERP sync", "students:read courses:read"], ["LMS bridge", "courses:read assessments:write"], ["Attendance import", "attendance:write"], ["Analytics export", "analytics:read"]].map(([name, scopes], i) => ({ name: name!, scopes: scopes!, tenant: TENANTS[i]?.name ?? "", created: `${3 + i} Aug 2026`, lastUsed: `${i + 1}h ago`, status: i === 3 ? "Revoked" : "Active" })),
      "status", "Create API key"),

  /* ── workflows ── */
  "mission-planner": (scope, live) => generateDynamicMissionPlanner(live.session ?? { college: scope, sub: "demo-student" }),
  certifications: (scope, live) => generateDynamicCertifications(live.session ?? { college: scope, sub: "demo-student" }),
  "startup-hub": (scope, live) => generateDynamicStartupHub(live.session ?? { college: scope, sub: "demo-student" }),
  "incubation-pipeline": () =>
    stagesOf("Incubation pipeline — 2026 cohort", [
      ["Idea", "41 submissions", ["Screened by Incubation Agent + panel"]],
      ["Problem validation", "22 ventures"],
      ["Market analysis", "15 ventures"],
      ["Customer persona", "15 ventures"],
      ["Business model", "11 ventures"],
      ["MVP", "8 ventures"],
      ["Mentor", "8 ventures matched"],
      ["Prototype", "6 ventures"],
      ["Pitch deck", "5 ventures"],
      ["Incubation review", "Panel Nov 12"],
      ["Startup readiness", "Funding track"],
    ], 6),
  "skill-booster": () =>
    stagesOf("Faculty roadmap — AI for Teaching (12 weeks)", [
      ["Current level", "Self + AI assessment", ["Digital skills: 72", "AI literacy: 41", "Assessment design: 66"]],
      ["Skill gap", "AI literacy and educational analytics"],
      ["AI fundamentals", "Week 1–2"],
      ["Generative AI", "Week 3"],
      ["Prompt engineering", "Week 4"],
      ["AI classroom applications", "Week 5–6"],
      ["Assessment with AI", "Week 7"],
      ["Responsible AI", "Week 8"],
      ["Educational analytics", "Week 9"],
      ["AI project & capstone", "Week 10–11"],
      ["Assessment & certification", "Week 12"],
      ["Portfolio", "Showcase to department"],
    ], 5),

  /* ── scorecards ── */
  "skill-graph": (scope, live) => generateDynamicSkillGraph(live.session ?? { college: scope, sub: "demo-student" }),
  "study-twin": (scope, live) => generateDynamicStudyTwin(live.session ?? { college: scope, sub: "demo-student" }),
  career: (scope, live) => generateDynamicCareer(live.session ?? { college: scope, sub: "demo-student" }),
  readiness: (scope, live) => generateDynamicReadiness(live.session ?? { college: scope, sub: "demo-student" }),
  communication: (scope, live) => generateDynamicCommunication(live.session ?? { college: scope, sub: "demo-student" }),
  "project-review": () =>
    score("Smart Campus AI — review report", [["Architecture", 82, 75], ["Documentation", 64, 75], ["Code quality", 76, 75], ["Test coverage", 58, 70], ["Innovation", 88, 70], ["Presentation", 70, 75]], ["Clear modular architecture", "Strong novelty for campus context"], ["README lacks setup steps", "Unit tests cover only 41% of services"], ["Add architecture decision records", "Raise coverage on attendance service", "Rehearse demo with viva questions"]),
  "funding-readiness": () =>
    score("AgriSoil Sense", [["Team", 72, 75], ["Problem validation", 81, 75], ["Product", 55, 70], ["Traction", 30, 60], ["Business model", 60, 70], ["Pitch", 66, 75]], ["Well-validated problem", "Complementary founding team"], ["No paying pilots yet", "Unit economics unproven"], ["Run paid pilot with one FPO", "Refine cost model", "Mentor pitch rehearsal"]),

  /* ── calendars ── */
  "daily-plan": (scope, live) => generateDynamicDailyPlan(live.session ?? { college: scope, sub: "demo-student" }),
  "academic-calendar": (collegeScope = "all") => {
    const raw = getCollegeCalendar(collegeScope);
    const thisWeek = raw.filter((it) => it.date >= "2026-09-28" && it.date <= "2026-10-05");
    const next30 = raw.filter((it) => it.date > "2026-10-05" && it.date <= "2026-11-05");
    const later = raw.filter((it) => it.date > "2026-11-05");

    return {
      template: "calendar",
      days: [
        {
          day: "This week",
          items: thisWeek.map((it) => ({
            time: it.date.slice(5) + " · " + it.time,
            title: it.title,
            tag: it.tag,
            tone: it.tone,
          })),
        },
        {
          day: "Next 30 days",
          items: next30.map((it) => ({
            time: it.date.slice(5) + " · " + it.time,
            title: it.title,
            tag: it.tag,
            tone: it.tone,
          })),
        },
        ...(later.length > 0
          ? [
            {
              day: "Semester Milestones & Exams",
              items: later.map((it) => ({
                time: it.date.slice(5) + " · " + it.time,
                title: it.title,
                tag: it.tag,
                tone: it.tone,
              })),
            },
          ]
          : []),
      ],
      tips: ["Class timings and assessment windows sync from the official academic calendar."],
    };
  },
  wellness: () => ({
    template: "calendar",
    days: [
      {
        day: "Healthy routine suggestions", items: [
          { time: "Morning", title: "10 minutes of light movement and sunlight", tag: "Activity", tone: "teal" },
          { time: "Every 45 min", title: "5-minute study break, look away from screens", tag: "Breaks", tone: "sky" },
          { time: "All day", title: "Aim for regular water intake", tag: "Hydration", tone: "sky" },
          { time: "Evening", title: "Screen-free wind-down 30 minutes before bed", tag: "Sleep", tone: "brand" },
          { time: "Night", title: "Consistent 7–8 hour sleep window", tag: "Sleep", tone: "brand" },
        ]
      },
    ],
    tips: ["Educational guidance only — not medical advice.", "Student Welfare Office: Block C, Room 104 · Counsellor hours 10:00–17:00."],
  }),
  "recruiter-interviews": () => ({
    template: "calendar",
    days: [
      {
        day: "Today", items: [
          { time: "10:00", title: "Divya Raman — SDE-1 technical", tag: "Technical", tone: "brand" },
          { time: "14:30", title: "Karthik Iyer — Data Analyst", tag: "Technical", tone: "brand" },
        ]
      },
      { day: "Tomorrow", items: [{ time: "11:00", title: "Priya Nair — HR round", tag: "HR", tone: "gold" }] },
    ],
    tips: [],
  }),

  /* ── galleries ── */
  passport: (scope, live) => generateDynamicPassport(live.session ?? { college: scope, sub: "demo-student" }),
  "competitive-exams": () =>
    gallery([
      ["GATE CSE", "Topic-wise plan, PYQs and full-length mocks", "Engineering", "Next exam: Feb 2027", "brand", 34],
      ["UPSC CSE", "Prelims GS, CSAT and daily current affairs", "Civil services", "Prelims: May 2027", "gold"],
      ["TNPSC Group 2", "Tamil & English, aptitude and GS", "State", "Notification awaited", "teal"],
      ["Banking (IBPS / SBI)", "Quant, reasoning, English, banking awareness", "Banking", "PO prelims: Oct", "sky"],
      ["SSC CGL", "Tier 1 & 2 preparation", "Central govt.", "Tier 1: Nov", "amber"],
      ["Railway (RRB NTPC)", "CBT 1 & 2", "Railways", "Upcoming", "rose"],
      ["UGC-NET", "Paper 1 + subject paper", "Teaching", "Dec cycle", "brand"],
      ["CAT / MBA entrance", "QA, DILR, VARC", "Management", "CAT: Nov 30", "gold"],
      ["Law entrance (CLAT)", "Legal reasoning, GK, English", "Law", "Dec", "teal"],
      ["Defence (CDS / AFCAT)", "Maths, English, GK", "Defence", "Feb", "sky"],
    ]),
  opportunities: () =>
    gallery([
      ["Data Analyst Intern — Tiger Analytics", "SQL, Python, dashboards · Chennai", "Internship", "92% match", "teal", 92],
      ["HackTN 2026", "State-level hackathon, ₹5L prize pool", "Hackathon", "Registrations close Oct 12", "gold"],
      ["Mentor: Priya S. (Data Scientist, Freshworks)", "Alumnus, batch 2016", "Mentor", "Accepting mentees", "brand"],
      ["Workshop: Kaggle for beginners", "Coding Club · Oct 9", "Workshop", "Free", "sky"],
      ["Cloud fundamentals certification", "Recommended by your skill graph", "Certification", "Sponsored seats: 20", "amber"],
      ["Research assistant — IoT lab", "Faculty project, 6 months", "Project", "Stipend", "teal"],
    ]),
  "refresh-zone": (scope, live) => generateDynamicRefreshZone(live.session ?? { college: scope, sub: "demo-student" }),
  achievements: (scope, live) => generateDynamicAchievements(live.session ?? { college: scope, sub: "demo-student" }),
  "department-labs": async (collegeScope, live) => {
    if (dataBackend() === "postgres" && collegeScope && collegeScope !== "all") {
      try {
        const t = db();
        const [colDepts, colCourses] = await Promise.all([
          t.collegeDepartment.findMany({
            where: { college: { publicId: collegeScope }, status: "Active" },
            include: { department: true },
            orderBy: { department: { name: "asc" } },
          }),
          t.course.findMany({
            where: { college: { publicId: collegeScope }, status: "Active" },
            include: { department: true },
            orderBy: { title: "asc" },
          }),
        ]);

        if (colDepts.length > 0 || colCourses.length > 0) {
          const tones = ["brand", "sky", "teal", "gold", "amber", "rose"] as const;
          const items: Array<[string, string, string, string, (typeof tones)[number]]> = [];

          // Add practical labs for active courses in PostgreSQL
          for (let i = 0; i < colCourses.length; i++) {
            const c = colCourses[i]!;
            const tone = tones[i % tones.length]!;
            items.push([
              `${c.title} Practical Lab`,
              `Interactive practical problems, lab assignments and exercises for ${c.code}`,
              c.department.name,
              "Active (PostgreSQL)",
              tone,
            ]);
          }

          // Department lab specializations mapped to real departments
          const DEPT_LAB_SPEC: Record<string, { lab: string; desc: string }> = {
            "Computer Science & Engineering": { lab: "Cloud Computing & Systems Lab", desc: "Docker containers, Linux virtual machines and distributed systems practice" },
            "Artificial Intelligence & Data Science": { lab: "AI & Neural Networks Lab", desc: "Jupyter notebooks, GPU clusters and deep learning model benchmarking" },
            "Information Technology": { lab: "Cybersecurity & Web Services Lab", desc: "Penetration testing environments, API fuzzing and web application security" },
            "Electronics & Communication": { lab: "Embedded Systems & IoT Lab", desc: "Microcontroller emulators, sensor interface kits and signal analysis" },
            "Electrical & Electronics": { lab: "Power Systems & Renewable Energy Lab", desc: "Smart grid simulations, MATLAB/Simulink models and machine testing" },
            "Mechanical Engineering": { lab: "Advanced CAD/CAM & Robotics Lab", desc: "Finite element analysis, 3D modelling and automated robotics simulations" },
            "Civil Engineering": { lab: "Structural GIS & Materials Lab", desc: "Building information modelling (BIM), seismic analysis and GIS mapping" },
            "Science & Humanities": { lab: "Computational Mathematics & Physics Lab", desc: "Numerical simulations, statistical modeling and research experiments" },
          };

          for (let i = 0; i < colDepts.length; i++) {
            const d = colDepts[i]!;
            const name = d.department.name;
            const spec = DEPT_LAB_SPEC[name] ?? {
              lab: `${name} Virtual Lab`,
              desc: `Specialized virtual laboratories, simulation toolkits and sandboxes for ${name}`,
            };
            const tone = tones[(colCourses.length + i) % tones.length]!;
            if (!items.some((it) => it[0] === spec.lab)) {
              items.push([
                spec.lab,
                spec.desc,
                name,
                "Active (PostgreSQL)",
                tone,
              ]);
            }
          }

          return gallery(items);
        }
      } catch (err) {
        console.error("[department-labs] Error fetching from postgres:", err);
      }
    }

    // Stream-based fallback for memory mode
    const stream = live.stream ?? "engineering";
    if (stream === "engineering") {
      return gallery([
        ["Coding Lab", "Practice problems, contests and auto-graded labs", "Computer Science & Engineering", "Active", "brand"],
        ["AI & Data Science Lab", "Notebooks, datasets and GPU queue", "AI & Data Science", "Active", "sky"],
        ["Circuits & VLSI Lab", "Simulations and PCB project templates", "Electronics & Communication", "Active", "teal"],
        ["Power & Machines Lab", "Grid simulation and drive testing", "Electrical & Electronics", "Active", "gold"],
        ["CAD & Design Lab", "Guided modelling exercises", "Mechanical Engineering", "Active", "amber"],
        ["Structural GIS Lab", "Estimation, planning and site safety modules", "Civil Engineering", "Active", "rose"],
      ]);
    }
    return gallery([
      ["Practical Simulation Lab", "Virtual labs and clinical / subject experiments", "Academic", "Active", "brand"],
      ["Research & Analytics Lab", "Data analysis, case studies and reporting", "Department", "Active", "sky"],
    ]);
  },
  integrations: () =>
    gallery([
      ["Student Information System", "Sync students, programs and enrolments", "SIS", "Connected", "teal"],
      ["College ERP", "Fees, timetable and HR", "ERP", "Connected", "teal"],
      ["LMS (Moodle / Canvas)", "Courses, content and grades", "LMS", "Available", "brand"],
      ["Attendance platform", "Biometric / app attendance", "Attendance", "Available", "brand"],
      ["Examination system", "Hall tickets and results", "Exams", "Available", "brand"],
      ["Identity provider (SAML / OIDC)", "Enterprise SSO with MFA", "Identity", "Connected", "teal"],
      ["Email & SMS gateway", "Institution-approved messaging", "Communication", "Connected", "teal"],
    ]),
  "agent-store": () =>
    gallery([
      ["AI GATE Agent", "GATE-specific plans, PYQs and adaptive mocks", "Exam", "Enabled for 3 tenants", "brand"],
      ["AI NEET Preparation Agent", "Biology, chemistry and physics prep", "Exam", "Available", "teal"],
      ["AI Coding Agent", "Code review, hints and debugging", "Skills", "Enabled", "sky"],
      ["AI Accounting Agent", "Tally, GST and accounting practice", "Commerce", "Available", "gold"],
      ["AI Mechanical Design Agent", "CAD and design reasoning", "Engineering", "Beta", "amber"],
      ["AI Civil Engineering Agent", "Estimation, structural basics", "Engineering", "Beta", "amber"],
      ["AI Law Preparation Agent", "CLAT and legal reasoning", "Exam", "Available", "rose"],
      ["AI Entrepreneurship Agent", "Business models and pitch coaching", "Innovation", "Enabled", "teal"],
    ]),

  /* ── settings ── */
  branding: (): SettingsData => ({
    template: "settings",
    sections: [
      {
        title: "Identity", description: "How your institution appears to students and staff.", fields: [
          { id: "name", label: "Display name", type: "text", value: "Anna Institute of Technology" },
          { id: "subdomain", label: "Subdomain", type: "text", value: "ait.collossusiq.ai", help: "Custom domains (e.g. ai.college.edu) are verified via DNS." },
          { id: "primary", label: "Primary colour", type: "color", value: "#1e2a5a" },
          { id: "accent", label: "Accent colour", type: "color", value: "#c9962b" },
        ]
      },
      {
        title: "Language", description: "Default interface and AI explanation languages.", fields: [
          { id: "ui-lang", label: "Default interface language", type: "select", value: "English", options: ["English", "தமிழ்", "हिन्दी"] },
          { id: "ai-lang", label: "Default AI explanation language", type: "select", value: "English", options: ["English", "Tamil", "Hindi", "Telugu", "Kannada", "Malayalam"] },
        ]
      },
    ],
  }),
  "notifications-config": (): SettingsData => ({
    template: "settings",
    sections: [
      {
        title: "Channels", description: "Channels approved by the institution.", fields: [
          { id: "web", label: "In-app / web", type: "toggle", value: true },
          { id: "email", label: "Email", type: "toggle", value: true },
          { id: "push", label: "Mobile push", type: "toggle", value: true },
          { id: "sms", label: "SMS", type: "toggle", value: false, help: "Charged per message by your SMS gateway." },
        ]
      },
      {
        title: "Rules", description: "Event + priority + audience + timing.", fields: [
          { id: "exam", label: "Exam reminders", type: "select", value: "7 days and 1 day before", options: ["Off", "1 day before", "7 days and 1 day before"] },
          { id: "quiet", label: "Quiet hours", type: "select", value: "22:00–07:00", options: ["None", "22:00–07:00", "21:00–08:00"] },
          { id: "digest", label: "Weekly faculty digest", type: "toggle", value: true },
        ]
      },
    ],
  }),
  "feature-flags": (): SettingsData => ({
    template: "settings",
    sections: [
      {
        title: "Phase 2 modules", description: "Roll out per tenant.", fields: [
          { id: "handwritten", label: "Handwritten evaluation", type: "toggle", value: true },
          { id: "voice", label: "Voice AI", type: "toggle", value: false },
          { id: "gd", label: "GD simulation", type: "toggle", value: true },
        ]
      },
      {
        title: "Phase 3–4 modules", description: "Early access.", fields: [
          { id: "command", label: "Institution command center", type: "toggle", value: true },
          { id: "market", label: "Recruiter marketplace", type: "toggle", value: false },
          { id: "store", label: "Agent store", type: "toggle", value: false },
        ]
      },
    ],
  }),
  "security-settings": (): SettingsData => ({
    template: "settings",
    sections: [
      {
        title: "Authentication", description: "Applies to every user in the tenant.", fields: [
          { id: "mfa", label: "Require MFA for staff", type: "toggle", value: true },
          { id: "mfa-students", label: "Require MFA for students", type: "toggle", value: false },
          { id: "sso", label: "Enterprise SSO (SAML / OIDC)", type: "toggle", value: true },
          { id: "session", label: "Idle session timeout", type: "select", value: "30 minutes", options: ["15 minutes", "30 minutes", "60 minutes"] },
          { id: "pwd", label: "Minimum password length", type: "select", value: "12", options: ["10", "12", "14", "16"] },
        ]
      },
      {
        title: "Data & AI", description: "Data protection and AI data isolation.", fields: [
          { id: "retention", label: "AI conversation retention", type: "select", value: "180 days", options: ["30 days", "90 days", "180 days", "1 year"] },
          { id: "masking", label: "Mask personal data before sending to models", type: "toggle", value: true },
          { id: "training", label: "Allow tenant data for model training", type: "toggle", value: false, help: "Off by default. Student data is never used for training without explicit institutional consent." },
          { id: "attendance", label: "Use attendance in early-warning signals", type: "toggle", value: false, help: "Enable only where legally and institutionally permitted." },
        ]
      },
    ],
  }),
};

/* ── chat & generator configs ── */
const CHAT: Record<string, Omit<ChatData, "template">> = {
  viva: { intro: "I'll act as your viva examiner for **Smart Campus AI**. I'll start with basics and follow up based on your answers.", suggestions: ["Start my project viva", "Ask me architecture questions", "Give me a tough follow-up on security"], context: ["Project: Smart Campus AI", "Stack: Python, FastAPI, React", "Mode: Technical viva"] },
  "group-discussion": { intro: "Welcome to the GD room. Three AI participants — **Asha** (pro), **Vikram** (against) and **Neha** (moderator) — will join you.", suggestions: ["Topic: Should AI be allowed in exams?", "Topic: Work from home vs office", "Give me feedback on my last point"], context: ["Mode: Group discussion", "Participants: 3 AI + you", "Duration: 10 minutes"] },
  research: { intro: "I can help you frame research questions, find and compare literature, and plan your paper. I will flag when a claim needs a verified source.", suggestions: ["Research questions on IoT for agriculture", "Compare approaches to handwriting OCR", "Outline an IEEE conference paper"], context: ["Field: Computer Science", "Level: UG"] },
  "campus-assistant": { intro: "Ask me anything about Anna Institute of Technology. I answer from **institution-approved sources** and cite them.", suggestions: ["Where is the placement office?", "What is the exam application process?", "How can I register for sports?"], context: ["Knowledge base: 8 approved documents", "Campus: Main"] },
  "policy-assistant": { intro: "I answer strictly from approved institutional documents. If a policy is not in the knowledge base, I'll say so rather than guess.", suggestions: ["What are the internal assessment rules?", "Minimum attendance for exam eligibility?", "Placement policy for students with offers"], context: ["Sources: Regulations 2021, IA Rules, Placement Policy 2026"] },
};

const GEN: Record<string, Omit<GeneratorData, "template">> = {
  "document-ai": { fields: [{ name: "task", label: "What should AI do?", type: "select", options: ["Summarise", "Create flashcards", "Generate questions", "Revision notes", "Extract key terms"] }, { name: "text", label: "Paste text from your document", type: "textarea", placeholder: "Paste notes or a section of a chapter…" }], cta: "Process document" },
  "job-prep": { fields: [{ name: "role", label: "Target role", type: "select", options: ["Software Engineer", "Data Analyst", "Data Scientist", "Cloud Engineer", "Product Manager", "Core Engineering (GET)"] }, { name: "company", label: "Company type", type: "select", options: ["Product company", "IT services", "Startup", "PSU / Government", "Core engineering"] }, { name: "weeks", label: "Weeks available", type: "number", defaultValue: "8" }], cta: "Build my preparation plan" },
  "project-ideas": { fields: [{ name: "department", label: "Department", type: "select", options: ["CSE", "IT", "ECE", "EEE", "Mechanical", "Civil", "AI & DS", "Management"] }, { name: "category", label: "Category", type: "select", options: ["AI/ML", "IoT", "Embedded Systems", "SaaS", "Cybersecurity", "FinTech", "HealthTech", "EdTech", "AgriTech", "GovTech", "ClimateTech", "Robotics", "EV", "Blockchain", "Industry 4.0"] }, { name: "skills", label: "Your skills", type: "text", placeholder: "Python, React, Arduino…" }, { name: "budget", label: "Budget (₹)", type: "number", defaultValue: "5000" }, { name: "team", label: "Team size", type: "number", defaultValue: "3" }], cta: "Generate project ideas" },
  "event-generator": { fields: [{ name: "brief", label: "Describe the event", type: "textarea", defaultValue: "Create a one-day technology event for 500 students." }, { name: "budget", label: "Budget (₹)", type: "number", defaultValue: "150000" }], cta: "Generate event plan" },
  copilot: { fields: [{ name: "tool", label: "Tool", type: "select", options: ["Lesson plan", "Lecture notes", "PPT outline", "Assignment", "Rubric", "Quiz", "Lab manual", "Remedial plan"] }, { name: "topic", label: "Topic", type: "text", defaultValue: "Database normalization" }, { name: "duration", label: "Duration (minutes)", type: "number", defaultValue: "45" }, { name: "level", label: "Level", type: "select", options: ["UG Year 1", "UG Year 2", "UG Year 3", "UG Year 4", "PG"] }], cta: "Generate" },
  "question-generator": { fields: [{ name: "course", label: "Course", type: "text", defaultValue: "CS3492 Database Management Systems" }, { name: "units", label: "Units", type: "select", options: ["Units 1–2", "Units 3–4", "Units 1–5"] }, { name: "marks", label: "Total marks", type: "number", defaultValue: "50" }, { name: "pattern", label: "Pattern", type: "select", options: ["Part A (2 marks) + Part B (13 marks)", "MCQ only", "Descriptive only"] }], cta: "Generate question paper" },
};

function fallback(mod: ModuleDef): ModuleData {
  return dashboard([k("Status", mod.phase, undefined, "sky")], [], [ins(mod.title, mod.description, "Module configuration")]);
}

const STREAM_RELABEL = new Set(["academic-tracker", "exam-prep", "class-analytics", "department-academics"]);

export async function moduleData(slug: string, collegeScope = "all", session?: SessionPayload): Promise<ModuleData | null> {
  const mod = findModule(slug);
  if (!mod) return null;
  const builder = DATA[slug];
  if (builder) {
    const live: ScopeData = {
      stream: await collegeStream(collegeScope),
      admissions: slug === "admission-insights" ? await getStore().records.all(RESOURCES.admissions!, collegeScope) : [],
      session,
    };
    const data = await builder(collegeScope, live);
    if (data.template === "settings") {
      const saved = (await getStore().settings.get(collegeScope, slug))
        ?? (collegeScope !== "all" ? await getStore().settings.get("all", slug) : undefined);
      if (saved) {
        for (const section of data.sections) {
          for (const field of section.fields) {
            if (field.id in saved && saved[field.id] !== undefined) {
              field.value = saved[field.id]!;
            }
          }
        }
      }
    }
    // Generic academic dashboards use the college's own subjects (Anatomy, Accounts, DBMS …).
    if (data.template === "dashboard" && STREAM_RELABEL.has(slug)) return relabelSubjects(data, live.stream);
    return data;
  }
  if (mod.template === "chat") {
    const cfg = CHAT[slug];
    if (cfg) return { template: "chat", ...cfg };
  }
  if (mod.template === "generator") {
    const cfg = GEN[slug];
    if (cfg) return { template: "generator", ...cfg };
  }
  return fallback(mod);
}

// Exposed for tests: every registry module (except bespoke) must resolve to real data.
export const _hasData = (slug: string) => Boolean(DATA[slug] || CHAT[slug] || GEN[slug]);
export type { CalendarData };
