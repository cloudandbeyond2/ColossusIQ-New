/*
 * Academic streams. A college's *type* maps to a stream, and the stream decides which departments,
 * programmes, entrance exam, academic terms, regulator and stream-only modules apply.
 */

export const STREAMS = ["engineering", "medical", "artsScience", "management", "polytechnic"] as const;
export type Stream = (typeof STREAMS)[number];

/** College types the university can register, and the stream each one follows. */
export const COLLEGE_TYPE_STREAM = {
  Engineering: "engineering",
  "Medical College & Hospital": "medical",
  "Dental College": "medical",
  "Nursing & Allied Health Sciences": "medical",
  "Arts & Science": "artsScience",
  Management: "management",
  Polytechnic: "polytechnic",
} as const satisfies Record<string, Stream>;

export type CollegeType = keyof typeof COLLEGE_TYPE_STREAM;
export const COLLEGE_TYPES = Object.keys(COLLEGE_TYPE_STREAM) as CollegeType[];

export function streamOfType(type: unknown): Stream {
  const raw = String(type ?? "").trim();
  if (raw in COLLEGE_TYPE_STREAM) {
    const s = COLLEGE_TYPE_STREAM[raw as CollegeType];
    if (s) return s;
  }
  const lower = raw.toLowerCase();
  if (lower.includes("art") || (lower.includes("science") && !lower.includes("tech") && !lower.includes("engineer"))) {
    return "artsScience";
  }
  if (lower.includes("medic") || lower.includes("dental") || lower.includes("nurs") || lower.includes("health") || lower.includes("pharm")) {
    return "medical";
  }
  if (lower.includes("manage") || lower.includes("business") || lower.includes("mba")) {
    return "management";
  }
  if (lower.includes("polytechnic") || lower.includes("diploma")) {
    return "polytechnic";
  }
  return "engineering";
}

export interface StreamDef {
  key: Stream;
  label: string;
  icon: string;
  regulator: string;
  /** Name of the academic term used in this stream. */
  termLabel: string;
  terms: readonly string[];
  departments: readonly string[];
  programs: readonly string[];
  entrance: { label: string; max: number };
  designations: readonly string[];
}

const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

export const STREAM_DEFS: Record<Stream, StreamDef> = {
  engineering: {
    key: "engineering",
    label: "Engineering & Technology",
    icon: "microchip",
    regulator: "AICTE · Anna University regulations",
    termLabel: "Semester",
    terms: SEMESTERS,
    departments: [
      "Computer Science & Engineering",
      "Information Technology",
      "Artificial Intelligence & Data Science",
      "Electronics & Communication",
      "Electrical & Electronics",
      "Mechanical Engineering",
      "Civil Engineering",
      "Science & Humanities",
      "Administration",
    ],
    programs: [
      "B.E. Computer Science & Engineering",
      "B.Tech Information Technology",
      "B.Tech AI & Data Science",
      "B.E. Electronics & Communication",
      "B.E. Electrical & Electronics",
      "B.E. Mechanical Engineering",
      "B.E. Civil Engineering",
      "M.E. Computer Science",
    ],
    entrance: { label: "TNEA counselling cut-off (out of 200)", max: 200 },
    designations: ["Professor", "Associate Professor", "Assistant Professor", "Lab Instructor"],
  },
  medical: {
    key: "medical",
    label: "Medical & Health Sciences",
    icon: "stethoscope",
    regulator: "NMC · DCI · INC · PCI (CBME curriculum)",
    termLabel: "Phase",
    terms: ["Phase I", "Phase II", "Phase III Part 1", "Phase III Part 2", "Internship (CRMI)", "Year 1", "Year 2", "Year 3", "Year 4"],
    departments: [
      "Anatomy",
      "Physiology",
      "Biochemistry",
      "Pathology",
      "Pharmacology",
      "Microbiology",
      "Forensic Medicine",
      "Community Medicine",
      "General Medicine",
      "General Surgery",
      "Obstetrics & Gynaecology",
      "Paediatrics",
      "Orthopaedics",
      "Anaesthesiology",
      "Radiodiagnosis",
      "Dermatology, Venereology & Leprosy",
      "Psychiatry",
      "Ophthalmology",
      "Otorhinolaryngology (ENT)",
      "Emergency Medicine",
      "Respiratory Medicine",
      "Nursing",
      "Physiotherapy",
      "Pharmacy",
      "Hospital Administration",
    ],
    programs: [
      "MBBS",
      "BDS",
      "B.Sc Nursing",
      "Bachelor of Physiotherapy (BPT)",
      "B.Pharm",
      "B.Sc Medical Laboratory Technology",
      "MD General Medicine",
      "MS General Surgery",
    ],
    entrance: { label: "NEET score (out of 720)", max: 720 },
    designations: ["Professor", "Associate Professor", "Assistant Professor", "Senior Resident", "Junior Resident", "Tutor / Demonstrator", "Nursing Tutor", "Staff Nurse"],
  },
  artsScience: {
    key: "artsScience",
    label: "Arts & Science",
    icon: "book-open-cover",
    regulator: "UGC · CBCS · NAAC",
    termLabel: "Semester",
    terms: ["1", "2", "3", "4", "5", "6"],
    departments: [
      "Tamil",
      "English",
      "History",
      "Economics",
      "Commerce",
      "Mathematics",
      "Physics",
      "Chemistry",
      "Botany",
      "Zoology",
      "Computer Science",
      "Business Administration",
      "Administration",
    ],
    programs: [
      "B.A. Tamil",
      "B.A. English",
      "B.A. History",
      "B.A. Economics",
      "B.Sc. Mathematics",
      "B.Sc. Physics",
      "B.Sc. Chemistry",
      "B.Sc. Botany",
      "B.Sc. Zoology",
      "B.Sc. Computer Science",
      "B.Com",
      "BCA",
      "BBA",
      "M.A. English",
      "M.Sc. Chemistry",
      "M.Com",
    ],
    entrance: { label: "Qualifying exam merit score (out of 100)", max: 100 },
    designations: ["Professor", "Associate Professor", "Assistant Professor", "Guest Lecturer"],
  },
  management: {
    key: "management",
    label: "Management",
    icon: "briefcase",
    regulator: "AICTE · NBA",
    termLabel: "Trimester",
    terms: ["1", "2", "3", "4", "5", "6"],
    departments: ["Marketing", "Finance", "Human Resources", "Operations", "Business Analytics", "Administration"],
    programs: ["MBA", "MBA Business Analytics", "BBA", "PGDM"],
    entrance: { label: "TANCET / CAT percentile (out of 100)", max: 100 },
    designations: ["Professor", "Associate Professor", "Assistant Professor", "Industry Fellow"],
  },
  polytechnic: {
    key: "polytechnic",
    label: "Polytechnic (Diploma)",
    icon: "settings",
    regulator: "DOTE · AICTE",
    termLabel: "Semester",
    terms: ["1", "2", "3", "4", "5", "6"],
    departments: ["Mechanical Engineering", "Electrical & Electronics", "Civil Engineering", "Computer Engineering", "Administration"],
    programs: ["Diploma in Mechanical Engineering", "Diploma in Electrical & Electronics", "Diploma in Civil Engineering", "Diploma in Computer Engineering"],
    entrance: { label: "10th marks merit score (out of 100)", max: 100 },
    designations: ["Head of Section", "Lecturer", "Lab Instructor", "Workshop Instructor"],
  },
};

/** Designations common to every stream (non-teaching staff). */
export const COMMON_DESIGNATIONS = ["Librarian", "Administrative Officer", "Accountant", "Technician", "Office Assistant"] as const;

const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));
export const ALL_DEPARTMENTS = uniq(STREAMS.flatMap((s) => [...STREAM_DEFS[s].departments]));
export const ALL_PROGRAMS = uniq(STREAMS.flatMap((s) => [...STREAM_DEFS[s].programs]));
export const ALL_TERMS = uniq(STREAMS.flatMap((s) => [...STREAM_DEFS[s].terms]));
export const ALL_DESIGNATIONS = uniq([...STREAMS.flatMap((s) => [...STREAM_DEFS[s].designations]), ...COMMON_DESIGNATIONS]);

/** Stream-specific option lists for fields that depend on the college's stream. */
export function streamOptions(field: "department" | "program" | "semester" | "designation", stream: Stream): readonly string[] {
  const d = STREAM_DEFS[stream];
  switch (field) {
    case "department":
      return d.departments;
    case "program":
      return d.programs;
    case "semester":
      return d.terms;
    case "designation":
      return [...d.designations, ...COMMON_DESIGNATIONS];
  }
}

/** Map of degree designations to their associated academic streams. */
export const DEGREE_STREAM: Record<string, Stream[]> = {
  "B.E.": ["engineering"],
  "B.TECH.": ["engineering"],
  "B.TECH": ["engineering"],
  "M.E.": ["engineering"],
  "M.TECH.": ["engineering"],
  "M.TECH": ["engineering"],

  "B.SC.": ["artsScience"],
  "B.SC": ["artsScience"],
  "M.SC.": ["artsScience"],
  "M.SC": ["artsScience"],
  "B.COM.": ["artsScience"],
  "B.COM": ["artsScience"],
  "M.COM.": ["artsScience"],
  "M.COM": ["artsScience"],
  "B.A.": ["artsScience"],
  "B.A": ["artsScience"],
  "M.A.": ["artsScience"],
  "M.A": ["artsScience"],
  "BCA": ["artsScience"],
  "MCA": ["artsScience"],
  "BBA": ["artsScience", "management"],

  "MBA": ["management"],
  "PGDM": ["management"],

  "MBBS": ["medical"],
  "M.B.B.S.": ["medical"],
  "M.B.B.S": ["medical"],
  "BDS": ["medical"],
  "B.SC. NURSING": ["medical"],
  "B.SC NURSING": ["medical"],
  "B.PHARM.": ["medical"],
  "B.PHARM": ["medical"],
  "BPT": ["medical"],
  "MD": ["medical"],
  "MS": ["medical"],

  "DIPLOMA": ["polytechnic"],
};

/** Whether a programme or degree matches the college's academic stream. */
export function streamMatchesCurriculum(stream: Stream, programme: string, degree?: string): boolean {
  const norm = (s: string) => s.trim().toUpperCase();
  const d = degree ? norm(degree) : "";
  const dClean = d.replace(/\./g, "");
  if (d && (DEGREE_STREAM[d] || DEGREE_STREAM[dClean])) {
    return (DEGREE_STREAM[d] || DEGREE_STREAM[dClean])!.includes(stream);
  }
  const progUpper = norm(programme);
  const progClean = progUpper.replace(/\./g, "");
  for (const [degKey, streams] of Object.entries(DEGREE_STREAM)) {
    const degClean = degKey.replace(/\./g, "");
    if (progUpper.startsWith(degKey) || progClean.startsWith(degClean)) {
      return streams.includes(stream);
    }
  }
  const def = STREAM_DEFS[stream];
  if (def && def.programs.some((p) => norm(p) === progUpper || progUpper.includes(norm(p)) || progClean.includes(norm(p).replace(/\./g, "")))) {
    return true;
  }
  return false;
}
