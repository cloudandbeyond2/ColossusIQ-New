import "server-only";
import type { CourseDetail, DashboardData, Kpi, ListData, RoleHome, ScorecardData, StudentDashboard } from "@/lib/api/schemas";
import type { Stream } from "@/config/streams";
import { COURSES, STUDENT_DASHBOARD, personName, seeded } from "./fixtures";

/*
 * Content that differs by academic stream, so an MBBS student, a B.Com student and a B.E. student
 * each see their own subjects, terms, exams and regulators.
 */

/* ── subjects shown in charts ───────────────────── */
export const SUBJECTS: Record<Stream, string[]> = {
  engineering: ["DBMS", "OS", "CN", "ML", "TOC", "SE"],
  medical: ["Anatomy", "Physiology", "Biochem", "Pathology", "Pharmac.", "Microbio."],
  artsScience: ["Tamil", "English", "Accounts", "Chemistry", "Economics", "Maths"],
  management: ["Marketing", "Finance", "HR", "Operations", "Analytics", "Strategy"],
  polytechnic: ["Drawing", "Workshop", "Machines", "Circuits", "Surveying", "CAD"],
};

const DEPARTMENT_SHORT: Record<Stream, string[]> = {
  engineering: ["CSE", "IT", "ECE", "MECH", "CIVIL", "MBA"],
  medical: ["Medicine", "Surgery", "OBG", "Paediatrics", "Ortho", "Comm. Med"],
  artsScience: ["Tamil", "English", "Commerce", "Chemistry", "Maths", "Comp. Sci"],
  management: ["Marketing", "Finance", "HR", "Operations", "Analytics", "Strategy"],
  polytechnic: ["Mech", "EEE", "Civil", "Computer", "Auto", "ECE"],
};

/* ── student dashboard ──────────────────────────── */
const STUDENT_OVERRIDES: Partial<Record<Stream, Partial<StudentDashboard>>> = {
  medical: {
    name: "Keerthana",
    department: "Pathology & Pharmacology",
    departmentCode: "MED",
    degree: "MBBS (Phase II)",
    semester: 4,
    year: "2nd Year",
    rollNo: "21MB1042",
    today: [
      { time: "08:00", title: "Clinical posting — General Medicine, Unit II", kind: "class" },
      { time: "11:00", title: "Pathology lecture — Neoplasia", kind: "class" },
      { time: "14:00", title: "Skills lab — IV cannulation (OSCE prep)", kind: "study" },
      { time: "19:00", title: "Logbook: get 2 competencies certified", kind: "career" },
    ],
    recommendation:
      "Revise **Neoplasia (PA 7.1–7.5)** for 25 minutes and attempt the 10-question MCQ set — it is your weakest Phase II topic and the internal assessment is in 9 days. Also, **3 logbook competencies** are awaiting faculty certification.",
    project: { name: "ICMR-STS: Anaemia prevalence among adolescents", progress: 55 },
    upcoming: [
      { title: "OSCE mock — 8 stations", when: "Friday, 2:00 PM" },
      { title: "Pathology Internal Assessment II", when: "in 9 days" },
      { title: "Rural health camp posting", when: "Oct 21" },
    ],
    weakTopics: [
      { subject: "Pathology", topic: "Neoplasia", mastery: 44 },
      { subject: "Pharmacology", topic: "Autonomic drugs", mastery: 51 },
      { subject: "Microbiology", topic: "Immunology basics", mastery: 57 },
    ],
    examCountdown: { exam: "Pathology Internal Assessment II", days: 9, syllabusCovered: 58 },
  },
  artsScience: {
    name: "Nandhini",
    department: "Commerce & Accounting",
    departmentCode: "COM",
    degree: "B.Com Accounting & Finance",
    semester: 5,
    year: "3rd Year",
    rollNo: "21CO2018",
    today: [
      { time: "09:30", title: "Financial Accounting — Depreciation methods", kind: "class" },
      { time: "11:30", title: "English Communication — group presentation", kind: "class" },
      { time: "14:30", title: "Tally practice — GST vouchers", kind: "study" },
      { time: "17:00", title: "Placement aptitude — quantitative set", kind: "career" },
    ],
    recommendation:
      "Spend 25 minutes on **Depreciation — written-down value method** and solve 5 problems. It is your weakest Accounts topic and the CIA test is in 9 days. Your **CBCS elective choice** for Semester 4 closes on Friday.",
    project: { name: "Survey: Digital payment adoption among Tiruchy retailers", progress: 65 },
    upcoming: [
      { title: "Continuous Internal Assessment II", when: "in 9 days" },
      { title: "CBCS elective choice closes", when: "Friday" },
      { title: "Tamil Mandram literary festival", when: "Oct 8" },
    ],
    weakTopics: [
      { subject: "Accounts", topic: "Depreciation (WDV)", mastery: 45 },
      { subject: "Business Statistics", topic: "Correlation", mastery: 52 },
      { subject: "English", topic: "Report writing", mastery: 60 },
    ],
    examCountdown: { exam: "Continuous Internal Assessment II", days: 9, syllabusCovered: 64 },
  },
};

export function studentDashboard(stream: Stream | null): StudentDashboard {
  return { ...STUDENT_DASHBOARD, ...(stream ? STUDENT_OVERRIDES[stream] : {}) };
}

/* ── student courses ────────────────────────────── */
type TopicSeed = [string, string];
const COURSE_SEEDS: Partial<Record<Stream, Array<[string, string, string, string, number, number, TopicSeed[]]>>> = {
  medical: [
    ["pa", "PA201", "Pathology", "Dr. K. Vasanth, MD", 58, 54, [["General Pathology", "Cell injury"], ["General Pathology", "Inflammation & repair"], ["General Pathology", "Haemodynamic disorders"], ["General Pathology", "Neoplasia"], ["Systemic Pathology", "Cardiovascular system"], ["Haematology", "Anaemias"]]],
    ["ph", "PH201", "Pharmacology", "Dr. G. Latha, MD", 50, 58, [["General Pharmacology", "Pharmacokinetics"], ["General Pharmacology", "Pharmacodynamics"], ["ANS", "Autonomic drugs"], ["CVS", "Antihypertensives"], ["Chemotherapy", "Antimicrobials"]]],
    ["mi", "MI201", "Microbiology", "Dr. S. Anjali, MD", 62, 60, [["General Microbiology", "Sterilisation"], ["Immunology", "Immunology basics"], ["Bacteriology", "Staphylococcus"], ["Virology", "HIV & hepatitis"]]],
    ["fm", "FM201", "Forensic Medicine", "Dr. R. Surya, MD", 40, 63, [["Forensic Pathology", "Post-mortem changes"], ["Toxicology", "Organophosphate poisoning"], ["Medical Jurisprudence", "Consent & negligence"]]],
  ],
  artsScience: [
    ["fa", "UCO301", "Financial Accounting", "Dr. V. Murugan", 64, 57, [["Unit 1", "Final accounts"], ["Unit 2", "Depreciation (WDV)"], ["Unit 3", "Branch accounts"], ["Unit 4", "Hire purchase"], ["Unit 5", "Partnership admission"]]],
    ["bs", "UCO302", "Business Statistics", "Dr. K. Priya", 55, 60, [["Unit 1", "Measures of central tendency"], ["Unit 2", "Dispersion"], ["Unit 3", "Correlation"], ["Unit 4", "Index numbers"]]],
    ["en", "UEN301", "English for Professionals", "Dr. Anne Joseph", 70, 66, [["Unit 1", "Business letters"], ["Unit 2", "Report writing"], ["Unit 3", "Presentations"]]],
    ["ta", "UTA301", "Tamil Ilakkiyam III", "Dr. P. Senthamizh", 72, 74, [["Sangam", "Kurunthogai"], ["Bhakti", "Thevaram"], ["Modern", "Bharathiyar kavithaigal"]]],
  ],
};

function buildCourse(id: string, code: string, title: string, faculty: string, progress: number, mastery: number, seeds: TopicSeed[]): CourseDetail {
  const doneUntil = Math.round((progress / 100) * seeds.length);
  const topics = seeds.map(([unit, t], i) => {
    const m = Math.max(25, Math.min(95, mastery + ((i * 13) % 30) - 15));
    const status = i < doneUntil ? (m < 50 ? "weak" : "done") : i === doneUntil ? "in-progress" : "todo";
    return { id: `${id}-t${i + 1}`, unit, title: t, mastery: i <= doneUntil ? m : 0, status } as const;
  });
  const next = topics.find((t) => t.status === "in-progress" || t.status === "weak") ?? topics[0];
  return { id, code, title, faculty, progress, mastery, units: new Set(topics.map((t) => t.unit)).size, nextTopic: next?.title ?? "", topics };
}

export function studentCourses(stream: Stream | null): CourseDetail[] {
  const seeds = stream ? COURSE_SEEDS[stream] : undefined;
  return seeds ? seeds.map(([id, code, title, faculty, p, m, t]) => buildCourse(id, code, title, faculty, p, m, t)) : COURSES;
}

/* ── role home overrides ────────────────────────── */
const kpi = (label: string, value: string, tone: Kpi["tone"], delta?: string): Kpi => ({ label, value, tone, delta });

export function roleHomeFor(home: RoleHome, role: string, stream: Stream | null, collegeLabel: string | null): RoleHome {
  const subjects = SUBJECTS[stream ?? "engineering"];
  let out: RoleHome = { ...home };
  if (role === "institution" && collegeLabel) out = { ...out, greeting: `${collegeLabel} — Command Center` };
  if (!stream || stream === "engineering") return out;

  if (role === "institution" && stream === "medical") {
    out = {
      ...out,
      kpis: [
        kpi("MBBS students", "750", "brand"),
        kpi("Faculty (NMC norm met)", "212 / 198", "teal", "+14 above norm"),
        kpi("Teaching hospital beds", "1,120", "sky"),
        kpi("Bed occupancy", "82%", "teal", "+4%"),
        kpi("OPD patients / day", "2,940", "gold"),
        kpi("Students on clinical postings", "486", "brand"),
        kpi("Clinical attendance ≥ 80%", "91%", "teal"),
        kpi("Pending logbook sign-offs", "318", "amber"),
      ],
      insights: [
        { title: "Logbook sign-off backlog", body: "318 competencies await faculty certification, mostly in General Surgery and OBG.", evidence: "Competency logbook · last 30 days", tone: "amber" },
        { title: "Attendance risk before university exams", body: "27 Phase III students are below 80% clinical attendance in at least one posting.", evidence: "Clinical rotation attendance records", tone: "rose" },
        { title: "NMC faculty norm", body: "Faculty strength exceeds the NMC minimum in 19 of 21 departments; Radiodiagnosis and Psychiatry need one Assistant Professor each.", evidence: "Staff records vs NMC MSR 2023", tone: "sky" },
      ],
      queue: [
        { title: "Approve October clinical rotation schedule", meta: "486 students · 11 departments", href: "/institution/clinical-rotations", tone: "brand" },
        { title: "NMC compliance review", meta: "2 departments below norm", href: "/institution/nmc-compliance", tone: "amber" },
        { title: "MBBS admissions (NEET counselling)", meta: "Round 2 allotments", href: "/institution/admissions", tone: "teal" },
      ],
    };
  } else if (role === "institution" && stream === "artsScience") {
    out = {
      ...out,
      kpis: [
        kpi("Students (UG + PG)", "3,140", "brand"),
        kpi("Programmes", "13", "sky"),
        kpi("CBCS elective seats filled", "88%", "teal", "+6%"),
        kpi("NAAC readiness", "3.1 / 4", "gold", "Grade A+ track"),
        kpi("Pass percentage", "89.4%", "teal", "+1.8%"),
        kpi("Research publications (yr)", "46", "brand"),
        kpi("Placement / higher studies", "71%", "teal"),
        kpi("Support reviews open", "12", "amber"),
      ],
      insights: [
        { title: "Elective demand imbalance", body: "Data Analytics and Digital Marketing electives are oversubscribed while Folklore has 9 takers.", evidence: "CBCS elective choices · Semester 4", tone: "amber" },
        { title: "NAAC Criterion 3 gap", body: "Research & extension evidence is the weakest criterion; 14 departments have no MoU uploaded this year.", evidence: "NAAC readiness scorecard", tone: "rose" },
      ],
      queue: [
        { title: "Publish Semester 4 elective allocation", meta: "CBCS · closes Friday", href: "/institution/cbcs-electives", tone: "brand" },
        { title: "NAAC SSR evidence upload", meta: "Criteria 3 and 7 pending", href: "/institution/naac-readiness", tone: "amber" },
        { title: "Admissions — B.Com and BCA", meta: "Merit list ready", href: "/institution/admissions", tone: "teal" },
      ],
    };
  }

  // Principal: department charts use the college's own departments.
  if (role === "institution") {
    const depts = DEPARTMENT_SHORT[stream];
    out = { ...out, charts: out.charts.map((c) => (c.type === "bar" && c.data.length <= 6 ? { ...c, data: c.data.map((d, i) => ({ ...d, name: depts[i] ?? String(d.name) })) } : c)) };
  }

  // HOD and faculty: swap subject names in their charts so they match the stream.
  if (role === "hod" || role === "faculty") {
    out = {
      ...out,
      greeting: role === "hod" ? `Department dashboard · ${collegeLabel ?? ""}` : out.greeting,
      charts: out.charts.map((c) =>
        c.type === "bar" && c.data.length <= 6 ? { ...c, title: c.title.replace(/— CSE-A|by subject/, "by subject"), data: c.data.map((d, i) => ({ ...d, name: subjects[i] ?? String(d.name) })) } : c,
      ),
    };
  }
  return out;
}

/* ── stream-aware versions of generic module dashboards ── */
export function relabelSubjects(data: DashboardData, stream: Stream | null): DashboardData {
  if (!stream || stream === "engineering") return data;
  const subjects = SUBJECTS[stream];
  return {
    ...data,
    charts: data.charts.map((c) =>
      c.type === "bar" && c.data.length <= 6 ? { ...c, data: c.data.map((d, i) => ({ ...d, name: subjects[i] ?? String(d.name) })) } : c,
    ),
  };
}

/* ── new stream-only modules ────────────────────── */
export function competencyLogbook(): ListData {
  const r = seeded(771);
  const rows = [
    ["PA 7.1", "Define and classify neoplasia", "Pathology", "K"],
    ["PH 1.13", "Describe mechanism of action of adrenergic drugs", "Pharmacology", "KH"],
    ["IM 4.9", "Elicit a clinical history in a patient with fever", "General Medicine", "SH"],
    ["SU 5.2", "Perform wound dressing under supervision", "General Surgery", "P"],
    ["OG 8.3", "Perform obstetric examination", "Obstetrics & Gynaecology", "SH"],
    ["PE 1.4", "Perform anthropometry and plot growth chart", "Paediatrics", "P"],
    ["CM 5.2", "Conduct a nutritional assessment in the community", "Community Medicine", "SH"],
    ["MI 1.2", "Perform and interpret Gram stain", "Microbiology", "P"],
  ].map(([code, competency, department, level]) => ({
    code: code!,
    competency: competency!,
    department: department!,
    level: level!,
    attempts: 1 + Math.floor(r() * 3),
    status: r() > 0.55 ? "Certified" : r() > 0.3 ? "Pending review" : "Not attempted",
    certifiedBy: `Dr. ${personName(Math.floor(r() * 30))}`,
  }));
  return {
    template: "list",
    columns: [
      { key: "code", label: "Competency", kind: "text" },
      { key: "competency", label: "Description", kind: "text" },
      { key: "department", label: "Department", kind: "text" },
      { key: "level", label: "Level (K/KH/SH/P)", kind: "badge" },
      { key: "attempts", label: "Attempts", kind: "number" },
      { key: "status", label: "Status", kind: "badge" },
      { key: "certifiedBy", label: "Certifying faculty", kind: "text" },
    ],
    rows,
    filterKey: "status",
    primaryAction: "Request sign-off",
  };
}

export function osceStations(): ListData {
  return {
    template: "list",
    columns: [
      { key: "station", label: "Station", kind: "text" },
      { key: "skill", label: "Skill", kind: "text" },
      { key: "type", label: "Type", kind: "badge" },
      { key: "duration", label: "Minutes", kind: "number" },
      { key: "score", label: "Last checklist score", kind: "progress" },
      { key: "slot", label: "Next skills-lab slot", kind: "text" },
    ],
    rows: [
      { station: "Station 1", skill: "Blood pressure measurement", type: "Procedure", duration: 5, score: 86, slot: "Mon 10:00" },
      { station: "Station 2", skill: "IV cannulation on manikin", type: "Procedure", duration: 7, score: 64, slot: "Mon 11:00" },
      { station: "Station 3", skill: "History taking — chest pain", type: "Communication", duration: 8, score: 72, slot: "Tue 09:00" },
      { station: "Station 4", skill: "Basic life support (BLS)", type: "Emergency", duration: 6, score: 91, slot: "Tue 10:00" },
      { station: "Station 5", skill: "Breaking bad news", type: "Communication", duration: 8, score: 58, slot: "Wed 14:00" },
      { station: "Station 6", skill: "Suturing — simple interrupted", type: "Procedure", duration: 7, score: 69, slot: "Thu 11:00" },
      { station: "Station 7", skill: "Interpret chest X-ray", type: "Data interpretation", duration: 5, score: 75, slot: "Fri 09:00" },
      { station: "Station 8", skill: "Prescription writing", type: "Data interpretation", duration: 5, score: 81, slot: "Fri 10:00" },
    ],
    filterKey: "type",
    primaryAction: "Book skills-lab slot",
  };
}

export function hospitalDashboard(): DashboardData {
  const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
  return {
    template: "dashboard",
    kpis: [
      kpi("Beds", "1,120", "brand"),
      kpi("Bed occupancy", "82%", "teal", "+4%"),
      kpi("OPD / day", "2,940", "gold"),
      kpi("IPD admissions / day", "210", "sky"),
      kpi("Surgeries / month", "1,460", "brand"),
      kpi("Deliveries / month", "380", "teal"),
    ],
    charts: [
      { type: "line", title: "OPD and IPD load", xKey: "name", series: ["OPD (÷10)", "IPD"], data: months.map((name, i) => ({ name, "OPD (÷10)": 270 + i * 5, IPD: 190 + i * 4 })) },
      {
        type: "bar",
        title: "Clinical material per student (cases / week)",
        xKey: "name",
        series: ["Cases"],
        data: [
          { name: "Medicine", Cases: 14 },
          { name: "Surgery", Cases: 11 },
          { name: "OBG", Cases: 9 },
          { name: "Paediatrics", Cases: 8 },
          { name: "Ortho", Cases: 6 },
        ],
      },
    ],
    insights: [
      { title: "Clinical exposure is adequate", body: "Case load per student meets CBME recommendations in all major departments except Orthopaedics.", evidence: "Hospital information system · last 90 days", tone: "teal" },
    ],
  };
}

const score = (headline: string, dims: Array<[string, number, number]>, strengths: string[], gaps: string[], plan: string[]): ScorecardData => ({
  template: "scorecard",
  headline,
  overall: Math.round(dims.reduce((a, [, s]) => a + s, 0) / dims.length),
  dimensions: dims.map(([name, s, target]) => ({ name, score: s, target })),
  strengths,
  gaps,
  plan,
});

export const nmcCompliance = () =>
  score(
    "Compliance against NMC Minimum Standard Requirements",
    [["Faculty strength", 92, 100], ["Faculty attendance (AEBAS)", 88, 75], ["Teaching beds", 100, 100], ["Clinical material", 86, 80], ["Skills lab & e-learning", 78, 100], ["CBME logbook completion", 71, 90], ["Library & journals", 95, 100]],
    ["Teaching beds and clinical material exceed requirements", "Biometric faculty attendance above the 75% threshold"],
    ["Two departments below faculty norm (Radiodiagnosis, Psychiatry)", "Skills lab lacks 2 mandated simulators", "Logbook completion trails target"],
    ["Recruit 2 Assistant Professors before the inspection window", "Procure advanced airway and obstetric simulators", "Weekly logbook sign-off drive per department"],
  );

export const naacReadiness = () =>
  score(
    "NAAC readiness — seven criteria",
    [["C1 Curricular aspects", 82, 80], ["C2 Teaching-learning & evaluation", 78, 80], ["C3 Research, innovation & extension", 58, 75], ["C4 Infrastructure & learning resources", 84, 75], ["C5 Student support & progression", 76, 75], ["C6 Governance & leadership", 80, 75], ["C7 Institutional values & best practices", 66, 75]],
    ["Strong curriculum design with CBCS and value-added courses", "Well-documented infrastructure and ICT resources"],
    ["Research publications and MoUs are below target", "Best-practice documentation (C7) incomplete"],
    ["Collect MoU and extension evidence from every department", "Publish two best practices with outcome data", "Run a mock peer-team visit in January"],
  );

export const aicteCompliance = () =>
  score(
    "AICTE approval conditions",
    [["Faculty-student ratio (1:20)", 90, 100], ["Faculty cadre ratio", 76, 100], ["Laboratories & equipment", 88, 100], ["Built-up area", 100, 100], ["Mandatory disclosures", 70, 100], ["Anti-ragging & grievance cells", 100, 100]],
    ["Infrastructure and statutory committees fully compliant"],
    ["Professor cadre short by 3 posts", "Mandatory disclosure page is outdated"],
    ["Advertise 3 Professor posts", "Update the AICTE mandatory disclosure page this month"],
  );

export function cbcsElectives(stream: Stream | null): ListData {
  const rows =
    stream === "management"
      ? [
          { course: "Digital Marketing", category: "Discipline elective", credits: 3, seats: 60, filled: 60, status: "Full" },
          { course: "FinTech Fundamentals", category: "Discipline elective", credits: 3, seats: 60, filled: 41, status: "Open" },
          { course: "Negotiation Skills", category: "Skill enhancement", credits: 2, seats: 40, filled: 22, status: "Open" },
        ]
      : [
          { course: "Data Analytics with Excel", category: "Skill enhancement (SEC)", credits: 2, seats: 60, filled: 60, status: "Full" },
          { course: "Digital Marketing", category: "Generic elective (GE)", credits: 3, seats: 60, filled: 58, status: "Open" },
          { course: "Environmental Studies", category: "Ability enhancement (AECC)", credits: 2, seats: 400, filled: 400, status: "Full" },
          { course: "Tamil Folklore", category: "Discipline elective (DSE)", credits: 3, seats: 40, filled: 9, status: "Open" },
          { course: "Green Chemistry", category: "Discipline elective (DSE)", credits: 3, seats: 40, filled: 33, status: "Open" },
          { course: "Yoga & Wellness", category: "Value-added course", credits: 1, seats: 120, filled: 97, status: "Open" },
          { course: "Spoken Hindi", category: "Value-added course", credits: 1, seats: 60, filled: 60, status: "Full" },
        ];
  return {
    template: "list",
    columns: [
      { key: "course", label: "Course", kind: "text" },
      { key: "category", label: "CBCS category", kind: "badge" },
      { key: "credits", label: "Credits", kind: "number" },
      { key: "seats", label: "Seats", kind: "number" },
      { key: "filled", label: "Filled", kind: "number" },
      { key: "status", label: "Status", kind: "badge" },
    ],
    rows: rows.map((r) => ({ ...r })),
    filterKey: "category",
    primaryAction: "Choose electives",
  };
}
