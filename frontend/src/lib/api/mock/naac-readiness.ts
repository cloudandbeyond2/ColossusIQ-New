import "server-only";
import { RESOURCES } from "@/config/resources";
import { ALL_COLLEGES } from "@/config/tenancy";
import type { ScorecardData } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { AICTE_COMMITTEES } from "./aicte-compliance";
import { aicteStore } from "./aicte-store";
import { alumniStore } from "./alumni-store";
import { driveStore } from "./drive-store";
import { kbStore } from "./knowledge-store";
import { noticeStore } from "./notice-store";

/*
 * NAAC readiness, scored from what the college has actually recorded in ColossusIQ: courses and departments,
 * the staff register, events, placement drives, alumni, notices, approved policy documents and the committees
 * recorded on the AICTE Compliance page. Each criterion is a weighted blend of a few measurable shares, so the
 * score moves as the college's records do. It is a readiness indicator, not a NAAC grade: peer-team evidence
 * such as publications, MoUs and the SSR itself is not in the system, and the gaps say so.
 */

type Rec = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
/** Share of `part` in `whole` as 0..1; an empty whole is 0 (nothing recorded, nothing to credit). */
const share = (part: number, whole: number) => (whole > 0 ? Math.min(1, part / whole) : 0);
/** Progress towards a target count as 0..1. */
const toward = (n: number, target: number) => Math.min(1, n / target);
const blend = (...parts: Array<[weight: number, value: number]>) => Math.round(100 * parts.reduce((a, [w, v]) => a + w * v, 0));
const percent = (v: number) => `${Math.round(v * 100)}%`;

const YEAR_MS = 365 * 86400000;
const withinYear = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) && Math.abs(Date.now() - t) <= YEAR_MS;
};

export interface NaacCriterion {
  name: string;
  score: number;
  target: number;
  evidence: string;
  /** What to do when the score is below target. */
  action: string;
}

export async function naacCriteria(scope: string, session?: SessionPayload): Promise<NaacCriterion[]> {
  const collegeId = scope !== ALL_COLLEGES ? scope : "COL-1001";
  const store = getStore();
  const s = session ? { ...session, college: collegeId } : undefined;

  const [departmentRows, courses, staff, users, events, board, docs, notices, alumni, aicte, drives] = await Promise.all([
    store.records.all(RESOURCES.departments!, collegeId) as Promise<Rec[]>,
    store.records.all(RESOURCES.courses!, collegeId) as Promise<Rec[]>,
    store.records.all(RESOURCES.staff!, collegeId) as Promise<Rec[]>,
    store.records.all(RESOURCES.users!, collegeId) as Promise<Rec[]>,
    store.records.all(RESOURCES.events!, collegeId) as Promise<Rec[]>,
    store.readiness.board(collegeId),
    kbStore().list(collegeId),
    noticeStore().list(collegeId),
    alumniStore().listMembers(collegeId),
    aicteStore().get(collegeId),
    s ? driveStore().list(s) : Promise.resolve([] as Array<{ date?: string }>),
  ]);

  /* teaching staff and their qualifications */
  const teaching = staff.filter((x) => x.status === "Active" && (x.staffType === "Teaching" || !x.staffType));
  const facultyCount = Math.max(teaching.length, users.filter((u) => u.status === "Active" && ["Faculty", "Head of Department", "Principal"].includes(str(u.role))).length);
  const phd = teaching.filter((x) => /ph\.?\s?d|doctor/i.test(str(x.qualification))).length;

  const activeCourses = courses.filter((c) => !str(c.status) || str(c.status) === "Active");
  const sanctioned = [...new Set(departmentRows.map((d) => str(d.department)).filter(Boolean))];
  const departments = [...new Set(activeCourses.map((c) => str(c.department)).filter(Boolean))];
  const labCourses = activeCourses.filter((c) => str(c.courseType).toLowerCase() === "practical" || /lab/i.test(str(c.title)));
  const deptsWithLab = new Set(labCourses.map((c) => str(c.department))).size;
  const withCredits = activeCourses.filter((c) => num(c.credits) > 0).length;
  const withOutcomes = activeCourses.filter((c) => str(c.description).length >= 40).length;
  const withFaculty = activeCourses.filter((c) => str(c.faculty).length > 1).length;

  const fsr = facultyCount > 0 ? board.length / facultyCount : Infinity;
  const fsrFit = facultyCount === 0 ? 0 : fsr <= 20 ? 1 : Math.max(0.2, 20 / fsr);

  const recentEvents = events.filter((e) => withinYear(str(e.date)));
  const approvedDocs = docs.filter((d) => d.status === "Approved");
  const recentNotices = notices.filter((n) => withinYear(n.createdAt));
  const recentDrives = drives.filter((d) => withinYear(str((d as { date?: string }).date)));

  const credit = (id: string) => {
    const c = aicte.committees[id];
    return c?.status === "Constituted & Active" ? 1 : c?.status === "Pending Reconstitution" ? 0.5 : 0;
  };
  const meetingCredit = (id: string) => (credit(id) === 1 && aicte.committees[id]?.momStatus === "Certified by Principal" ? 1 : credit(id) * 0.6);
  const statutory = AICTE_COMMITTEES.reduce((a, c) => a + credit(c.id), 0) / AICTE_COMMITTEES.length;
  const actions = aicte.actions;
  const resolved = actions.filter((a) => a.status === "Resolved").length;

  return [
    {
      name: "C1 Curricular aspects",
      target: 80,
      score: blend([0.4, share(sanctioned.filter((d) => departments.includes(d)).length, sanctioned.length)], [0.3, share(withCredits, activeCourses.length)], [0.3, share(withOutcomes, activeCourses.length)]),
      evidence: `${activeCourses.length} active courses; ${sanctioned.filter((d) => departments.includes(d)).length} of ${sanctioned.length} sanctioned departments offer courses; ${percent(share(withCredits, activeCourses.length))} carry credits and ${percent(share(withOutcomes, activeCourses.length))} document course outcomes.`,
      action: "Add credits and written course outcomes to every course in Course Management.",
    },
    {
      name: "C2 Teaching-learning & evaluation",
      target: 80,
      score: blend([0.4, share(withFaculty, activeCourses.length)], [0.3, fsrFit], [0.3, share(phd, teaching.length)]),
      evidence: `${percent(share(withFaculty, activeCourses.length))} of courses have an assigned faculty; student-teacher ratio ${facultyCount > 0 ? `1:${fsr.toFixed(1)}` : "unknown"}; ${phd} of ${teaching.length} teaching staff hold a doctorate.`,
      action: "Assign a faculty member to every course and record staff qualifications in Staff Management.",
    },
    {
      name: "C3 Research, innovation & extension",
      target: 75,
      score: blend([0.6, toward(recentEvents.length, 12)], [0.4, share(phd, teaching.length)]),
      evidence: `${recentEvents.length} events (workshops, seminars, extension) in the last 12 months against a target of 12; ${phd} doctorate-holding faculty.`,
      action: "Log every seminar, workshop and outreach activity under Events; publications and MoUs must be collected outside the system.",
    },
    {
      name: "C4 Infrastructure & learning resources",
      target: 75,
      score: blend([0.5, share(deptsWithLab, departments.length)], [0.5, toward(approvedDocs.length, 4)]),
      evidence: `${deptsWithLab} of ${departments.length} departments run practical or laboratory courses; ${approvedDocs.length} approved documents in the Knowledge Base.`,
      action: "Register practical courses for the departments without one and approve handbooks and syllabi in the Knowledge Base.",
    },
    {
      name: "C5 Student support & progression",
      target: 75,
      score: blend([0.4, toward(recentDrives.length, 6)], [0.3, toward(alumni.length, 10)], [0.3, toward(recentNotices.length, 5)]),
      evidence: `${recentDrives.length} placement drives and ${recentNotices.length} notices in the last 12 months; ${alumni.length} alumni in the network.`,
      action: "Schedule placement drives, publish notices through the Notice Board and onboard alumni mentors.",
    },
    {
      name: "C6 Governance & leadership",
      target: 75,
      score: blend([0.4, meetingCredit("COM-05")], [0.4, statutory], [0.2, share(resolved, actions.length)]),
      evidence: `IQAC ${aicte.committees["COM-05"]?.status ?? "not recorded"}; ${Math.round(statutory * AICTE_COMMITTEES.length)} of ${AICTE_COMMITTEES.length} statutory bodies constituted; ${resolved} of ${actions.length} compliance actions resolved.`,
      action: "Record the IQAC and the other statutory committees (with certified minutes) on the AICTE Compliance page and close open actions.",
    },
    {
      name: "C7 Institutional values & best practices",
      target: 75,
      score: blend([0.4, toward(approvedDocs.length, 4)], [0.6, (meetingCredit("COM-01") + meetingCredit("COM-02") + meetingCredit("COM-04")) / 3]),
      evidence: `${approvedDocs.length} approved policy documents; Anti-Ragging, ICC and SC/ST bodies ${Math.round(((credit("COM-01") + credit("COM-02") + credit("COM-04")) / 3) * 100)}% in place.`,
      action: "Approve institutional policies in the Knowledge Base and record the Anti-Ragging, ICC and SC/ST bodies; document two best practices with outcome data.",
    },
  ];
}

export async function dynamicNaacReadiness(scope: string, session?: SessionPayload): Promise<ScorecardData> {
  const criteria = await naacCriteria(scope, session);
  const overall = Math.round(criteria.reduce((a, c) => a + c.score, 0) / criteria.length);
  const meets = criteria.filter((c) => c.score >= c.target);
  const below = criteria.filter((c) => c.score < c.target).sort((a, b) => a.score - a.target - (b.score - b.target));

  return {
    template: "scorecard",
    headline: `NAAC readiness — seven criteria, ${meets.length} of ${criteria.length} at target`,
    overall,
    dimensions: criteria.map((c) => ({ name: c.name, score: c.score, target: c.target })),
    strengths: meets.length > 0 ? meets.map((c) => `${c.name}: ${c.evidence}`) : ["No criterion has reached its target yet; the gaps below show where the evidence is thinnest."],
    gaps: [
      ...below.map((c) => `${c.name} (${c.score} of ${c.target}): ${c.evidence}`),
      "Publications, MoUs, extension reports and the SSR itself are collected outside ColossusIQ and are not part of this score.",
    ],
    plan: below.length > 0 ? below.slice(0, 4).map((c) => c.action) : ["Keep records current and run a mock peer-team visit before the assessment window."],
  };
}
