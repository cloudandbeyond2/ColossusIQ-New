import "server-only";

import type { SessionPayload } from "@/lib/auth/session";
import {
  OsceOverview,
  OsceStation,
  OsceSession,
  SkillsLabBooking,
  StudentOsceResult,
  SkillsLabEquipment,
  CreateOsceStationInput,
  CreateOsceSessionInput,
  CreateSkillsLabBookingInput,
  UpdateBookingStatusInput,
  GradeStudentOsceInput,
} from "../osce-schemas";

const DEFAULT_STATIONS: OsceStation[] = [
  {
    id: "st-1",
    number: 1,
    title: "Basic Life Support (BLS) & CPR with AED",
    department: "Emergency Medicine & Anaesthesia",
    domain: "Emergency",
    durationMinutes: 8,
    totalMarks: 20,
    passMarks: 16,
    nmcCompetencyCode: "PE-24.3",
    room: "Sim Suite 101 - High Fidelity",
    manikinEquipment: "Laerdal SimMan 3G / Defib AED Trainer",
    examiner: "Dr. A. Meenakshi, MD (Anaesth)",
    status: "Active",
    checklistCount: 6,
    averageScore: 91.2,
    passRate: 94.5,
    criticalStepRequired: true,
    criticalStepDescription: "Ensure scene safety & initiate chest compressions at 100-120 bpm with depth 5-6 cm within 10 seconds of pulse check.",
    checklist: [
      { id: "cl-1-1", step: "Assess scene safety and responsiveness of patient", maxMarks: 3, isCritical: true, category: "Preparation" },
      { id: "cl-1-2", step: "Call for help / activate code blue hospital emergency team", maxMarks: 3, isCritical: false, category: "Preparation" },
      { id: "cl-1-3", step: "Check carotid pulse and breathing simultaneously within 10s", maxMarks: 3, isCritical: true, category: "Execution" },
      { id: "cl-1-4", step: "High quality chest compressions (100-120/min, 30:2 ratio, full recoil)", maxMarks: 5, isCritical: true, category: "Execution" },
      { id: "cl-1-5", step: "Attach AED pads correctly and deliver shock safely ('All clear')", maxMarks: 4, isCritical: true, category: "Patient Safety" },
      { id: "cl-1-6", step: "Resume CPR immediately after shock without pulse check delay", maxMarks: 2, isCritical: false, category: "Execution" },
    ],
  },
  {
    id: "st-2",
    number: 2,
    title: "Intravenous (IV) Cannulation on Simulator Arm",
    department: "General Medicine",
    domain: "Procedure",
    durationMinutes: 7,
    totalMarks: 20,
    passMarks: 14,
    nmcCompetencyCode: "IM-11.4",
    room: "Skills Cubicle 4 - Vascular Access",
    manikinEquipment: "Adult Multi-Vein IV Training Arm + 20G/18G Cannula",
    examiner: "Dr. R. Sundararajan, MD (Gen Med)",
    status: "Active",
    checklistCount: 6,
    averageScore: 78.4,
    passRate: 83.0,
    criticalStepRequired: true,
    criticalStepDescription: "Confirm flashback in flash chamber before advancing cannula catheter and release tourniquet before flush.",
    checklist: [
      { id: "cl-2-1", step: "Patient identification, consent and explanation of procedure", maxMarks: 3, isCritical: false, category: "Communication" },
      { id: "cl-2-2", step: "Hand hygiene and aseptic non-touch technique (sterile gloves)", maxMarks: 3, isCritical: true, category: "Patient Safety" },
      { id: "cl-2-3", step: "Apply tourniquet 5-10 cm above site; inspect & palpate vein", maxMarks: 3, isCritical: false, category: "Preparation" },
      { id: "cl-2-4", step: "Skin disinfection with 2% chlorhexidine in 70% alcohol (30s air dry)", maxMarks: 3, isCritical: true, category: "Patient Safety" },
      { id: "cl-2-5", step: "Cannula insertion at 15-30 degrees; observe flashback & advance", maxMarks: 5, isCritical: true, category: "Execution" },
      { id: "cl-2-6", step: "Release tourniquet, secure with sterile dressing, flush with saline", maxMarks: 3, isCritical: false, category: "Execution" },
    ],
  },
  {
    id: "st-3",
    number: 3,
    title: "History Taking & Triage — Acute Chest Pain",
    department: "General Medicine",
    domain: "Communication",
    durationMinutes: 8,
    totalMarks: 20,
    passMarks: 14,
    nmcCompetencyCode: "IM-10.2",
    room: "Communication Suite A (Standardized Patient)",
    manikinEquipment: "Standardized Patient Actor (Angina Simulation)",
    examiner: "Dr. K. S. Balaji, MD (Cardiology)",
    status: "Active",
    checklistCount: 5,
    averageScore: 82.0,
    passRate: 88.5,
    criticalStepRequired: true,
    criticalStepDescription: "Elicit red flag symptoms (radiation to jaw/left arm, diaphoresis, dyspnea) and order urgent 12-lead ECG within 10 minutes.",
    checklist: [
      { id: "cl-3-1", step: "Build rapport, maintain eye contact and empathetic listening", maxMarks: 3, isCritical: false, category: "Communication" },
      { id: "cl-3-2", step: "Systematic SOCRATES exploration of chest pain character & onset", maxMarks: 5, isCritical: true, category: "Execution" },
      { id: "cl-3-3", step: "Screen cardiovascular risk factors (HTN, DM, smoking, family history)", maxMarks: 4, isCritical: false, category: "Execution" },
      { id: "cl-3-4", step: "Rule out acute aortic dissection, pulmonary embolism & pneumothorax", maxMarks: 4, isCritical: true, category: "Patient Safety" },
      { id: "cl-3-5", step: "Formulate differential diagnosis and communicate urgent plan", maxMarks: 4, isCritical: false, category: "Communication" },
    ],
  },
  {
    id: "st-4",
    number: 4,
    title: "Surgical Suturing & Instrument Knot Tying",
    department: "General Surgery",
    domain: "Procedure",
    durationMinutes: 7,
    totalMarks: 20,
    passMarks: 14,
    nmcCompetencyCode: "SU-17.2",
    room: "Surgical Skills Lab 1",
    manikinEquipment: "Multi-Layer Skin Suture Pad + Needle Holder & 3-0 Silk",
    examiner: "Dr. S. K. Narayanan, MS (Gen Surg)",
    status: "Active",
    checklistCount: 6,
    averageScore: 74.5,
    passRate: 79.2,
    criticalStepRequired: true,
    criticalStepDescription: "Correct needle entry at 90 degrees to skin margin and accurate knot tension without tissue strangulation.",
    checklist: [
      { id: "cl-4-1", step: "Grasp needle at junction of middle and posterior third with needle holder", maxMarks: 3, isCritical: false, category: "Preparation" },
      { id: "cl-4-2", step: "Pierce skin at 90-degree angle; follow curve of needle through tissue", maxMarks: 4, isCritical: true, category: "Execution" },
      { id: "cl-4-3", step: "Maintain equal distance and bite depth on both wound edges", maxMarks: 3, isCritical: false, category: "Execution" },
      { id: "cl-4-4", step: "Perform instrument tie with surgeon's knot (double throw) followed by square throws", maxMarks: 5, isCritical: true, category: "Execution" },
      { id: "cl-4-5", step: "Achieve wound edge eversion without ischemia or excessive tension", maxMarks: 3, isCritical: true, category: "Patient Safety" },
      { id: "cl-4-6", step: "Cut suture ends neatly leaving 4-5 mm tails; sharps safety protocol", maxMarks: 2, isCritical: false, category: "Patient Safety" },
    ],
  },
  {
    id: "st-5",
    number: 5,
    title: "Normal Vaginal Delivery & Third Stage Active Management (AMTSL)",
    department: "Obstetrics & Gynaecology",
    domain: "Procedure",
    durationMinutes: 10,
    totalMarks: 20,
    passMarks: 15,
    nmcCompetencyCode: "OG-8.1",
    room: "Birthing Simulation Suite 2",
    manikinEquipment: "PROMPT Flex Advanced Birthing Simulator + Fetal Doll",
    examiner: "Dr. Jayanthi Raman, MD, DGO",
    status: "Active",
    checklistCount: 6,
    averageScore: 86.4,
    passRate: 91.0,
    criticalStepRequired: true,
    criticalStepDescription: "Administer 10 IU IM Oxytocin within 1 minute of fetal delivery & practice controlled cord traction with counter-traction.",
    checklist: [
      { id: "cl-5-1", step: "Controlled delivery of fetal head, supporting perineum during crowning", maxMarks: 4, isCritical: true, category: "Execution" },
      { id: "cl-5-2", step: "Check for nuchal cord and wait for spontaneous external rotation", maxMarks: 3, isCritical: false, category: "Execution" },
      { id: "cl-5-3", step: "Gentle downward traction for anterior shoulder followed by upward for posterior", maxMarks: 3, isCritical: false, category: "Execution" },
      { id: "cl-5-4", step: "Immediate drying of baby and delayed cord clamping (1-3 min)", maxMarks: 3, isCritical: true, category: "Patient Safety" },
      { id: "cl-5-5", step: "Active Management of Third Stage (AMTSL): 10 IU Oxytocin & CCT", maxMarks: 5, isCritical: true, category: "Execution" },
      { id: "cl-5-6", step: "Inspect placenta for completeness and assess uterine contraction", maxMarks: 2, isCritical: false, category: "Patient Safety" },
    ],
  },
  {
    id: "st-6",
    number: 6,
    title: "Interpretation of 12-Lead ECG & Chest Radiograph",
    department: "General Medicine",
    domain: "Data interpretation",
    durationMinutes: 6,
    totalMarks: 20,
    passMarks: 13,
    nmcCompetencyCode: "IM-10.7",
    room: "Diagnostic Booth 3",
    manikinEquipment: "High-Resolution PACS Diagnostic Station + Light Box",
    examiner: "Dr. R. Sundararajan, MD",
    status: "Active",
    checklistCount: 5,
    averageScore: 76.0,
    passRate: 81.5,
    criticalStepRequired: true,
    criticalStepDescription: "Correctly diagnose acute ST-segment elevation myocardial infarction (STEMI) in anterior leads V1-V4.",
    checklist: [
      { id: "cl-6-1", step: "Verify patient details, date, standardization (25 mm/s, 10 mm/mV)", maxMarks: 2, isCritical: false, category: "Preparation" },
      { id: "cl-6-2", step: "Systematic rhythm analysis, heart rate calculation, PR and QRS duration", maxMarks: 4, isCritical: false, category: "Execution" },
      { id: "cl-6-3", step: "Identify ST elevation / reciprocal ST depression and localize culprit artery", maxMarks: 6, isCritical: true, category: "Execution" },
      { id: "cl-6-4", step: "Systematic Chest X-Ray reading: ABCDEF approach", maxMarks: 4, isCritical: false, category: "Execution" },
      { id: "cl-6-5", step: "Correlate radiological cardiomegaly and pulmonary venous congestion", maxMarks: 4, isCritical: true, category: "Patient Safety" },
    ],
  },
  {
    id: "st-7",
    number: 7,
    title: "Neonatal Resuscitation Protocol (NRP)",
    department: "Pediatrics & Neonatology",
    domain: "Emergency",
    durationMinutes: 8,
    totalMarks: 20,
    passMarks: 16,
    nmcCompetencyCode: "PE-19.4",
    room: "Neonatal Sim Cubicle",
    manikinEquipment: "NeoNatalie Suction & Bag-Mask Resusci Manikin",
    examiner: "Dr. G. Sivakumar, MD (Pediatrics)",
    status: "Active",
    checklistCount: 5,
    averageScore: 89.0,
    passRate: 92.4,
    criticalStepRequired: true,
    criticalStepDescription: "MRSOPE ventilation corrective steps if chest not rising; initiate chest compressions if HR < 60 bpm after 30s effective PPV.",
    checklist: [
      { id: "cl-7-1", step: "Initial steps: warm, dry, stimulate, clear airway if obstructed within 30s", maxMarks: 3, isCritical: true, category: "Preparation" },
      { id: "cl-7-2", step: "Assess breathing (apnea/gasping) and HR; start PPV via T-piece / bag-mask", maxMarks: 5, isCritical: true, category: "Execution" },
      { id: "cl-7-3", step: "Attach pulse oximeter on right wrist (pre-ductal SpO2 target)", maxMarks: 3, isCritical: false, category: "Patient Safety" },
      { id: "cl-7-4", step: "Apply MRSOPE corrective ventilation steps if no chest rise", maxMarks: 5, isCritical: true, category: "Execution" },
      { id: "cl-7-5", step: "Synchronized CPR (3:1 ratio, 90 compressions + 30 breaths/min)", maxMarks: 4, isCritical: true, category: "Execution" },
    ],
  },
  {
    id: "st-8",
    number: 8,
    title: "Breaking Bad News — SPIKES Protocol",
    department: "General Medicine & Oncology",
    domain: "Communication",
    durationMinutes: 8,
    totalMarks: 20,
    passMarks: 14,
    nmcCompetencyCode: "IM-2.8",
    room: "Communication Suite B",
    manikinEquipment: "Standardized Relative Actor (Biopsy Malignancy Scenario)",
    examiner: "Dr. Priya K., MD",
    status: "Active",
    checklistCount: 5,
    averageScore: 79.5,
    passRate: 85.0,
    criticalStepRequired: true,
    criticalStepDescription: "Deliver information in small digestible chunks without jargon, pausing to acknowledge emotions with empathy.",
    checklist: [
      { id: "cl-8-1", step: "Setting: private room, sit down, maintain comfort and offer tissues", maxMarks: 3, isCritical: false, category: "Preparation" },
      { id: "cl-8-2", step: "Perception: elicit what patient/relative already knows about condition", maxMarks: 3, isCritical: false, category: "Communication" },
      { id: "cl-8-3", step: "Invitation: obtain permission and ask how much detail is desired", maxMarks: 3, isCritical: false, category: "Communication" },
      { id: "cl-8-4", step: "Knowledge: deliver diagnosis clearly, avoid jargon, use warning shot", maxMarks: 5, isCritical: true, category: "Communication" },
      { id: "cl-8-5", step: "Empathy & Strategy: validate emotions (NURSE steps) and outline clear treatment roadmap", maxMarks: 6, isCritical: true, category: "Patient Safety" },
    ],
  },
];

const DEFAULT_SESSIONS: OsceSession[] = [
  {
    id: "sess-2026-01",
    title: "Final MBBS Phase 3 Part 2 — Clinical OSCE Circuit",
    batch: "MBBS 2022 (Final Year)",
    department: "Multidisciplinary Clinical Board",
    date: "2026-11-15",
    timeSlot: "08:30 AM - 01:30 PM",
    venue: "Central Clinical Skills Simulation Center - Block C",
    totalCandidates: 60,
    evaluatedCount: 0,
    stationsAssigned: 8,
    leadExaminer: "Prof. Dr. R. Sundararajan, MD (Gen Med)",
    status: "Scheduled",
  },
  {
    id: "sess-2026-02",
    title: "Phase 3 Part 1 Surgery & Trauma OSCE Mock",
    batch: "MBBS 2023 (Third Year)",
    department: "General Surgery & Emergency",
    date: "2026-10-28",
    timeSlot: "09:00 AM - 12:30 PM",
    venue: "Surgical Skills Pavilion - Floor 2",
    totalCandidates: 45,
    evaluatedCount: 32,
    stationsAssigned: 6,
    leadExaminer: "Dr. S. K. Narayanan, MS",
    status: "In Progress",
  },
  {
    id: "sess-2026-03",
    title: "Mid-Term Paediatrics & Neonatal Resuscitation OSCE",
    batch: "MBBS 2023 (Third Year)",
    department: "Pediatrics & Neonatology",
    date: "2026-09-18",
    timeSlot: "10:00 AM - 01:00 PM",
    venue: "Sim Suite 101 & 102",
    totalCandidates: 40,
    evaluatedCount: 40,
    stationsAssigned: 4,
    leadExaminer: "Dr. G. Sivakumar, MD",
    status: "Results Published",
  },
];

const DEFAULT_BOOKINGS: SkillsLabBooking[] = [
  {
    id: "book-101",
    applicantName: "Sneha Varma (MED22-019)",
    applicantRole: "Student",
    stationOrRoom: "Surgical Skills Cubicle 2",
    equipment: "Suture Pad & 3-0 Silk Instrument Kit",
    date: "2026-10-22",
    timeSlot: "14:00 - 15:30",
    purpose: "Independent Practice",
    status: "Approved",
    notes: "Practicing horizontal mattress suture and instrument knot tying for upcoming surgical posting.",
  },
  {
    id: "book-102",
    applicantName: "Dr. Priya Nair (PG Resident, Anaesthesia)",
    applicantRole: "Resident",
    stationOrRoom: "Sim Suite 101 - High Fidelity",
    equipment: "SimMan 3G Advanced Life Support Manikin",
    date: "2026-10-23",
    timeSlot: "10:00 - 12:00",
    purpose: "Faculty-Guided Demo",
    status: "Approved",
    notes: "Difficult airway intubation scenario & cricothyroidotomy training for junior interns.",
  },
  {
    id: "book-103",
    applicantName: "Arjun Reddy (MED22-054)",
    applicantRole: "Student",
    stationOrRoom: "Skills Cubicle 4 - Vascular Access",
    equipment: "Adult Multi-Vein IV Training Arm",
    date: "2026-10-24",
    timeSlot: "15:00 - 16:30",
    purpose: "Remediation Training",
    status: "Pending Review",
    notes: "Remedial cannulation practice requested after formative feedback.",
  },
  {
    id: "book-104",
    applicantName: "Kavya Krishnan (MED22-042)",
    applicantRole: "Student",
    stationOrRoom: "Birthing Simulation Suite 2",
    equipment: "PROMPT Flex Advanced Birthing Simulator",
    date: "2026-10-25",
    timeSlot: "11:00 - 12:30",
    purpose: "Independent Practice",
    status: "Pending Review",
    notes: "AMTSL maneuver and shoulder dystocia management practice.",
  },
];

const DEFAULT_RESULTS: StudentOsceResult[] = [
  {
    id: "res-1",
    rollNo: "MED22-001",
    studentName: "Aadhya Iyer",
    batch: "MBBS 2022",
    stationId: "st-1",
    stationName: "Basic Life Support (BLS) & CPR with AED",
    score: 19,
    total: 20,
    scorePercent: 95.0,
    grade: "Distinction",
    criticalStepMet: true,
    examiner: "Dr. A. Meenakshi, MD",
    date: "2026-09-18",
    evaluatorRemarks: "Flawless compression depth and timing. Prompt AED pad placement and safety clearance.",
    cbmeCertified: true,
  },
  {
    id: "res-2",
    rollNo: "MED22-005",
    studentName: "Bhuvaneshwaren R.",
    batch: "MBBS 2022",
    stationId: "st-2",
    stationName: "Intravenous (IV) Cannulation on Simulator Arm",
    score: 17,
    total: 20,
    scorePercent: 85.0,
    grade: "Pass",
    criticalStepMet: true,
    examiner: "Dr. R. Sundararajan, MD",
    date: "2026-09-18",
    evaluatorRemarks: "Good sterile technique. Flashback confirmed smoothly. Minor hesitation securing wings.",
    cbmeCertified: true,
  },
  {
    id: "res-3",
    rollNo: "MED22-014",
    studentName: "Divya Prakash",
    batch: "MBBS 2022",
    stationId: "st-4",
    stationName: "Surgical Suturing & Instrument Knot Tying",
    score: 11,
    total: 20,
    scorePercent: 55.0,
    grade: "Remediation Needed",
    criticalStepMet: false,
    examiner: "Dr. S. K. Narayanan, MS",
    date: "2026-09-18",
    evaluatorRemarks: "Tissue tension was excessively tight causing ischemia. Missed square throw. 2 hours skills lab remediation advised.",
    cbmeCertified: false,
  },
  {
    id: "res-4",
    rollNo: "MED22-022",
    studentName: "Farhan Ali",
    batch: "MBBS 2022",
    stationId: "st-3",
    stationName: "History Taking & Triage — Acute Chest Pain",
    score: 18,
    total: 20,
    scorePercent: 90.0,
    grade: "Distinction",
    criticalStepMet: true,
    examiner: "Dr. K. S. Balaji, MD",
    date: "2026-09-18",
    evaluatorRemarks: "Excellent empathetic communication. Elicited radiation to left shoulder quickly and requested urgent stat ECG.",
    cbmeCertified: true,
  },
  {
    id: "res-5",
    rollNo: "MED22-031",
    studentName: "Gokul Prasad",
    batch: "MBBS 2022",
    stationId: "st-5",
    stationName: "Normal Vaginal Delivery & AMTSL",
    score: 18,
    total: 20,
    scorePercent: 90.0,
    grade: "Distinction",
    criticalStepMet: true,
    examiner: "Dr. Jayanthi Raman, MD",
    date: "2026-09-18",
    evaluatorRemarks: "Clear AMTSL protocol execution. Administered 10 IU Oxytocin promptly. Perineum supported well.",
    cbmeCertified: true,
  },
  {
    id: "res-6",
    rollNo: "MED22-042",
    studentName: "Kavya Krishnan",
    batch: "MBBS 2022",
    stationId: "st-7",
    stationName: "Neonatal Resuscitation Protocol (NRP)",
    score: 19,
    total: 20,
    scorePercent: 95.0,
    grade: "Distinction",
    criticalStepMet: true,
    examiner: "Dr. G. Sivakumar, MD",
    date: "2026-09-18",
    evaluatorRemarks: "Outstanding MRSOPE execution when bag-mask showed poor seal. Immediate chest rise established.",
    cbmeCertified: true,
  },
];

const DEFAULT_EQUIPMENT: SkillsLabEquipment[] = [
  {
    id: "eq-1",
    name: "Laerdal SimMan 3G Advanced Life Support Simulator",
    serialNo: "LAER-3G-2023-882",
    category: "High Fidelity Patient Simulator",
    room: "Sim Suite 101",
    status: "Operational",
    lastInspection: "2026-10-01",
    nextMaintenance: "2027-01-10",
    utilizationHoursWeek: 28.5,
    nmcComplianceStatus: "Fully Compliant",
  },
  {
    id: "eq-2",
    name: "PROMPT Flex Advanced Birthing Simulator",
    serialNo: "LIMB-PF-2022-411",
    category: "Maternal & Birthing Simulator",
    room: "Birthing Sim Suite 2",
    status: "Operational",
    lastInspection: "2026-09-15",
    nextMaintenance: "2026-12-15",
    utilizationHoursWeek: 21.0,
    nmcComplianceStatus: "Fully Compliant",
  },
  {
    id: "eq-3",
    name: "LapSim Virtual Reality Laparoscopic Trainer",
    serialNo: "SURS-LAP-2024-109",
    category: "Minimally Invasive Surgical Simulator",
    room: "Surgical Skills Lab 1",
    status: "Operational",
    lastInspection: "2026-09-28",
    nextMaintenance: "2026-11-20",
    utilizationHoursWeek: 18.0,
    nmcComplianceStatus: "Fully Compliant",
  },
  {
    id: "eq-4",
    name: "NeoNatalie Suction & Bag-Mask Resuscitation Trainer",
    serialNo: "LAER-NN-2023-550",
    category: "Neonatal Simulation Trainer",
    room: "Neonatal Sim Cubicle",
    status: "Operational",
    lastInspection: "2026-10-05",
    nextMaintenance: "2027-01-05",
    utilizationHoursWeek: 16.5,
    nmcComplianceStatus: "Fully Compliant",
  },
  {
    id: "eq-5",
    name: "Adult Vascular Access & Cannulation Arm (Set of 4)",
    serialNo: "NASCO-IV-2021-901",
    category: "Procedural Task Trainer",
    room: "Skills Cubicle 4",
    status: "Calibration Due",
    lastInspection: "2026-08-10",
    nextMaintenance: "2026-10-30",
    utilizationHoursWeek: 34.0,
    nmcComplianceStatus: "Action Needed",
  },
];

const DEPARTMENTS_LIST = [
  "Emergency Medicine & Anaesthesia",
  "General Medicine",
  "General Surgery",
  "Obstetrics & Gynaecology",
  "Pediatrics & Neonatology",
  "Orthopaedics & Traumatology",
  "Ophthalmology & ENT",
];

interface OsceStoreState {
  stations: OsceStation[];
  sessions: OsceSession[];
  bookings: SkillsLabBooking[];
  results: StudentOsceResult[];
  equipment: SkillsLabEquipment[];
}

const storeByCollege = new Map<string, OsceStoreState>();

function getCollegeKey(session?: SessionPayload): string {
  return session?.college || "COL-1001";
}

function getStore(session?: SessionPayload): OsceStoreState {
  const key = getCollegeKey(session);
  let state = storeByCollege.get(key);
  if (!state) {
    state = {
      stations: JSON.parse(JSON.stringify(DEFAULT_STATIONS)),
      sessions: JSON.parse(JSON.stringify(DEFAULT_SESSIONS)),
      bookings: JSON.parse(JSON.stringify(DEFAULT_BOOKINGS)),
      results: JSON.parse(JSON.stringify(DEFAULT_RESULTS)),
      equipment: JSON.parse(JSON.stringify(DEFAULT_EQUIPMENT)),
    };
    storeByCollege.set(key, state);
  }
  return state;
}

export async function getOsceOverview(session?: SessionPayload): Promise<OsceOverview> {
  const state = getStore(session);

  const activeStations = state.stations.filter((s) => s.status === "Active").length;
  const upcomingSessions = state.sessions.filter((s) => s.status === "Scheduled" || s.status === "In Progress").length;
  const certifiedCompetencies = state.results.filter((r) => r.cbmeCertified).length;
  const passedCount = state.results.filter((r) => r.grade !== "Remediation Needed").length;
  const averagePassRate = state.results.length > 0 ? Math.round((passedCount / state.results.length) * 1000) / 10 : 88.5;
  const pendingBookings = state.bookings.filter((b) => b.status === "Pending Review").length;
  const highFidelitySimulators = state.equipment.filter((e) => e.category.includes("High Fidelity") || e.category.includes("Birthing")).length;

  return {
    kpis: {
      activeStations,
      skillsLabStations: state.stations.length,
      upcomingSessions,
      certifiedCompetencies,
      averagePassRate,
      pendingBookings,
      highFidelitySimulators,
      nmcSkillsNormMet: state.stations.length >= 6 && highFidelitySimulators >= 2,
    },
    stations: state.stations,
    sessions: state.sessions,
    bookings: state.bookings,
    results: state.results,
    equipment: state.equipment,
    departments: DEPARTMENTS_LIST,
  };
}

export async function createOsceStation(session: SessionPayload, input: CreateOsceStationInput): Promise<OsceStation> {
  const state = getStore(session);
  const nextNum = state.stations.length + 1;
  const newStation: OsceStation = {
    id: `st-${Date.now().toString(36)}`,
    number: nextNum,
    title: input.title,
    department: input.department,
    domain: input.domain,
    durationMinutes: input.durationMinutes,
    totalMarks: input.totalMarks,
    passMarks: input.passMarks,
    nmcCompetencyCode: input.nmcCompetencyCode,
    room: input.room,
    manikinEquipment: input.manikinEquipment,
    examiner: session.name || "Dr. S. Venkatesh (HOD)",
    status: "Active",
    checklistCount: input.checklist.length,
    averageScore: 80.0,
    passRate: 85.0,
    criticalStepRequired: input.criticalStepRequired,
    criticalStepDescription: input.criticalStepDescription,
    checklist: input.checklist.map((item, idx) => ({
      id: `cl-${nextNum}-${idx + 1}`,
      step: item.step,
      maxMarks: item.maxMarks,
      isCritical: item.isCritical,
      category: item.category,
    })),
  };
  state.stations.unshift(newStation);
  return newStation;
}

export async function createOsceSession(session: SessionPayload, input: CreateOsceSessionInput): Promise<OsceSession> {
  const state = getStore(session);
  const newSession: OsceSession = {
    id: `sess-${Date.now().toString(36)}`,
    title: input.title,
    batch: input.batch,
    department: input.department,
    date: input.date,
    timeSlot: input.timeSlot,
    venue: input.venue,
    totalCandidates: input.totalCandidates,
    evaluatedCount: 0,
    stationsAssigned: state.stations.filter((s) => s.status === "Active").length,
    leadExaminer: input.leadExaminer,
    status: "Scheduled",
  };
  state.sessions.unshift(newSession);
  return newSession;
}

export async function createSkillsLabBooking(session: SessionPayload, input: CreateSkillsLabBookingInput): Promise<SkillsLabBooking> {
  const state = getStore(session);
  const newBooking: SkillsLabBooking = {
    id: `book-${Date.now().toString(36)}`,
    applicantName: input.applicantName,
    applicantRole: input.applicantRole,
    stationOrRoom: input.stationOrRoom,
    equipment: input.equipment,
    date: input.date,
    timeSlot: input.timeSlot,
    purpose: input.purpose,
    status: "Pending Review",
    notes: input.notes || "",
  };
  state.bookings.unshift(newBooking);
  return newBooking;
}

export async function updateBookingStatus(session: SessionPayload, bookingId: string, input: UpdateBookingStatusInput): Promise<SkillsLabBooking> {
  const state = getStore(session);
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }
  booking.status = input.status;
  return booking;
}

export async function gradeStudentOsce(session: SessionPayload, input: GradeStudentOsceInput): Promise<StudentOsceResult> {
  const state = getStore(session);
  const station = state.stations.find((s) => s.id === input.stationId);
  const total = station ? station.totalMarks : 20;
  const scorePercent = Math.round((input.score / total) * 1000) / 10;

  let grade: "Distinction" | "Pass" | "Remediation Needed" = "Pass";
  if (scorePercent >= 85 && input.criticalStepMet) {
    grade = "Distinction";
  } else if (scorePercent < 60 || !input.criticalStepMet) {
    grade = "Remediation Needed";
  }

  const newResult: StudentOsceResult = {
    id: `res-${Date.now().toString(36)}`,
    rollNo: input.rollNo,
    studentName: input.studentName,
    batch: input.batch,
    stationId: input.stationId,
    stationName: station ? station.title : "OSCE Clinical Station",
    score: input.score,
    total,
    scorePercent,
    grade,
    criticalStepMet: input.criticalStepMet,
    examiner: session.name || "Examiner Faculty",
    date: new Date().toISOString().split("T")[0] || "2026-10-20",
    evaluatorRemarks: input.evaluatorRemarks,
    cbmeCertified: input.cbmeCertified,
  };
  state.results.unshift(newResult);
  return newResult;
}

export async function toggleStationStatus(session: SessionPayload, stationId: string): Promise<OsceStation> {
  const state = getStore(session);
  const station = state.stations.find((s) => s.id === stationId);
  if (!station) {
    throw new Error(`Station ${stationId} not found`);
  }
  station.status = station.status === "Active" ? "Maintenance" : "Active";
  return station;
}
