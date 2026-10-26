import "server-only";
import { RESOURCES } from "@/config/resources";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import type {
  CreateNmcActionInput,
  NmcActionItem,
  NmcComplianceData,
  NmcDepartmentCompliance,
  NmcNormItem,
  UpdateNmcActionStatusInput,
  UpdateNmcCommitteeInput,
  UpdateNmcDepartmentNormInput,
  UpdateNmcProfileInput,
} from "@/lib/api/nmc-schemas";
import type { ScorecardData } from "@/lib/api/schemas";
import { nmcData } from "./nmc-data";
import { listColleges } from "./records";
import { getHospitalOverview } from "./teaching-hospital";
import { getOsceOverview } from "./osce-store";

/*
 * NMC / council compliance. The college records its registration profile, statutory committees, action plan and the
 * required faculty strength per department (nmc-data.ts). Everything else is computed from its own records: faculty
 * counts from staff, bed occupancy from the hospital census, skills-lab readiness from the OSCE module. A norm whose
 * data the college hasn't recorded is "Not Assessed" - never filled in with a made-up figure.
 */

export class NmcError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const MANAGE_ROLES = new Set(["institution", "admin"]);
export const canManageNmc = (role: string) => MANAGE_ROLES.has(role);

/** The departments the council assesses (a fixed regulatory list, not college data). */
const NMC_DEPARTMENTS: Array<{ name: string; type: NmcDepartmentCompliance["type"] }> = [
  { name: "Anatomy", type: "Pre-clinical" },
  { name: "Physiology", type: "Pre-clinical" },
  { name: "Biochemistry", type: "Pre-clinical" },
  { name: "Pathology", type: "Para-clinical" },
  { name: "Microbiology", type: "Para-clinical" },
  { name: "Pharmacology", type: "Para-clinical" },
  { name: "Forensic Medicine", type: "Para-clinical" },
  { name: "Community Medicine", type: "Para-clinical" },
  { name: "General Medicine", type: "Clinical" },
  { name: "General Surgery", type: "Clinical" },
  { name: "Obstetrics & Gynaecology", type: "Clinical" },
  { name: "Paediatrics", type: "Clinical" },
  { name: "Orthopaedics", type: "Clinical" },
  { name: "Ophthalmology", type: "Clinical" },
  { name: "ENT (Otorhinolaryngology)", type: "Clinical" },
  { name: "DVL (Dermatology)", type: "Clinical" },
  { name: "Psychiatry", type: "Clinical" },
  { name: "Respiratory Medicine", type: "Clinical" },
  { name: "Radiodiagnosis", type: "Clinical" },
  { name: "Anaesthesiology", type: "Clinical" },
  { name: "Emergency Medicine", type: "Clinical" },
];

/** The statutory committees a medical college must constitute. Added on request; the college fills in the details. */
export const STANDARD_COMMITTEES = [
  { name: "Medical Education Unit (MEU)", mandate: "Faculty development, curriculum implementation workshops and medical education training.", meetingFrequency: "Quarterly" },
  { name: "Curriculum Committee & CBME Sub-committee", mandate: "Competency-based curriculum implementation, foundation course, AETCOM and logbook tracking.", meetingFrequency: "Monthly" },
  { name: "Institutional Ethics Committee (IEC)", mandate: "Ethical review and oversight of clinical research and trials.", meetingFrequency: "Bi-monthly" },
  { name: "Hospital Infection Control Committee (HICC)", mandate: "Biomedical waste management, antimicrobial stewardship and hospital-acquired infection surveillance.", meetingFrequency: "Monthly" },
  { name: "Pharmacovigilance & ADR Monitoring Committee", mandate: "Adverse drug reaction tracking, causality analysis and reporting.", meetingFrequency: "Quarterly" },
  { name: "Anti-Ragging Committee & Squad", mandate: "Prevention and prohibition of ragging: squad, surveillance and affidavit audit.", meetingFrequency: "Quarterly" },
  { name: "Internal Complaints Committee (ICC) / POSH", mandate: "Prevention of sexual harassment at the workplace, counselling and inquiry.", meetingFrequency: "Quarterly" },
];

async function collegeOf(session: SessionPayload): Promise<string> {
  if (session.college && session.college !== "all") return session.college;
  const first = (await listColleges())[0];
  if (!first) throw new NmcError("There is no college to run compliance for yet.", 404);
  return first.id;
}

async function audit(session: SessionPayload, action: string, target = "nmc-compliance") {
  await getStore().audit.add({
    actor: session.name,
    action,
    target,
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });
}

function requireManage(session: SessionPayload) {
  if (!canManageNmc(session.role)) throw new NmcError("Only the principal's office can change NMC compliance records.", 403);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const round1 = (n: number) => Math.round(n * 10) / 10;

interface StaffRow {
  department?: unknown;
  designation?: unknown;
  status?: unknown;
  data?: { department?: unknown; designation?: unknown; status?: unknown };
}

function cadreCounts(staff: StaffRow[], deptName: string) {
  const want = norm(deptName);
  let professors = 0, assoc = 0, asst = 0, residents = 0;
  for (const s of staff) {
    const dept = norm(String(s.department ?? s.data?.department ?? ""));
    const status = String(s.status ?? s.data?.status ?? "Active").toLowerCase();
    if (status !== "active" || dept === "" || !(dept === want || dept.includes(want) || want.includes(dept))) continue;
    const desig = String(s.designation ?? s.data?.designation ?? "").toLowerCase();
    if (desig.includes("associate") || desig.includes("assoc")) assoc++;
    else if (desig.includes("assistant") || desig.includes("asst")) asst++;
    else if (desig.includes("resident") || desig.includes("tutor")) residents++;
    else if (desig.includes("professor") || desig.includes("hod") || desig.includes("dean")) professors++;
    else asst++;
  }
  return { professors, assocProfessors: assoc, asstProfessors: asst, seniorResidents: residents };
}

export async function getNmcComplianceOverview(session: SessionPayload): Promise<NmcComplianceData> {
  const college = await collegeOf(session);
  const data = nmcData();
  const [profile, committees, actions, norms, colleges] = await Promise.all([
    data.profile(college),
    data.committees(college),
    data.actions(college),
    data.norms(college),
    listColleges(),
  ]);
  const collegeName = String(colleges.find((c) => c.id === college)?.name ?? "");

  const [hospital, osce, staff] = await Promise.all([
    getHospitalOverview(session).catch(() => null),
    getOsceOverview(session).catch(() => null),
    getStore().records.all(RESOURCES.staff!, college).catch(() => [] as unknown[]),
  ]);

  const departments: NmcDepartmentCompliance[] = NMC_DEPARTMENTS.map((d, i) => {
    const cadre = cadreCounts(staff as StaffRow[], d.name);
    const actual = cadre.professors + cadre.assocProfessors + cadre.asstProfessors;
    const n = norms.get(d.name);
    const required = n?.requiredFaculty ?? null;
    const aebas = n?.aebasAttendance ?? null;
    const shortfall = required === null ? 0 : required - actual;
    const issues: string[] = [];
    if (shortfall > 0) issues.push(`Shortage of ${shortfall} faculty against the required strength of ${required}.`);
    if (aebas !== null && aebas < 75) issues.push(`Biometric attendance is ${aebas}%, below the 75% norm.`);
    const status: NmcDepartmentCompliance["status"] =
      required === null ? "Not Set" : shortfall > 1 ? "Deficient" : shortfall === 1 || (aebas !== null && aebas < 75) ? "Needs Attention" : "Compliant";
    return {
      id: `dept-nmc-${i + 1}`,
      name: d.name,
      type: d.type,
      ...cadre,
      requiredFaculty: required,
      actualFaculty: actual,
      aebasAttendance: aebas,
      status,
      deficiencyDetails: issues.length ? issues.join(" ") : undefined,
    };
  });

  const withRequired = departments.filter((d) => d.requiredFaculty !== null);
  const totalRequired = withRequired.reduce((s, d) => s + (d.requiredFaculty ?? 0), 0);
  const totalActual = withRequired.reduce((s, d) => s + d.actualFaculty, 0);
  const facultyAdequacy = totalRequired > 0 ? round1((Math.min(totalActual, totalRequired) / totalRequired) * 100) : null;
  const withAebas = departments.filter((d) => d.aebasAttendance !== null);
  const aebasAverage = withAebas.length ? round1(withAebas.reduce((s, d) => s + (d.aebasAttendance ?? 0), 0) / withAebas.length) : null;
  const bedOccupancy =
    hospital && hospital.kpis.totalBeds > 0 && hospital.kpis.occupancyRate > 0 ? hospital.kpis.occupancyRate : null;

  const notAssessed = (id: string, name: string, category: NmcNormItem["category"], normText: string, why: string): NmcNormItem => ({
    id, name, category, current: why, norm: normText, score: 0, target: 100, status: "Not Assessed", remediation: undefined,
  });
  const byScore = (score: number, ok: number, warn: number): NmcNormItem["status"] => (score >= ok ? "Compliant" : score >= warn ? "Needs Attention" : "Deficient");

  const norms_: NmcNormItem[] = [];

  // 1. faculty strength
  if (facultyAdequacy === null) {
    norms_.push(notAssessed("NMC-NORM-01", "Faculty Strength & Cadre Ratio", "Faculty & AEBAS", "Required faculty strength per department", "Required strength not set for any department yet."));
  } else {
    const short = withRequired.filter((d) => d.actualFaculty < (d.requiredFaculty ?? 0)).map((d) => `${d.name} (${(d.requiredFaculty ?? 0) - d.actualFaculty})`);
    norms_.push({
      id: "NMC-NORM-01", name: "Faculty Strength & Cadre Ratio", category: "Faculty & AEBAS",
      current: `${totalActual} / ${totalRequired} faculty (${facultyAdequacy}%) across ${withRequired.length} departments`,
      norm: "Faculty in post meet the required strength set for each department",
      score: Math.round(facultyAdequacy), target: 100, status: byScore(facultyAdequacy, 95, 85),
      remediation: short.length ? `Short of faculty: ${short.slice(0, 4).join(", ")}${short.length > 4 ? ` and ${short.length - 4} more` : ""}.` : undefined,
    });
  }
  // 2. AEBAS
  norms_.push(
    aebasAverage === null
      ? notAssessed("NMC-NORM-02", "Aadhaar Biometric Attendance (AEBAS)", "Faculty & AEBAS", "At least 75% average attendance", "No department attendance recorded yet.")
      : {
          id: "NMC-NORM-02", name: "Aadhaar Biometric Attendance (AEBAS)", category: "Faculty & AEBAS",
          current: `${aebasAverage}% average across ${withAebas.length} departments`, norm: "At least 75% average attendance",
          score: Math.min(100, Math.round((aebasAverage / 75) * 100)), target: 100, status: aebasAverage >= 75 ? "Compliant" : "Deficient",
        },
  );
  // 3. beds
  norms_.push(
    bedOccupancy === null
      ? notAssessed("NMC-NORM-03", "Teaching Hospital Bed Occupancy", "Hospital & Wards", "At least 80% daily average bed occupancy", "No bed census recorded in the Hospital Dashboard yet.")
      : {
          id: "NMC-NORM-03", name: "Teaching Hospital Bed Occupancy", category: "Hospital & Wards",
          current: `${bedOccupancy}% of ${hospital!.kpis.totalBeds} teaching beds occupied`, norm: "At least 80% daily average bed occupancy",
          score: Math.min(100, Math.round((bedOccupancy / 80) * 100)), target: 100, status: bedOccupancy >= 80 ? "Compliant" : "Deficient",
        },
  );
  // 4. skills lab
  {
    const eq = osce?.equipment ?? [];
    const stations = osce?.kpis.activeStations ?? 0;
    const hf = osce?.kpis.highFidelitySimulators ?? 0;
    if (!osce || (stations === 0 && eq.length === 0)) {
      norms_.push(notAssessed("NMC-NORM-04", "Skills Lab & Medical Simulation Centre", "Infrastructure & Labs", "At least 6 OSCE stations, 2 high-fidelity simulators, equipment operational", "No OSCE stations or skills-lab equipment recorded yet."));
    } else {
      const operational = eq.filter((e) => e.status === "Operational").length;
      const score = Math.round(((Math.min(1, stations / 6) + Math.min(1, hf / 2) + (eq.length ? operational / eq.length : 0)) / 3) * 100);
      norms_.push({
        id: "NMC-NORM-04", name: "Skills Lab & Medical Simulation Centre", category: "Infrastructure & Labs",
        current: `${stations} OSCE stations · ${hf} high-fidelity simulators · ${operational}/${eq.length} equipment operational`,
        norm: "At least 6 OSCE stations, 2 high-fidelity simulators, equipment operational",
        score, target: 100, status: byScore(score, 95, 75),
        remediation: score < 100 ? "Add the missing stations or simulators, or return equipment to service, in the OSCE & Skills Lab module." : undefined,
      });
    }
  }
  // 5. committees
  {
    const active = committees.filter((c) => c.status === "Constituted & Active").length;
    norms_.push(
      committees.length === 0
        ? notAssessed("NMC-NORM-05", "Statutory Committees Constituted", "Statutory Governance", "All statutory committees constituted and active", "No statutory committees recorded yet.")
        : {
            id: "NMC-NORM-05", name: "Statutory Committees Constituted", category: "Statutory Governance",
            current: `${active} of ${committees.length} committees constituted and active`, norm: "All statutory committees constituted and active",
            score: Math.round((active / committees.length) * 100), target: 100, status: byScore((active / committees.length) * 100, 100, 70),
            remediation: active < committees.length ? `Pending: ${committees.filter((c) => c.status !== "Constituted & Active").map((c) => c.name).slice(0, 3).join(", ")}.` : undefined,
          },
    );
  }
  // 6. CCTV
  norms_.push(
    profile.cctvStreamsTotal <= 0
      ? notAssessed("NMC-NORM-06", "NMC CCTV Streaming & Command Center", "Statutory Governance", "All fixed cameras connected to the council surveillance portal", "Camera count not recorded in the council profile yet.")
      : {
          id: "NMC-NORM-06", name: "NMC CCTV Streaming & Command Center", category: "Statutory Governance",
          current: `${profile.cctvStreamsOnline} / ${profile.cctvStreamsTotal} streams active`, norm: "All fixed cameras connected to the council surveillance portal",
          score: Math.round((Math.min(profile.cctvStreamsOnline, profile.cctvStreamsTotal) / profile.cctvStreamsTotal) * 100), target: 100,
          status: profile.cctvStreamsOnline >= profile.cctvStreamsTotal ? "Compliant" : "Needs Attention",
        },
  );

  const assessed = norms_.filter((n) => n.status !== "Not Assessed");
  const overallScore = assessed.length ? Math.round(assessed.reduce((s, n) => s + n.score, 0) / assessed.length) : null;
  const overallGrade =
    overallScore === null ? "Not yet assessed" : overallScore >= 90 ? "Grade A (Fully Compliant)" : overallScore >= 75 ? "Grade B (Minor Deficiencies)" : "Grade C (Substantial Deficiencies)";
  const overallStatus =
    overallScore === null ? "Record data to begin the audit" : overallScore >= 90 ? "Approval Recommended" : "Rectification Notice Required";

  return {
    collegeId: college,
    collegeName,
    stream: "medical",
    overallScore,
    overallGrade,
    overallStatus,
    kpis: { overallCompliance: overallScore, facultyAdequacy, aebasAverage, bedOccupancy, openActions: actions.filter((a) => a.status !== "Resolved").length },
    norms: norms_,
    departments,
    committees: committees.map(({ college: _c, ...rest }) => (void _c, rest)),
    actions: actions.map(({ college: _c, ...rest }) => (void _c, rest)),
    profile,
    strengths: norms_.filter((n) => n.status === "Compliant").map((n) => `${n.name}: ${n.current}.`),
    deficiencies: norms_.filter((n) => n.status === "Needs Attention" || n.status === "Deficient").map((n) => `${n.name}: ${n.current} (requirement: ${n.norm}).`),
    permissions: { manage: canManageNmc(session.role) },
  };
}

export async function createNmcAction(session: SessionPayload, input: CreateNmcActionInput): Promise<NmcActionItem> {
  requireManage(session);
  const college = await collegeOf(session);
  const created = await nmcData().addAction(college, {
    title: input.title.trim(), category: input.category, priority: input.priority, assignee: input.assignee.trim(), dueDate: input.dueDate, notes: input.notes?.trim() ?? "",
  });
  if (!created) throw new NmcError("Could not save the action item.", 404);
  await audit(session, `Added NMC Compliance Action: ${created.title}`);
  const { college: _c, ...item } = created;
  void _c;
  return item;
}

async function ownAction(session: SessionPayload, id: string) {
  const college = await collegeOf(session);
  const a = await nmcData().action(id);
  if (!a || a.college !== college) throw new NmcError("NMC action item not found.", 404);
  return a;
}

export async function updateNmcActionStatus(session: SessionPayload, actionId: string, input: UpdateNmcActionStatusInput): Promise<{ ok: boolean }> {
  requireManage(session);
  const a = await ownAction(session, actionId);
  await nmcData().setActionStatus(a.id, input.status, input.notes?.trim() || undefined);
  await audit(session, `Updated NMC Action Status to ${input.status}: ${a.title}`);
  return { ok: true };
}

export async function deleteNmcAction(session: SessionPayload, actionId: string): Promise<{ ok: boolean }> {
  requireManage(session);
  const a = await ownAction(session, actionId);
  await nmcData().removeAction(a.id);
  await audit(session, `Deleted NMC Action Item: ${a.title}`);
  return { ok: true };
}

export async function seedStandardCommittees(session: SessionPayload): Promise<{ added: number }> {
  requireManage(session);
  const college = await collegeOf(session);
  const added = await nmcData().addCommittees(college, STANDARD_COMMITTEES);
  if (added > 0) await audit(session, `Added ${added} standard NMC statutory committees`);
  return { added };
}

export async function updateNmcCommittee(session: SessionPayload, committeeId: string, input: UpdateNmcCommitteeInput): Promise<{ ok: boolean }> {
  requireManage(session);
  const college = await collegeOf(session);
  const c = await nmcData().committee(committeeId);
  if (!c || c.college !== college) throw new NmcError("NMC committee record not found.", 404);
  if (input.status === "Constituted & Active" && (input.chairperson.trim() === "" || input.membersCount < 1)) {
    throw new NmcError("A constituted committee needs a chairperson and at least one member.", 400);
  }
  await nmcData().updateCommittee(c.id, {
    chairperson: input.chairperson.trim(), convener: input.convener.trim(), membersCount: input.membersCount, status: input.status,
    lastMeetingDate: input.lastMeetingDate, momUploaded: input.momUploaded, notes: input.notes?.trim() ?? "",
    ...(input.meetingFrequency !== undefined ? { meetingFrequency: input.meetingFrequency.trim() } : {}),
  });
  await audit(session, `Updated NMC Committee Details: ${c.name}`);
  return { ok: true };
}

export async function updateNmcProfile(session: SessionPayload, input: UpdateNmcProfileInput): Promise<{ ok: boolean }> {
  requireManage(session);
  const college = await collegeOf(session);
  const current = await nmcData().profile(college);
  const total = input.cctvStreamsTotal ?? current.cctvStreamsTotal;
  const online = input.cctvStreamsOnline ?? current.cctvStreamsOnline;
  if (online > total) throw new NmcError("Active camera feeds can't exceed the total number of cameras.", 400);
  await nmcData().saveProfile(college, {
    nmcCode: input.nmcCode, mbbsSeats: input.mbbsSeats, ethicsCommitteeRegNo: input.ethicsCommitteeRegNo,
    cctvStreamsOnline: online, cctvStreamsTotal: total,
    ...(input.aebasPortalActive !== undefined ? { aebasPortalActive: input.aebasPortalActive } : {}),
    ...(input.meuCertified !== undefined ? { meuCertified: input.meuCertified } : {}),
    ...(input.lopStatus !== undefined ? { lopStatus: input.lopStatus } : {}),
    ...(input.affiliationYear !== undefined ? { affiliationYear: input.affiliationYear } : {}),
    ...(input.lastInspectionDate !== undefined ? { lastInspectionDate: input.lastInspectionDate } : {}),
    ...(input.nextInspectionWindow !== undefined ? { nextInspectionWindow: input.nextInspectionWindow } : {}),
  });
  await audit(session, `Updated NMC Institution Profile${input.nmcCode ? `: ${input.nmcCode}` : ""}`);
  return { ok: true };
}

export async function updateNmcDepartmentNorm(session: SessionPayload, input: UpdateNmcDepartmentNormInput): Promise<{ ok: boolean }> {
  requireManage(session);
  const college = await collegeOf(session);
  if (!NMC_DEPARTMENTS.some((d) => d.name === input.department)) throw new NmcError(`"${input.department}" isn't an NMC-assessed department.`, 400);
  await nmcData().setNorm(college, input.department, { requiredFaculty: input.requiredFaculty, aebasAttendance: input.aebasAttendance });
  await audit(session, `Updated NMC faculty norm for ${input.department}`);
  return { ok: true };
}

/** Scorecard view used by the generic module template. */
export async function dynamicNmcComplianceData(collegeScope = "all", session?: SessionPayload): Promise<ScorecardData> {
  const s: SessionPayload = session ?? { college: collegeScope, sub: "system", role: "institution", name: "System", tenant: "", mfa: true, exp: 0 };
  const o = await getNmcComplianceOverview(s);
  return {
    template: "scorecard",
    headline: `NMC Minimum Standard Requirements (MSR) - ${o.overallGrade}`,
    overall: o.overallScore ?? 0,
    dimensions: o.norms.filter((n) => n.status !== "Not Assessed").map((n) => ({ name: n.name, score: n.score, target: n.target })),
    strengths: o.strengths,
    gaps: o.deficiencies,
    plan: o.actions.filter((a) => a.status !== "Resolved").slice(0, 4).map((a) => a.title),
  };
}
