import "server-only";
import { CLINICAL_DEPARTMENTS, RESOURCES, type ResourceRecord } from "@/config/resources";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { sharedState } from "./global-state";
import {
  HospitalCensusLog,
  HospitalDepartment,
  HospitalKpis,
  HospitalNmcNorm,
  HospitalOverview,
  HospitalRotationItem,
  UpdateHospitalCensusInput,
  CertifyRotationInput,
} from "@/lib/api/hospital-schemas";
import type { DashboardData, Kpi, ChartSpec, Insight } from "@/lib/api/schemas";

const DEFAULT_DEPARTMENTS: HospitalDepartment[] = [
  {
    id: "dept-gen-med",
    name: "General Medicine",
    category: "Medicine & Allied",
    hod: "Dr. R. Sundararajan, MD",
    teachingBeds: 240,
    occupiedBeds: 216,
    occupancyPercent: 90.0,
    opdDaily: 620,
    ipdAdmissionsDaily: 48,
    studentCasesWeekly: 15.2,
    cbmeTargetCases: 12.0,
    units: ["Unit I (Ward 11)", "Unit II (Ward 12)", "Unit III (Ward 13)", "Unit IV (Ward 14)"],
    activeStudents: 24,
    status: "Optimal",
    statusNotes: "High case diversity; robust bedside clinical teaching.",
  },
  {
    id: "dept-gen-surg",
    name: "General Surgery",
    category: "Surgery & Allied",
    hod: "Dr. S. K. Narayanan, MS",
    teachingBeds: 210,
    occupiedBeds: 182,
    occupancyPercent: 86.7,
    opdDaily: 480,
    ipdAdmissionsDaily: 36,
    surgeriesMonthly: 550,
    studentCasesWeekly: 12.4,
    cbmeTargetCases: 10.0,
    units: ["Unit I (Ward 21)", "Unit II (Ward 22)", "Unit III (Ward 23)", "Unit IV (Ward 24)"],
    activeStudents: 20,
    status: "Optimal",
    statusNotes: "4 OT tables active daily for teaching cases.",
  },
  {
    id: "dept-obg",
    name: "Obstetrics & Gynaecology",
    category: "OBG & Paediatrics",
    hod: "Dr. Jayanthi Raman, MD, DGO",
    teachingBeds: 150,
    occupiedBeds: 135,
    occupancyPercent: 90.0,
    opdDaily: 390,
    ipdAdmissionsDaily: 34,
    deliveriesMonthly: 392,
    studentCasesWeekly: 10.8,
    cbmeTargetCases: 8.0,
    units: ["Unit I (Antenatal)", "Unit II (Labour & Delivery)", "Unit III (Postnatal & Gynae)"],
    activeStudents: 18,
    status: "Optimal",
    statusNotes: "High volume of normal and caesarean deliveries.",
  },
  {
    id: "dept-paed",
    name: "Paediatrics",
    category: "OBG & Paediatrics",
    hod: "Dr. K. Radhakrishnan, MD (Paed)",
    teachingBeds: 120,
    occupiedBeds: 102,
    occupancyPercent: 85.0,
    opdDaily: 340,
    ipdAdmissionsDaily: 26,
    studentCasesWeekly: 9.6,
    cbmeTargetCases: 8.0,
    units: ["Unit I (General Paediatrics)", "Unit II (NICU & PICU)"],
    activeStudents: 14,
    status: "Optimal",
    statusNotes: "Level-3 NICU fully functional with 20 beds.",
  },
  {
    id: "dept-ortho",
    name: "Orthopaedics",
    category: "Surgery & Allied",
    hod: "Dr. V. Murugan, MS (Ortho)",
    teachingBeds: 100,
    occupiedBeds: 78,
    occupancyPercent: 78.0,
    opdDaily: 290,
    ipdAdmissionsDaily: 19,
    surgeriesMonthly: 110,
    studentCasesWeekly: 7.2,
    cbmeTargetCases: 8.0,
    units: ["Unit I (Trauma & Arthroplasty)", "Unit II (Spine & Paed Ortho)"],
    activeStudents: 12,
    status: "Attention Required",
    statusNotes: "Occupancy trails 80% norm; mobilizing elective surgeries.",
  },
  {
    id: "dept-ophth",
    name: "Ophthalmology",
    category: "Surgery & Allied",
    hod: "Dr. S. Gayathri, MS (Ophth)",
    teachingBeds: 60,
    occupiedBeds: 48,
    occupancyPercent: 80.0,
    opdDaily: 240,
    ipdAdmissionsDaily: 14,
    surgeriesMonthly: 180,
    studentCasesWeekly: 6.8,
    cbmeTargetCases: 6.0,
    units: ["Ward 51 & Dedicated Eye OT Complex"],
    activeStudents: 8,
    status: "Optimal",
    statusNotes: "Cataract camp cases boost day-care volume.",
  },
  {
    id: "dept-ent",
    name: "ENT (Otorhinolaryngology)",
    category: "Surgery & Allied",
    hod: "Dr. P. Anand, MS (ENT)",
    teachingBeds: 50,
    occupiedBeds: 41,
    occupancyPercent: 82.0,
    opdDaily: 195,
    ipdAdmissionsDaily: 12,
    surgeriesMonthly: 85,
    studentCasesWeekly: 5.9,
    cbmeTargetCases: 5.0,
    units: ["Ward 52 & Audiology Lab"],
    activeStudents: 8,
    status: "Optimal",
    statusNotes: "Micro-ear and endoscopic sinus surgery clinical teaching.",
  },
  {
    id: "dept-derma",
    name: "Dermatology (DVL)",
    category: "Medicine & Allied",
    hod: "Dr. N. Chitra, MD (DVL)",
    teachingBeds: 40,
    occupiedBeds: 32,
    occupancyPercent: 80.0,
    opdDaily: 220,
    ipdAdmissionsDaily: 8,
    studentCasesWeekly: 6.2,
    cbmeTargetCases: 5.0,
    units: ["Ward 61 & Phototherapy Unit"],
    activeStudents: 6,
    status: "Optimal",
    statusNotes: "Excellent variety of infective and autoimmune skin lesions.",
  },
  {
    id: "dept-psych",
    name: "Psychiatry",
    category: "Medicine & Allied",
    hod: "Dr. M. Ganesan, MD (Psych)",
    teachingBeds: 40,
    occupiedBeds: 33,
    occupancyPercent: 82.5,
    opdDaily: 135,
    ipdAdmissionsDaily: 7,
    studentCasesWeekly: 5.4,
    cbmeTargetCases: 5.0,
    units: ["Ward 62 & De-addiction Centre"],
    activeStudents: 6,
    status: "Optimal",
    statusNotes: "Active outpatient counseling and ECT facilities.",
  },
  {
    id: "dept-pulm",
    name: "Respiratory Medicine",
    category: "Medicine & Allied",
    hod: "Dr. T. Karthik, MD (Pulm)",
    teachingBeds: 40,
    occupiedBeds: 35,
    occupancyPercent: 87.5,
    opdDaily: 140,
    ipdAdmissionsDaily: 9,
    studentCasesWeekly: 5.8,
    cbmeTargetCases: 5.0,
    units: ["Ward 71 & DOTS Centre"],
    activeStudents: 6,
    status: "Optimal",
    statusNotes: "Sleep lab, PFT, and bronchoscopy unit available.",
  },
  {
    id: "dept-emergency",
    name: "Emergency & Trauma",
    category: "Emergency & Critical Care",
    hod: "Dr. S. Balasubramanian, MD (EM)",
    teachingBeds: 70,
    occupiedBeds: 53,
    occupancyPercent: 75.7,
    opdDaily: 142,
    ipdAdmissionsDaily: 19,
    surgeriesMonthly: 90,
    studentCasesWeekly: 14.5,
    cbmeTargetCases: 10.0,
    units: ["Red Resuscitation", "Yellow Acute Care", "Green Minor Triage"],
    activeStudents: 16,
    status: "Optimal",
    statusNotes: "24/7 Level-1 Trauma team and stroke management active.",
  },
];

const DEFAULT_LOGS: HospitalCensusLog[] = [
  {
    id: "hlog-1",
    timestamp: "Today, 08:30 AM",
    department: "General Medicine",
    actor: "Dr. R. Sundararajan",
    summary: "Morning ward census recorded: 216 beds occupied, 48 new admissions from emergency.",
    notes: "Monitored bed availability in Ward 14 following monsoon viral admissions.",
  },
  {
    id: "hlog-2",
    timestamp: "Today, 07:45 AM",
    department: "Obstetrics & Gynaecology",
    actor: "Dr. Jayanthi Raman",
    summary: "Night shift hand-over: 14 normal deliveries, 6 emergency LSCS performed.",
    notes: "All maternal and neonatal vitals stable; labour ward at 90% occupancy.",
  },
  {
    id: "hlog-3",
    timestamp: "Yesterday, 06:15 PM",
    department: "General Surgery",
    actor: "Dr. S. K. Narayanan",
    summary: "OT Complex report: 18 major elective surgeries, 12 laparoscopic procedures completed.",
    notes: "Phase III Part 2 students assisted in laparoscopic appendectomy & cholecystectomy.",
  },
  {
    id: "hlog-4",
    timestamp: "Yesterday, 11:00 AM",
    department: "Orthopaedics",
    actor: "Dr. V. Murugan",
    summary: "Elective joint replacement case mobilization underway; 19 admissions logged.",
    notes: "Targeting 85% occupancy by weekend for upcoming council compliance verification.",
  },
];

async function getHospitalStore(collegeScope: string) {
  try {
    const saved = (await getStore().settings.get(collegeScope, "hospital-dashboard")) as
      | { depts?: HospitalDepartment[]; logs?: HospitalCensusLog[] }
      | undefined;
    if (saved && Array.isArray(saved.depts) && saved.depts.length > 0) {
      return {
        depts: saved.depts,
        logs: Array.isArray(saved.logs) ? saved.logs : [...DEFAULT_LOGS],
      };
    }
  } catch (err) {
    console.warn("[hospital] Error reading settings store:", err);
  }
  const depts = sharedState(`hospital.depts.${collegeScope}`, () => DEFAULT_DEPARTMENTS.map((d) => ({ ...d })));
  const logs = sharedState(`hospital.logs.${collegeScope}`, () => DEFAULT_LOGS.map((l) => ({ ...l })));
  return { depts, logs };
}

async function saveHospitalStore(collegeScope: string, depts: HospitalDepartment[], logs: HospitalCensusLog[]) {
  const mDepts = sharedState(`hospital.depts.${collegeScope}`, () => depts);
  if (mDepts !== depts) {
    mDepts.length = 0;
    mDepts.push(...depts);
  }
  const mLogs = sharedState(`hospital.logs.${collegeScope}`, () => logs);
  if (mLogs !== logs) {
    mLogs.length = 0;
    mLogs.push(...logs);
  }

  try {
    await getStore().settings.save(collegeScope, "hospital-dashboard", { depts, logs });
  } catch (err) {
    console.warn("[hospital] Error saving to settings store:", err);
  }
}

export async function getHospitalOverview(session: SessionPayload): Promise<HospitalOverview> {
  const scope = session.college || "COL-1006";
  const { depts, logs } = await getHospitalStore(scope);
  const rotationOverrides = sharedState(`hospital.rotations.${scope}`, () => new Map<string, Partial<HospitalRotationItem>>());

  // Compute live KPIs across departments
  const totalBeds = depts.reduce((sum, d) => sum + d.teachingBeds, 0);
  const occupiedBeds = depts.reduce((sum, d) => sum + d.occupiedBeds, 0);
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 84.8;
  const dailyOpd = depts.reduce((sum, d) => sum + d.opdDaily, 0);
  const dailyIpdAdmissions = depts.reduce((sum, d) => sum + d.ipdAdmissionsDaily, 0);
  const dailyDischarges = Math.round(dailyIpdAdmissions * 0.88);
  const emergencyFootfall = depts.find((d) => d.name.includes("Emergency"))?.opdDaily ?? 142;
  const monthlySurgeries = depts.reduce((sum, d) => sum + (d.surgeriesMonthly ?? 0), 0);
  const monthlyDeliveries = depts.find((d) => d.name.includes("Obstetrics"))?.deliveriesMonthly ?? 392;
  const clinicalMaterialAvg =
    Math.round((depts.reduce((sum, d) => sum + d.studentCasesWeekly, 0) / depts.length) * 10) / 10;

  // NMC Compliance Norms
  const nmcNorms: HospitalNmcNorm[] = [
    {
      id: "norm-occupancy",
      title: "Average Teaching Bed Occupancy",
      currentValue: `${occupancyRate}%`,
      normRequirement: "≥ 80% (NMC MSR Table 2)",
      compliant: occupancyRate >= 80,
      status: occupancyRate >= 80 ? "Pass" : occupancyRate >= 75 ? "Warning" : "Deficiency",
      remediation: occupancyRate < 80 ? "Mobilize elective surgical and medical admissions across allied wards." : undefined,
    },
    {
      id: "norm-opd",
      title: "Daily Outpatient (OPD) Footfall",
      currentValue: `${dailyOpd.toLocaleString()} / day`,
      normRequirement: "≥ 2,500 / day (for 250 MBBS seats)",
      compliant: dailyOpd >= 2500,
      status: dailyOpd >= 2500 ? "Pass" : "Deficiency",
      remediation: dailyOpd < 2500 ? "Expand specialized evening and super-specialty peripheral clinics." : undefined,
    },
    {
      id: "norm-icu",
      title: "Intensive Care Unit (ICU / ICCU / NICU)",
      currentValue: "92 / 100 beds (92%)",
      normRequirement: "≥ 10% of total teaching beds with ventilator support",
      compliant: true,
      status: "Pass",
    },
    {
      id: "norm-surgery",
      title: "Monthly Surgeries & Deliveries",
      currentValue: `${monthlySurgeries.toLocaleString()} surgeries · ${monthlyDeliveries} deliveries`,
      normRequirement: "≥ 25 major surgeries/day, ≥ 10 deliveries/day",
      compliant: monthlySurgeries >= 750 && monthlyDeliveries >= 300,
      status: "Pass",
    },
    {
      id: "norm-lab",
      title: "Central Clinical Lab Investigations",
      currentValue: "3,820 tests / day",
      normRequirement: "≥ 2,500 investigations/day (Biochem, Path, Micro)",
      compliant: true,
      status: "Pass",
    },
    {
      id: "norm-bloodbank",
      title: "Licensed Blood Centre & Components",
      currentValue: "210 whole blood · 380 PRBC/FFP units",
      normRequirement: "24/7 licensed component separation unit",
      compliant: true,
      status: "Pass",
    },
    {
      id: "norm-cbme",
      title: "CBME Bedside Clinical Material / Student",
      currentValue: `${clinicalMaterialAvg} cases / week`,
      normRequirement: "≥ 8.0 cases / student / week per department",
      compliant: depts.filter((d) => d.status === "Attention Required").length === 0,
      status: depts.filter((d) => d.status === "Attention Required").length === 0 ? "Pass" : "Warning",
      remediation: "Orthopaedics requires increased elective admissions to meet 8.0 case quota.",
    },
  ];

  const compliantCount = nmcNorms.filter((n) => n.compliant).length;
  const nmcComplianceScore = Math.round((compliantCount / nmcNorms.length) * 1000) / 10;

  const kpis: HospitalKpis = {
    totalBeds,
    occupiedBeds,
    occupancyRate,
    dailyOpd,
    dailyIpdAdmissions,
    dailyDischarges,
    icuOccupiedBeds: 92,
    totalIcuBeds: 100,
    emergencyFootfall,
    monthlySurgeries,
    monthlyDeliveries,
    clinicalMaterialAvg,
    nmcComplianceScore,
  };

  // Fetch live clinical rotations from store
  let activeRotations: HospitalRotationItem[] = [];
  try {
    const rawRotations = await getStore().records.all(RESOURCES.rotations!, scope);
    activeRotations = rawRotations.slice(0, 15).map((r: any) => ({
      id: r.id,
      student: String(r.student ?? r.data?.student ?? "MBBS Student"),
      regNo: String(r.regNo ?? r.data?.regNo ?? "21MB1000"),
      phase: String(r.phase ?? r.data?.phase ?? "Phase III"),
      department: String(r.department ?? r.data?.department ?? "General Medicine"),
      unit: String(r.unit ?? r.data?.unit ?? "Unit I"),
      startDate: String(r.startDate ?? r.data?.startDate ?? "2026-08-01"),
      endDate: String(r.endDate ?? r.data?.endDate ?? "2026-10-31"),
      supervisor: String(r.supervisor ?? r.data?.supervisor ?? "Faculty"),
      attendance: Number(r.attendance ?? r.data?.attendance ?? 85),
      competenciesSigned: Number(r.competenciesSigned ?? r.data?.competenciesSigned ?? 18),
      status: String(r.status ?? r.data?.status ?? "Ongoing"),
      remarks: r.remarks ? String(r.remarks) : r.data?.remarks ? String(r.data.remarks) : undefined,
    }));
  } catch {
    activeRotations = [];
  }

  if (activeRotations.length === 0) {
    activeRotations = [
      {
        id: "rot-seed-1",
        student: "Aravind Swaminathan",
        regNo: "MB211024",
        phase: "Phase III Part 1",
        department: "General Medicine",
        unit: "Unit I (Ward 14)",
        startDate: "2026-08-01",
        endDate: "2026-10-31",
        supervisor: "Dr. K. Senthil Kumar, MD",
        attendance: 92,
        competenciesSigned: 6,
        status: "Active",
        remarks: "Good bedside case history presentation.",
      },
      {
        id: "rot-seed-2",
        student: "Pooja Radhakrishnan",
        regNo: "MB211058",
        phase: "Phase III Part 1",
        department: "General Surgery",
        unit: "Unit II (Ward 22)",
        startDate: "2026-08-01",
        endDate: "2026-10-31",
        supervisor: "Dr. M. Sundararajan, MS",
        attendance: 88,
        competenciesSigned: 5,
        status: "Active",
        remarks: "Suturing and aseptic OT protocol certified.",
      },
      {
        id: "rot-seed-3",
        student: "Divya Bharathi",
        regNo: "MB221012",
        phase: "Phase II",
        department: "Obstetrics & Gynaecology",
        unit: "Labour Room & Ward 31",
        startDate: "2026-09-01",
        endDate: "2026-11-30",
        supervisor: "Dr. N. Chitra, MD (OBG)",
        attendance: 94,
        competenciesSigned: 7,
        status: "Active",
        remarks: "Observed 12 normal deliveries.",
      },
      {
        id: "rot-seed-4",
        student: "Vignesh Karthik",
        regNo: "MB201089",
        phase: "Internship (CRMI)",
        department: "Emergency & Trauma Care",
        unit: "Casualty & Red Triage",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        supervisor: "Dr. T. Rajesh, MD (EM)",
        attendance: 96,
        competenciesSigned: 8,
        status: "Completed",
        remarks: "Certified in ACLS & BLS triage resuscitation.",
      },
    ];
  }

  // Apply any in-memory rotation overrides
  activeRotations = activeRotations.map((rot) => {
    const override = rotationOverrides.get(rot.id);
    return override ? { ...rot, ...override } : rot;
  });

  const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
  const monthlyTrends = months.map((name, i) => ({
    name,
    opdDivided10: Math.round(270 + i * 8 + (Math.sin(i) * 5)),
    ipd: Math.round(190 + i * 6 + (Math.cos(i) * 4)),
    occupancy: Math.round(80 + i * 0.9),
  }));

  let hospitalName = scope === "COL-1006" ? "Madurai Medical College Teaching Hospital" : "University Teaching Hospital & Research Centre";
  try {
    const colRecord = await getStore().records.get(RESOURCES.colleges!, scope);
    if (colRecord) {
      const name = String((colRecord as any).name ?? (colRecord as any).data?.name ?? "");
      if (name) {
        hospitalName = name.toLowerCase().includes("hospital") ? name : `${name} Teaching Hospital`;
      }
    }
  } catch {
    // continue
  }

  return {
    collegeId: scope,
    hospitalName,
    stream: "medical",
    kpis,
    departments: depts,
    nmcNorms,
    recentLogs: logs,
    activeRotations,
    monthlyTrends,
  };
}

export async function updateHospitalCensus(
  session: SessionPayload,
  input: UpdateHospitalCensusInput,
): Promise<HospitalOverview> {
  const scope = session.college || "COL-1006";
  const { depts, logs } = await getHospitalStore(scope);

  const dept = depts.find((d) => d.name.toLowerCase() === input.department.toLowerCase());
  if (!dept) {
    throw new Error(`Department '${input.department}' not found.`);
  }

  // Update department statistics
  dept.opdDaily = input.opd;
  dept.ipdAdmissionsDaily = input.ipdAdmissions;
  dept.occupiedBeds = Math.min(dept.teachingBeds, input.occupiedBeds);
  dept.occupancyPercent = Math.round((dept.occupiedBeds / dept.teachingBeds) * 1000) / 10;
  if (input.surgeries !== undefined) {
    dept.surgeriesMonthly = input.surgeries;
  }
  if (input.deliveries !== undefined) {
    dept.deliveriesMonthly = input.deliveries;
  }

  // Update status based on occupancy
  if (dept.occupancyPercent >= 80) {
    dept.status = "Optimal";
    dept.statusNotes = "Occupancy exceeds NMC 80% teaching minimum.";
  } else if (dept.occupancyPercent >= 75) {
    dept.status = "Surplus";
    dept.statusNotes = "Adequate bed availability, monitoring clinical postings.";
  } else {
    dept.status = "Attention Required";
    dept.statusNotes = "Occupancy below 75% threshold; mobilize elective cases.";
  }

  // Record census audit log
  const now = new Date();
  const timeStr = `Today, ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  const logEntry: HospitalCensusLog = {
    id: `hlog-${Date.now()}`,
    timestamp: timeStr,
    department: dept.name,
    actor: session.name || "Medical Superintendent",
    summary: `Census updated: ${dept.occupiedBeds}/${dept.teachingBeds} beds (${dept.occupancyPercent}%), OPD: ${dept.opdDaily}, IPD: ${dept.ipdAdmissionsDaily}`,
    notes: input.notes || "Live ward census entered via Teaching Hospital Dashboard.",
  };
  logs.unshift(logEntry);
  if (logs.length > 50) logs.pop();

  await saveHospitalStore(scope, depts, logs);

  // Audit trail
  await getStore().audit.add({
    actor: session.name,
    action: `Updated Hospital Census for ${dept.name}`,
    target: "hospital-dashboard",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return getHospitalOverview(session);
}

export async function certifyClinicalRotation(
  session: SessionPayload,
  input: CertifyRotationInput,
): Promise<{ ok: boolean; rotationId: string }> {
  const scope = session.college || "COL-1006";
  const rotationOverrides = sharedState(
    `hospital.rotations.${scope}`,
    () => new Map<string, Partial<HospitalRotationItem>>(),
  );

  // Apply override to in-memory map so updates reflect immediately
  const existingOverride = rotationOverrides.get(input.rotationId) || {};
  const updatedOverride: Partial<HospitalRotationItem> = {
    ...existingOverride,
    ...(input.competenciesSigned !== undefined ? { competenciesSigned: input.competenciesSigned } : {}),
    ...(input.attendance !== undefined ? { attendance: input.attendance } : {}),
    ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
  };
  rotationOverrides.set(input.rotationId, updatedOverride);

  let studentName = "Student";
  try {
    const rec = await getStore().records.get(RESOURCES.rotations!, input.rotationId);
    if (rec) {
      studentName = String((rec as any).student ?? (rec as any).data?.student ?? "Student");
      const nextData: Record<string, any> = { ...rec };
      if (input.competenciesSigned !== undefined) nextData.competenciesSigned = input.competenciesSigned;
      if (input.attendance !== undefined) nextData.attendance = input.attendance;
      if (input.remarks) nextData.remarks = input.remarks;
      await getStore().records.update(RESOURCES.rotations!, rec.id, nextData, rec.version);
    }
  } catch {
    // continue
  }

  await getStore().audit.add({
    actor: session.name,
    action: `Certified CBME clinical rotation for ${studentName}`,
    target: "clinical-rotations",
    collegeId: session.college === "all" ? null : session.college,
    actorSub: session.sub,
  });

  return { ok: true, rotationId: input.rotationId };
}

/** Dynamic fallback builder returning DashboardData matching generic schema */
export async function dynamicHospitalDashboardData(
  collegeScope = "all",
  session?: SessionPayload,
): Promise<DashboardData> {
  const mockSession: SessionPayload = session || {
    college: collegeScope === "all" ? "COL-1006" : collegeScope,
    sub: "inst-demo",
    role: "institution",
    name: "Dr. R. Meenakshi, MD",
    tenant: "TNTU",
    mfa: true,
    exp: 0,
  };

  const overview = await getHospitalOverview(mockSession);
  const k = overview.kpis;

  const kpis: Kpi[] = [
    { label: "Teaching Beds", value: k.totalBeds.toLocaleString(), tone: "brand", hint: "NMC 250 MBBS intake sanctioned" },
    { label: "Bed Occupancy Rate", value: `${k.occupancyRate}%`, delta: "+2.8%", tone: k.occupancyRate >= 80 ? "teal" : "rose", hint: "NMC Norm: ≥80% average" },
    { label: "Daily OPD", value: k.dailyOpd.toLocaleString(), delta: "+5.4%", tone: "gold", hint: "Outpatients across 11 specialties" },
    { label: "Daily IPD Admissions", value: k.dailyIpdAdmissions.toLocaleString(), tone: "sky", hint: "Direct ward & emergency admissions" },
    { label: "Monthly Surgeries", value: k.monthlySurgeries.toLocaleString(), tone: "brand", hint: "Major & minor procedures" },
    { label: "Monthly Deliveries", value: k.monthlyDeliveries.toLocaleString(), tone: "teal", hint: "Normal & caesarean sections" },
  ];

  const charts: ChartSpec[] = [
    {
      type: "line",
      title: "OPD and IPD Load Trends (Last 6 Months)",
      xKey: "name",
      series: ["OPD (÷10)", "IPD"],
      data: overview.monthlyTrends.map((t) => ({
        name: t.name,
        "OPD (÷10)": t.opdDivided10,
        IPD: t.ipd,
      })),
    },
    {
      type: "bar",
      title: "Clinical Material per Student (Cases / Week vs CBME Norm)",
      xKey: "name",
      series: ["Cases", "Target"],
      data: overview.departments.slice(0, 6).map((d) => ({
        name: d.name.replace("General ", "").replace("Obstetrics & Gynaecology", "OBG"),
        Cases: d.studentCasesWeekly,
        Target: d.cbmeTargetCases,
      })),
    },
  ];

  const insights: Insight[] = [
    {
      title: `Hospital NMC Compliance: ${k.nmcComplianceScore}% (Grade A+)`,
      body: `Teaching bed occupancy is currently at ${k.occupancyRate}% with ${k.dailyOpd} daily OPD outpatients. 10 of 11 departments satisfy or exceed CBME student case allocations.`,
      evidence: "Hospital Information System (HIS) · Live Campus Sync",
      tone: k.occupancyRate >= 80 ? "teal" : "amber",
    },
  ];

  return {
    template: "dashboard",
    kpis,
    charts,
    insights,
  };
}
