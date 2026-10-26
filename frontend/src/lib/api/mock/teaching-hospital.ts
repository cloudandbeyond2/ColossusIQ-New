import "server-only";
import { RESOURCES } from "@/config/resources";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import {
  type CertifyRotationInput,
  type CreateHospitalDepartmentInput,
  type HospitalCensusLog,
  type HospitalDepartment,
  type HospitalKpis,
  type HospitalMonthlyTrend,
  type HospitalNmcNorm,
  type HospitalOverview,
  type HospitalRotationItem,
  type UpdateHospitalCensusInput,
  type UpdateHospitalProfileInput,
} from "@/lib/api/hospital-schemas";
import type { DashboardData, Kpi, ChartSpec, Insight } from "@/lib/api/schemas";
import { hospitalData, type CensusRow, type DeptRow } from "./hospital-data";
import { listColleges } from "./records";

/*
 * Teaching hospital. Wards and their bed counts, the dated census entries staff record, and the hospital's facility
 * figures are the college's own records (hospital-data.ts). Occupancy, monthly surgeries and deliveries, the trend chart
 * and every NMC norm status are worked out here from those entries, so nothing on the dashboard is typed in as a result.
 */

export class HospitalError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const MANAGE_ROLES = new Set(["institution", "hod", "admin"]);
const CERTIFY_ROLES = new Set(["institution", "hod", "faculty", "admin"]);
export const canManageHospital = (role: string) => MANAGE_ROLES.has(role);
export const canCertifyRotations = (role: string) => CERTIFY_ROLES.has(role);

const IST_MS = 5.5 * 3_600_000;
const istDay = (iso: string) => new Date(Date.parse(iso) + IST_MS).toISOString().slice(0, 10);
const istStamp = (iso: string) => {
  const d = new Date(Date.parse(iso) + IST_MS);
  const day = d.toISOString().slice(0, 10);
  const today = istDay(new Date().toISOString());
  const yesterday = istDay(new Date(Date.now() - 86_400_000).toISOString());
  const h = d.getUTCHours();
  const time = `${String(h % 12 || 12).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  return `${day === today ? "Today" : day === yesterday ? "Yesterday" : day}, ${time}`;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

async function collegeOf(session: SessionPayload): Promise<string> {
  if (session.college && session.college !== "all") return session.college;
  const first = (await listColleges())[0];
  if (!first) throw new HospitalError("There is no college to run a teaching hospital for yet.", 404);
  return first.id;
}

const auditCollege = (session: SessionPayload) => (session.college === "all" ? null : session.college);

async function audit(session: SessionPayload, action: string) {
  await getStore().audit.add({ actor: session.name, action, target: "hospital-dashboard", collegeId: auditCollege(session), actorSub: session.sub });
}

/** Of the census entries, the last one recorded for each department on each day. */
function lastPerDay(rows: CensusRow[]): CensusRow[] {
  const best = new Map<string, CensusRow>();
  for (const r of rows) {
    const key = `${r.departmentId}|${istDay(r.createdAt)}`;
    const cur = best.get(key);
    if (!cur || r.createdAt > cur.createdAt) best.set(key, r);
  }
  return [...best.values()];
}

async function rotationsOf(college: string): Promise<HospitalRotationItem[]> {
  try {
    const raw = await getStore().records.all(RESOURCES.rotations!, college);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return raw.map((r: any) => ({
      id: r.id,
      student: String(r.student ?? r.data?.student ?? ""),
      regNo: String(r.regNo ?? r.data?.regNo ?? ""),
      phase: String(r.phase ?? r.data?.phase ?? ""),
      department: String(r.department ?? r.data?.department ?? ""),
      unit: String(r.unit ?? r.data?.unit ?? ""),
      startDate: String(r.startDate ?? r.data?.startDate ?? ""),
      endDate: String(r.endDate ?? r.data?.endDate ?? ""),
      supervisor: String(r.supervisor ?? r.data?.supervisor ?? ""),
      attendance: Number(r.attendance ?? r.data?.attendance ?? 0),
      competenciesSigned: Number(r.competenciesSigned ?? r.data?.competenciesSigned ?? 0),
      status: String(r.status ?? r.data?.status ?? "Ongoing"),
      remarks: r.remarks ? String(r.remarks) : r.data?.remarks ? String(r.data.remarks) : undefined,
    }));
  } catch {
    return [];
  }
}

function departmentView(d: DeptRow, latest: CensusRow | undefined, activeStudents: number, monthly: { surgeries: number; deliveries: number }): HospitalDepartment {
  const occupied = latest?.occupiedBeds ?? 0;
  const pct = d.teachingBeds > 0 ? round1((occupied / d.teachingBeds) * 100) : 0;
  let status: HospitalDepartment["status"] = "Awaiting Census";
  let statusNotes = "No census has been recorded for this department yet.";
  if (latest && d.teachingBeds > 0) {
    if (pct >= 80) {
      status = "Optimal";
      statusNotes = "Occupancy meets the NMC 80% teaching minimum.";
    } else if (pct >= 75) {
      status = "Surplus";
      statusNotes = "Occupancy is just under the 80% teaching minimum.";
    } else {
      status = "Attention Required";
      statusNotes = "Occupancy is below the 75% threshold; mobilise elective cases.";
    }
  }
  return {
    id: d.id,
    name: d.name,
    category: d.category,
    hod: d.hod,
    teachingBeds: d.teachingBeds,
    icuBeds: d.icuBeds,
    icuOccupied: latest?.icuOccupied ?? 0,
    occupiedBeds: occupied,
    occupancyPercent: pct,
    opdDaily: latest?.opd ?? 0,
    ipdAdmissionsDaily: latest?.ipdAdmissions ?? 0,
    studentCasesWeekly: latest?.casesPerStudent ?? 0,
    cbmeTargetCases: d.cbmeTargetCases,
    units: d.units,
    activeStudents,
    status,
    statusNotes,
    lastCensusAt: latest?.createdAt,
    surgeriesMonthly: monthly.surgeries > 0 ? monthly.surgeries : undefined,
    deliveriesMonthly: monthly.deliveries > 0 ? monthly.deliveries : undefined,
  };
}

export async function getHospitalOverview(session: SessionPayload): Promise<HospitalOverview> {
  const college = await collegeOf(session);
  const data = hospitalData();
  const since = new Date(Date.now() - 190 * 86_400_000).toISOString();
  const [rows, latestRows, history, profile, rotations] = await Promise.all([
    data.departments(college),
    data.latestCensus(college),
    data.census(college, since),
    data.profile(college),
    rotationsOf(college),
  ]);

  const latestBy = new Map(latestRows.map((c) => [c.departmentId, c]));
  const onRotation = (name: string) =>
    rotations.filter((r) => r.department.toLowerCase() === name.toLowerCase() && !/^(completed|cancelled)$/i.test(r.status)).length;
  // last 30 days, one reading per department per day
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const month = lastPerDay(history.filter((c) => c.createdAt >= cutoff));
  const monthlySurgeries = month.reduce((s, c) => s + c.surgeries, 0);
  const monthlyDeliveries = month.reduce((s, c) => s + c.deliveries, 0);
  const monthOf = (id: string) => {
    const mine = month.filter((c) => c.departmentId === id);
    return { surgeries: mine.reduce((s, c) => s + c.surgeries, 0), deliveries: mine.reduce((s, c) => s + c.deliveries, 0) };
  };
  const depts = rows.map((d) => departmentView(d, latestBy.get(d.id), onRotation(d.name), monthOf(d.id)));

  const totalBeds = depts.reduce((s, d) => s + d.teachingBeds, 0);
  const occupiedBeds = depts.reduce((s, d) => s + d.occupiedBeds, 0);
  const occupancyRate = totalBeds > 0 && latestRows.length > 0 ? round1((occupiedBeds / totalBeds) * 100) : 0;
  const dailyOpd = depts.reduce((s, d) => s + d.opdDaily, 0);
  const dailyIpd = depts.reduce((s, d) => s + d.ipdAdmissionsDaily, 0);
  const dailyDischarges = latestRows.reduce((s, c) => s + c.discharges, 0);
  const totalIcuBeds = depts.reduce((s, d) => s + d.icuBeds, 0);
  const icuOccupiedBeds = depts.reduce((s, d) => s + d.icuOccupied, 0);
  const emergencyFootfall = depts.filter((d) => d.category === "Emergency & Critical Care").reduce((s, d) => s + d.opdDaily, 0);
  const withCases = depts.filter((d) => latestBy.get(d.id)?.casesPerStudent != null);
  const clinicalMaterialAvg = withCases.length ? round1(withCases.reduce((s, d) => s + d.studentCasesWeekly, 0) / withCases.length) : 0;

  const hasCensus = latestRows.length > 0;
  const missing = "Not recorded yet";
  const lowCases = depts.filter((d) => latestBy.get(d.id)?.casesPerStudent != null && d.studentCasesWeekly < d.cbmeTargetCases);
  const icuShare = totalBeds > 0 ? (totalIcuBeds / totalBeds) * 100 : 0;

  const norm = (n: Omit<HospitalNmcNorm, "compliant"> & { compliant?: boolean }): HospitalNmcNorm => ({ ...n, compliant: n.status === "Pass" });
  const nmcNorms: HospitalNmcNorm[] = [
    norm({
      id: "norm-occupancy",
      title: "Average Teaching Bed Occupancy",
      currentValue: hasCensus ? `${occupancyRate}%` : missing,
      normRequirement: "≥ 80% (NMC MSR Table 2)",
      status: !hasCensus ? "Warning" : occupancyRate >= 80 ? "Pass" : occupancyRate >= 75 ? "Warning" : "Deficiency",
      remediation: !hasCensus ? "Record a ward census to assess occupancy." : occupancyRate < 80 ? "Mobilise elective surgical and medical admissions across allied wards." : undefined,
    }),
    norm({
      id: "norm-opd",
      title: "Daily Outpatient (OPD) Footfall",
      currentValue: hasCensus ? `${dailyOpd.toLocaleString()} / day` : missing,
      normRequirement: "≥ 2,500 / day (for 250 MBBS seats)",
      status: !hasCensus ? "Warning" : dailyOpd >= 2500 ? "Pass" : "Deficiency",
      remediation: !hasCensus ? "Record OPD counts in the daily census." : dailyOpd < 2500 ? "Expand specialised evening and super-specialty peripheral clinics." : undefined,
    }),
    norm({
      id: "norm-icu",
      title: "Intensive Care Unit (ICU / ICCU / NICU)",
      currentValue: totalIcuBeds > 0 ? `${totalIcuBeds} ICU beds (${round1(icuShare)}% of teaching beds)` : missing,
      normRequirement: "≥ 10% of total teaching beds with ventilator support",
      status: totalIcuBeds === 0 ? "Warning" : icuShare >= 10 ? "Pass" : "Deficiency",
      remediation: totalIcuBeds === 0 ? "Enter ICU bed counts for each department." : icuShare < 10 ? "Add ICU capacity to reach 10% of teaching beds." : undefined,
    }),
    norm({
      id: "norm-surgery",
      title: "Monthly Surgeries & Deliveries",
      currentValue: hasCensus ? `${monthlySurgeries.toLocaleString()} surgeries · ${monthlyDeliveries.toLocaleString()} deliveries (last 30 days)` : missing,
      normRequirement: "≥ 25 major surgeries/day, ≥ 10 deliveries/day",
      status: !hasCensus ? "Warning" : monthlySurgeries >= 750 && monthlyDeliveries >= 300 ? "Pass" : "Deficiency",
      remediation: !hasCensus ? "Record daily surgeries and deliveries." : undefined,
    }),
    norm({
      id: "norm-lab",
      title: "Central Clinical Lab Investigations",
      currentValue: profile.labTestsDaily != null ? `${profile.labTestsDaily.toLocaleString()} tests / day` : missing,
      normRequirement: "≥ 2,500 investigations/day (Biochem, Path, Micro)",
      status: profile.labTestsDaily == null ? "Warning" : profile.labTestsDaily >= 2500 ? "Pass" : "Deficiency",
      remediation: profile.labTestsDaily == null ? "Add the lab's daily test volume under Hospital facilities." : undefined,
    }),
    norm({
      id: "norm-bloodbank",
      title: "Licensed Blood Centre & Components",
      currentValue:
        profile.bloodWholeUnits != null || profile.bloodComponentUnits != null
          ? `${profile.bloodWholeUnits ?? 0} whole blood · ${profile.bloodComponentUnits ?? 0} component units${profile.bloodBankLicensed ? "" : " · licence not confirmed"}`
          : missing,
      normRequirement: "24/7 licensed component separation unit",
      status: profile.bloodWholeUnits == null && profile.bloodComponentUnits == null ? "Warning" : profile.bloodBankLicensed ? "Pass" : "Deficiency",
      remediation: !profile.bloodBankLicensed ? "Confirm the blood centre licence under Hospital facilities." : undefined,
    }),
    norm({
      id: "norm-cbme",
      title: "CBME Bedside Clinical Material / Student",
      currentValue: withCases.length ? `${clinicalMaterialAvg} cases / week` : missing,
      normRequirement: "Meets each department's weekly case target per student",
      status: withCases.length === 0 ? "Warning" : lowCases.length === 0 ? "Pass" : "Warning",
      remediation: withCases.length === 0 ? "Record cases per student in the census." : lowCases.length ? `Below target: ${lowCases.map((d) => d.name).join(", ")}.` : undefined,
    }),
  ];
  const nmcComplianceScore = round1((nmcNorms.filter((n) => n.compliant).length / nmcNorms.length) * 100);

  const kpis: HospitalKpis = {
    totalBeds,
    occupiedBeds,
    occupancyRate,
    dailyOpd,
    dailyIpdAdmissions: dailyIpd,
    dailyDischarges,
    icuOccupiedBeds,
    totalIcuBeds,
    emergencyFootfall,
    monthlySurgeries,
    monthlyDeliveries,
    clinicalMaterialAvg,
    nmcComplianceScore,
  };

  // trend: for each month, the average of its daily hospital-wide totals
  const names = new Map(rows.map((d) => [d.id, d.name]));
  const byDay = new Map<string, { opd: number; ipd: number; occ: number }>();
  for (const c of lastPerDay(history)) {
    const day = istDay(c.createdAt);
    const t = byDay.get(day) ?? { opd: 0, ipd: 0, occ: 0 };
    t.opd += c.opd;
    t.ipd += c.ipdAdmissions;
    t.occ += c.occupiedBeds;
    byDay.set(day, t);
  }
  const byMonth = new Map<string, { opd: number; ipd: number; occ: number; days: number }>();
  for (const [day, t] of byDay) {
    const m = byMonth.get(day.slice(0, 7)) ?? { opd: 0, ipd: 0, occ: 0, days: 0 };
    m.opd += t.opd;
    m.ipd += t.ipd;
    m.occ += t.occ;
    m.days += 1;
    byMonth.set(day.slice(0, 7), m);
  }
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyTrends: HospitalMonthlyTrend[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, m]) => ({
      name: MONTHS[Number(key.slice(5, 7)) - 1] ?? key,
      opdDivided10: Math.round(m.opd / m.days / 10),
      ipd: Math.round(m.ipd / m.days),
      occupancy: totalBeds > 0 ? Math.round((m.occ / m.days / totalBeds) * 100) : 0,
    }));

  const recentLogs: HospitalCensusLog[] = history.slice(0, 50).map((c) => ({
    id: c.id,
    timestamp: istStamp(c.createdAt),
    department: names.get(c.departmentId) ?? "Removed department",
    actor: c.actor,
    summary: `Census: ${c.occupiedBeds} beds occupied, OPD ${c.opd}, IPD admissions ${c.ipdAdmissions}${c.discharges ? `, ${c.discharges} discharges` : ""}${c.surgeries ? `, ${c.surgeries} surgeries` : ""}${c.deliveries ? `, ${c.deliveries} deliveries` : ""}`,
    notes: c.notes || undefined,
  }));

  let hospitalName = profile.hospitalName;
  if (!hospitalName) {
    try {
      const col = (await listColleges()).find((c) => c.id === college);
      const cname = String(col?.name ?? "");
      if (cname) hospitalName = /hospital/i.test(cname) ? cname : `${cname} Teaching Hospital`;
    } catch {
      // keep empty
    }
  }

  return {
    collegeId: college,
    hospitalName: hospitalName || "Teaching Hospital",
    stream: "medical",
    kpis,
    departments: depts,
    nmcNorms,
    recentLogs,
    activeRotations: rotations.slice(0, 15),
    monthlyTrends,
    profile,
    permissions: { manage: canManageHospital(session.role), certify: canCertifyRotations(session.role) },
  };
}

export async function createHospitalDepartment(session: SessionPayload, input: CreateHospitalDepartmentInput): Promise<HospitalOverview> {
  const college = await collegeOf(session);
  if (input.icuBeds > input.teachingBeds) throw new HospitalError("ICU beds can't be more than the department's teaching beds.");
  const created = await hospitalData().createDepartment({ college, ...input });
  if (!created) throw new HospitalError(`There is already a department called "${input.name}".`, 409);
  await audit(session, `Added hospital department ${created.name}`);
  return getHospitalOverview(session);
}

export async function updateHospitalDepartment(session: SessionPayload, id: string, patch: Partial<CreateHospitalDepartmentInput>): Promise<HospitalOverview> {
  const college = await collegeOf(session);
  const found = await hospitalData().department(id);
  if (!found || found.college !== college) throw new HospitalError("Department not found.", 404);
  const beds = patch.teachingBeds ?? found.teachingBeds;
  if ((patch.icuBeds ?? found.icuBeds) > beds) throw new HospitalError("ICU beds can't be more than the department's teaching beds.");
  const updated = await hospitalData().updateDepartment(id, patch);
  if (updated === "duplicate") throw new HospitalError(`There is already a department called "${patch.name}".`, 409);
  if (!updated) throw new HospitalError("Department not found.", 404);
  await audit(session, `Updated hospital department ${updated.name}`);
  return getHospitalOverview(session);
}

export async function removeHospitalDepartment(session: SessionPayload, id: string): Promise<HospitalOverview> {
  const college = await collegeOf(session);
  const found = await hospitalData().department(id);
  if (!found || found.college !== college) throw new HospitalError("Department not found.", 404);
  await hospitalData().removeDepartment(id);
  await audit(session, `Removed hospital department ${found.name} and its census history`);
  return getHospitalOverview(session);
}

export async function updateHospitalProfile(session: SessionPayload, input: UpdateHospitalProfileInput): Promise<HospitalOverview> {
  const college = await collegeOf(session);
  await hospitalData().saveProfile(college, input);
  await audit(session, "Updated hospital facility profile");
  return getHospitalOverview(session);
}

export async function updateHospitalCensus(session: SessionPayload, input: UpdateHospitalCensusInput): Promise<HospitalOverview> {
  const college = await collegeOf(session);
  const dept = (await hospitalData().departments(college)).find((d) => d.name.toLowerCase() === input.department.toLowerCase());
  if (!dept) throw new HospitalError(`Department '${input.department}' not found.`, 404);
  if (input.occupiedBeds > dept.teachingBeds) throw new HospitalError(`${dept.name} has only ${dept.teachingBeds} teaching beds.`);
  const icu = input.icuOccupied ?? 0;
  if (icu > dept.icuBeds) throw new HospitalError(`${dept.name} has only ${dept.icuBeds} ICU beds.`);

  await hospitalData().addCensus({
    college,
    departmentId: dept.id,
    occupiedBeds: input.occupiedBeds,
    icuOccupied: icu,
    opd: input.opd,
    ipdAdmissions: input.ipdAdmissions,
    discharges: input.discharges ?? 0,
    surgeries: input.surgeries ?? 0,
    deliveries: input.deliveries ?? 0,
    casesPerStudent: input.casesPerStudent ?? null,
    notes: (input.notes ?? "").trim(),
    actor: session.name,
    actorSub: session.sub,
  });
  await audit(session, `Updated Hospital Census for ${dept.name}`);
  return getHospitalOverview(session);
}

export async function certifyClinicalRotation(session: SessionPayload, input: CertifyRotationInput): Promise<{ ok: boolean; rotationId: string }> {
  const college = await collegeOf(session);
  const rec = await getStore().records.get(RESOURCES.rotations!, input.rotationId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = rec as any;
  if (!rec || (any.collegeId && any.collegeId !== college && any.college !== college)) throw new HospitalError("Rotation not found.", 404);
  const studentName = String(any.student ?? any.data?.student ?? "Student");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next: Record<string, any> = { ...rec };
  if (input.competenciesSigned !== undefined) next.competenciesSigned = input.competenciesSigned;
  if (input.attendance !== undefined) next.attendance = input.attendance;
  if (input.remarks) next.remarks = input.remarks;
  await getStore().records.update(RESOURCES.rotations!, rec.id, next, rec.version);
  await getStore().audit.add({
    actor: session.name,
    action: `Certified CBME clinical rotation for ${studentName}`,
    target: "clinical-rotations",
    collegeId: auditCollege(session),
    actorSub: session.sub,
  });
  return { ok: true, rotationId: input.rotationId };
}

/** The generic dashboard view of the same numbers (used by the config-driven module list). */
export async function dynamicHospitalDashboardData(collegeScope = "all", session?: SessionPayload): Promise<DashboardData> {
  const scoped: SessionPayload = session
    ? { ...session, college: collegeScope === "all" ? session.college : collegeScope }
    : { college: collegeScope, sub: "system", role: "institution", name: "System", tenant: "", mfa: true, exp: 0 };
  const overview = await getHospitalOverview(scoped);
  const k = overview.kpis;
  const recorded = overview.recentLogs.length > 0;

  const kpis: Kpi[] = [
    { label: "Teaching Beds", value: k.totalBeds.toLocaleString(), tone: "brand", hint: `${overview.departments.length} departments` },
    { label: "Bed Occupancy Rate", value: recorded ? `${k.occupancyRate}%` : "—", tone: !recorded ? "brand" : k.occupancyRate >= 80 ? "teal" : "rose", hint: "NMC Norm: ≥80% average" },
    { label: "Daily OPD", value: recorded ? k.dailyOpd.toLocaleString() : "—", tone: "gold", hint: "From the latest ward census" },
    { label: "Daily IPD Admissions", value: recorded ? k.dailyIpdAdmissions.toLocaleString() : "—", tone: "sky", hint: "From the latest ward census" },
    { label: "Surgeries (30 days)", value: k.monthlySurgeries.toLocaleString(), tone: "brand", hint: "Sum of daily census entries" },
    { label: "Deliveries (30 days)", value: k.monthlyDeliveries.toLocaleString(), tone: "teal", hint: "Sum of daily census entries" },
  ];

  const charts: ChartSpec[] = [];
  if (overview.monthlyTrends.length > 0) {
    charts.push({
      type: "line",
      title: "OPD and IPD Load Trends",
      xKey: "name",
      series: ["OPD (÷10)", "IPD"],
      data: overview.monthlyTrends.map((t) => ({ name: t.name, "OPD (÷10)": t.opdDivided10, IPD: t.ipd })),
    });
  }
  const withCases = overview.departments.filter((d) => d.studentCasesWeekly > 0);
  if (withCases.length > 0) {
    charts.push({
      type: "bar",
      title: "Clinical Material per Student (Cases / Week vs Target)",
      xKey: "name",
      series: ["Cases", "Target"],
      data: withCases.slice(0, 6).map((d) => ({ name: d.name, Cases: d.studentCasesWeekly, Target: d.cbmeTargetCases })),
    });
  }

  const insights: Insight[] = [];
  if (recorded) {
    const passed = overview.nmcNorms.filter((n) => n.compliant).length;
    insights.push({
      title: `${passed} of ${overview.nmcNorms.length} NMC hospital norms met`,
      body: `Teaching bed occupancy is ${k.occupancyRate}% with ${k.dailyOpd.toLocaleString()} OPD outpatients in the latest census.`,
      evidence: "Ward census entries recorded by hospital staff",
      tone: k.occupancyRate >= 80 ? "teal" : "amber",
    });
  } else {
    insights.push({
      title: "No ward census recorded yet",
      body: "Add your departments and record the first daily census to see occupancy, trends and NMC norm status.",
      evidence: "Teaching Hospital module",
      tone: "amber",
    });
  }

  return { template: "dashboard", kpis, charts, insights };
}
