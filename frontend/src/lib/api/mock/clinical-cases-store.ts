import "server-only";
import { sharedState } from "./global-state";

export interface ClerkedCase {
  id: string;
  bed: string;
  patient: string;
  diagnosis: string;
  complaints?: string;
  date: string;
  status: "Approved" | "Pending" | "Rejected";
  faculty: string;
  studentName: string;
  studentRoll: string;
  collegeId: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface DopsSubmission {
  id: string;
  code: string;
  name: string;
  level: "Shows How" | "Performs";
  status: "Certified" | "Pending Review" | "To be Attempted";
  notes?: string;
  supervisor: string;
  studentName: string;
  date: string;
  certifier?: string;
}

const DEFAULT_CASES: ClerkedCase[] = [
  {
    id: "CASE-101",
    bed: "Bed 25",
    patient: "Subramanian M., 52 M",
    diagnosis: "Community Acquired Pneumonia (CAP) - Right Lower Lobe",
    complaints: "High-grade fever x 4 days, productive cough with yellow sputum, breathlessness",
    date: "Today",
    status: "Pending",
    faculty: "Dr. R. Prakash, MD",
    studentName: "Aishwarya V.",
    studentRoll: "51211005",
    collegeId: "COL-1006",
  },
  {
    id: "CASE-102",
    bed: "Bed 14",
    patient: "Murugesan K., 42 M",
    diagnosis: "Acute Appendicitis with Localized Peritonitis",
    complaints: "Right lower quadrant pain x 2 days, vomiting",
    date: "21 Oct 2026",
    status: "Approved",
    faculty: "Dr. R. Prakash, MD",
    studentName: "Keerthana S.",
    studentRoll: "21MB1042",
    collegeId: "COL-1006",
    verifiedBy: "Dr. R. Prakash, MD",
    verifiedAt: "21 Oct 2026",
  },
  {
    id: "CASE-103",
    bed: "Bed 19",
    patient: "Selvam P., 56 M",
    diagnosis: "Right Inguinal Hernia (Direct) - For Lichtenstein Mesh Repair",
    complaints: "Swelling in right groin x 6 months, dragging pain",
    date: "18 Oct 2026",
    status: "Approved",
    faculty: "Dr. S. Anbarasu (SR)",
    studentName: "Divya Ramesh",
    studentRoll: "51211001",
    collegeId: "COL-1006",
    verifiedBy: "Dr. S. Anbarasu (SR)",
    verifiedAt: "18 Oct 2026",
  },
  {
    id: "CASE-104",
    bed: "Bed 22",
    patient: "Ganesan R., 61 M",
    diagnosis: "Diabetic Foot Ulcer (Wagner Grade 3) with Neuropathy",
    complaints: "Non-healing wound on right heel x 3 weeks, loss of sensation",
    date: "15 Oct 2026",
    status: "Approved",
    faculty: "Dr. R. Prakash, MD",
    studentName: "Keerthana S.",
    studentRoll: "21MB1042",
    collegeId: "COL-1006",
    verifiedBy: "Dr. R. Prakash, MD",
    verifiedAt: "15 Oct 2026",
  },
];

const DEFAULT_DOPS: DopsSubmission[] = [
  {
    id: "SK-01",
    code: "SU11.1",
    name: "Aseptic hand scrubbing, gowning and sterile gloving",
    level: "Shows How",
    status: "Certified",
    certifier: "Dr. R. Prakash, MD",
    date: "04 Oct 2026",
    supervisor: "Dr. R. Prakash, MD",
    studentName: "Aishwarya V.",
  },
  {
    id: "SK-02",
    code: "SU14.3",
    name: "Simple interrupted surgical suturing & instrument knot tying",
    level: "Performs",
    status: "Certified",
    certifier: "Dr. R. Prakash, MD",
    date: "08 Oct 2026",
    supervisor: "Dr. R. Prakash, MD",
    studentName: "Aishwarya V.",
  },
  {
    id: "SK-03",
    code: "SU17.2",
    name: "Nasogastric (Ryle's) tube insertion and verification",
    level: "Performs",
    status: "Certified",
    certifier: "Dr. S. Anbarasu (SR)",
    date: "11 Oct 2026",
    supervisor: "Dr. S. Anbarasu (SR)",
    studentName: "Aishwarya V.",
  },
  {
    id: "SK-04",
    code: "SU20.1",
    name: "Urinary Foley catheterization with sterile precautions",
    level: "Performs",
    status: "Certified",
    certifier: "Dr. R. Prakash, MD",
    date: "14 Oct 2026",
    supervisor: "Dr. R. Prakash, MD",
    studentName: "Aishwarya V.",
  },
  {
    id: "SK-05",
    code: "SU10.2",
    name: "Pre-operative evaluation & WHO Surgical Safety Checklist",
    level: "Shows How",
    status: "Certified",
    certifier: "Dr. S. Anbarasu (SR)",
    date: "16 Oct 2026",
    supervisor: "Dr. S. Anbarasu (SR)",
    studentName: "Aishwarya V.",
  },
  {
    id: "SK-06",
    code: "SU14.5",
    name: "Post-operative surgical wound dressing & drain inspection",
    level: "Performs",
    status: "Certified",
    certifier: "Dr. R. Prakash, MD",
    date: "19 Oct 2026",
    supervisor: "Dr. R. Prakash, MD",
    studentName: "Aishwarya V.",
  },
  {
    id: "SK-07",
    code: "SU22.4",
    name: "Digital rectal examination & proctoscopy assist",
    level: "Shows How",
    status: "Pending Review",
    certifier: "Submitted to Dr. Anbarasu",
    date: "Yesterday",
    supervisor: "Dr. S. Anbarasu (SR)",
    studentName: "Aishwarya V.",
    notes: "Observed and assisted Senior Resident during proctoscopy. Anal sphincteric tone assessed, no external haemorrhoids, rectal mucosa inspected under proper illumination.",
  },
  {
    id: "SK-08",
    code: "SU15.1",
    name: "Incision and drainage of superficial cutaneous abscess",
    level: "Performs",
    status: "To be Attempted",
    supervisor: "Dr. R. Prakash, MD",
    studentName: "Aishwarya V.",
    date: "—",
  },
];

function casesMap() {
  return sharedState("clinical.cases.store", () => {
    const m = new Map<string, ClerkedCase>();
    for (const c of DEFAULT_CASES) m.set(c.id, c);
    return m;
  });
}

function dopsMap() {
  return sharedState("clinical.dops.store", () => {
    const m = new Map<string, DopsSubmission>();
    for (const d of DEFAULT_DOPS) m.set(d.code, d);
    return m;
  });
}

export function listClinicalCases(collegeId?: string | null): ClerkedCase[] {
  const all = Array.from(casesMap().values());
  if (collegeId && collegeId !== "all") {
    return all.filter((c) => !c.collegeId || c.collegeId === collegeId);
  }
  return all;
}

export function createClinicalCase(input: {
  bed: string;
  patient: string;
  diagnosis: string;
  complaints?: string;
  faculty: string;
  studentName: string;
  studentRoll?: string;
  collegeId?: string | null;
}): ClerkedCase {
  const id = `CASE-${Date.now().toString().slice(-5)}`;
  const item: ClerkedCase = {
    id,
    bed: input.bed || "Bed 27",
    patient: input.patient,
    diagnosis: input.diagnosis,
    complaints: input.complaints || "",
    date: "Today",
    status: "Pending",
    faculty: input.faculty || "Dr. R. Prakash, MD",
    studentName: input.studentName || "Student",
    studentRoll: input.studentRoll || "51211005",
    collegeId: input.collegeId || "COL-1006",
  };
  casesMap().set(id, item);
  return item;
}

export function approveClinicalCase(id: string, facultyName: string): ClerkedCase | null {
  const m = casesMap();
  const found = m.get(id);
  if (!found) return null;
  found.status = "Approved";
  found.verifiedBy = facultyName;
  found.verifiedAt = "Today";
  m.set(id, found);
  return found;
}

export function listDopsSkills(): DopsSubmission[] {
  return Array.from(dopsMap().values());
}

export function submitDopsSkill(input: {
  code: string;
  notes?: string;
  supervisor: string;
  studentName: string;
}): DopsSubmission | null {
  const m = dopsMap();
  const found = m.get(input.code);
  if (!found) return null;
  found.status = "Pending Review";
  found.notes = input.notes || "";
  found.supervisor = input.supervisor;
  found.studentName = input.studentName;
  found.date = "Today";
  found.certifier = `Submitted to ${input.supervisor}`;
  m.set(input.code, found);
  return found;
}

export function approveDopsSkill(code: string, supervisor: string): DopsSubmission | null {
  const m = dopsMap();
  const found = m.get(code);
  if (!found) return null;
  found.status = "Certified";
  found.certifier = supervisor;
  found.date = "Today";
  m.set(code, found);
  return found;
}
