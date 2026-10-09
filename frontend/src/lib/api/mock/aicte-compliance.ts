import "server-only";
import { randomBytes } from "node:crypto";
import { RESOURCES } from "@/config/resources";
import { ALL_COLLEGES } from "@/config/tenancy";
import type {
  AicteActionItem,
  AicteCommittee,
  AicteComplianceData,
  AicteDepartmentCompliance,
  AicteNormItem,
  ChartSpec,
  CreateAicteActionInput,
  Kpi,
  UpdateAicteActionStatusInput,
  UpdateAicteCommitteeInput,
  UpdateAicteProfileInput,
} from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { getCollege, listColleges } from "./records";
import { aicteStore, MAX_ACTIONS, updateAicte, type StoredAction } from "./aicte-store";

/*
 * AICTE Compliance. The numbers (faculty-student ratio, cadre, laboratories, departments) are computed on every read
 * from the college's own staff, user, student and course records. What a person has to state - the AICTE id, the
 * status of each statutory committee, the compliance action plan - is saved per college (aicte-store.ts).
 * A Super Admin at "All colleges" sees the first college read-only; changes need a college to be chosen.
 */

export const AICTE_FSR_LIMIT = 20;
/** AICTE faculty cadre norm: Professor : Associate Professor : Assistant Professor. */
export const AICTE_CADRE = { prof: 1, assoc: 2, asst: 6 } as const;

interface CommitteeDef {
  id: string;
  name: string;
  mandate: string;
}

export const AICTE_COMMITTEES: CommitteeDef[] = [
  { id: "COM-01", name: "Anti-Ragging Committee & Squad", mandate: "AICTE Regulations 2009 (Clause 6a) — Ragging prevention, squad monitoring, and student affidavits" },
  { id: "COM-02", name: "Internal Complaints Committee (ICC) / POSH", mandate: "POSH Act 2013 & AICTE Regulations 2016 — Gender sensitization, woman safety, and grievance redressal" },
  { id: "COM-03", name: "Student Grievance Redressal Committee (SGRC)", mandate: "AICTE Regulations 2019 — Ombudsman oversight, student grievance portal, and appellate mechanism" },
  { id: "COM-04", name: "SC / ST Committee & Equal Opportunity Cell", mandate: "Scheduled Castes & Scheduled Tribes Prevention of Atrocities Act & AICTE guidelines" },
  { id: "COM-05", name: "Internal Quality Assurance Cell (IQAC)", mandate: "Continuous quality monitoring, academic audits, NIRF/NBA alignment, and student feedback" },
  { id: "COM-06", name: "Industry-Institute Interaction Cell (IIIC) & Placement", mandate: "AICTE Internship Policy, industry MoUs, campus placement drives, and skill development" },
];

const STATUS_CONSTITUTED = "Constituted & Active";
const STATUS_PENDING = "Pending Reconstitution";
const CERTIFIED = "Certified by Principal";
const UNASSIGNED = "Unassigned";

type Rec = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

const today = () => new Date().toISOString().slice(0, 10);

/** Indian academic years start in July. */
export function academicYearOf(now = new Date()): string {
  const y = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 6 ? y : y - 1;
  return `${start}–${start + 1}`;
}

type Cadre = "prof" | "assoc" | "asst";
export function cadreOf(designation: string): Cadre {
  const d = designation.toLowerCase();
  if (d.includes("associate")) return "assoc";
  if (d.includes("assistant")) return "asst";
  if (d.includes("principal") || d.includes("hod") || d.includes("head") || d.includes("professor")) return "prof";
  return "asst";
}

/** How close a cadre mix is to 1 : 2 : 6, from 0 (nothing alike) to 100 (exactly the norm). */
export function cadreScore(prof: number, assoc: number, asst: number): number {
  const total = prof + assoc + asst;
  if (total === 0) return 0;
  const ideal = AICTE_CADRE.prof + AICTE_CADRE.assoc + AICTE_CADRE.asst;
  const gap =
    Math.abs(prof / total - AICTE_CADRE.prof / ideal) +
    Math.abs(assoc / total - AICTE_CADRE.assoc / ideal) +
    Math.abs(asst / total - AICTE_CADRE.asst / ideal);
  return Math.round(100 * (1 - gap / 2));
}

const ratioText = (students: number, faculty: number) => {
  if (faculty === 0) return students > 0 ? "No faculty recorded" : "—";
  const r = Number((students / faculty).toFixed(1));
  return r <= 1 ? "1 : <1" : `1 : ${r}`;
};

const toneOf = (score: number): AicteNormItem["status"] => (score >= 85 ? "Compliant" : score >= 60 ? "Needs Attention" : "Deficient");

const isLab = (c: Rec) => {
  const t = str(c.title).toLowerCase();
  return str(c.courseType).toLowerCase() === "practical" || t.includes("lab");
};

/** The college this session works on; "All colleges" has none of its own, so it reads the first one. */
async function resolveCollege(session: SessionPayload): Promise<{ collegeId: string; college: Rec | undefined }> {
  let collegeId = session.college !== ALL_COLLEGES ? session.college : "COL-1001";
  let college = (await getCollege(collegeId)) as Rec | undefined;
  if (!college) {
    const all = await listColleges();
    const first = all[0] as Rec | undefined;
    if (first) {
      college = first;
      collegeId = str(first.id) || collegeId;
    }
  }
  return { collegeId, college };
}

export const canManageAicte = (session: SessionPayload) =>
  (session.role === "institution" || session.role === "admin") && session.college !== ALL_COLLEGES;

const toAction = (a: StoredAction, now: string): AicteActionItem => ({ ...a, overdue: a.status !== "Resolved" && a.dueDate !== "" && a.dueDate < now });

export async function createAicteAction(session: SessionPayload, input: CreateAicteActionInput): Promise<AicteActionItem> {
  const now = today();
  const item: StoredAction = {
    id: `ACT-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`,
    title: input.title,
    category: input.category,
    priority: input.priority,
    assignedTo: input.assignedTo,
    dueDate: input.dueDate,
    status: "Open",
    notes: input.notes ?? "",
    createdAt: now,
    createdBy: session.name.slice(0, 120),
    resolvedAt: "",
  };
  await updateAicte(session.college, session.name, (s) => {
    s.actions = [item, ...s.actions].slice(0, MAX_ACTIONS);
  });
  return toAction(item, now);
}

export async function updateAicteActionStatus(
  session: SessionPayload,
  input: UpdateAicteActionStatusInput
): Promise<{ ok: boolean; action: AicteActionItem | null }> {
  const now = today();
  return updateAicte(session.college, session.name, (s) => {
    const found = s.actions.find((a) => a.id === input.actionId);
    if (!found) return { ok: false, action: null };
    found.status = input.status;
    found.resolvedAt = input.status === "Resolved" ? now : "";
    return { ok: true, action: toAction(found, now) };
  });
}

export async function deleteAicteAction(session: SessionPayload, actionId: string): Promise<boolean> {
  return updateAicte(session.college, session.name, (s) => {
    const before = s.actions.length;
    s.actions = s.actions.filter((a) => a.id !== actionId);
    return s.actions.length < before;
  });
}

/** Records one statutory committee. Returns false for an id that is not one of the six. */
export async function updateAicteCommittee(session: SessionPayload, id: string, input: UpdateAicteCommitteeInput): Promise<boolean> {
  if (!AICTE_COMMITTEES.some((c) => c.id === id)) return false;
  await updateAicte(session.college, session.name, (s) => {
    s.committees[id] = {
      status: input.status,
      chairperson: input.chairperson,
      membersCount: input.membersCount,
      lastMeetingDate: input.lastMeetingDate,
      momStatus: input.momStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: session.name.slice(0, 120),
    };
  });
  return true;
}

export async function updateAicteProfile(session: SessionPayload, input: UpdateAicteProfileInput): Promise<{ pid: string }> {
  await updateAicte(session.college, session.name, (s) => {
    s.pid = input.pid;
  });
  return { pid: input.pid };
}

export async function getAicteComplianceOverview(session: SessionPayload): Promise<AicteComplianceData> {
  const { collegeId, college } = await resolveCollege(session);
  const now = today();
  const collegeName = str(college?.name) || "College";
  const collegeCode = str(college?.code) || "0000";
  const collegeStream = str(college?.type) || "Engineering";

  const store = getStore();
  const [dbDepartments, dbStaff, dbUsers, dbCourses, board, saved] = await Promise.all([
    store.records.all(RESOURCES.departments!, collegeId),
    store.records.all(RESOURCES.staff!, collegeId),
    store.records.all(RESOURCES.users!, collegeId),
    store.records.all(RESOURCES.courses!, collegeId),
    store.readiness.board(collegeId),
    aicteStore().get(collegeId),
  ]);

  const pid = saved.pid || `1-${collegeCode}-AICTE-TN`;

  /* faculty: the staff register plus active teaching users who are not in it yet */
  const faculty = new Map<string, { name: string; designation: string; department: string }>();
  for (const s of dbStaff as Rec[]) {
    if (s.status === "Active" && (s.staffType === "Teaching" || !s.staffType)) {
      const name = str(s.fullName);
      if (name) faculty.set(name.toLowerCase(), { name, designation: str(s.designation) || "Assistant Professor", department: str(s.department) || UNASSIGNED });
    }
  }
  for (const u of dbUsers as Rec[]) {
    const role = str(u.role);
    if (u.status !== "Active" || !["Faculty", "Head of Department", "Principal"].includes(role)) continue;
    const name = str(u.fullName);
    if (!name || faculty.has(name.toLowerCase())) continue;
    const designation = role === "Principal" ? "Principal & Professor" : role === "Head of Department" ? "Professor & HOD" : "Assistant Professor";
    faculty.set(name.toLowerCase(), { name, designation, department: str(u.department) || UNASSIGNED });
  }
  const allFaculty = [...faculty.values()];
  const totalFaculty = allFaculty.length;
  const totalStudents = board.length;

  const cadre = { prof: 0, assoc: 0, asst: 0 };
  const facultyByDept = new Map<string, { total: number; prof: number; assoc: number; asst: number }>();
  for (const f of allFaculty) {
    const c = cadreOf(f.designation);
    cadre[c]++;
    const d = facultyByDept.get(f.department) ?? { total: 0, prof: 0, assoc: 0, asst: 0 };
    d.total++;
    d[c]++;
    facultyByDept.set(f.department, d);
  }
  const studentsByDept = new Map<string, number>();
  for (const s of board) {
    const dept = s.department || UNASSIGNED;
    studentsByDept.set(dept, (studentsByDept.get(dept) ?? 0) + 1);
  }
  const coursesByDept = new Map<string, { total: number; lab: number }>();
  for (const c of dbCourses as Rec[]) {
    const dept = str(c.department) || UNASSIGNED;
    const d = coursesByDept.get(dept) ?? { total: 0, lab: 0 };
    d.total++;
    if (isLab(c)) d.lab++;
    coursesByDept.set(dept, d);
  }
  const labCoursesTotal = (dbCourses as Rec[]).filter(isLab).length;

  /* departments: the sanctioned list, plus any department the records mention that is not on it */
  const sanctioned = (dbDepartments as Rec[]).map((d) => str(d.department)).filter(Boolean);
  const departmentNames = [...new Set([...sanctioned, ...studentsByDept.keys(), ...facultyByDept.keys(), ...coursesByDept.keys()])];

  const departments: AicteDepartmentCompliance[] = departmentNames.map((name) => {
    const students = studentsByDept.get(name) ?? 0;
    const f = facultyByDept.get(name) ?? { total: 0, prof: 0, assoc: 0, asst: 0 };
    const courses = coursesByDept.get(name) ?? { total: 0, lab: 0 };
    const compliant = f.total > 0 ? students / f.total <= AICTE_FSR_LIMIT : students === 0;
    return {
      department: name,
      studentsCount: students,
      facultyCount: f.total,
      fsrRatio: f.total > 0 ? ratioText(students, f.total) : students > 0 ? "Faculty Shortage" : "1 : 0",
      professors: f.prof,
      assocProfessors: f.assoc,
      asstProfessors: f.asst,
      coursesCount: courses.total,
      labCoursesCount: courses.lab,
      status: compliant ? "Compliant" : "Action Required",
    };
  });

  /* statutory committees: what the Principal recorded, with the records' suggestion for who should lead */
  const nameOf = (pred: (f: { designation: string }) => boolean) => allFaculty.find(pred)?.name ?? "";
  const principal = nameOf((f) => f.designation.toLowerCase().includes("principal")) || str((dbUsers as Rec[]).find((u) => u.role === "Principal")?.fullName);
  const hod = nameOf((f) => f.designation.toLowerCase().includes("hod")) || str((dbUsers as Rec[]).find((u) => u.role === "Head of Department")?.fullName);
  const senior = nameOf((f) => cadreOf(f.designation) === "prof" && !f.designation.toLowerCase().includes("principal"));
  const tpo = str((dbUsers as Rec[]).find((u) => u.role === "Placement Officer")?.fullName);
  const suggestion: Record<string, string> = { "COM-01": principal, "COM-02": senior, "COM-03": principal, "COM-04": hod, "COM-05": principal, "COM-06": tpo };
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const committees: AicteCommittee[] = AICTE_COMMITTEES.map((def) => {
    const r = saved.committees[def.id];
    const status = r?.status ?? "Not Recorded";
    return {
      id: def.id,
      name: def.name,
      mandate: def.mandate,
      chairperson: r?.chairperson ?? "",
      membersCount: r?.membersCount ?? 0,
      status,
      lastMeetingDate: r?.lastMeetingDate ?? "",
      momStatus: r?.momStatus ?? "Not Recorded",
      recorded: !!r,
      meetingOverdue: status === STATUS_CONSTITUTED && (!r?.lastMeetingDate || r.lastMeetingDate < yearAgo),
      suggestedChairperson: suggestion[def.id] ?? "",
    };
  });
  const credit = (c: AicteCommittee) => (c.status === STATUS_CONSTITUTED ? 1 : c.status === STATUS_PENDING ? 0.5 : 0);
  const constitutedCount = committees.filter((c) => c.status === STATUS_CONSTITUTED).length;
  const recordedCount = committees.filter((c) => c.recorded).length;
  const statutoryScore = Math.round((100 * committees.reduce((a, c) => a + credit(c), 0)) / committees.length);

  /* faculty-student ratio and cadre */
  const fsr = totalFaculty > 0 ? Number((totalStudents / totalFaculty).toFixed(1)) : 0;
  const fsrCompliant = totalFaculty > 0 && fsr <= AICTE_FSR_LIMIT;
  const fsrScore = totalFaculty === 0 ? 0 : fsrCompliant ? (fsr <= 15 ? 100 : 90) : Math.max(20, Math.round((AICTE_FSR_LIMIT / fsr) * 100));
  const fsrDisplay = ratioText(totalStudents, totalFaculty);
  const cadreScoreValue = cadreScore(cadre.prof, cadre.assoc, cadre.asst);

  /* laboratories: how many departments have at least one practical course */
  const deptsWithLab = departments.filter((d) => d.labCoursesCount > 0).length;
  const labScore = departments.length > 0 ? Math.round((100 * deptsWithLab) / departments.length) : 0;

  /* mandatory disclosure: how complete the college's public profile is */
  const disclosureFields: Array<[string, boolean]> = [
    ["college name", !!str(college?.name)],
    ["affiliation code", !!str(college?.code)],
    ["college type", !!str(college?.type)],
    ["city", !!str(college?.city)],
    ["year established", !!str(college?.established)],
    ["sanctioned intake", !!str(college?.studentCapacity)],
    ["principal", !!str(college?.principal)],
    ["official email", !!str(college?.email)],
    ["office phone", !!str(college?.phone)],
    ["AICTE permanent id", !!saved.pid],
  ];
  const missingDisclosure = disclosureFields.filter(([, ok]) => !ok).map(([n]) => n);
  const disclosureScore = Math.round((100 * (disclosureFields.length - missingDisclosure.length)) / disclosureFields.length);

  /* campus safety: the three bodies students turn to, and whether their minutes are certified */
  const safetyNames = committees.filter((c) => ["COM-01", "COM-02", "COM-03"].includes(c.id));
  const safetyParts: number[] = safetyNames.map((c) => (c.status === STATUS_CONSTITUTED ? (c.momStatus === CERTIFIED ? 100 : 80) : c.status === STATUS_PENDING ? 40 : 0));
  const safetyScore = Math.round(safetyParts.reduce((a, b) => a + b, 0) / safetyParts.length);

  const shortName = (n: string) => (n.split(" (")[0] ?? n).split(" &")[0] ?? n;
  const short = (n: number, one: string, many: string) => (n === 1 ? one : many);

  const norms: AicteNormItem[] = [
    {
      id: "NORM-FSR",
      category: "Faculty & Academics",
      name: "Faculty-Student Ratio (FSR)",
      normRequirement: `Min 1:${AICTE_FSR_LIMIT} for UG Technical Courses (AICTE APH ${academicYearOf()})`,
      actualValue: totalFaculty > 0 ? `${fsrDisplay} (${totalStudents} enrolled students : ${totalFaculty} teaching faculty)` : `No teaching faculty recorded (${totalStudents} enrolled students)`,
      score: fsrScore,
      status: fsrCompliant ? "Compliant" : "Deficient",
      deficiencyNotes:
        totalFaculty === 0
          ? "Add teaching staff in Staff Management so the ratio can be measured."
          : fsrCompliant
          ? "Within the regulatory limit."
          : `About ${Math.max(1, Math.ceil(totalStudents / AICTE_FSR_LIMIT) - totalFaculty)} more teaching faculty are needed to reach 1:${AICTE_FSR_LIMIT}.`,
    },
    {
      id: "NORM-CADRE",
      category: "Faculty & Academics",
      name: "Faculty Cadre Ratio",
      normRequirement: "1 : 2 : 6 (Professor : Assoc. Professor : Asst. Professor)",
      actualValue: totalFaculty > 0 ? `${cadre.prof} Prof : ${cadre.assoc} Assoc : ${cadre.asst} Asst Prof` : "No teaching faculty recorded",
      score: cadreScoreValue,
      status: toneOf(cadreScoreValue),
      deficiencyNotes:
        totalFaculty === 0
          ? "Add teaching staff with their designations to measure the cadre mix."
          : cadreScoreValue >= 85
          ? "Cadre mix is close to the 1 : 2 : 6 norm."
          : "Add Professor and Associate Professor posts, or correct the designations in Staff Management.",
    },
    {
      id: "NORM-STATUTORY",
      category: "Governance & Statutory",
      name: "Statutory Committees & Grievance Bodies",
      normRequirement: "Mandatory constitution of Anti-Ragging, ICC, SGRC, SC/ST, IQAC and IIIC",
      actualValue: `${constitutedCount} of ${committees.length} constituted · ${recordedCount} recorded on this page`,
      score: statutoryScore,
      status: statutoryScore >= 90 ? "Compliant" : statutoryScore >= 50 ? "Needs Attention" : "Deficient",
      deficiencyNotes:
        recordedCount < committees.length
          ? `Record ${committees.length - recordedCount} ${short(committees.length - recordedCount, "committee", "committees")} in the Statutory Committees tab.`
          : constitutedCount === committees.length
          ? "All statutory bodies are constituted."
          : `${committees.length - constitutedCount} ${short(committees.length - constitutedCount, "committee is", "committees are")} not constituted or awaiting reconstitution.`,
    },
    {
      id: "NORM-CURRICULUM",
      category: "Infrastructure & Curriculum",
      name: "Laboratories & Course Curricula",
      normRequirement: "Practical laboratory courses in every department",
      actualValue: `${dbCourses.length} courses (${labCoursesTotal} practical) · ${deptsWithLab} of ${departments.length} departments have a lab course`,
      score: labScore,
      status: toneOf(labScore),
      deficiencyNotes:
        departments.length === 0
          ? "No departments are registered yet."
          : deptsWithLab === departments.length
          ? "Every department has practical coursework."
          : `No practical course for: ${departments.filter((d) => d.labCoursesCount === 0).map((d) => d.department).slice(0, 4).join(", ")}.`,
    },
    {
      id: "NORM-DISCLOSURE",
      category: "Mandatory Disclosures",
      name: "AICTE Mandatory Public Disclosure",
      normRequirement: "Approval, programmes, faculty, fees and grievance details published online",
      actualValue: `${disclosureFields.length - missingDisclosure.length} of ${disclosureFields.length} profile fields complete · Portal: /colleges/${collegeId}`,
      score: disclosureScore,
      status: toneOf(disclosureScore),
      deficiencyNotes: missingDisclosure.length === 0 ? "The public college profile is complete." : `Missing: ${missingDisclosure.join(", ")}.`,
    },
    {
      id: "NORM-SAFETY",
      category: "Campus Safety",
      name: "Anti-Ragging & Campus Safety Bodies",
      normRequirement: "Anti-Ragging squad, ICC and SGRC constituted, meeting and with certified minutes",
      actualValue: safetyNames.map((c) => `${shortName(c.name)}: ${c.status}`).join(" · "),
      score: safetyScore,
      status: safetyScore >= 90 ? "Compliant" : safetyScore >= 50 ? "Needs Attention" : "Deficient",
      deficiencyNotes: safetyScore >= 90 ? "All three bodies are constituted with certified minutes." : "Constitute these bodies and certify their meeting minutes in the Statutory Committees tab.",
    },
  ];

  const overallScore = Math.round(norms.reduce((a, n) => a + n.score, 0) / norms.length);
  const overallStatus: AicteComplianceData["overallStatus"] = overallScore >= 85 ? "Compliant" : overallScore >= 70 ? "Action Required" : "Deficient";

  /* action plan: open work first, soonest due first */
  const actions = saved.actions
    .map((a) => toAction(a, now))
    .sort((a, b) => Number(a.status === "Resolved") - Number(b.status === "Resolved") || a.dueDate.localeCompare(b.dueDate));
  const actionSummary = {
    open: actions.filter((a) => a.status === "Open").length,
    inProgress: actions.filter((a) => a.status === "In Progress").length,
    resolved: actions.filter((a) => a.status === "Resolved").length,
    overdue: actions.filter((a) => a.overdue).length,
  };

  const kpis: Kpi[] = [
    { label: "AICTE Compliance Index", value: `${overallScore}%`, delta: overallStatus === "Compliant" ? "Fully compliant" : "Review needed", tone: overallScore >= 85 ? "teal" : overallScore >= 70 ? "amber" : "rose" },
    { label: "Faculty-Student Ratio", value: fsrDisplay, delta: `Norm: 1:${AICTE_FSR_LIMIT}${totalFaculty > 0 ? (fsrCompliant ? " (within limit)" : " (shortfall)") : ""}`, tone: fsrCompliant ? "teal" : "rose" },
    { label: "Teaching Faculty", value: String(totalFaculty), delta: `${cadre.prof} Prof · ${cadre.assoc} Assoc · ${cadre.asst} Asst`, tone: "neutral" },
    {
      label: "Statutory Committees",
      value: `${constitutedCount} / ${committees.length} Constituted`,
      delta: recordedCount < committees.length ? `${committees.length - recordedCount} not yet recorded` : actionSummary.overdue > 0 ? `${actionSummary.overdue} overdue ${short(actionSummary.overdue, "action", "actions")}` : "All recorded",
      tone: constitutedCount === committees.length ? "teal" : "amber",
    },
  ];

  const complianceDistribution: ChartSpec = {
    type: "bar",
    title: "AICTE Norms Compliance Score (%)",
    xKey: "name",
    series: ["Score"],
    data: norms.map((n) => ({ name: n.name.length > 20 ? n.name.slice(0, 18) + "…" : n.name, Score: n.score })),
  };
  const departmentComparison: ChartSpec = {
    type: "bar",
    title: "Department Faculty vs Students Allocation",
    xKey: "name",
    series: ["Students", "Faculty"],
    data: departments.slice(0, 6).map((d) => ({ name: d.department.length > 15 ? d.department.slice(0, 12) + "…" : d.department, Students: d.studentsCount, Faculty: d.facultyCount })),
  };

  /* strengths and observations come from the same numbers, so they never disagree with the scorecard */
  const strengths: string[] = [];
  if (fsrCompliant) strengths.push(`Faculty-student ratio is ${fsrDisplay} (${totalStudents} students, ${totalFaculty} teaching faculty), within the 1:${AICTE_FSR_LIMIT} norm.`);
  if (cadreScoreValue >= 85) strengths.push(`Faculty cadre (${cadre.prof} : ${cadre.assoc} : ${cadre.asst}) is close to the 1 : 2 : 6 norm.`);
  if (constitutedCount > 0) strengths.push(`${constitutedCount} of ${committees.length} statutory bodies are constituted.`);
  const certified = committees.filter((c) => c.status === STATUS_CONSTITUTED && c.momStatus === CERTIFIED).length;
  if (certified > 0) strengths.push(`${certified} ${short(certified, "committee has", "committees have")} Principal-certified meeting minutes.`);
  if (deptsWithLab > 0) strengths.push(`${deptsWithLab} of ${departments.length} departments run practical or laboratory courses.`);
  if (actionSummary.resolved > 0) strengths.push(`${actionSummary.resolved} compliance ${short(actionSummary.resolved, "action", "actions")} resolved.`);
  if (strengths.length === 0) strengths.push("Nothing meets an AICTE norm yet; the observations list where to start.");

  const deficiencies: string[] = [];
  if (totalFaculty === 0) deficiencies.push("No teaching faculty are recorded, so the ratio and cadre cannot be measured. Add staff in Staff Management.");
  else if (!fsrCompliant) deficiencies.push(`Faculty shortage: ${fsrDisplay} against the 1:${AICTE_FSR_LIMIT} norm.`);
  if (totalFaculty > 0 && cadre.prof === 0) deficiencies.push("No Professor-level faculty are recorded; designate or recruit senior faculty.");
  else if (totalFaculty > 0 && cadreScoreValue < 85) deficiencies.push(`Cadre mix ${cadre.prof} : ${cadre.assoc} : ${cadre.asst} is away from the 1 : 2 : 6 norm.`);
  const unrecorded = committees.filter((c) => !c.recorded);
  if (unrecorded.length > 0) deficiencies.push(`${unrecorded.length} statutory ${short(unrecorded.length, "committee has", "committees have")} not been recorded: ${unrecorded.map((c) => shortName(c.name)).join(", ")}.`);
  for (const c of committees) {
    if (c.status === "Not Constituted") deficiencies.push(`${c.name} is not constituted.`);
    else if (c.status === STATUS_PENDING) deficiencies.push(`${c.name} is awaiting reconstitution.`);
    else if (c.meetingOverdue) deficiencies.push(`${c.name} has not met in the last 12 months.`);
    else if (c.status === STATUS_CONSTITUTED && c.momStatus !== CERTIFIED) deficiencies.push(`${c.name}: meeting minutes are not yet certified.`);
  }
  if (departments.length > 0 && deptsWithLab < departments.length) deficiencies.push(`No practical course in ${departments.length - deptsWithLab} ${short(departments.length - deptsWithLab, "department", "departments")}.`);
  for (const d of departments.filter((x) => x.studentsCount > 0 && x.facultyCount === 0)) deficiencies.push(`${d.department} has ${d.studentsCount} students and no assigned faculty.`);
  if (missingDisclosure.length > 0) deficiencies.push(`Public disclosure incomplete: ${missingDisclosure.join(", ")}.`);
  if (actionSummary.overdue > 0) deficiencies.push(`${actionSummary.overdue} compliance ${short(actionSummary.overdue, "action is", "actions are")} past due.`);
  if (deficiencies.length === 0) deficiencies.push("No gaps found. Keep committee meetings and the public disclosure up to date.");

  return {
    college: { id: collegeId, name: collegeName, code: collegeCode, stream: collegeStream, pid },
    academicYear: academicYearOf(),
    overallScore,
    overallStatus,
    kpis,
    complianceDistribution,
    departmentComparison,
    norms,
    departments,
    committees,
    actions,
    strengths,
    deficiencies,
    availableFaculty: [...new Set(allFaculty.map((f) => f.name))].sort((a, b) => a.localeCompare(b)),
    mandatoryDisclosureUrl: `/colleges/${collegeId}`,
    pidRecorded: !!saved.pid,
    actionSummary,
    committeeSummary: { constituted: constitutedCount, total: committees.length, recorded: recordedCount },
    canManage: canManageAicte(session),
    generatedAt: new Date().toISOString(),
  };
}
