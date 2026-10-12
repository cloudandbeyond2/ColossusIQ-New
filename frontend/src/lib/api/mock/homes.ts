import "server-only";
import type { RoleHome } from "@/lib/api/schemas";
import type { Role } from "@/lib/auth/roles";

const M = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const series = (vals: number[][], keys: string[]) =>
  M.map((name, i) => Object.fromEntries([["name", name], ...keys.map((k, j) => [k, vals[j]?.[i] ?? 0])]));

export const ROLE_HOMES: Record<Exclude<Role, "student">, RoleHome> = {
  faculty: {
    greeting: "Good morning, Dr. Meena",
    kpis: [
      { label: "Classes today", value: "3", tone: "brand", hint: "CSE-A, CSE-B, AI&DS lab" },
      { label: "Answers to review", value: "14", delta: "AI pre-evaluated", tone: "amber" },
      { label: "Class average (DBMS)", value: "68%", delta: "+4% vs IA1", tone: "teal" },
      { label: "Skill Booster", value: "Week 5/12", delta: "AI for Teaching", tone: "gold" },
    ],
    charts: [
      { type: "bar", title: "Topic mastery — CSE-A", xKey: "name", series: ["Mastery"], data: [
        { name: "ER", Mastery: 78 }, { name: "SQL", Mastery: 74 }, { name: "FDs", Mastery: 61 }, { name: "3NF", Mastery: 52 }, { name: "BCNF", Mastery: 47 }, { name: "ACID", Mastery: 69 },
      ] },
      { type: "line", title: "Class average trend", xKey: "name", series: ["CSE-A", "CSE-B"], data: series([[60, 62, 64, 66, 68, 70], [58, 59, 61, 62, 64, 66]], ["CSE-A", "CSE-B"]) },
    ],
    insights: [
      { title: "Remedial recap suggested", body: "18 students missed the lossless-join property on IA1 Q5. A 15-minute recap is recommended before IA2.", evidence: "IA1 rubric criterion 3 · 18/64 scored 0", tone: "amber" },
      { title: "6 support recommendations", body: "Six students show declining scores across three assessments. Review before contacting them.", evidence: "Student Success Agent · last 4 weeks", tone: "rose" },
    ],
    queue: [
      { title: "Review AI-evaluated answers (14)", meta: "DBMS IA-I · 3 flagged low confidence", href: "/faculty/evaluation", tone: "amber" },
      { title: "Generate IA-II question paper", meta: "Due Friday", href: "/faculty/question-generator", tone: "brand" },
      { title: "Lesson plan: BCNF", meta: "Tomorrow, CSE-A", href: "/faculty/copilot", tone: "teal" },
    ],
  },
  hod: {
    greeting: "Department of Computer Science & Engineering",
    kpis: [
      { label: "Students", value: "0", tone: "brand" },
      { label: "Pass percentage", value: "91.4%", delta: "+2.1%", tone: "teal" },
      { label: "Placement readiness", value: "66%", delta: "+5%", tone: "gold" },
      { label: "Faculty upskilling", value: "72%", delta: "on track", tone: "sky" },
    ],
    charts: [
      { type: "bar", title: "Pass % by subject", xKey: "name", series: ["Pass %"], data: [
        { name: "DBMS", "Pass %": 93 }, { name: "OS", "Pass %": 90 }, { name: "CN", "Pass %": 92 }, { name: "TOC", "Pass %": 86 }, { name: "ML", "Pass %": 94 }, { name: "SE", "Pass %": 97 },
      ] },
      { type: "area", title: "Active projects", xKey: "name", series: ["Projects"], data: series([[82, 96, 110, 131, 148, 160]], ["Projects"]) },
    ],
    insights: [
      { title: "Theory of Computation failures rising", body: "Failures increased for two consecutive semesters.", evidence: "Sem 5: 7% → 11% → 14%", tone: "rose" },
      { title: "Cloud skills gap", body: "Cloud skills are in high demand but only 22% of final-year students are ready.", evidence: "146 job descriptions vs skill graph", tone: "amber" },
    ],
    queue: [
      { title: "Early-warning reviews (7)", meta: "Pending faculty/counsellor review", href: "/hod/early-warning", tone: "rose" },
      { title: "Approve project reviews (12)", meta: "AI Project Review Board", href: "/hod/project-review", tone: "brand" },
      { title: "Department skill report", meta: "Ready to export", href: "/hod/department-skills", tone: "teal" },
    ],
  },
  placement: {
    greeting: "Training & Placement — 2026–27 season",
    kpis: [
      { label: "Offers", value: "412", delta: "+38 this month", tone: "gold" },
      { label: "Eligible students", value: "1,860", tone: "brand" },
      { label: "Readiness", value: "68%", delta: "+6%", tone: "teal" },
      { label: "Upcoming drives", value: "5", tone: "sky" },
    ],
    charts: [
      { type: "bar", title: "Offers by department", xKey: "name", series: ["Offers"], data: [
        { name: "CSE", Offers: 142 }, { name: "IT", Offers: 88 }, { name: "ECE", Offers: 71 }, { name: "EEE", Offers: 39 }, { name: "MECH", Offers: 45 }, { name: "CIVIL", Offers: 27 },
      ] },
      { type: "line", title: "Mock interview average", xKey: "name", series: ["Technical", "HR"], data: series([[58, 60, 63, 65, 67, 69], [49, 50, 52, 53, 55, 56]], ["Technical", "HR"]) },
    ],
    insights: [{ title: "HR round lagging", body: "HR-round scores trail technical rounds by 13 points. Schedule HR mock sessions.", evidence: "1,120 AI mock interviews", tone: "amber" }],
    queue: [
      { title: "Freshworks drive — shortlist", meta: "Oct 11 · 212 eligible", href: "/placement/drives", tone: "brand" },
      { title: "Match new openings", meta: "8 roles pending", href: "/placement/jobs", tone: "teal" },
    ],
  },
  incubation: {
    greeting: "Innovation & Incubation Cell",
    kpis: [
      { label: "Ideas submitted", value: "41", tone: "brand" },
      { label: "Active ventures", value: "11", tone: "teal" },
      { label: "Mentors", value: "26", tone: "gold" },
      { label: "Funding-ready", value: "3", tone: "sky" },
    ],
    charts: [
      { type: "bar", title: "Pipeline by stage", xKey: "name", series: ["Ventures"], data: [
        { name: "Idea", Ventures: 41 }, { name: "Validation", Ventures: 22 }, { name: "Model", Ventures: 11 }, { name: "MVP", Ventures: 8 }, { name: "Pitch", Ventures: 5 }, { name: "Incubated", Ventures: 3 },
      ] },
      { type: "donut", title: "Ventures by domain", xKey: "name", series: ["value"], data: [
        { name: "AgriTech", value: 4 }, { name: "EdTech", value: 3 }, { name: "HealthTech", value: 2 }, { name: "ClimateTech", value: 2 },
      ] },
    ],
    insights: [{ title: "Validation bottleneck", body: "Half the ideas stall at problem validation. Customer-interview workshops are recommended.", evidence: "41 → 22 ventures between stages", tone: "amber" }],
    queue: [
      { title: "Incubation review panel", meta: "Nov 12 · 5 ventures", href: "/incubation/incubation-pipeline", tone: "brand" },
      { title: "Assign mentors", meta: "3 ventures without mentors", href: "/incubation/mentors", tone: "amber" },
    ],
  },
  institution: {
    greeting: "Institutional AI Command Center",
    kpis: [
      { label: "Students", value: "18,452", tone: "brand" },
      { label: "Faculty", value: "782", tone: "brand" },
      { label: "Departments", value: "41", tone: "sky" },
      { label: "Active courses", value: "612", tone: "sky" },
      { label: "Projects", value: "1,284", tone: "gold" },
      { label: "Placement readiness", value: "68%", delta: "+6%", tone: "teal" },
      { label: "AI learning adoption", value: "74%", delta: "+9%", tone: "teal" },
      { label: "Support reviews open", value: "37", tone: "amber" },
    ],
    charts: [
      { type: "area", title: "Weekly active learners (%)", xKey: "name", series: ["Students", "Faculty"], data: series([[61, 64, 68, 70, 73, 74], [48, 52, 55, 60, 63, 66]], ["Students", "Faculty"]) },
      { type: "bar", title: "Department readiness (%)", xKey: "name", series: ["Academic", "Placement"], data: [
        { name: "CSE", Academic: 84, Placement: 72 }, { name: "IT", Academic: 81, Placement: 70 }, { name: "ECE", Academic: 79, Placement: 64 }, { name: "MECH", Academic: 76, Placement: 58 }, { name: "CIVIL", Academic: 74, Placement: 51 }, { name: "MBA", Academic: 82, Placement: 69 },
      ] },
    ],
    insights: [
      { title: "Academic insight", body: "Three subjects show increasing failure patterns.", evidence: "TOC, Thermodynamics, Structural Analysis · 3-semester trend", tone: "rose" },
      { title: "Skill insight", body: "Cloud and AI skills have high demand but low student readiness.", evidence: "Job-matching data vs skill graph, 4,200 final-year students", tone: "amber" },
      { title: "Placement insight", body: "Final-year students need increased interview practice.", evidence: "HR-round mock average 56% vs 69% technical", tone: "amber" },
      { title: "Engagement insight", body: "Participation in technical clubs is below the configured target.", evidence: "38.6% vs 45% target", tone: "sky" },
    ],
    queue: [
      { title: "Early-warning: 37 support reviews open", meta: "Across 9 departments", href: "/institution/early-warning", tone: "rose" },
      { title: "Semester report", meta: "Ready to generate", href: "/institution/reports", tone: "teal" },
    ],
  },
  recruiter: {
    greeting: "Welcome, Rahul — TechNova talent workspace",
    kpis: [
      { label: "Verified profiles", value: "12,480", tone: "brand" },
      { label: "Shortlisted", value: "48", tone: "gold" },
      { label: "Interviews this week", value: "9", tone: "sky" },
      { label: "Offers made", value: "6", tone: "teal" },
    ],
    charts: [
      { type: "bar", title: "Candidates by readiness band", xKey: "name", series: ["Candidates"], data: [
        { name: "50–60", Candidates: 2310 }, { name: "60–70", Candidates: 3920 }, { name: "70–80", Candidates: 3480 }, { name: "80–90", Candidates: 2010 }, { name: "90+", Candidates: 760 },
      ] },
    ],
    insights: [{ title: "Profiles are verified, not ranked", body: "Readiness is shown per dimension. Hiring decisions remain with your panel.", evidence: "CollossusIQ readiness policy", tone: "sky" }],
    queue: [
      { title: "Review 12 new matches for SDE-1", meta: "Python · SQL · readiness ≥ 75", href: "/recruiter/talent-search", tone: "brand" },
      { title: "Interviews today (2)", meta: "10:00, 14:30", href: "/recruiter/recruiter-interviews", tone: "gold" },
    ],
  },
  admin: {
    greeting: "Platform operations",
    kpis: [
      { label: "Tenants", value: "6", delta: "+1 onboarding", tone: "brand" },
      { label: "Active users (30d)", value: "58,940", tone: "teal" },
      { label: "AI requests (24h)", value: "412K", tone: "sky" },
      { label: "p95 AI latency", value: "2.1s", delta: "−0.3s", tone: "teal" },
      { label: "Uptime (30d)", value: "99.97%", tone: "teal" },
      { label: "Open security alerts", value: "2", tone: "rose" },
    ],
    charts: [
      { type: "line", title: "AI requests (thousands / day)", xKey: "name", series: ["Requests"], data: series([[210, 260, 300, 350, 390, 412]], ["Requests"]) },
      { type: "bar", title: "AI cost by tenant (₹ '000 / month)", xKey: "name", series: ["Cost"], data: [
        { name: "TNTU", Cost: 184 }, { name: "AIT", Cost: 62 }, { name: "Malabar", Cost: 41 }, { name: "Kaveri", Cost: 18 }, { name: "Deccan", Cost: 22 },
      ] },
    ],
    insights: [
      { title: "Prompt regression detected", body: "Interview agent v14 lowered relevance by 3%. Rollback to v13 is recommended.", evidence: "A/B evaluation · 400 sessions", tone: "rose" },
      { title: "Blocked prompt-injection attempts", body: "132 injection attempts blocked in 24h; none reached tools.", evidence: "AI gateway guard logs", tone: "sky" },
    ],
    queue: [
      { title: "Onboard Sahyadri Polytechnic", meta: "Tenant provisioning 60%", href: "/admin/colleges", tone: "brand" },
      { title: "Review 23 flagged AI outputs", meta: "Human review queue", href: "/admin/ai-governance", tone: "amber" },
      { title: "Audit export for TNTU", meta: "Requested by registrar", href: "/admin/audit-log", tone: "teal" },
    ],
  },
};
