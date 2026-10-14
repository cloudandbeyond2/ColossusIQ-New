import "server-only";
import { RESOURCES, type ResourceRecord } from "@/config/resources";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { sharedState } from "./global-state";
import {
  NmcActionItem,
  NmcCommittee,
  NmcComplianceData,
  NmcDepartmentCompliance,
  NmcNormItem,
  NmcProfile,
  CreateNmcActionInput,
  UpdateNmcActionStatusInput,
  UpdateNmcCommitteeInput,
  UpdateNmcProfileInput,
} from "@/lib/api/nmc-schemas";
import type { ScorecardData } from "@/lib/api/schemas";
import { getHospitalOverview } from "./teaching-hospital";

const DEFAULT_COMMITTEES: NmcCommittee[] = [
  {
    id: "NMC-COM-01",
    name: "Medical Education Unit (MEU)",
    mandate: "NMC MSR 2023 §3.4 — Faculty development, CISP-III workshops, curriculum implementation, and RBCW certification",
    chairperson: "Dr. R. Meenakshi, MD (Dean / Principal)",
    convener: "Dr. K. Senthil Kumar, MD (MEU Coordinator)",
    membersCount: 12,
    meetingFrequency: "Quarterly",
    lastMeetingDate: "2026-09-15",
    status: "Constituted & Active",
    momUploaded: true,
    notes: "Completed 2 Revised Basic Course Workshops (RBCW) and 1 CISP-III session this academic cycle.",
  },
  {
    id: "NMC-COM-02",
    name: "Curriculum Committee & CBME Sub-committee",
    mandate: "CBME Guidelines 2023 — Integration of horizontal/vertical alignment, Foundation Course, and AETCOM logbook tracking",
    chairperson: "Dr. R. Meenakshi, MD",
    convener: "Dr. P. Vasanthi, MD (Vice Principal - Academics)",
    membersCount: 14,
    meetingFrequency: "Monthly",
    lastMeetingDate: "2026-10-02",
    status: "Constituted & Active",
    momUploaded: true,
    notes: "Elective rotation modules finalized for Phase III Part 1 students.",
  },
  {
    id: "NMC-COM-03",
    name: "Institutional Ethics Committee (IEC)",
    mandate: "CDSCO & DHR Registration Mandate — Clinical research clearance, clinical trials ethical review, and ICMR STS oversight",
    chairperson: "Hon. Justice (Retd.) M. Chidambaram",
    convener: "Dr. S. K. Narayanan, MS",
    membersCount: 15,
    meetingFrequency: "Bi-monthly",
    lastMeetingDate: "2026-08-28",
    status: "Constituted & Active",
    momUploaded: true,
    notes: "CDSCO Re-registration No: ECR/124/Inst/TN/2021/RR-24 approved.",
  },
  {
    id: "NMC-COM-04",
    name: "Hospital Infection Control Committee (HICC)",
    mandate: "NMC Hospital Norms & NABH — Biomedical waste management, antimicrobial stewardship, surveillance, and HAI monitoring",
    chairperson: "Dr. R. Sundararajan, MD (Medical Superintendent)",
    convener: "Dr. A. Kavitha, MD (Microbiology)",
    membersCount: 11,
    meetingFrequency: "Monthly",
    lastMeetingDate: "2026-09-22",
    status: "Constituted & Active",
    momUploaded: true,
    notes: "Surgical site infection (SSI) rate contained at 1.2% in teaching OTs.",
  },
  {
    id: "NMC-COM-05",
    name: "Pharmacovigilance & ADR Monitoring Committee",
    mandate: "PvPI & NMC Curriculum Mandate — Adverse drug reaction tracking, causality analysis, and medical student case reporting",
    chairperson: "Dr. M. Ganesan, MD (Pharmacology)",
    convener: "Dr. K. Jayasree, MD",
    membersCount: 9,
    meetingFrequency: "Quarterly",
    lastMeetingDate: "2026-09-08",
    status: "Constituted & Active",
    momUploaded: true,
    notes: "82 ADR forms submitted to National Coordination Centre (NCC-PvPI) this quarter.",
  },
  {
    id: "NMC-COM-06",
    name: "Anti-Ragging Committee & Squad",
    mandate: "NMC Prevention and Prohibition of Ragging in Medical Colleges Regulations 2021 — 24/7 squad, CCTV surveillance, and affidavit audit",
    chairperson: "Dr. R. Meenakshi, MD",
    convener: "Dr. V. Murugan, MS (Hostel Warden / Ortho)",
    membersCount: 16,
    meetingFrequency: "Quarterly & Sudden Surprise",
    lastMeetingDate: "2026-10-05",
    status: "Constituted & Active",
    momUploaded: true,
    notes: "100% student affidavits registered on anti-ragging national portal.",
  },
  {
    id: "NMC-COM-07",
    name: "Internal Complaints Committee (ICC) / POSH",
    mandate: "Sexual Harassment of Women at Workplace Act 2013 & NMC Guidelines — Gender sensitization, counseling, and swift inquiry",
    chairperson: "Dr. Jayanthi Raman, MD (OBG)",
    convener: "Dr. S. Gayathri, MS (Ophthalmology)",
    membersCount: 10,
    meetingFrequency: "Quarterly",
    lastMeetingDate: "2026-08-14",
    status: "Constituted & Active",
    momUploaded: true,
    notes: "Annual gender sensitization workshop conducted for MBBS fresher batch.",
  },
];

const DEFAULT_ACTIONS: NmcActionItem[] = [
  {
    id: "nmc-act-1",
    title: "Recruit 2 Assistant Professors in Radiodiagnosis",
    category: "Faculty Strength",
    priority: "High",
    status: "In Progress",
    assignee: "Dean's Office & HR",
    dueDate: "2026-11-15",
    notes: "Interviews scheduled for next Monday to meet sanctioned faculty count prior to inspection.",
  },
  {
    id: "nmc-act-2",
    title: "Procure High-Fidelity Maternal Birthing Simulator for Skills Lab",
    category: "Infrastructure & Labs",
    priority: "High",
    status: "In Progress",
    assignee: "Skills Lab Director / OBG HOD",
    dueDate: "2026-11-30",
    notes: "Tender floating complete; demonstration scheduled with biomedical suppliers.",
  },
  {
    id: "nmc-act-3",
    title: "Conduct Weekly CBME Logbook Sign-off Drive",
    category: "Academic & CBME",
    priority: "Medium",
    status: "Pending",
    assignee: "HODs of Clinical Departments",
    dueDate: "2026-10-31",
    notes: "Phase III Part 1 logbook certification rate currently at 74%; target is 90%.",
  },
  {
    id: "nmc-act-4",
    title: "Replace 3 Non-functional CCTV cameras in Casualty & Triage",
    category: "Statutory Governance",
    priority: "Medium",
    status: "Resolved",
    assignee: "IT & Security Department",
    dueDate: "2026-10-10",
    notes: "All 25 NMC live monitoring feeds verified live on the central portal.",
    resolvedAt: "2026-10-09",
  },
];

const DEFAULT_PROFILE: NmcProfile = {
  nmcCode: "NMC-MED-TN-042",
  mbbsSeats: 250,
  lopStatus: "Recognized by NMC (Annual Renewal Approved)",
  affiliationYear: 1954,
  cctvStreamsOnline: 25,
  cctvStreamsTotal: 25,
  aebasPortalActive: true,
  meuCertified: true,
  ethicsCommitteeRegNo: "ECR/124/Inst/TN/2021/RR-24",
  lastInspectionDate: "2025-11-18",
  nextInspectionWindow: "December 2026 – January 2027",
};

const BASE_DEPARTMENTS: Array<{
  name: string;
  type: "Pre-clinical" | "Para-clinical" | "Clinical";
  professors: number;
  assocProfessors: number;
  asstProfessors: number;
  seniorResidents: number;
  requiredFaculty: number;
  aebasAttendance: number;
  deficiencyDetails?: string;
}> = [
  // Pre-clinical
  { name: "Anatomy", type: "Pre-clinical", professors: 1, assocProfessors: 2, asstProfessors: 3, seniorResidents: 2, requiredFaculty: 6, aebasAttendance: 88 },
  { name: "Physiology", type: "Pre-clinical", professors: 1, assocProfessors: 2, asstProfessors: 3, seniorResidents: 2, requiredFaculty: 6, aebasAttendance: 85 },
  { name: "Biochemistry", type: "Pre-clinical", professors: 1, assocProfessors: 1, asstProfessors: 3, seniorResidents: 2, requiredFaculty: 5, aebasAttendance: 90 },

  // Para-clinical
  { name: "Pathology", type: "Para-clinical", professors: 2, assocProfessors: 3, asstProfessors: 4, seniorResidents: 3, requiredFaculty: 9, aebasAttendance: 89 },
  { name: "Microbiology", type: "Para-clinical", professors: 1, assocProfessors: 2, asstProfessors: 3, seniorResidents: 2, requiredFaculty: 6, aebasAttendance: 87 },
  { name: "Pharmacology", type: "Para-clinical", professors: 1, assocProfessors: 2, asstProfessors: 3, seniorResidents: 2, requiredFaculty: 6, aebasAttendance: 86 },
  { name: "Forensic Medicine", type: "Para-clinical", professors: 1, assocProfessors: 1, asstProfessors: 2, seniorResidents: 2, requiredFaculty: 4, aebasAttendance: 82 },
  { name: "Community Medicine", type: "Para-clinical", professors: 2, assocProfessors: 2, asstProfessors: 4, seniorResidents: 3, requiredFaculty: 8, aebasAttendance: 84 },

  // Clinical
  { name: "General Medicine", type: "Clinical", professors: 3, assocProfessors: 5, asstProfessors: 8, seniorResidents: 6, requiredFaculty: 16, aebasAttendance: 91 },
  { name: "General Surgery", type: "Clinical", professors: 3, assocProfessors: 4, asstProfessors: 8, seniorResidents: 6, requiredFaculty: 15, aebasAttendance: 88 },
  { name: "Obstetrics & Gynaecology", type: "Clinical", professors: 2, assocProfessors: 4, asstProfessors: 6, seniorResidents: 5, requiredFaculty: 12, aebasAttendance: 92 },
  { name: "Paediatrics", type: "Clinical", professors: 2, assocProfessors: 3, asstProfessors: 5, seniorResidents: 4, requiredFaculty: 10, aebasAttendance: 89 },
  { name: "Orthopaedics", type: "Clinical", professors: 1, assocProfessors: 3, asstProfessors: 4, seniorResidents: 4, requiredFaculty: 8, aebasAttendance: 86 },
  { name: "Ophthalmology", type: "Clinical", professors: 1, assocProfessors: 1, asstProfessors: 3, seniorResidents: 2, requiredFaculty: 5, aebasAttendance: 90 },
  { name: "ENT (Otorhinolaryngology)", type: "Clinical", professors: 1, assocProfessors: 1, asstProfessors: 3, seniorResidents: 2, requiredFaculty: 5, aebasAttendance: 88 },
  { name: "DVL (Dermatology)", type: "Clinical", professors: 1, assocProfessors: 1, asstProfessors: 2, seniorResidents: 2, requiredFaculty: 4, aebasAttendance: 87 },
  { name: "Psychiatry", type: "Clinical", professors: 1, assocProfessors: 0, asstProfessors: 2, seniorResidents: 1, requiredFaculty: 4, aebasAttendance: 81, deficiencyDetails: "1 Associate Professor vacant; recruitment under process." },
  { name: "Respiratory Medicine", type: "Clinical", professors: 1, assocProfessors: 1, asstProfessors: 2, seniorResidents: 2, requiredFaculty: 4, aebasAttendance: 84 },
  { name: "Radiodiagnosis", type: "Clinical", professors: 1, assocProfessors: 1, asstProfessors: 2, seniorResidents: 3, requiredFaculty: 6, aebasAttendance: 79, deficiencyDetails: "Shortage of 2 Assistant Professors against 250 MBBS intake norm." },
  { name: "Anaesthesiology", type: "Clinical", professors: 2, assocProfessors: 4, asstProfessors: 7, seniorResidents: 5, requiredFaculty: 13, aebasAttendance: 90 },
  { name: "Emergency Medicine", type: "Clinical", professors: 1, assocProfessors: 2, asstProfessors: 3, seniorResidents: 4, requiredFaculty: 6, aebasAttendance: 89 },
];

function getNmcStore(collegeScope: string) {
  const committees = sharedState(`nmc.committees.${collegeScope}`, () => [...DEFAULT_COMMITTEES]);
  const actions = sharedState(`nmc.actions.${collegeScope}`, () => [...DEFAULT_ACTIONS]);
  const profile = sharedState(`nmc.profile.${collegeScope}`, () => ({ ...DEFAULT_PROFILE }));
  return { committees, actions, profile };
}

export async function getNmcComplianceOverview(session: SessionPayload): Promise<NmcComplianceData> {
  const scope = session.college || "COL-1006";
  const { committees, actions, profile } = getNmcStore(scope);

  // Fetch live hospital overview to sync hospital metrics
  let hospitalOverview;
  try {
    hospitalOverview = await getHospitalOverview(session);
  } catch {
    hospitalOverview = null;
  }

  const bedOccupancy = hospitalOverview?.kpis.occupancyRate ?? 84.8;
  const dailyOpd = hospitalOverview?.kpis.dailyOpd ?? 1480;
  const monthlySurgeries = hospitalOverview?.kpis.monthlySurgeries ?? 890;
  const monthlyDeliveries = hospitalOverview?.kpis.monthlyDeliveries ?? 392;

  // Compute departmental faculty counts
  const departments: NmcDepartmentCompliance[] = BASE_DEPARTMENTS.map((d, i) => {
    const actualFaculty = d.professors + d.assocProfessors + d.asstProfessors;
    const isDeficient = actualFaculty < d.requiredFaculty - 1;
    const isBorderline = actualFaculty === d.requiredFaculty - 1 || d.aebasAttendance < 80;
    const status: NmcDepartmentCompliance["status"] = isDeficient
      ? "Deficient"
      : isBorderline
      ? "Needs Attention"
      : "Compliant";

    return {
      id: `dept-nmc-${i + 1}`,
      name: d.name,
      type: d.type,
      professors: d.professors,
      assocProfessors: d.assocProfessors,
      asstProfessors: d.asstProfessors,
      seniorResidents: d.seniorResidents,
      requiredFaculty: d.requiredFaculty,
      actualFaculty,
      aebasAttendance: d.aebasAttendance,
      status,
      deficiencyDetails: d.deficiencyDetails,
    };
  });

  const totalRequiredFaculty = departments.reduce((s, d) => s + d.requiredFaculty, 0);
  const totalActualFaculty = departments.reduce((s, d) => s + d.actualFaculty, 0);
  const facultyAdequacy = Math.round((totalActualFaculty / totalRequiredFaculty) * 1000) / 10;
  const aebasAverage =
    Math.round((departments.reduce((s, d) => s + d.aebasAttendance, 0) / departments.length) * 10) / 10;

  // Mandatory Council Norms
  const norms: NmcNormItem[] = [
    {
      id: "NMC-NORM-01",
      name: "Faculty Strength & Cadre Ratio",
      category: "Faculty & AEBAS",
      current: `${totalActualFaculty} / ${totalRequiredFaculty} Faculty (${facultyAdequacy}%)`,
      norm: "100% sanctioned posts filled as per MSR 2023",
      score: Math.min(100, Math.round(facultyAdequacy)),
      target: 100,
      status: facultyAdequacy >= 95 ? "Compliant" : facultyAdequacy >= 85 ? "Needs Attention" : "Deficient",
      remediation: "Deficiencies observed in Radiodiagnosis (2 Asst Prof) and Psychiatry (1 Assoc Prof).",
    },
    {
      id: "NMC-NORM-02",
      name: "Aadhaar Biometric Attendance (AEBAS)",
      category: "Faculty & AEBAS",
      current: `${aebasAverage}% Daily Biometric Punching`,
      norm: "≥ 75% average attendance strictly enforced",
      score: Math.min(100, Math.round((aebasAverage / 75) * 100)),
      target: 100,
      status: aebasAverage >= 75 ? "Compliant" : "Deficient",
    },
    {
      id: "NMC-NORM-03",
      name: "Teaching Hospital Bed Occupancy",
      category: "Hospital & Wards",
      current: `${bedOccupancy}% Daily Inpatient Average`,
      norm: "≥ 80% daily average bed occupancy across wards",
      score: Math.min(100, Math.round((bedOccupancy / 80) * 100)),
      target: 100,
      status: bedOccupancy >= 80 ? "Compliant" : "Deficient",
    },
    {
      id: "NMC-NORM-04",
      name: "Outpatient & Inpatient Clinical Material",
      category: "Clinical Material",
      current: `${dailyOpd.toLocaleString()} OPD pts/day · ${monthlySurgeries} Surgeries/mo`,
      norm: "≥ 1,200 OPD footfall/day, ≥ 25 major surgeries/day",
      score: 96,
      target: 100,
      status: "Compliant",
    },
    {
      id: "NMC-NORM-05",
      name: "Skills Lab & Medical Simulation Centre",
      category: "Infrastructure & Labs",
      current: "12 of 14 mandated simulators installed",
      norm: "Advanced simulation lab with BLS, ACLS, Airway & Birthing simulators",
      score: 85,
      target: 100,
      status: "Needs Attention",
      remediation: "High-fidelity obstetric birthing simulator procurement in progress.",
    },
    {
      id: "NMC-NORM-06",
      name: "CBME Logbook & Portfolio Certification",
      category: "Academic & CBME",
      current: "81% certified competencies across Phases",
      norm: "100% CBME procedural competencies certified by faculty",
      score: 81,
      target: 100,
      status: "Needs Attention",
      remediation: "Weekly logbook verification drive required to close Phase III backlog.",
    },
    {
      id: "NMC-NORM-07",
      name: "Central Clinical Lab & Blood Centre",
      category: "Infrastructure & Labs",
      current: "Licensed 24/7 component separation & 3,820 tests/day",
      norm: "Central Clinical Lab & Licensed Blood Centre functional round the clock",
      score: 100,
      target: 100,
      status: "Compliant",
    },
    {
      id: "NMC-NORM-08",
      name: "NMC CCTV Streaming & Command Center",
      category: "Statutory Governance",
      current: `${profile.cctvStreamsOnline} / ${profile.cctvStreamsTotal} Streams Active`,
      norm: "25 fixed cameras connected to NMC live surveillance portal",
      score: profile.cctvStreamsOnline === profile.cctvStreamsTotal ? 100 : 70,
      target: 100,
      status: profile.cctvStreamsOnline === profile.cctvStreamsTotal ? "Compliant" : "Needs Attention",
    },
  ];

  const overallScore = Math.round(
    norms.reduce((acc, n) => acc + (n.score / n.target) * 100, 0) / norms.length
  );

  const overallGrade = overallScore >= 90 ? "Grade A (Fully Compliant)" : overallScore >= 75 ? "Grade B (Minor Deficiencies)" : "Grade C (Substantial Deficiencies)";
  const overallStatus = overallScore >= 90 ? "Approval Recommended" : "Rectification Notice Required";

  const openActions = actions.filter((a) => a.status !== "Resolved").length;

  const kpis = {
    overallCompliance: overallScore,
    facultyAdequacy,
    aebasAverage,
    bedOccupancy,
    cbmeCompletion: 81,
    openActions,
  };

  const strengths = [
    `Teaching hospital bed occupancy is maintained at ${bedOccupancy}% (exceeding council 80% threshold).`,
    `Faculty biometric AEBAS attendance averages ${aebasAverage}%, well above the mandated 75% limit.`,
    "Central clinical laboratory and 24/7 licensed blood centre fully operational.",
    "Medical Education Unit (MEU) certified with active Basic & CISP-III faculty training cycles.",
  ];

  const deficiencies = [
    "Faculty deficit in Radiodiagnosis (2 Asst Professors) and Psychiatry (1 Assoc Professor).",
    "Skills Lab requires 2 additional high-fidelity obstetric and neonatal resuscitation simulators.",
    "CBME logbook sign-offs require acceleration before end-of-term university evaluations.",
  ];

  return {
    collegeId: scope,
    collegeName: "Madurai Medical College & Hospital",
    stream: "medical",
    overallScore,
    overallGrade,
    overallStatus,
    kpis,
    norms,
    departments,
    committees,
    actions,
    profile,
    strengths,
    deficiencies,
  };
}

export async function createNmcAction(
  session: SessionPayload,
  input: CreateNmcActionInput,
): Promise<NmcActionItem> {
  const scope = session.college || "COL-1006";
  const { actions } = getNmcStore(scope);

  const newAction: NmcActionItem = {
    id: `nmc-act-${Date.now()}`,
    title: input.title,
    category: input.category,
    priority: input.priority,
    status: "Pending",
    assignee: input.assignee,
    dueDate: input.dueDate,
    notes: input.notes,
  };

  actions.unshift(newAction);

  await getStore().audit.add({
    actor: session.name,
    action: `Added NMC Compliance Action: ${newAction.title}`,
    target: "nmc-compliance",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return newAction;
}

export async function updateNmcActionStatus(
  session: SessionPayload,
  actionId: string,
  input: UpdateNmcActionStatusInput,
): Promise<{ ok: boolean }> {
  const scope = session.college || "COL-1006";
  const { actions } = getNmcStore(scope);
  const found = actions.find((a) => a.id === actionId);
  if (!found) throw new Error("NMC action item not found.");

  found.status = input.status;
  if (input.notes) found.notes = input.notes;
  if (input.status === "Resolved") {
    found.resolvedAt = new Date().toISOString().slice(0, 10);
  }

  await getStore().audit.add({
    actor: session.name,
    action: `Updated NMC Action Status to ${input.status}: ${found.title}`,
    target: "nmc-compliance",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return { ok: true };
}

export async function deleteNmcAction(
  session: SessionPayload,
  actionId: string,
): Promise<{ ok: boolean }> {
  const scope = session.college || "COL-1006";
  const { actions } = getNmcStore(scope);
  const idx = actions.findIndex((a) => a.id === actionId);
  if (idx === -1) throw new Error("NMC action item not found.");

  const removed = actions.splice(idx, 1)[0];

  await getStore().audit.add({
    actor: session.name,
    action: `Deleted NMC Action Item: ${removed?.title}`,
    target: "nmc-compliance",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return { ok: true };
}

export async function updateNmcCommittee(
  session: SessionPayload,
  committeeId: string,
  input: UpdateNmcCommitteeInput,
): Promise<{ ok: boolean }> {
  const scope = session.college || "COL-1006";
  const { committees } = getNmcStore(scope);
  const found = committees.find((c) => c.id === committeeId);
  if (!found) throw new Error("NMC committee record not found.");

  found.chairperson = input.chairperson;
  found.convener = input.convener;
  found.membersCount = input.membersCount;
  found.status = input.status;
  found.lastMeetingDate = input.lastMeetingDate;
  found.momUploaded = input.momUploaded;
  if (input.notes) found.notes = input.notes;

  await getStore().audit.add({
    actor: session.name,
    action: `Updated NMC Committee Details: ${found.name}`,
    target: "nmc-compliance",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return { ok: true };
}

export async function updateNmcProfile(
  session: SessionPayload,
  input: UpdateNmcProfileInput,
): Promise<{ ok: boolean }> {
  const scope = session.college || "COL-1006";
  const { profile } = getNmcStore(scope);

  profile.nmcCode = input.nmcCode;
  profile.mbbsSeats = input.mbbsSeats;
  profile.ethicsCommitteeRegNo = input.ethicsCommitteeRegNo;
  if (input.cctvStreamsOnline !== undefined) profile.cctvStreamsOnline = input.cctvStreamsOnline;
  if (input.aebasPortalActive !== undefined) profile.aebasPortalActive = input.aebasPortalActive;
  if (input.meuCertified !== undefined) profile.meuCertified = input.meuCertified;

  await getStore().audit.add({
    actor: session.name,
    action: `Updated NMC Institution Profile: ${profile.nmcCode}`,
    target: "nmc-compliance",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return { ok: true };
}

/** Dynamic ScorecardData builder for backwards-compatible generic scorecard view */
export async function dynamicNmcComplianceData(
  collegeScope = "all",
  session?: SessionPayload,
): Promise<ScorecardData> {
  const mockSession: SessionPayload = session || {
    college: collegeScope === "all" ? "COL-1006" : collegeScope,
    sub: "inst-demo",
    role: "institution",
    name: "Dr. R. Meenakshi, MD",
    tenant: "TNTU",
    mfa: true,
    exp: 0,
  };

  const overview = await getNmcComplianceOverview(mockSession);

  return {
    template: "scorecard",
    headline: `NMC Minimum Standard Requirements (MSR) — ${overview.overallGrade}`,
    overall: overview.overallScore,
    dimensions: overview.norms.map((n) => ({
      name: n.name,
      score: n.score,
      target: n.target,
    })),
    strengths: overview.strengths,
    gaps: overview.deficiencies,
    plan: overview.actions.filter((a) => a.status !== "Resolved").slice(0, 4).map((a) => a.title),
  };
}
